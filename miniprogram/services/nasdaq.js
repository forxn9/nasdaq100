const apiConfig = require("../config/api");
const {
  toNumber,
  isValidNumber,
  formatPrice,
  formatChange,
  formatPercent,
  formatUpdatedParts,
  directionOf,
} = require("../utils/format");
const {
  resolveMarketStatus,
  marketStatusLabel,
  isRegularSessionOpen,
} = require("../utils/market");

const INDEX_NAME = "纳斯达克综合指数";
const INDEX_EN_NAME = "NASDAQ Composite";
const INDEX_SYMBOL = "^IXIC";

function normalizeQuote(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("行情数据为空");
  }

  if (!isValidNumber(raw.price ?? raw.close ?? raw.last)) {
    throw new Error("点位数据无效");
  }

  const price = toNumber(raw.price ?? raw.close ?? raw.last);
  const change = toNumber(raw.change ?? raw.chg ?? raw.delta, 0);
  const changePercent = toNumber(
    raw.changePercent ?? raw.chgPct ?? raw.percent ?? raw.change_percent,
    0
  );
  const updatedAt =
    raw.updatedAt || raw.updated_at || raw.time || new Date().toISOString();
  const marketStatus = resolveMarketStatus(
    raw.marketStatus || raw.market_status || raw.status
  );
  const direction = directionOf(change);
  const timeParts = formatUpdatedParts(updatedAt);

  return {
    name: raw.name || INDEX_NAME,
    enName: raw.enName || raw.en_name || INDEX_EN_NAME,
    symbol: raw.symbol || INDEX_SYMBOL,
    subtitle: `${raw.enName || raw.en_name || INDEX_EN_NAME}  ·  ${raw.symbol || INDEX_SYMBOL}`,
    price,
    change,
    changePercent,
    updatedAt,
    marketStatus,
    marketStatusText: marketStatusLabel(marketStatus),
    priceText: formatPrice(price),
    changeText: formatChange(change),
    changePercentText: formatPercent(changePercent),
    updatedAtText: timeParts.updatedAtText,
    timezoneHint: timeParts.timezoneHint,
    direction,
    source: raw.source || "unknown",
  };
}

function lastRegularCloseIso() {
  const now = new Date();
  for (let i = 0; i < 8; i += 1) {
    const probe = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const utcDay = probe.getUTCDay();
    if (utcDay === 0 || utcDay === 6) continue;
    // 美东约 16:00：夏令时 UTC 20:00 / 冬令时 UTC 21:00，取 20:00 作演示时间戳
    const close = new Date(Date.UTC(
      probe.getUTCFullYear(),
      probe.getUTCMonth(),
      probe.getUTCDate(),
      20,
      0,
      0
    ));
    if (i === 0 && isRegularSessionOpen(now)) continue;
    return close.toISOString();
  }
  return now.toISOString();
}

/** mock：开盘轻微波动；休市固定收盘价，避免假实时跳动 */
function fetchMockQuote() {
  const open = isRegularSessionOpen();
  const previousClose = 17740.18;
  const priorClose = 17695.4;

  let price;
  let change;
  let changePercent;
  let updatedAt;

  if (open) {
    const jitter = (Math.random() - 0.45) * 60;
    price = 17820.5 + jitter;
    change = price - previousClose;
    changePercent = (change / previousClose) * 100;
    updatedAt = new Date().toISOString();
  } else {
    price = previousClose;
    change = previousClose - priorClose;
    changePercent = (change / priorClose) * 100;
    updatedAt = lastRegularCloseIso();
  }

  return Promise.resolve(
    normalizeQuote({
      name: INDEX_NAME,
      enName: INDEX_EN_NAME,
      symbol: INDEX_SYMBOL,
      price,
      change,
      changePercent,
      updatedAt,
      marketStatus: open ? "open" : "closed",
      source: "mock",
    })
  );
}

function requestHttpQuote() {
  const url = apiConfig.httpUrl;
  if (!url || url.indexOf("your-api.example.com") !== -1) {
    return Promise.reject(new Error("请先在 config/api.js 配置真实 httpUrl"));
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
            resolve(normalizeQuote({ ...payload, source: "http" }));
          } catch (err) {
            reject(err);
          }
          return;
        }
        reject(new Error(`接口异常（HTTP ${res.statusCode}）`));
      },
      fail(err) {
        reject(new Error(err.errMsg || "网络请求失败"));
      },
    });
  });
}

function fetchNasdaqQuote() {
  const mode = apiConfig.mode || "mock";
  if (mode === "http") {
    return requestHttpQuote().then((quote) => ({
      ...quote,
      isFallback: false,
      errorMessage: "",
    }));
  }
  return fetchMockQuote().then((quote) => ({
    ...quote,
    isFallback: false,
    errorMessage: "",
  }));
}

module.exports = {
  fetchNasdaqQuote,
  normalizeQuote,
  INDEX_NAME,
  INDEX_EN_NAME,
  INDEX_SYMBOL,
};
