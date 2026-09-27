# 纳斯达克综合指数 · 微信小程序

首页展示纳斯达克综合指数（^IXIC）点位、涨跌、涨跌幅、市场状态与更新时间；页面下部为 VIX 恐慌指数表盘（次要区）。对齐 PRD v0.1 与「冷钢行情台」UI。

## 目录

```
miniprogram/          ← 用微信开发者工具打开此目录
  app.js / app.json / app.wxss
  config/api.js       ← 纳指 + VIX 数据源（mock / http）与 20s 刷新
  services/nasdaq.js  ← 纳指拉取与字段归一化
  services/vix.js     ← VIX 拉取、分区色阶与归一化
  components/vix-gauge/ ← 底部恐慌指数半弧表盘
  utils/market.js     ← 美东交易时段
  utils/format.js     ← 数值 / 北京·美东时间
  pages/index/        ← 首页（加载骨架 / 成功 / 休市 / 失败 + VIX）
```

## 预览

1. 打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目，目录选择仓库下 `miniprogram/`
3. AppID 可用测试号或 `touristappid`
4. 本地请求外部域名时可勾选「不校验合法域名」
5. 编译后查看首页；支持下拉刷新与「刷新行情」；底部可见 VIX 表盘

## 配置真实数据源

编辑 `miniprogram/config/api.js`：

| 字段 | 说明 |
| --- | --- |
| `mode` / `httpUrl` | 纳指：`mock` 或 `http` |
| `vixMode` / `vixHttpUrl` | VIX：可单独设；`vixMode` 留空则跟随 `mode` |

纳指期望 JSON：

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

VIX 期望 JSON：

```json
{
  "symbol": "^VIX",
  "value": 18.42,
  "change": -0.85,
  "changePercent": -4.41,
  "updatedAt": "2026-09-27T20:00:00.000Z"
}
```

VIX 表盘色阶（对齐 UI §12.2，量程 **0–50** 半圆）：**0–15 低恐慌 `#1B7F4A` · 15–25 中等 `#C4A035` · 25–35 高恐慌 `#C45A12` · ≥35 极端 `#C62828`**（真实值 >50 时指针贴右端，数值仍显示真实值）。

上线前配置 request 合法域名。交易中约 20 秒自动刷新；休市停止轮询；页面隐藏暂停，回前台补拉。VIX 拉取失败不影响纳指主信息展示。
