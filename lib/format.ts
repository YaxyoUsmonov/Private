export function formatNumber(value: number) {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const [integer, fraction] = absolute.toString().split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return `${sign}${fraction ? `${grouped}.${fraction}` : grouped}`;
}

export function formatMoney(value: number) {
  return `${formatNumber(value)} UZS`;
}
