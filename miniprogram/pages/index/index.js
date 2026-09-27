const apiConfig = require("../../config/api");
const { fetchNasdaqQuote } = require("../../services/nasdaq");
const { fetchVixQuote } = require("../../services/vix");

Page({
  data: {
    status: "loading", // loading | success | error
    quote: null,
    vix: null,
    vixHint: "",
    errorMessage: "",
    refreshing: false,
    flashPrice: false,
    isMock: false,
  },

  _refreshTimer: null,
  _inflight: null,
  _pageVisible: true,
  _flashTimer: null,

  onLoad() {
    this.loadQuote({ initial: true });
  },

  onShow() {
    this._pageVisible = true;
    if (this.data.status === "success" || this.data.status === "error") {
      this.loadQuote({ silent: true }).then(() => this.syncAutoRefresh());
    } else {
      this.syncAutoRefresh();
    }
  },

  onHide() {
    this._pageVisible = false;
    this.clearAutoRefresh();
  },

  onUnload() {
    this._pageVisible = false;
    this.clearAutoRefresh();
    if (this._flashTimer) clearTimeout(this._flashTimer);
  },

  onPullDownRefresh() {
    this.loadQuote({ fromPullDown: true, silent: !!this.data.quote });
  },

  syncAutoRefresh() {
    this.clearAutoRefresh();
    if (!this._pageVisible) return;
    const quote = this.data.quote;
    const interval = apiConfig.refreshIntervalMs || 0;
    if (!quote || quote.marketStatus !== "open" || interval <= 0) return;

    this._refreshTimer = setInterval(() => {
      if (!this._pageVisible) return;
      this.loadQuote({ silent: true });
    }, interval);
  },

  clearAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  },

  triggerPriceFlash() {
    if (this._flashTimer) clearTimeout(this._flashTimer);
    this.setData({ flashPrice: true });
    this._flashTimer = setTimeout(() => {
      this.setData({ flashPrice: false });
    }, 160);
  },

  loadQuote(options = {}) {
    const { silent = false, fromPullDown = false } = options;

    if (this._inflight) {
      return this._inflight.finally(() => {
        if (fromPullDown) wx.stopPullDownRefresh();
      });
    }

    const hasQuote = !!this.data.quote;
    if (!silent && !hasQuote) {
      this.setData({
        status: "loading",
        errorMessage: "",
        refreshing: false,
      });
    } else {
      this.setData({
        refreshing: true,
        errorMessage: silent && hasQuote ? this.data.errorMessage : "",
      });
    }

    const prevPrice = hasQuote ? this.data.quote.price : null;

    this._inflight = Promise.all([
      fetchNasdaqQuote(),
      fetchVixQuote().catch((err) => {
        console.warn("[vix]", err && err.message ? err.message : err);
        return null;
      }),
    ])
      .then(([quote, vix]) => {
        const shouldFlash =
          hasQuote && prevPrice !== null && prevPrice !== quote.price;
        const patch = {
          status: "success",
          quote,
          isMock: quote.source === "mock" || (vix && vix.source === "mock"),
          errorMessage: "",
          refreshing: false,
          vixHint: "",
        };
        if (vix) {
          patch.vix = { ...vix, available: true };
          patch.vixHint =
            vix.source === "mock"
              ? "VIX 为模拟数据（config/api.js 可切换）"
              : "";
        } else if (!this.data.vix || this.data.vix.available === false) {
          // §12.4：无数据仍展示空表盘（无指针 / -- / 暂不可用）
          patch.vix = {
            value: 0,
            valueText: "--",
            zoneLabel: "暂不可用",
            zoneColor: "#8A93A3",
            changeText: "",
            changePercentText: "",
            direction: "flat",
            symbol: "^VIX",
            gaugeMax: 50,
            available: false,
          };
          patch.vixHint = "VIX 暂不可用";
        }
        this.setData(patch);
        if (shouldFlash) this.triggerPriceFlash();
        this.syncAutoRefresh();
      })
      .catch(() => {
        if (this.data.quote) {
          this.setData({
            status: "success",
            refreshing: false,
            errorMessage: "刷新失败，以下为上次数据",
          });
        } else {
          this.setData({
            status: "error",
            quote: null,
            refreshing: false,
            errorMessage: "行情暂时无法获取，请稍后重试",
          });
          this.clearAutoRefresh();
        }
      })
      .finally(() => {
        this._inflight = null;
        if (fromPullDown) wx.stopPullDownRefresh();
      });

    return this._inflight;
  },

  onRetry() {
    this.loadQuote({ silent: !!this.data.quote });
  },
});
