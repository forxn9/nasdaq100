/** §6：红涨绿跌 */
const UP = "#F6465D";
const DOWN = "#0ECB81";
const GRID = "rgba(255, 255, 255, 0.06)";
const LABEL = "#5E6673";

function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${m}-${day}`;
}

Component({
  properties: {
    points: { type: Array, value: [] },
    direction: { type: String, value: "flat" },
    changePercentText: { type: String, value: "" },
    rangeLabel: { type: String, value: "近 1 个月" },
  },

  data: {
    canvasW: 340,
    canvasH: 180,
    ready: false,
    startLabel: "",
    endLabel: "",
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
    "points, direction"() {
      if (this._ready) this.measureAndDraw();
    },
  },

  methods: {
    measureAndDraw() {
      const query = this.createSelectorQuery();
      query
        .select(".chart__canvas-wrap")
        .boundingClientRect((rect) => {
          const w = rect && rect.width
            ? Math.floor(rect.width)
            : 340;
          const h = Math.max(160, Math.round(w * 0.48));
          const pts = this.properties.points || [];
          this.setData(
            {
              canvasW: w,
              canvasH: h,
              startLabel: pts.length ? shortDate(pts[0].t) : "",
              endLabel: pts.length ? shortDate(pts[pts.length - 1].t) : "",
            },
            () => setTimeout(() => this.draw(), 16)
          );
        })
        .exec();
    },

    draw() {
      const pts = this.properties.points || [];
      const w = this.data.canvasW;
      const h = this.data.canvasH;
      const ctx = wx.createCanvasContext("priceChart", this);
      ctx.clearRect(0, 0, w, h);

      if (pts.length < 2) {
        ctx.draw(false, () => {
          if (!this.data.ready) this.setData({ ready: true });
        });
        return;
      }

      const padL = 4;
      const padR = 4;
      const padT = 12;
      const padB = 8;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      let min = pts[0].c;
      let max = pts[0].c;
      pts.forEach((p) => {
        if (p.c < min) min = p.c;
        if (p.c > max) max = p.c;
      });
      const span = max - min || 1;
      const padY = span * 0.08;
      min -= padY;
      max += padY;
      const ySpan = max - min;

      const color =
        this.properties.direction === "down"
          ? DOWN
          : this.properties.direction === "up"
            ? UP
            : "#848E9C";

      // 网格
      for (let i = 0; i < 4; i += 1) {
        const y = padT + (plotH * i) / 3;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.setStrokeStyle(GRID);
        ctx.setLineWidth(1);
        ctx.stroke();
      }

      const coords = pts.map((p, i) => {
        const x = padL + (plotW * i) / (pts.length - 1);
        const y = padT + plotH * (1 - (p.c - min) / ySpan);
        return { x, y };
      });

      // 面积填充
      ctx.beginPath();
      ctx.moveTo(coords[0].x, padT + plotH);
      coords.forEach((c) => ctx.lineTo(c.x, c.y));
      ctx.lineTo(coords[coords.length - 1].x, padT + plotH);
      ctx.closePath();
      ctx.setFillStyle(
        this.properties.direction === "down"
          ? "rgba(14, 203, 129, 0.16)"
          : "rgba(246, 70, 93, 0.16)"
      );
      ctx.fill();

      // 折线
      ctx.beginPath();
      coords.forEach((c, i) => {
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.setStrokeStyle(color);
      ctx.setLineWidth(2);
      ctx.setLineCap("round");
      ctx.setLineJoin("round");
      ctx.stroke();

      // 末端圆点
      const last = coords[coords.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
      ctx.setFillStyle(color);
      ctx.fill();

      // 高/低标注（克制）
      ctx.setFillStyle(LABEL);
      ctx.setFontSize(10);
      ctx.setTextAlign("left");
      ctx.fillText(max.toFixed(0), padL + 2, padT + 10);
      ctx.fillText(min.toFixed(0), padL + 2, padT + plotH - 2);

      ctx.draw(false, () => {
        if (!this.data.ready) this.setData({ ready: true });
      });
    },
  },
});
