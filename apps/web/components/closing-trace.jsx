import {amount} from '@/utils/closing-period';
import ClosingLots from '@/components/closing-lots';

const mxn = value => amount(value).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const date = value => String(value || '').slice(0,10);
const table = 'w-full text-sm text-left [&_td]:p-2 [&_th]:p-2 whitespace-nowrap [&_tr]:border-b';
const input = 'ml-2 rounded-lg border border-slate-300 p-2 w-36';

export default function ClosingTrace({data,period,form,setField}) {
  if (!data?.origen) return null;
  const saved = data.guardado;
  return <section className="space-y-4 rounded-xl border border-emerald-200 p-4">
    <ClosingLots origin={data.origen} start={period.start} end={period.end}/>
    {saved?.estado === 'cerrado' && <p className="bg-slate-100 p-2 rounded text-sm">Resultado al cerrar {mxn(saved.resultado)}. Los importes vivos reflejan ventas y gastos cargados después del cierre.</p>}
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
