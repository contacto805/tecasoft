export const fixedConcepts = {
  renta: 'Renta',
  luz_frio: 'Luz frío',
  luz_empaque: 'Luz empaque',
  renta_unidades: 'Renta unidades',
  mantenimientos: 'Mantenimientos',
};

const dayMs = 86400000;
export const dateKey = value => value instanceof Date ? value.toISOString().slice(0,10) : String(value || '').slice(0,10);
export const mexicoToday = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Mexico_City'}).format(new Date());
const epoch = date => new Date(date + 'T00:00:00Z').getTime() / dayMs;
const isoDay = day => new Date(day * dayMs).toISOString().slice(0,10);
export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(epoch(date)) && isoDay(epoch(date)) === date;
}

export function closingWeek(date = mexicoToday()) {
  const shift = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return {start:isoDay(epoch(date) - shift), end:isoDay(epoch(date) - shift + 6)};
}

export function validWeek(start, end) {
  return validDate(start) && validDate(end) && closingWeek(start).start === start &&
    closingWeek(start).end === end;
}

export const amount = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const money = value => Math.round(amount(value) * 100) / 100;

export function weeklyPortion(total, from, to, weekStart, weekEnd) {
  const days = epoch(to) - epoch(from) + 1;
  const first = Math.max(epoch(weekStart), epoch(from));
  const last = Math.min(epoch(weekEnd), epoch(to));
  if (first > last || days <= 0) return 0;
  const cents = Math.round(total * 100);
  const accumulated = day => Math.round(cents * (day - epoch(from)) / days);
  return (accumulated(last + 1) - accumulated(first)) / 100;
}

export function closingTotals(form) {
  const n = key => amount(form[key]);
  const extraordinary = form.conceptosExtraordinarios ?? [];
  const extra = type => extraordinary.reduce((sum, entry) =>
    entry.type === type ? sum + Math.round(amount(entry.amount) * 100) : sum, 0) / 100;
  const ingresos = money(n('totalCargasDinero') + n('totalVentasDesechoDinero') + n('totalVentasProcesoDinero') + extra('ingreso'));
  const egresos = money(n('totalEntradasFrutaDinero') + n('totalGastos') + n('totalCuadrillaDinero') +
    n('totalBrokerNotes') + n('nominaSemanal') + n('totalFletes') + n('rentaAplicada') +
    n('porcentajeLuz') + n('otrosFijos') + extra('egreso'));
  const salidas = n('totalCargasKg') + n('totalProcesoKg') + n('totalDesechoKg') + n('mermaKg');
  return {
    ingresos, egresos, resultado: money(ingresos - egresos), salidas,
    kilosPendientes: n('totalEntradasFrutaKg') - salidas - n('frioKg'),
  };
}
