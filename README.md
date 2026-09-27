# 纳斯达克综合指数 · 微信小程序

首页展示纳斯达克综合指数（^IXIC）点位、涨跌、涨跌幅、市场状态与更新时间。对齐 PRD v0.1 与「冷钢行情台」UI。

## 目录

```
miniprogram/          ← 用微信开发者工具打开此目录
  app.js / app.json / app.wxss
  config/api.js       ← 数据源（mock / http）与 20s 刷新
  services/nasdaq.js  ← 行情拉取与字段归一化
  utils/market.js     ← 美东交易时段
  utils/format.js     ← 数值 / 北京·美东时间
  pages/index/        ← 首页（加载骨架 / 成功 / 休市 / 失败）
```

## 预览

1. 打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目，目录选择仓库下 `miniprogram/`
3. AppID 可用测试号或 `touristappid`
4. 本地请求外部域名时可勾选「不校验合法域名」
5. 编译后查看首页；支持下拉刷新与「刷新行情」

## 配置真实数据源

编辑 `miniprogram/config/api.js`，将 `mode` 设为 `"http"` 并填写 `httpUrl`。期望 JSON：

```json
{
  "name": "纳斯达克综合指数",
  "symbol": "^IXIC",
  "price": 17823.45,
  "change": 125.32,
  "changePercent": 0.71,
  "updatedAt": "2026-09-27T20:00:00.000Z",
  "marketStatus": "open"
}
```

上线前配置 request 合法域名。交易中约 20 秒自动刷新；休市停止轮询；页面隐藏暂停，回前台补拉。
