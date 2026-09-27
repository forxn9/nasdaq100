const { VIX_ZONES, VIX_GAUGE_MAX } = require("../../services/vix");

/** §12：分段宽度比例 15:10:10:15 */
const SHORT = { low: "低", mid: "中", high: "高", extreme: "极端" };

Component({
  properties: {
    value: { type: Number, value: 0 },
    valueText: { type: String, value: "--" },
    zoneLabel: { type: String, value: "" },
    zoneColor: { type: String, value: "#F0B90B" },
    symbol: { type: String, value: "^VIX" },
    hint: { type: String, value: "" },
    gaugeMax: { type: Number, value: VIX_GAUGE_MAX },
    available: { type: Boolean, value: true },
  },

  data: {
    segments: VIX_ZONES.map((z) => ({
      key: z.key,
      color: z.color,
      flex: z.max - z.min,
      short: SHORT[z.key] || z.label,
    })),
    ticks: [0, 15, 25, 35, 50],
    markerPercent: 0,
  },

  observers: {
    "value, gaugeMax, available"() {
      this.updateMarker();
    },
  },

  lifetimes: {
    attached() {
      this.updateMarker();
    },
  },

  methods: {
    updateMarker() {
      const max = this.properties.gaugeMax || VIX_GAUGE_MAX;
      const available = this.properties.available !== false;
      if (!available) {
        this.setData({ markerPercent: 0 });
        return;
      }
      const raw = Number(this.properties.value);
      const v = Number.isFinite(raw) ? raw : 0;
      const clamped = Math.min(Math.max(v, 0), max);
      const pct = (clamped / max) * 100;
      this.setData({ markerPercent: Math.round(pct * 100) / 100 });
    },
  },
});
