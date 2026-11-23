import {amount} from '@/utils/closing-period';

const mxn = value => amount(value).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const kg = value => amount(value).toLocaleString('es-MX',{maximumFractionDigits:2});
const date = value => String(value || '').slice(0,10);
const table = 'w-full text-sm text-left [&_td]:p-2 [&_th]:p-2 whitespace-nowrap [&_tr]:border-b';
const input = 'ml-2 rounded-lg border border-slate-300 p-2 w-36';

export default function ClosingTrace({data,form,setField}) {
  if (!data?.origen) return null;
  const o = data.origen;
  const saved = data.guardado;
  return <section className="space-y-4 rounded-xl border border-emerald-200 p-4">
    <div><h3 className="font-semibold">Cierre vivo por semana de recepción</h3><p className="text-sm text-slate-600">El embarque conserva su fecha y actualiza el saldo de la semana de ingreso del lote.</p></div>
    {saved?.estado === 'cerrado' && <p className="bg-slate-100 p-2 rounded text-sm">Resultado al cerrar {mxn(saved.resultado)}. Los importes vivos reflejan ventas y gastos cargados después del cierre.</p>}
    {o.lotes.some(lote=>lote.cost == null) && <p role="status" className="text-sm text-amber-900">Hay lotes sin precio de compra. El egreso de fruta todavía está incompleto.</p>}
    {o.embarques_sin_recepcion.length > 0 && <details className="text-sm text-amber-900"><summary className="cursor-pointer">{o.embarques_sin_recepcion.length} partidas sin recepción verificable en la semana de venta</summary><ul>{o.embarques_sin_recepcion.map((row,i)=><li key={i}>Nota {row.nota || '—'} · Embarque #{row.load_id} · Lote #{row.lot_id || 'pendiente'}</li>)}</ul></details>}
    {o.ventas_pendientes_mxn.length > 0 && <p className="text-sm text-amber-900">Algunas ventas carecen de moneda o de tipo de cambio registrado. Sus kilos e importes originales se muestran. El resultado en MXN queda parcial.</p>}
    <div className="overflow-auto">
      <table className={table}><thead className="bg-slate-50"><tr><th>Lote / recepción</th><th>Recibido kg</th><th>En frío kg</th><th>Vendido kg</th><th>Detalle</th></tr></thead>
        <tbody>{o.lotes.map(lot=><tr key={lot.lot_id}>
          <td><strong>{lot.lot_number}</strong><span className="block text-xs">{date(lot.received_on)} · {lot.producer}</span></td>
          <td>{kg(lot.kg)}</td><td>{kg(lot.cold_kg)}</td><td>{kg(lot.sold_kg)}</td>
          <td className="whitespace-normal min-w-64">
            <details><summary className="cursor-pointer">Ver origen y movimientos</summary>
              <p className="text-xs mt-2">Recepción {lot.source === 'weighings' ? 'individual' : 'de báscula'} · Registros {lot.source_ids?.join(', ')}</p>
              <p className="text-xs">Corridas {lot.production_ids?.join(', ') || '—'} · Proceso {kg(lot.process_kg)} kg · Desecho {kg(lot.waste_kg)} kg · Merma {kg(lot.loss_kg)} kg</p>
              {lot.cold_details.map(p=><p key={p.id} className="text-xs">Frío · Tarima {p.folio || '#' + p.id} · {p.caliber} · {kg(p.kg)} kg · {p.status}</p>)}
              {lot.sales.map(s=><p key={s.load_id} className="text-xs mt-1">Venta {date(s.fecha)} · Nota {s.nota || '—'} · Embarque #{s.load_id} · {kg(s.kg)} kg · {s.importe ?? 'pendiente'} {s.moneda || ''} · Tarimas {s.tarimas.map(p=>p.folio || '#' + p.id).join(', ') || 'Sin vínculo histórico'}</p>)}
              {lot.waste_sales.map(s=><p key={s.id} className="text-xs">Venta de proceso/desecho #{s.id} · {date(s.fecha)} · {s.folio || '—'} · {mxn(s.importe)}</p>)}
            </details>
          </td>
        </tr>)}</tbody>
      </table>
      {!o.lotes.length && <p className="text-sm p-2">Sin recepciones verificadas en la semana.</p>}
    </div>
    <h4 className="font-semibold">Gastos fijos aplicados a la semana</h4>
    <label className="text-sm">Renta proporcional manual (MXN)
      <input className={input} type="number" step="0.01" min="0" placeholder={String(data.renta_automatica)}
        disabled={['cerrado','aprobado'].includes(form.status)} value={form.porcentajeRenta}
        onChange={e=>setField('porcentajeRenta',e.target.value)}/>
    </label>
    <p className="text-xs text-slate-600">Cuando el campo está vacío se usa la proporción capturada en Gastos.</p>
    <div className="overflow-auto"><table className={table}><thead className="bg-slate-50"><tr><th>Concepto / gasto</th><th>Periodo de servicio</th><th>Estado</th><th>Asignación semanal</th></tr></thead>
      <tbody>{data.conceptos_fijos.details.map(row=><tr key={row.id}><td>{row.label} · #{row.id}{row.reference ? ' · ' + row.reference : ''}</td>
        <td>{row.from} a {row.to}</td><td>{row.status}{row.paymentDate ? ' · ' + row.paymentDate : ''}</td>
        <td>{mxn(row.portion)}{row.concept === 'renta' && form.porcentajeRenta !== '' ? ' (reemplazada por renta manual)' : ''}</td>
      </tr>)}</tbody></table>
      {!data.conceptos_fijos.details.length && <p className="text-sm mt-2">Sin gastos fijos con periodo de servicio en esta semana.</p>}
    </div>
    <a href="/expenses" className="text-sm font-medium text-emerald-800 underline">Abrir Gastos fijos</a>
    <details><summary className="cursor-pointer text-sm">Detalle de otros egresos</summary>
      <div className="overflow-auto"><table className={table}><thead className="bg-slate-50"><tr><th>Concepto / registro</th><th>Fecha</th><th>Importe</th></tr></thead>
        <tbody>{data.movimientos_mxn.map(row=><tr key={row.concept + ':' + row.source_id}>
          <td>{row.concept} · #{row.source_id}{row.reference ? ' · ' + row.reference : ''}</td>
          <td>{date(row.date)}</td><td>{row.amount == null ? 'Pendiente' : mxn(row.amount)}</td>
        </tr>)}</tbody></table></div>
      {!data.movimientos_mxn.length && <p className="text-sm">Sin egresos adicionales registrados.</p>}
    </details>
    <details><summary className="cursor-pointer text-sm">Fuentes del cierre</summary><dl className="text-sm mt-2">{data.fuentes.map(([label,description])=><div key={label} className="mb-2"><dt className="font-semibold">{label}</dt><dd>{description}</dd></div>)}</dl></details>
  </section>;
}
