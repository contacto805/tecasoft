'use client';

import { useState } from 'react';
import { AlertCircle, ChevronDown, Package, Search, Snowflake, Truck } from 'lucide-react';
import { amount } from '@/utils/closing-period';

const kg = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const day = value => String(value || '').slice(0, 10) || 'Sin fecha';
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const filters = [['all', 'Todos'], ['cold', 'En frío'], ['sold', 'Con ventas'], ['pending', 'Con pendientes']];

function LotOrigin({ lot }) {
  const receipt = lot.source === 'weighings' ? 'Pesadas individuales' : 'Pesadas de ingreso';
  return (
    <details className="group min-w-44">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-emerald-800">
        Ver movimientos <ChevronDown size={15} className="group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-3 space-y-2 whitespace-normal rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
        <p><b>Recepción</b> · {receipt} · Registros {lot.source_ids?.join(', ') || '—'}</p>
        <p><b>Producción</b> · Corridas {lot.production_ids?.join(', ') || '—'} · Proceso {kg.format(amount(lot.process_kg))} kg · Desecho {kg.format(amount(lot.waste_kg))} kg · Merma {kg.format(amount(lot.loss_kg))} kg</p>
        {(lot.cold_details ?? []).map(p => (
          <p key={p.id}><b>Frío</b> · Tarima {p.folio || `#${p.id}`} · {p.caliber || 'Sin calibre'} · {kg.format(amount(p.kg))} kg · {p.status || 'Sin estado'}</p>
        ))}
        {(lot.sales ?? []).map(s => (
          <p key={s.load_id}><b>Embarque #{s.load_id}</b> · {day(s.fecha)} · Nota {s.nota || '—'} · {kg.format(amount(s.kg))} kg · {s.importe ?? 'Importe pendiente'} {s.moneda || ''} · Tarimas {s.tarimas?.map(p => p.folio || `#${p.id}`).join(', ') || 'Sin vínculo histórico'}</p>
        ))}
        {(lot.waste_sales ?? []).map(s => (
          <p key={s.id}><b>Venta de proceso o desecho #{s.id}</b> · {day(s.fecha)} · {s.folio || '—'} · {s.importe == null ? 'Importe pendiente' : mxn.format(amount(s.importe))}</p>
        ))}
      </div>
    </details>
  );
}

export default function ClosingLots({ origin, start, end, sample = false }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const lots = origin.lotes ?? [];
  const unresolved = origin.embarques_sin_recepcion ?? [];
  const currencyPending = origin.ventas_pendientes_mxn ?? [];
  const pendingIds = new Set(currencyPending.map(sale => String(sale.lot_id)));
  const missingPrice = lots.filter(lot => lot.cost == null).length;
  const totals = [
    ['Fruta recibida', origin.kg_recibidos, Package],
    ['Inventario en frío', origin.kg_frio, Snowflake],
    ['Fruta vendida', origin.kg_vendidos, Truck],
  ];
  const matches = lots.filter(lot => {
    const text = normalize(`${lot.lot_number ?? ''} ${lot.producer ?? ''}`);
    if (!text.includes(normalize(query.trim()))) return false;
    if (filter === 'cold') return amount(lot.cold_kg) > 0;
    if (filter === 'sold') return amount(lot.sold_kg) > 0;
    if (filter === 'pending') return lot.cost == null || pendingIds.has(String(lot.lot_id));
    return true;
  });

  return (
    <section aria-label="Seguimiento de lotes del cierre" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="bg-emerald-950 px-5 py-6 text-white sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold sm:text-2xl">Cierre por semana de recepción</h3>
          <span className="rounded-full bg-emerald-900 px-3 py-1 text-xs text-emerald-100">{day(start)} al {day(end)}</span>
        </div>
        <p className="mt-2 text-sm text-emerald-100">Las existencias y ventas se atribuyen a la semana de ingreso de cada lote. Cada embarque conserva su fecha.</p>
      </header>
      <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-3">
        {totals.map(([label, value, Icon]) => (
          <div key={label} className="flex items-center gap-3 bg-white px-5 py-4 sm:px-7">
            <Icon size={20} className="shrink-0 text-emerald-700" aria-hidden="true" />
            <div><p className="text-sm text-slate-600">{label}</p><p className="text-xl font-bold tabular-nums text-slate-900">{value == null ? '—' : `${kg.format(amount(value))} kg`}</p></div>
          </div>
        ))}
      </div>
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {(missingPrice > 0 || currencyPending.length > 0 || unresolved.length > 0) && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
            <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              {missingPrice > 0 && <p>Lotes sin precio de compra: {missingPrice}. El costo de fruta está incompleto.</p>}
              {currencyPending.length > 0 && <p>Partidas sin conversión verificable a MXN: {currencyPending.length}. El resultado en MXN es parcial.</p>}
              {unresolved.length > 0 && <details><summary className="cursor-pointer font-medium">Partidas sin recepción verificable: {unresolved.length}</summary><ul className="mt-1 space-y-1 pl-4">{unresolved.map(row => <li key={`${row.load_id}:${row.lot_id}`}>Embarque #{row.load_id} · Nota {row.nota || '—'} · Lote {row.lot_id ?? 'pendiente'}</li>)}</ul></details>}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex w-full items-center gap-2 rounded-lg border border-slate-300 px-3 sm:w-auto">
            <Search size={16} className="text-slate-500" aria-hidden="true" />
            <input aria-label="Buscar lote o productor" placeholder="Buscar lote o productor" value={query} onChange={event => setQuery(event.target.value)} className="w-full bg-transparent py-2 text-sm sm:w-52" />
          </label>
          <div role="group" aria-label="Filtrar lotes" className="flex flex-wrap gap-1.5">
            {filters.map(([id, label]) => <button key={id} type="button" aria-pressed={id === filter} onClick={() => setFilter(id)} className={id === filter ? 'rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white' : 'rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50'}>{label}</button>)}
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-2.5">
            <thead className="whitespace-nowrap bg-slate-50 text-xs text-slate-700"><tr><th scope="col">Lote / recepción</th><th scope="col">Recibido (kg)</th><th scope="col">En frío (kg)</th><th scope="col">Vendido (kg)</th><th scope="col">Trazabilidad</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {matches.map(lot => (
                <tr key={lot.lot_id} className="align-top">
                  <td className="min-w-40"><strong className="text-slate-950">{lot.lot_number || `#${lot.lot_id}`}</strong><span className="block text-xs text-slate-600">{day(lot.received_on)} · {lot.producer || 'Sin productor'}</span></td>
                  <td className="tabular-nums">{kg.format(amount(lot.kg))}</td>
                  <td className="tabular-nums text-emerald-800">{kg.format(amount(lot.cold_kg))}</td>
                  <td className="tabular-nums">{kg.format(amount(lot.sold_kg))}</td>
                  <td><LotOrigin lot={lot} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!matches.length && <p className="p-4 text-sm text-slate-600">{lots.length ? 'Ningún lote coincide con los filtros.' : 'Sin recepciones verificadas en la semana.'}</p>}
        </div>
        <p aria-live="polite" className="text-xs text-slate-600">{matches.length} de {lots.length} lotes · {sample ? 'Datos de ejemplo' : 'Los totales corresponden a toda la semana'}</p>
      </div>
    </section>
  );
}
