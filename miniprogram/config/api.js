/**
 * 数据源配置（纳指 + VIX）
 *
 * 默认：`mock` —— 本地模拟数据，无需域名白名单，适合本地预览
 * 接入真实数据：将 mode 改为 `http`，填写后端/代理接口地址，
 * 并在微信公众平台配置 request 合法域名。
 *
 * 纳指接口期望 JSON：
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
 * VIX 接口期望 JSON：
 * {
 *   "symbol": "^VIX",
 *   "value": 18.42,
 *   "change": -0.85,
 *   "changePercent": -4.41,
 *   "updatedAt": "2026-09-27T20:00:00.000Z"
 * }
 *
 * 也可在同一接口返回 `vix` / `vixValue` 字段，由 services/vix.js 归一化。
 */
module.exports = {
  // 纳指
  mode: "mock", // "mock" | "http"
  httpUrl: "https://your-api.example.com/nasdaq/quote",

  // VIX 恐慌指数（可与纳指共用 mode，也可单独覆盖）
  vixMode: "mock", // "mock" | "http"（留空则跟随 mode）
  vixHttpUrl: "https://your-api.example.com/vix/quote",

  timeoutMs: 8000,
  // 交易中自动刷新间隔（PRD：20 秒）
  refreshIntervalMs: 20 * 1000,
};
