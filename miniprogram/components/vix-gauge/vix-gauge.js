const { VIX_ZONES, VIX_GAUGE_MAX } = require("../../services/vix");

const TRACK_BG = "rgba(132, 142, 156, 0.18)";
const STEEL = "rgba(132, 142, 156, 0.55)";
const NEEDLE = "#EAECEF";
const HUB = "#181A20";
const MAJOR_TICKS = [0, 15, 25, 35, 50];

Component({
  properties: {
    value: { type: Number, value: 0 },
    valueText: { type: String, value: "--" },
    zoneLabel: { type: String, value: "" },
    zoneColor: { type: String, value: "#F0B90B" },
    changeText: { type: String, value: "" },
    changePercentText: { type: String, value: "" },
    direction: { type: String, value: "flat" },
    symbol: { type: String, value: "^VIX" },
    hint: { type: String, value: "" },
    gaugeMax: { type: Number, value: VIX_GAUGE_MAX },
    available: { type: Boolean, value: true },
  },

  data: {
    canvasW: 180,
    canvasH: 118,
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
    "value, zoneColor, gaugeMax, available"() {
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
            const w = Math.min(Math.max(Math.floor(rect.width), 140), 220);
            const h = Math.round(w * 0.64);
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
      const cx = w / 2;
      const cy = h * 0.84;
      const radius = Math.min(w * 0.42, h * 0.7);
      const trackWidth = Math.max(8, Math.round(radius * 0.14));
      const max = this.properties.gaugeMax || VIX_GAUGE_MAX;
      const available = this.properties.available !== false;
      const rawValue = Number(this.properties.value);
      const value = available
        ? Math.min(Math.max(Number.isFinite(rawValue) ? rawValue : 0, 0), max)
        : 0;

      ctx.clearRect(0, 0, w, h);
      this._arc(ctx, cx, cy, radius + trackWidth * 0.55 + 1, Math.PI, 0, STEEL, 1);
      this._arc(ctx, cx, cy, radius, Math.PI, 0, TRACK_BG, trackWidth);

      VIX_ZONES.forEach((zone) => {
        const start = Math.PI + (zone.min / max) * Math.PI;
        const end = Math.PI + (Math.min(zone.max, max) / max) * Math.PI;
        this._arc(ctx, cx, cy, radius, start, end, zone.color, trackWidth);
      });

      MAJOR_TICKS.forEach((tick) => {
        if (tick > max) return;
        const ang = Math.PI + (tick / max) * Math.PI;
        const inner = radius - trackWidth * 0.5;
        const outer = radius + trackWidth * 0.45 + 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
        ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
        ctx.setStrokeStyle("rgba(234, 236, 239, 0.35)");
        ctx.setLineWidth(1);
        ctx.stroke();
      });

      if (available) {
        const needleAng = Math.PI + (value / max) * Math.PI;
        const tipR = radius - trackWidth * 0.15;
        const tipX = cx + Math.cos(needleAng) * tipR;
        const tipY = cy + Math.sin(needleAng) * tipR;
        const backX = cx - Math.cos(needleAng) * 8;
        const backY = cy - Math.sin(needleAng) * 8;
        const leftAng = needleAng + Math.PI / 2;
        const rightAng = needleAng - Math.PI / 2;

        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(cx + Math.cos(leftAng) * 2, cy + Math.sin(leftAng) * 2);
        ctx.lineTo(backX, backY);
        ctx.lineTo(cx + Math.cos(rightAng) * 2, cy + Math.sin(rightAng) * 2);
        ctx.closePath();
        ctx.setFillStyle(NEEDLE);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.setStrokeStyle(STEEL);
      ctx.setLineWidth(1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.setFillStyle(NEEDLE);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 1.2, 0, Math.PI * 2);
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
