const apiConfig = require("../config/api");
const {
  toNumber,
  isValidNumber,
  formatChange,
  formatPercent,
  formatUpdatedParts,
  directionOf,
} = require("../utils/format");
const { isRegularSessionOpen } = require("../utils/market");

const VIX_NAME = "VIX 恐慌指数";
const VIX_SYMBOL = "^VIX";
/** 色阶条量程上限（UI §6 / §12：0–50；真实值可 >50，标记贴右端） */
const VIX_GAUGE_MAX = 50;

/**
 * 恐慌分区（对齐 UI §6）
 * 0–15 低恐慌 #0ECB81 · 15–25 中等 #F0B90B · 25–35 高恐慌 #F0A030 · ≥35 极端 #F6465D
 * 分段宽度比例 15:10:10:15
 */
const VIX_ZONES = [
  { min: 0, max: 15, key: "low", label: "低恐慌", color: "#0ECB81" },
  { min: 15, max: 25, key: "mid", label: "中等", color: "#F0B90B" },
  { min: 25, max: 35, key: "high", label: "高恐慌", color: "#F0A030" },
  { min: 35, max: VIX_GAUGE_MAX, key: "extreme", label: "极端", color: "#F6465D" },
];

/** if (v < 15) low; else if (v < 25) mid; else if (v < 35) high; else extreme */
function zoneOf(value) {
  const n = Math.max(0, toNumber(value, 0));
  if (n < 15) return VIX_ZONES[0];
  if (n < 25) return VIX_ZONES[1];
  if (n < 35) return VIX_ZONES[2];
  return VIX_ZONES[3];
}

function formatVixValue(value) {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n)) return "--";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeVix(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("VIX 数据为空");
  }

  const valueRaw =
    raw.value ?? raw.price ?? raw.close ?? raw.last ?? raw.vix ?? raw.vixValue;
  if (!isValidNumber(valueRaw)) {
    throw new Error("VIX 数值无效");
  }

  const value = toNumber(valueRaw);
  const change = toNumber(raw.change ?? raw.chg ?? raw.delta, 0);
  const changePercent = toNumber(
    raw.changePercent ?? raw.chgPct ?? raw.percent ?? raw.change_percent,
    0
  );
  const updatedAt =
    raw.updatedAt || raw.updated_at || raw.time || new Date().toISOString();
  const zone = zoneOf(value);
  const clamped = Math.min(Math.max(value, 0), VIX_GAUGE_MAX);
  const markerRatio = clamped / VIX_GAUGE_MAX;
  const timeParts = formatUpdatedParts(updatedAt);

  return {
    name: raw.name || VIX_NAME,
    symbol: raw.symbol || VIX_SYMBOL,
    value,
    change,
    changePercent,
    updatedAt,
    valueText: formatVixValue(value),
    changeText: formatChange(change),
    changePercentText: formatPercent(changePercent),
    updatedAtText: timeParts.updatedAtText,
    direction: directionOf(change),
    zoneKey: zone.key,
    zoneLabel: zone.label,
    zoneColor: zone.color,
    markerRatio,
    needleRatio: markerRatio,
    gaugeMax: VIX_GAUGE_MAX,
    zones: VIX_ZONES,
    available: true,
    source: raw.source || "unknown",
  };
}

function fetchMockVix() {
  const open = isRegularSessionOpen();
  const base = open ? 17.8 + (Math.random() - 0.5) * 3.2 : 18.42;
  const previousClose = 19.27;
  const value = Math.round(base * 100) / 100;
  const change = Math.round((value - previousClose) * 100) / 100;
  const changePercent =
    previousClose !== 0
      ? Math.round((change / previousClose) * 10000) / 100
      : 0;

  return Promise.resolve(
    normalizeVix({
      name: VIX_NAME,
      symbol: VIX_SYMBOL,
      value,
      change,
      changePercent,
      updatedAt: new Date().toISOString(),
      source: "mock",
    })
  );
}

function requestHttpVix() {
  const url = apiConfig.vixHttpUrl;
  if (!url || url.indexOf("your-api.example.com") !== -1) {
    return Promise.reject(new Error("请先在 config/api.js 配置真实 vixHttpUrl"));
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
            const nested = payload.vix && typeof payload.vix === "object"
              ? payload.vix
              : payload;
            resolve(normalizeVix({ ...nested, source: "http" }));
          } catch (err) {
            reject(err);
          }
          return;
        }
        reject(new Error(`VIX 接口异常（HTTP ${res.statusCode}）`));
      },
      fail(err) {
        reject(new Error(err.errMsg || "VIX 网络请求失败"));
      },
    });
  });
}

function resolveVixMode() {
  if (apiConfig.vixMode === "mock" || apiConfig.vixMode === "http") {
    return apiConfig.vixMode;
  }
  return apiConfig.mode || "mock";
}

function fetchVixQuote() {
  if (resolveVixMode() === "http") {
    return requestHttpVix();
  }
  return fetchMockVix();
}

module.exports = {
  fetchVixQuote,
  normalizeVix,
  zoneOf,
  VIX_ZONES,
  VIX_GAUGE_MAX,
  VIX_NAME,
  VIX_SYMBOL,
};
