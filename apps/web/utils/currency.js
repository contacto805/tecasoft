export function formatCurrency(amount, currency = 'MXN') {
  const num = parseFloat(amount) || 0;
  return `$${num.toFixed(2)} ${currency}`;
}

export function formatMoney(amount, currency = 'MXN') {
  return formatCurrency(amount, currency);
}
