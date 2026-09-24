import { formatMoney } from "../types";

interface MoneyProps {
  value: number | string;
  className?: string;
}

function Money({ value, className = "" }: MoneyProps) {
  return <span className={`font-ledger ${className}`}>{formatMoney(value)}</span>;
}

export default Money;
