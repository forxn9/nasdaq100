const { VIX_ZONES, VIX_GAUGE_MAX } = require("../../services/vix");

const TRACK_BG = "rgba(21, 32, 51, 0.08)";
const STEEL = "rgba(90, 101, 120, 0.55)";
const NEEDLE = "#152033";
const HUB = "#EEF2F6";
/** UI §12.3 主刻度 */
const MAJOR_TICKS = [0, 15, 25, 35, 50];

Component({
  properties: {
    value: { type: Number, value: 0 },
    valueText: { type: String, value: "--" },
    zoneLabel: { type: String, value: "" },
    zoneColor: { type: String, value: "#C4A035" },
    changeText: { type: String, value: "" },
    changePercentText: { type: String, value: "" },
    direction: { type: String, value: "flat" },
    symbol: { type: String, value: "^VIX" },
    hint: { type: String, value: "" },
    gaugeMax: { type: Number, value: VIX_GAUGE_MAX },
  },

  data: {
    canvasW: 280,
    canvasH: 168,
    ready: false,
    legend: VIX_ZONES.map((z) => ({
      key: z.key,
      label: z.label,
      color: z.color,
    })),
  },

  lifetimes: {
    ready() {
      this._ready = true;
      this.measureAndDraw();
    },
    detached() {
      this._ready = false;
    },
  },

  observers: {
    "value, zoneColor, gaugeMax"() {
      if (this._ready) this.drawGauge();
    },
  },

  methods: {
    measureAndDraw() {
      const query = this.createSelectorQuery();
      query
        .select(".gauge__dial")
        .boundingClientRect((rect) => {
          if (rect && rect.width) {
            const w = Math.min(Math.max(Math.floor(rect.width), 240), 320);
            const h = Math.round(w * 0.6);
            this.setData({ canvasW: w, canvasH: h }, () => {
              setTimeout(() => this.drawGauge(), 16);
            });
          } else {
            this.drawGauge();
          }
        })
        .exec();
    },

    drawGauge() {
      const w = this.data.canvasW;
      const h = this.data.canvasH;
      const ctx = wx.createCanvasContext("vixDial", this);

      // UI §12.2：左侧水平=0，右侧水平=180°；angleDeg = clamp(v,0,50)/50*180
      const cx = w / 2;
      const cy = h * 0.78;
      const radius = Math.min(w * 0.42, h * 0.72);
      const trackWidth = Math.max(10, Math.round(radius * 0.16));
      const max = this.properties.gaugeMax || VIX_GAUGE_MAX;
      const value = Math.min(Math.max(Number(this.properties.value) || 0, 0), max);

      ctx.clearRect(0, 0, w, h);

      // 外钢环 + 内轨
      this._arc(ctx, cx, cy, radius + trackWidth * 0.55, Math.PI, 0, STEEL, 1);
      this._arc(ctx, cx, cy, radius - trackWidth * 0.55, Math.PI, 0, TRACK_BG, 1);

      // 底轨
      this._arc(ctx, cx, cy, radius, Math.PI, 0, TRACK_BG, trackWidth);

      // 分区着色弧（量程上 35–50 仍画极端色；>50 数值贴右端）
      VIX_ZONES.forEach((zone) => {
        const start = Math.PI + (zone.min / max) * Math.PI;
        const end = Math.PI + (Math.min(zone.max, max) / max) * Math.PI;
        this._arc(ctx, cx, cy, radius, start, end, zone.color, trackWidth);
      });

      // 主刻度 0 / 15 / 25 / 35 / 50
      MAJOR_TICKS.forEach((tick) => {
        if (tick > max) return;
        const ang = Math.PI + (tick / max) * Math.PI;
        const inner = radius - trackWidth * 0.55;
        const outer = radius + trackWidth * 0.45;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
        ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
        ctx.setStrokeStyle("rgba(21, 32, 51, 0.35)");
        ctx.setLineWidth(1.2);
        ctx.stroke();

        const lx = cx + Math.cos(ang) * (outer + 11);
        const ly = cy + Math.sin(ang) * (outer + 11);
        ctx.setFillStyle("rgba(90, 101, 120, 0.95)");
        ctx.setFontSize(10);
        ctx.setTextAlign("center");
        ctx.setTextBaseline("middle");
        ctx.fillText(String(tick), lx, ly);
      });

      // 指针
      const needleAng = Math.PI + (value / max) * Math.PI;
      const tipR = radius - trackWidth * 0.1;
      const backR = 10;
      const tipX = cx + Math.cos(needleAng) * tipR;
      const tipY = cy + Math.sin(needleAng) * tipR;
      const leftAng = needleAng + Math.PI / 2;
      const rightAng = needleAng - Math.PI / 2;
      const bx1 = cx + Math.cos(leftAng) * 3.5;
      const by1 = cy + Math.sin(leftAng) * 3.5;
      const bx2 = cx + Math.cos(rightAng) * 3.5;
      const by2 = cy + Math.sin(rightAng) * 3.5;
      const backX = cx - Math.cos(needleAng) * backR;
      const backY = cy - Math.sin(needleAng) * backR;

      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(bx1, by1);
      ctx.lineTo(backX, backY);
      ctx.lineTo(bx2, by2);
      ctx.closePath();
      ctx.setFillStyle(NEEDLE);
      ctx.fill();

      // 轴心
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.setStrokeStyle(STEEL);
      ctx.setLineWidth(1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.setFillStyle(NEEDLE);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
      ctx.setFillStyle(HUB);
      ctx.fill();

      ctx.draw(false, () => {
        if (!this.data.ready) this.setData({ ready: true });
      });
    },

    _arc(ctx, cx, cy, r, start, end, color, width) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end, false);
      ctx.setStrokeStyle(color);
      ctx.setLineWidth(width);
      ctx.setLineCap("butt");
      ctx.stroke();
    },
  },
});
