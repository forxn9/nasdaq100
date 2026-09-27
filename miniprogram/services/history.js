const apiConfig = require("../config/api");
const { toNumber, formatPercent, directionOf } = require("../utils/format");

/**
 * 近一月日线序列（Binance 详情页主图）
 *
 * HTTP 期望 JSON：
 * {
 *   "symbol": "^IXIC",
 *   "range": "1M",
 *   "points": [{ "t": "2026-08-27T20:00:00.000Z", "c": 17120.12 }, ...]
 * }
 * 或 points 为 [timestampMs, close] 二元组。
 */

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
    changePercentText: formatPercent(changePercent),
    direction: directionOf(change),
    high,
    low,
  };
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
    range: raw.range || "1M",
    source: raw.source || "unknown",
    ...summary,
  };
}

/** 约 22 个交易日的 mock 日线，收于当前点位附近 */
function fetchMockHistory(anchorPrice) {
  const end = Number.isFinite(Number(anchorPrice))
    ? Number(anchorPrice)
    : 17823.45;
  const days = 22;
  const points = [];
  let price = end * 0.965;
  const now = Date.now();
  // 回溯约 30 自然日，跳过周末
  let cursor = new Date(now);
  const dates = [];
  while (dates.length < days) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    const d = cursor.getUTCDay();
    if (d === 0 || d === 6) continue;
    dates.unshift(new Date(cursor));
  }

  for (let i = 0; i < days; i += 1) {
    const progress = i / (days - 1);
    const drift = (end - price) * (0.08 + progress * 0.12);
    const wave = Math.sin(i * 0.7) * end * 0.006;
    const noise = (Math.sin(i * 2.3 + 1.1) + Math.cos(i * 1.1)) * end * 0.002;
    price = Math.max(end * 0.92, price + drift + wave + noise);
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
      range: "1M",
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

function fetchMonthHistory(anchorPrice) {
  if (resolveHistoryMode() === "http") {
    return requestHttpHistory();
  }
  return fetchMockHistory(anchorPrice);
}

module.exports = {
  fetchMonthHistory,
  normalizeHistory,
  summarizeSeries,
};
