/** §6：红涨绿跌 */
const UP = "#F6465D";
const DOWN = "#0ECB81";
const FLAT = "#848E9C";
const GRID = "rgba(255, 255, 255, 0.06)";
const LABEL = "#5E6673";
const MASK = "rgba(11, 14, 17, 0.72)";
const WINDOW_EDGE = "rgba(234, 236, 239, 0.85)";
const SCRUB_LINE = "rgba(132, 142, 156, 0.55)";

const { sliceAndSummarize } = require("../../services/history");

const MIN_SPAN = 5;
const HANDLE_HIT = 18;

function shortDate(iso, withYear) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  if (withYear) return `${y}-${m}`;
  return `${m}-${day}`;
}

function axisLabel(iso, spanDays) {
  if (!iso) return "";
  if (spanDays > 60) return shortDate(iso, true);
  return shortDate(iso, false);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function downsample(pts, maxPoints) {
  if (!pts || pts.length <= maxPoints) return pts || [];
  const out = [];
  const step = (pts.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(pts[Math.round(i * step)]);
  }
  return out;
}

Component({
  properties: {
    points: { type: Array, value: [] },
    rangeLabel: { type: String, value: "近十年" },
  },

  data: {
    canvasW: 340,
    canvasH: 180,
    scrubW: 340,
    scrubH: 44,
    ready: false,
    startLabel: "",
    endLabel: "",
    direction: "flat",
    changeText: "--",
    changePercentText: "--",
    startRatio: 0,
    endRatio: 1,
    windowLeft: 0,
    windowWidth: 100,
    dragging: "",
  },

  lifetimes: {
    ready() {
      this._ready = true;
      this._startRatio = 0;
      this._endRatio = 1;
      this.resetSelection(true);
      this.measureAndDraw();
    },
    detached() {
      this._ready = false;
    },
  },

  observers: {
    points() {
      if (!this._ready) return;
      this.resetSelection(false);
      this.measureAndDraw();
    },
  },

  methods: {
    resetSelection(forceFull) {
      const pts = this.properties.points || [];
      if (!pts.length) {
        this._startRatio = 0;
        this._endRatio = 1;
        this.applySelectionStats([]);
        return;
      }
      if (forceFull || this._startRatio == null) {
        this._startRatio = 0;
        this._endRatio = 1;
      }
      this.syncSelectionUi();
    },

    indicesFromRatios(len) {
      if (len < 2) return { start: 0, end: Math.max(0, len - 1) };
      let start = Math.round(this._startRatio * (len - 1));
      let end = Math.round(this._endRatio * (len - 1));
      start = clamp(start, 0, len - 1);
      end = clamp(end, 0, len - 1);
      const minSpan = Math.min(MIN_SPAN - 1, len - 1);
      if (end - start < minSpan) {
        end = Math.min(len - 1, start + minSpan);
        if (end - start < minSpan) {
          start = Math.max(0, end - minSpan);
        }
      }
      return { start, end };
    },

    selectedPoints() {
      const pts = this.properties.points || [];
      if (!pts.length) return [];
      const { start, end } = this.indicesFromRatios(pts.length);
      return pts.slice(start, end + 1);
    },

    buildSelectionState(sel) {
      const summary = sliceAndSummarize(sel, 0, Math.max(0, sel.length - 1));
      const spanDays =
        sel.length >= 2
          ? (new Date(sel[sel.length - 1].t) - new Date(sel[0].t)) /
            (24 * 60 * 60 * 1000)
          : 0;
      return {
        direction: summary.direction,
        changeText: summary.changeText,
        changePercentText: summary.changePercentText,
        change: summary.change,
        startLabel: sel.length ? axisLabel(sel[0].t, spanDays) : "",
        endLabel: sel.length ? axisLabel(sel[sel.length - 1].t, spanDays) : "",
      };
    },

    applySelectionStats(sel) {
      const state = this.buildSelectionState(sel);
      this.setData({
        direction: state.direction,
        changeText: state.changeText,
        changePercentText: state.changePercentText,
        startLabel: state.startLabel,
        endLabel: state.endLabel,
      });
      return state;
    },

    syncSelectionUi() {
      const pts = this.properties.points || [];
      const sel = this.selectedPoints();
      const state = this.applySelectionStats(sel);
      const w = this.data.scrubW || 340;
      const left = this._startRatio * w;
      const right = this._endRatio * w;
      const idx = pts.length
        ? this.indicesFromRatios(pts.length)
        : { start: 0, end: 0 };
      this.setData({
        startRatio: this._startRatio,
        endRatio: this._endRatio,
        windowLeft: left,
        windowWidth: Math.max(2, right - left),
      });
      this.triggerEvent("rangechange", {
        startRatio: this._startRatio,
        endRatio: this._endRatio,
        startIndex: idx.start,
        endIndex: idx.end,
        change: state.change,
        changeText: state.changeText,
        changePercentText: state.changePercentText,
        direction: state.direction,
      });
    },

    measureAndDraw() {
      const query = this.createSelectorQuery();
      query.select(".chart__canvas-wrap").boundingClientRect();
      query.select(".chart__scrub").boundingClientRect();
      query.exec((res) => {
        const mainRect = res && res[0];
        const scrubRect = res && res[1];
        const w =
          mainRect && mainRect.width ? Math.floor(mainRect.width) : 340;
        const h = Math.max(160, Math.round(w * 0.48));
        const scrubW =
          scrubRect && scrubRect.width ? Math.floor(scrubRect.width) : w;
        this.setData(
          {
            canvasW: w,
            canvasH: h,
            scrubW,
            scrubH: 44,
          },
          () => {
            this.syncSelectionUi();
            setTimeout(() => {
              this.drawMain();
              this.drawScrub();
            }, 16);
          }
        );
      });
    },

    colorFor(direction) {
      if (direction === "down") return DOWN;
      if (direction === "up") return UP;
      return FLAT;
    },

    fillFor(direction) {
      if (direction === "down") return "rgba(14, 203, 129, 0.16)";
      if (direction === "up") return "rgba(246, 70, 93, 0.16)";
      return "rgba(132, 142, 156, 0.12)";
    },

    drawSeries(ctx, pts, w, h, opts) {
      const padL = opts.padL != null ? opts.padL : 4;
      const padR = opts.padR != null ? opts.padR : 4;
      const padT = opts.padT != null ? opts.padT : 12;
      const padB = opts.padB != null ? opts.padB : 8;
      const lineW = opts.lineW != null ? opts.lineW : 2;
      const showGrid = !!opts.showGrid;
      const showDot = !!opts.showDot;
      const showLabels = !!opts.showLabels;
      const color = opts.color || FLAT;
      const fill = opts.fill || "rgba(132, 142, 156, 0.12)";

      ctx.clearRect(0, 0, w, h);
      if (!pts || pts.length < 2) return;

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

      if (showGrid) {
        for (let i = 0; i < 4; i += 1) {
          const y = padT + (plotH * i) / 3;
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(w - padR, y);
          ctx.setStrokeStyle(GRID);
          ctx.setLineWidth(1);
          ctx.stroke();
        }
      }

      const coords = pts.map((p, i) => {
        const x = padL + (plotW * i) / (pts.length - 1);
        const y = padT + plotH * (1 - (p.c - min) / ySpan);
        return { x, y };
      });

      ctx.beginPath();
      ctx.moveTo(coords[0].x, padT + plotH);
      coords.forEach((c) => ctx.lineTo(c.x, c.y));
      ctx.lineTo(coords[coords.length - 1].x, padT + plotH);
      ctx.closePath();
      ctx.setFillStyle(fill);
      ctx.fill();

      ctx.beginPath();
      coords.forEach((c, i) => {
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.setStrokeStyle(color);
      ctx.setLineWidth(lineW);
      ctx.setLineCap("round");
      ctx.setLineJoin("round");
      ctx.stroke();

      if (showDot) {
        const last = coords[coords.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
        ctx.setFillStyle(color);
        ctx.fill();
      }

      if (showLabels) {
        ctx.setFillStyle(LABEL);
        ctx.setFontSize(10);
        ctx.setTextAlign("left");
        ctx.fillText(max.toFixed(0), padL + 2, padT + 10);
        ctx.fillText(min.toFixed(0), padL + 2, padT + plotH - 2);
      }
    },

    drawMain() {
      const pts = downsample(this.selectedPoints(), 480);
      const w = this.data.canvasW;
      const h = this.data.canvasH;
      const ctx = wx.createCanvasContext("priceChart", this);
      const direction = this.data.direction;
      this.drawSeries(ctx, pts, w, h, {
        showGrid: true,
        showDot: true,
        showLabels: true,
        color: this.colorFor(direction),
        fill: this.fillFor(direction),
        lineW: 2,
      });
      ctx.draw(false, () => {
        if (!this.data.ready) this.setData({ ready: true });
      });
    },

    drawScrub() {
      const all = this.properties.points || [];
      const pts = downsample(all, 160);
      const w = this.data.scrubW;
      const h = this.data.scrubH;
      const ctx = wx.createCanvasContext("scrubChart", this);
      this.drawSeries(ctx, pts, w, h, {
        padL: 0,
        padR: 0,
        padT: 4,
        padB: 4,
        showGrid: false,
        showDot: false,
        showLabels: false,
        color: SCRUB_LINE,
        fill: "rgba(132, 142, 156, 0.14)",
        lineW: 1,
      });
      const left = this._startRatio * w;
      const right = this._endRatio * w;
      ctx.setFillStyle(MASK);
      ctx.fillRect(0, 0, left, h);
      ctx.fillRect(right, 0, Math.max(0, w - right), h);
      ctx.setStrokeStyle(WINDOW_EDGE);
      ctx.setLineWidth(1);
      ctx.strokeRect(left, 0.5, Math.max(1, right - left), h - 1);
      ctx.draw();
    },

    ratioFromTouch(e) {
      const touch =
        (e.touches && e.touches[0]) ||
        (e.changedTouches && e.changedTouches[0]);
      if (!touch) return null;
      const scrubLeft = this._scrubLeft != null ? this._scrubLeft : 0;
      const x = touch.clientX - scrubLeft;
      const w = this.data.scrubW || 1;
      return clamp(x / w, 0, 1);
    },

    cacheScrubLeft(cb) {
      this.createSelectorQuery()
        .select(".chart__scrub")
        .boundingClientRect((rect) => {
          this._scrubLeft = rect ? rect.left : 0;
          if (cb) cb();
        })
        .exec();
    },

    pickHandle(ratio) {
      const start = this._startRatio;
      const end = this._endRatio;
      const w = this.data.scrubW || 1;
      const hit = HANDLE_HIT / w;
      const dStart = Math.abs(ratio - start);
      const dEnd = Math.abs(ratio - end);
      if (dStart <= hit && dStart <= dEnd) return "start";
      if (dEnd <= hit) return "end";
      if (ratio > start && ratio < end) return "window";
      return dStart < dEnd ? "start" : "end";
    },

    onScrubStart(e) {
      this.cacheScrubLeft(() => {
        const ratio = this.ratioFromTouch(e);
        if (ratio == null) return;
        const mode = this.pickHandle(ratio);
        this._dragMode = mode;
        this._dragOriginRatio = ratio;
        this._dragStart0 = this._startRatio;
        this._dragEnd0 = this._endRatio;
        this.setData({ dragging: mode });
        if (mode === "start" || mode === "end") {
          this.applyDragRatio(ratio);
        }
      });
    },

    onScrubMove(e) {
      if (!this._dragMode) return;
      const ratio = this.ratioFromTouch(e);
      if (ratio == null) return;
      this.applyDragRatio(ratio);
    },

    onScrubEnd() {
      this._dragMode = "";
      this.setData({ dragging: "" });
      this.drawMain();
      this.drawScrub();
    },

    applyDragRatio(ratio) {
      const pts = this.properties.points || [];
      const len = Math.max(2, pts.length);
      const minGap = Math.min(MIN_SPAN - 1, len - 1) / (len - 1);
      let start = this._startRatio;
      let end = this._endRatio;
      const mode = this._dragMode;

      if (mode === "start") {
        start = clamp(ratio, 0, end - minGap);
      } else if (mode === "end") {
        end = clamp(ratio, start + minGap, 1);
      } else if (mode === "window") {
        const delta = ratio - this._dragOriginRatio;
        const span = this._dragEnd0 - this._dragStart0;
        start = this._dragStart0 + delta;
        end = this._dragEnd0 + delta;
        if (start < 0) {
          start = 0;
          end = span;
        }
        if (end > 1) {
          end = 1;
          start = 1 - span;
        }
      }

      this._startRatio = start;
      this._endRatio = end;
      this.syncSelectionUi();
      this.drawMain();
      this.drawScrub();
    },
  },
});
