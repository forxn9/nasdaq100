/**
 * DecadeRangeChart + RangeScrubber（§3.4 / §13）
 * 默认近十年全窗；底部双滑块；选中窗涨跌汇总。
 */
const UP = "#F6465D";
const DOWN = "#0ECB81";
const FLAT = "#848E9C";
const GRID = "rgba(255, 255, 255, 0.06)";
const LABEL = "#5E6673";
const SCRUB_MINI = "#5E6673";

const { sliceAndSummarize } = require("../../services/history");

/** §13.2：最小跨度 ≥ 30 个交易日 */
const MIN_SPAN = 30;
/** 柄命中半宽（px），外扩约 44pt */
const HANDLE_HIT_PX = 22;
const DRAG_THROTTLE_MS = 80;
const MAIN_MAX_POINTS = 280;
const SCRUB_MAX_POINTS = 160;

function pad2(n) {
  return `${n}`.padStart(2, "0");
}

/** §13.3：跨度 ≥ 1 年用 YYYY-MM，否则 YYYY-MM-DD */
function formatRangeDate(iso, spanDays) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  if (spanDays >= 365) return `${y}-${m}`;
  return `${y}-${m}-${day}`;
}

function yearOf(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}`;
}

function spanDaysOf(a, b) {
  if (!a || !b) return 0;
  return Math.abs(new Date(b) - new Date(a)) / (24 * 60 * 60 * 1000);
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
    canvasH: 168,
    scrubW: 340,
    scrubH: 36,
    ready: false,
    dateRangeText: "",
    startLabel: "",
    endLabel: "",
    fullStartYear: "",
    fullEndYear: "",
    direction: "flat",
    changeText: "--",
    changePercentText: "--",
    startRatio: 0,
    endRatio: 1,
    windowLeft: 0,
    windowWidth: 100,
    maskLeftW: 0,
    maskRightL: 0,
    maskRightW: 0,
    dragging: "",
    isFullWindow: true,
  },

  lifetimes: {
    ready() {
      this._ready = true;
      this._startRatio = 0;
      this._endRatio = 1;
      this._dragMode = "";
      this._lastMainDraw = 0;
      this.resetToFull();
      this.measureAndDraw();
    },
    detached() {
      this._ready = false;
      if (this._throttleTimer) clearTimeout(this._throttleTimer);
    },
  },

  observers: {
    points(pts) {
      if (!this._ready) return;
      // §13.4：刷新后保持比例映射；无点则清空
      if (!pts || !pts.length) {
        this.resetToFull();
        this.measureAndDraw();
        return;
      }
      if (this._startRatio == null || this._endRatio == null) {
        this.resetToFull();
      }
      this.measureAndDraw();
    },
  },

  methods: {
    resetToFull() {
      this._startRatio = 0;
      this._endRatio = 1;
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

    /** 松手吸附到最近数据点（§13.2） */
    snapToPoints() {
      const pts = this.properties.points || [];
      if (pts.length < 2) return;
      const { start, end } = this.indicesFromRatios(pts.length);
      this._startRatio = start / (pts.length - 1);
      this._endRatio = end / (pts.length - 1);
    },

    selectedPoints() {
      const pts = this.properties.points || [];
      if (!pts.length) return [];
      const { start, end } = this.indicesFromRatios(pts.length);
      return pts.slice(start, end + 1);
    },

    buildSelectionState(sel) {
      const all = this.properties.points || [];
      if (!sel.length) {
        return {
          direction: "flat",
          changeText: "--",
          changePercentText: "--",
          change: 0,
          dateRangeText: "",
          startLabel: "",
          endLabel: "",
          fullStartYear: all.length ? yearOf(all[0].t) : "",
          fullEndYear: all.length ? yearOf(all[all.length - 1].t) : "",
          isFullWindow: true,
        };
      }
      const summary = sliceAndSummarize(sel, 0, Math.max(0, sel.length - 1));
      const days = spanDaysOf(sel[0].t, sel[sel.length - 1].t);
      const startFmt = formatRangeDate(sel[0].t, days);
      const endFmt = formatRangeDate(sel[sel.length - 1].t, days);
      const idx = this.indicesFromRatios(all.length || 1);
      const isFull =
        !all.length ||
        (idx.start === 0 && idx.end === all.length - 1);
      return {
        direction: summary.direction,
        changeText: summary.changeText,
        changePercentText: summary.changePercentText,
        change: summary.change,
        dateRangeText: `${startFmt} — ${endFmt}`,
        startLabel: startFmt,
        endLabel: endFmt,
        fullStartYear: all.length ? yearOf(all[0].t) : "",
        fullEndYear: all.length ? yearOf(all[all.length - 1].t) : "",
        isFullWindow: isFull,
      };
    },

    syncSelectionUi() {
      const pts = this.properties.points || [];
      const sel = this.selectedPoints();
      const state = this.buildSelectionState(sel);
      const w = this.data.scrubW || 340;
      const left = this._startRatio * w;
      const right = this._endRatio * w;
      const idx = pts.length
        ? this.indicesFromRatios(pts.length)
        : { start: 0, end: 0 };
      this.setData({
        direction: state.direction,
        changeText: state.changeText,
        changePercentText: state.changePercentText,
        dateRangeText: state.dateRangeText,
        startLabel: state.startLabel,
        endLabel: state.endLabel,
        fullStartYear: state.fullStartYear,
        fullEndYear: state.fullEndYear,
        isFullWindow: state.isFullWindow,
        startRatio: this._startRatio,
        endRatio: this._endRatio,
        windowLeft: left,
        windowWidth: Math.max(2, right - left),
        maskLeftW: Math.max(0, left),
        maskRightL: right,
        maskRightW: Math.max(0, w - right),
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
        dateRangeText: state.dateRangeText,
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
        // §3.4：主图 160–180px
        const h = clamp(Math.round(w * 0.48), 160, 180);
        const scrubW =
          scrubRect && scrubRect.width ? Math.floor(scrubRect.width) : w;
        this.setData(
          {
            canvasW: w,
            canvasH: h,
            scrubW,
            scrubH: 36,
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
      const lineW = opts.lineW != null ? opts.lineW : 1.75;
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
          if (typeof ctx.setLineDash === "function") {
            ctx.setLineDash([3, 4]);
          }
          ctx.stroke();
          if (typeof ctx.setLineDash === "function") {
            ctx.setLineDash([]);
          }
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
        ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
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
      const pts = downsample(this.selectedPoints(), MAIN_MAX_POINTS);
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
        lineW: 1.75,
      });
      ctx.draw(false, () => {
        if (!this.data.ready) this.setData({ ready: true });
      });
      this._lastMainDraw = Date.now();
    },

    /** 迷你轨只画全 10Y 折线；遮罩/窗/柄用 view（§13.2） */
    drawScrub() {
      const all = this.properties.points || [];
      const pts = downsample(all, SCRUB_MAX_POINTS);
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
        color: SCRUB_MINI,
        fill: "rgba(94, 102, 115, 0.12)",
        lineW: 1.2,
      });
      ctx.draw();
    },

    scheduleMainDraw(force) {
      const now = Date.now();
      if (force) {
        if (this._throttleTimer) {
          clearTimeout(this._throttleTimer);
          this._throttleTimer = null;
        }
        this.drawMain();
        return;
      }
      if (now - (this._lastMainDraw || 0) >= DRAG_THROTTLE_MS) {
        this.drawMain();
        return;
      }
      if (this._throttleTimer) return;
      this._throttleTimer = setTimeout(() => {
        this._throttleTimer = null;
        this.drawMain();
      }, DRAG_THROTTLE_MS);
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
      const hit = HANDLE_HIT_PX / w;
      const dStart = Math.abs(ratio - start);
      const dEnd = Math.abs(ratio - end);
      if (dStart <= hit && dStart <= dEnd) return "start";
      if (dEnd <= hit) return "end";
      if (ratio > start && ratio < end) return "window";
      return dStart < dEnd ? "start" : "end";
    },

    onScrubStart(e) {
      // 双击复位（§13.2）
      const now = Date.now();
      if (this._lastTapAt && now - this._lastTapAt < 320) {
        this._lastTapAt = 0;
        this.onResetRange();
        return;
      }
      this._lastTapAt = now;

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
      if (!this._dragMode) return;
      this._dragMode = "";
      this.snapToPoints();
      this.setData({ dragging: "" });
      this.syncSelectionUi();
      this.scheduleMainDraw(true);
      this.drawScrub();
    },

    onResetRange() {
      this._dragMode = "";
      this.resetToFull();
      this.setData({ dragging: "" });
      this.syncSelectionUi();
      this.scheduleMainDraw(true);
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
      this.scheduleMainDraw(false);
    },
  },
});
