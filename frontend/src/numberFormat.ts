type NumericValue = number | string | null | undefined;

const quantityFormatter = new Intl.NumberFormat("en-PK", {
  maximumFractionDigits: 3,
});

const unitCostFormatter = new Intl.NumberFormat("en-PK", {
  maximumFractionDigits: 4,
});

const moneyFormatter = new Intl.NumberFormat("en-PK", {
  maximumFractionDigits: 2,
});

function finiteNumber(value: NumericValue) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function formatNumberInput(value: NumericValue, fallback = "") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? String(number) : fallback;
}

export function formatQuantity(value: NumericValue) {
  return quantityFormatter.format(finiteNumber(value));
}

export function formatUnitCost(value: NumericValue) {
  return `PKR ${unitCostFormatter.format(finiteNumber(value))}`;
}

export function formatMoney(value: NumericValue) {
  return `PKR ${moneyFormatter.format(finiteNumber(value))}`;
}

export function formatCardMoney(value: NumericValue) {
  const amount = finiteNumber(value);
  const abs = Math.abs(amount);

  if (abs >= 1_000_000) {
    return `PKR ${moneyFormatter.format(amount / 1_000_000)}M`;
  }

  if (abs >= 10_000) {
    return `PKR ${moneyFormatter.format(amount / 1_000)}k`;
  }

  return formatMoney(amount);
}
