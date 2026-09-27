# 纳斯达克综合指数 · 微信小程序

首页参照 **Binance 行情详情页**气质（深色金融终端）：大号实时点位与涨跌、近十年走势曲线（底部可滑动选区间）、VIX 横向色阶指标条。

## 目录

```
miniprogram/          ← 用微信开发者工具打开此目录
  app.js / app.json / app.wxss
  config/api.js       ← 纳指 / 历史 / VIX 数据源（mock / http）
  services/nasdaq.js  ← 实时报价
  services/history.js ← 近十年日线（可替换为 http）
  services/vix.js     ← VIX 分区与归一化
  components/price-chart/ ← 10Y 走势图 + range scrubber
  components/vix-gauge/   ← VIX 指标行 + 横向色阶条
  pages/index/        ← 首页
```

## 预览

1. 打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目，目录选择仓库下 `miniprogram/`
3. AppID 可用测试号或 `touristappid`
4. 本地请求外部域名时可勾选「不校验合法域名」
5. 编译后查看深色行情首页：点位 → 10Y 曲线（拖 scrubber 选区间）→ VIX

## 走势图

- **默认范围**：近约 **10 年**日线（mock 约 2600 个交易日）
- **区间选择**：底部 Binance 式 range scrubber（双滑块 + 选区外遮罩）；拖动两端或整窗平移
- **选中区间**：主图重绘该段，标题旁显示该段**涨跌额 / 涨跌幅**（红涨绿跌）
- 线色随选中区间涨跌；全宽面积图 + 克制网格

## 配置真实数据源

编辑 `miniprogram/config/api.js`：

| 字段 | 说明 |
| --- | --- |
| `mode` / `httpUrl` | 纳指实时 |
| `historyMode` / `historyHttpUrl` | 近十年走势；`historyMode` 留空则跟随 `mode` |
| `vixMode` / `vixHttpUrl` | VIX；`vixMode` 留空则跟随 `mode` |

历史期望 JSON：

```json
{
  "symbol": "^IXIC",
  "range": "10Y",
  "resolution": "1d",
  "points": [
    { "t": "2016-09-27T20:00:00.000Z", "c": 5312.00 },
    { "t": "2026-09-26T20:00:00.000Z", "c": 17823.45 }
  ]
}
```

`resolution` 可为 `1d`（日线）或 `1w`（周线）。亦支持 `[timestampMs, close]` 二元组。

涨跌色按内地习惯：**红涨 / 绿跌**（`#F6465D` / `#0ECB81`）。VIX 为指标行 + 横向色阶条（非半圆）：0–15 `#0ECB81` · 15–25 `#F0B90B` · 25–35 `#F0A030` · ≥35 `#F6465D`，量程 0–50。

上线前配置 request 合法域名。交易中约 20 秒自动刷新；休市停止轮询。VIX / 历史失败不影响主报价展示。
