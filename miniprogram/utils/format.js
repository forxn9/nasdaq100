/**
 * 数值与时间格式化工具
 */

const { getPartsInTimeZone } = require("./market");

function toNumber(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return fallback;
}

function isValidNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function formatPrice(value) {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n)) return "--";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChange(value) {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n)) return "--";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n > 0) return `+${abs}`;
  if (n < 0) return `-${abs}`;
  return "0.00";
}

function formatPercent(value) {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n)) return "--";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n > 0) return `+${abs}%`;
  if (n < 0) return `-${abs}%`;
  return "0.00%";
}

function formatZoneStamp(date, timeZone) {
  const p = getPartsInTimeZone(date, timeZone);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function formatUpdatedParts(isoOrDate) {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) {
    return {
      beijingText: "--",
      etText: "--",
      updatedAtText: "--",
      timezoneHint: "",
    };
  }
  const beijingText = formatZoneStamp(date, "Asia/Shanghai");
  const etText = formatZoneStamp(date, "America/New_York");
  return {
    beijingText,
    etText,
    updatedAtText: beijingText,
    timezoneHint: `北京时间（对应美东 ${etText.slice(11, 16)}）`,
  };
}

function directionOf(change) {
  const n = toNumber(change, 0);
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
}

module.exports = {
  toNumber,
  isValidNumber,
  formatPrice,
  formatChange,
  formatPercent,
  formatUpdatedParts,
  directionOf,
};
