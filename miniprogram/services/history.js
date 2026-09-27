const apiConfig = require("../config/api");
const { toNumber, formatPercent, formatChange, directionOf } = require("../utils/format");

/**
 * 近约 10 年日线序列（默认全窗；组件内可滑动选区间）
 *
 * HTTP 期望 JSON：
 * {
 *   "symbol": "^IXIC",
 *   "range": "10Y",
 *   "resolution": "1d",
 *   "points": [{ "t": "2016-09-27T20:00:00.000Z", "c": 5312.00 }, ...]
 * }
 * 或 points 为 [timestampMs, close] 二元组。
 */

const DEFAULT_RANGE = "10Y";
/** 约 10 个自然年的交易日（跳过周末，~261/年） */
const YEARS = 10;
const TRADING_DAYS = Math.round(YEARS * 365.25 * 5 / 7);

function normalizePoint(raw) {
  if (Array.isArray(raw) && raw.length >= 2) {
    const t = raw[0];
    const c = toNumber(raw[1], NaN);
    if (!Number.isFinite(c)) return null;
    const iso =
      typeof t === "number"
        ? new Date(t).toISOString()
        : new Date(t).toISOString();
    return { t: iso, c };
  }
  if (!raw || typeof raw !== "object") return null;
  const c = toNumber(raw.c ?? raw.close ?? raw.price ?? raw.v, NaN);
  if (!Number.isFinite(c)) return null;
  const tRaw = raw.t ?? raw.time ?? raw.date ?? raw.timestamp;
  const iso = tRaw
    ? new Date(typeof tRaw === "number" ? tRaw : tRaw).toISOString()
    : new Date().toISOString();
  return { t: iso, c };
}

function summarizeSeries(points) {
  if (!points.length) {
    return {
      points: [],
      first: null,
      last: null,
      change: 0,
      changePercent: 0,
      changeText: "--",
      changePercentText: "--",
      direction: "flat",
      high: null,
      low: null,
    };
  }
  const first = points[0].c;
  const last = points[points.length - 1].c;
  const change = last - first;
  const changePercent = first !== 0 ? (change / first) * 100 : 0;
  let high = points[0].c;
  let low = points[0].c;
  points.forEach((p) => {
    if (p.c > high) high = p.c;
    if (p.c < low) low = p.c;
  });
  return {
    points,
    first,
    last,
    change,
    changePercent,
    changeText: formatChange(change),
    changePercentText: formatPercent(changePercent),
    direction: directionOf(change),
    high,
    low,
  };
}

function sliceAndSummarize(points, startIndex, endIndex) {
  if (!points || !points.length) return summarizeSeries([]);
  const last = points.length - 1;
  let s = Math.max(0, Math.min(last, Math.floor(startIndex)));
  let e = Math.max(0, Math.min(last, Math.floor(endIndex)));
  if (e < s) {
    const tmp = s;
    s = e;
    e = tmp;
  }
  if (e === s && last > 0) {
    if (e < last) e += 1;
    else if (s > 0) s -= 1;
  }
  return summarizeSeries(points.slice(s, e + 1));
}

function normalizeHistory(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("历史数据为空");
  }
  const list = raw.points || raw.series || raw.data || raw.candles || [];
  if (!Array.isArray(list) || !list.length) {
    throw new Error("历史点位无效");
  }
  const points = list.map(normalizePoint).filter(Boolean);
  if (!points.length) {
    throw new Error("历史点位无效");
  }
  const summary = summarizeSeries(points);
  return {
    symbol: raw.symbol || "^IXIC",
    range: raw.range || DEFAULT_RANGE,
    resolution: raw.resolution || "1d",
    source: raw.source || "unknown",
    ...summary,
  };
}

/** 回溯交易日日期（UTC），跳过周末 */
function collectTradingDates(count, endMs) {
  const dates = [];
  let cursor = new Date(endMs);
  while (dates.length < count) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    const d = cursor.getUTCDay();
    if (d === 0 || d === 6) continue;
    dates.unshift(new Date(cursor));
  }
  return dates;
}

/**
 * 约 10 年日线 mock（~2520 个交易日），收于当前点位附近。
 * 轨迹：长期上飘 + 多周期波动，模拟纳指风格涨跌。
 */
function fetchMockHistory(anchorPrice) {
  const end = Number.isFinite(Number(anchorPrice))
    ? Number(anchorPrice)
    : 17823.45;
  const days = TRADING_DAYS;
  const dates = collectTradingDates(days, Date.now());
  const startPrice = end * 0.32;
  const points = [];
  let price = startPrice;

  for (let i = 0; i < days; i += 1) {
    const progress = i / (days - 1);
    const drift = (end - startPrice) * (0.00035 + progress * 0.00015);
    const wave =
      Math.sin(i * 0.045) * end * 0.012 +
      Math.sin(i * 0.011) * end * 0.028 +
      Math.sin(i * 0.0035) * end * 0.045;
    const noise =
      (Math.sin(i * 1.7 + 0.4) + Math.cos(i * 0.9 + 1.2)) * end * 0.0018;
    // 偶发回撤
    const shock =
      i % 317 === 0 && i > 0 ? -end * 0.04 : i % 503 === 0 ? end * 0.025 : 0;
    price = Math.max(end * 0.18, price + drift + wave * 0.002 + noise + shock);
    if (i === days - 1) price = end;
    points.push({
      t: new Date(
        Date.UTC(
          dates[i].getUTCFullYear(),
          dates[i].getUTCMonth(),
          dates[i].getUTCDate(),
          20,
          0,
          0
        )
      ).toISOString(),
      c: Math.round(price * 100) / 100,
    });
  }

  return Promise.resolve(
    normalizeHistory({
      symbol: "^IXIC",
      range: DEFAULT_RANGE,
      resolution: "1d",
      points,
      source: "mock",
    })
  );
}

function requestHttpHistory() {
  const url = apiConfig.historyHttpUrl;
  if (!url || url.indexOf("your-api.example.com") !== -1) {
    return Promise.reject(new Error("请先在 config/api.js 配置 historyHttpUrl"));
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: "GET",
      timeout: apiConfig.timeoutMs || 8000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
          try {
            const payload = res.data.data || res.data;
            resolve(normalizeHistory({ ...payload, source: "http" }));
          } catch (err) {
            reject(err);
          }
          return;
        }
        reject(new Error(`历史接口异常（HTTP ${res.statusCode}）`));
      },
      fail(err) {
        reject(new Error(err.errMsg || "历史数据网络请求失败"));
      },
    });
  });
}

function resolveHistoryMode() {
  if (apiConfig.historyMode === "mock" || apiConfig.historyMode === "http") {
    return apiConfig.historyMode;
  }
  return apiConfig.mode || "mock";
}

/** 拉取近约 10 年历史（默认 mock / 可配置 http） */
function fetchHistory(anchorPrice) {
  if (resolveHistoryMode() === "http") {
    return requestHttpHistory();
  }
  return fetchMockHistory(anchorPrice);
}

/** @deprecated 使用 fetchHistory */
function fetchMonthHistory(anchorPrice) {
  return fetchHistory(anchorPrice);
}

module.exports = {
  fetchHistory,
  fetchMonthHistory,
  normalizeHistory,
  summarizeSeries,
  sliceAndSummarize,
  DEFAULT_RANGE,
};
