'use client';

import {useEffect,useState} from 'react';
import {fixedConcepts,mexicoToday} from '@/utils/closing-period';

const blank = () => ({concept:'renta',from:'',to:'',reference:'',estimate:'',requestId:crypto.randomUUID()});
const fmt = value => Number(value).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const input = 'w-full rounded-lg border border-slate-300 p-2 text-sm';
const button = 'rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function FixedExpenses({editable}) {
  const [rows,setRows] = useState([]);
  const [form,setForm] = useState(null);
  const [edit,setEdit] = useState(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');

  async function read() {
    try {
      const res = await fetch('/api/expenses/fixed',{cache:'no-store'});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data);
    } catch (error) { setMessage(error.message); }
  }
  useEffect(() => {read();},[]);

  async function save(event,method,body) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/expenses/fixed',{
        method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(current => [data,...current.filter(row => row.id !== data.id)]);
      setForm(null);
      setEdit(null);
      setMessage(method === 'POST' ? 'Estimado guardado.' : 'Importe actualizado en las semanas del periodo.');
    } catch (error) {setMessage(error.message);}
    finally {setBusy(false);}
  }

  const startEdit = (row,action) => setEdit({id:row.id,revision:row.revision,action,
    value:action === 'pay' ? row.paid ?? '' : row.estimate,
    paymentDate:row.paymentDate || mexicoToday(),invoice:row.invoice || ''});

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <div><h2 className="font-bold text-lg">Gastos fijos</h2>
        <p className="text-sm text-slate-600">El cierre reparte el importe por días del servicio. El pago real reemplaza el estimado.</p></div>
        {editable && <button type="button" className={button} onClick={() => setForm(blank())}>Nuevo estimado</button>}
      </div>
      {form && <form onSubmit={event => save(event,'POST',form)} className="grid sm:grid-cols-3 gap-3 border rounded-xl p-3 mt-4">
        <label className="text-sm">Concepto<select className={input} value={form.concept} onChange={e=>setForm({...form,concept:e.target.value})}>
          {Object.entries(fixedConcepts).map(([code,label])=><option key={code} value={code}>{label}</option>)}
        </select></label>
        <label className="text-sm">Inicio del servicio<input className={input} type="date" required value={form.from} onChange={e=>setForm({...form,from:e.target.value})}/></label>
        <label className="text-sm">Fin del servicio<input className={input} type="date" required min={form.from} value={form.to} onChange={e=>setForm({...form,to:e.target.value})}/></label>
        <label className="text-sm">Referencia de servicio<input className={input} maxLength={140} value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="Medidor, contrato o unidad"/></label>
        <label className="text-sm">Estimado total (MXN)<input className={input} type="number" min="0" step="0.01" required value={form.estimate} onChange={e=>setForm({...form,estimate:e.target.value})}/></label>
        <div className="flex gap-2 items-end"><button disabled={busy} className={button}>Guardar</button><button type="button" onClick={()=>setForm(null)} className="p-2 text-sm">Cancelar</button></div>
      </form>}
      {edit && <form onSubmit={event=>save(event,'PUT',edit)} className="grid sm:grid-cols-4 gap-3 border rounded-xl p-3 mt-4">
        <label className="text-sm">{edit.action === 'pay' ? 'Pago real (MXN)' : 'Estimado (MXN)'}<input className={input} type="number" min="0" step="0.01" required value={edit.value} onChange={e=>setEdit({...edit,value:e.target.value})}/></label>
        {edit.action === 'pay' && <>
          <label className="text-sm">Fecha de pago<input className={input} type="date" required value={edit.paymentDate} onChange={e=>setEdit({...edit,paymentDate:e.target.value})}/></label>
          <label className="text-sm">Referencia / recibo<input className={input} maxLength={140} value={edit.invoice} onChange={e=>setEdit({...edit,invoice:e.target.value})}/></label>
        </>}
        <div className="flex gap-2 items-end"><button disabled={busy} className={button}>Guardar</button><button type="button" onClick={()=>setEdit(null)} className="p-2 text-sm">Cancelar</button></div>
      </form>}
      {message && <p role="status" className="text-sm mt-3">{message}</p>}
      <div className="overflow-auto mt-3">
        <table className="w-full text-sm text-left"><thead className="bg-slate-50"><tr><th className="p-2">Concepto</th><th>Servicio</th><th>Estimado</th><th>Pago real</th><th>Acciones</th></tr></thead>
          <tbody>{rows.map(row=><tr key={row.id} className="border-t">
            <td className="p-2 font-medium">#{row.id} {row.label}<span className="block text-xs text-slate-500">{row.reference}</span></td>
            <td>{row.from} a {row.to}</td><td>{fmt(row.estimate)}</td>
            <td>{row.paid === null ? 'Pendiente' : <>{fmt(row.paid)}<span className="block text-xs">{row.paymentDate} {row.invoice}</span></>}</td>
            <td>{editable && <div className="flex flex-wrap gap-2">
              {row.paid === null && <button type="button" className="text-sm underline" onClick={()=>startEdit(row,'estimate')}>Editar estimado</button>}
              <button type="button" className="text-sm underline" onClick={()=>startEdit(row,'pay')}>{row.paid === null ? 'Registrar pago' : 'Corregir pago'}</button>
            </div>}</td>
          </tr>)}</tbody></table>
      </div>
      {!rows.length && <p className="text-sm mt-2 text-slate-500">Sin gastos fijos registrados.</p>}
    </section>
  );
}
