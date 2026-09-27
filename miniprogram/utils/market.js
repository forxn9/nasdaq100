/**
 * 美东交易时段判定（简化版，不含法定假日）
 * 常规交易：周一至周五 09:30–16:00 America/New_York
 */

function getPartsInTimeZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = {};
  fmt.formatToParts(date).forEach((p) => {
    if (p.type !== "literal") parts[p.type] = p.value;
  });
  // hour12:false 下部分环境会把午夜标成 24
  if (parts.hour === "24") parts.hour = "00";
  return parts;
}

function isRegularSessionOpen(date = new Date()) {
  const et = getPartsInTimeZone(date, "America/New_York");
  const weekday = et.weekday; // Mon, Tue, ...
  if (weekday === "Sat" || weekday === "Sun") return false;

  const minutes = Number(et.hour) * 60 + Number(et.minute);
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  return minutes >= open && minutes < close;
}

/**
 * @returns {"open"|"closed"}
 */
function resolveMarketStatus(rawStatus, date = new Date()) {
  if (rawStatus === "open" || rawStatus === "trading" || rawStatus === "交易中") {
    return "open";
  }
  if (
    rawStatus === "closed" ||
    rawStatus === "休市" ||
    rawStatus === "market_closed"
  ) {
    return "closed";
  }
  return isRegularSessionOpen(date) ? "open" : "closed";
}

function marketStatusLabel(status) {
  return status === "open" ? "交易中" : "休市";
}

module.exports = {
  isRegularSessionOpen,
  resolveMarketStatus,
  marketStatusLabel,
  getPartsInTimeZone,
};
