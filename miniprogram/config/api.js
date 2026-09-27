/**
 * 数据源配置（纳指报价 + 近一月历史 + VIX）
 *
 * 默认：`mock` —— 本地模拟，无需域名白名单
 * 接入真实数据：将对应 mode 改为 `http`，填写接口地址，
 * 并在微信公众平台配置 request 合法域名。
 *
 * 纳指报价 JSON：
 * {
 *   "name": "纳斯达克综合指数",
 *   "symbol": "^IXIC",
 *   "price": 17823.45,
 *   "change": 125.32,
 *   "changePercent": 0.71,
 *   "updatedAt": "2026-09-27T20:00:00.000Z",
 *   "marketStatus": "open" | "closed"
 * }
 *
 * 近一月历史 JSON：
 * {
 *   "symbol": "^IXIC",
 *   "range": "1M",
 *   "points": [{ "t": "2026-08-27T20:00:00.000Z", "c": 17120.12 }, ...]
 * }
 *
 * VIX JSON：
 * {
 *   "symbol": "^VIX",
 *   "value": 18.42,
 *   "change": -0.85,
 *   "changePercent": -4.41,
 *   "updatedAt": "2026-09-27T20:00:00.000Z"
 * }
 */
module.exports = {
  // 纳指实时
  mode: "mock", // "mock" | "http"
  httpUrl: "https://your-api.example.com/nasdaq/quote",

  // 近一月走势（留空 mode 则跟随 mode）
  historyMode: "mock", // "mock" | "http"
  historyHttpUrl: "https://your-api.example.com/nasdaq/history?range=1M",

  // VIX 恐慌指数
  vixMode: "mock", // "mock" | "http"
  vixHttpUrl: "https://your-api.example.com/vix/quote",

  timeoutMs: 8000,
  refreshIntervalMs: 20 * 1000,
};
