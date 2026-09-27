/**
 * 纳指数据源配置
 *
 * 默认：`mock` —— 本地模拟数据，无需域名白名单，适合本地预览
 * 接入真实数据：将 mode 改为 `http`，填写你的后端/代理接口地址，
 * 并在微信公众平台配置 request 合法域名。
 *
 * 期望接口返回 JSON（字段可按 services/nasdaq.js 中 normalizeQuote 调整）：
 * {
 *   "name": "纳斯达克综合指数",
 *   "symbol": "^IXIC",
 *   "price": 17823.45,
 *   "change": 125.32,
 *   "changePercent": 0.71,
 *   "updatedAt": "2026-09-27T20:00:00.000Z",
 *   "marketStatus": "open" | "closed"
 * }
 */
module.exports = {
  mode: "mock", // "mock" | "http"
  // 将下方 URL 替换为你的真实数据源（需已加入小程序 request 合法域名）
  httpUrl: "https://your-api.example.com/nasdaq/quote",
  // 请求超时（毫秒）
  timeoutMs: 8000,
  // 交易中自动刷新间隔（PRD：20 秒）
  refreshIntervalMs: 20 * 1000,
};
