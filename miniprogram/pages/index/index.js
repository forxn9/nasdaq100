const apiConfig = require("../../config/api");
const { fetchNasdaqQuote } = require("../../services/nasdaq");

Page({
  data: {
    status: "loading", // loading | success | error
    quote: null,
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

    this._inflight = fetchNasdaqQuote()
      .then((quote) => {
        const shouldFlash =
          hasQuote && prevPrice !== null && prevPrice !== quote.price;
        this.setData({
          status: "success",
          quote,
          isMock: quote.source === "mock",
          errorMessage: "",
          refreshing: false,
        });
        if (shouldFlash) this.triggerPriceFlash();
        this.syncAutoRefresh();
      })
      .catch((err) => {
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
