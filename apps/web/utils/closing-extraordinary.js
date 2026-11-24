export function normalizeExtraordinaryEntry(entry) {
  const concept = typeof entry?.concept === 'string' ? entry.concept.trim() : '';
  const value = entry?.amount;
  const rawAmount = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  const amount = Number(rawAmount);
  if (typeof entry?.id !== 'string' || !/^[a-z0-9-]{1,64}$/i.test(entry.id) ||
      !['ingreso', 'egreso'].includes(entry?.type) ||
      !concept || concept.length > 160 || !/^\d+(\.\d{1,2})?$/.test(rawAmount) ||
      amount <= 0 || amount > 1_000_000_000) {
    throw new Error('Indica un concepto y un importe positivo en MXN, con hasta dos decimales.');
  }
  return { id: entry.id, type: entry.type, concept, amount };
}

export function normalizeExtraordinaryEntries(entries) {
  if (!Array.isArray(entries) || entries.length > 200) {
    throw new Error('Puedes registrar hasta 200 conceptos extraordinarios por cierre.');
  }
  const normalized = entries.map(normalizeExtraordinaryEntry);
  if (new Set(normalized.map(entry => entry.id)).size !== normalized.length) {
    throw new Error('Hay conceptos extraordinarios con identificadores duplicados.');
  }
  return normalized;
}

export function getExtraordinaryEntries(closing) {
  let detail = closing?.detalle_integral;
  if (typeof detail === 'string') {
    try { detail = JSON.parse(detail); } catch { return []; }
  }
  return Array.isArray(detail?.conceptos_extraordinarios) ? detail.conceptos_extraordinarios : [];
}

export function sameExtraordinaryEntries(first, second) {
  const fields = entries => entries.map(entry => [entry?.id, entry?.type, entry?.concept, entry?.amount]);
  return Array.isArray(first) && Array.isArray(second) && JSON.stringify(fields(first)) === JSON.stringify(fields(second));
}
