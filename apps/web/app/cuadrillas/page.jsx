'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function fmt(n) {
  return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}
function fmtKg(n) {
  return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg';
}
function safeDateStr(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-MX', { timeZone: 'UTC' }); } catch { return '—'; }
}

export default function CuadrillasPage() {
  const router = useRouter();
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumen');
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [defaultRate, setDefaultRate] = useState(1.40);

  const [crewsCatalog, setCrewsCatalog] = useState([]);
  const [tarifario, setTarifario] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([
    {id:1,nombre:'ESTAQUITAS'},{id:2,nombre:'DOBLE'},{id:3,nombre:'RABÓN'},{id:4,nombre:'TORTÓN'}
  ]);

  const [currentCuts, setCurrentCuts] = useState([]);
  const [currentFreights, setCurrentFreights] = useState([]);
  const [currentAdjustments, setCurrentAdjustments] = useState([]);
  const [dailySummary, setDailySummary] = useState([]);
  const [crewSummary, setCrewSummary] = useState([]);

  // Filters
  const [filterCrew, setFilterCrew] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Forms
  const [adjustForm, setAdjustForm] = useState({ cutting_order_id: '', adjustment_kg: '', tipo_ajuste: 'ERROR_PESAJE', justificacion: '', evidence_url: '' });
  const [fleteForm, setFleteForm] = useState({ cutting_order_id: '', origin: '', destination: '', vehicle_type_id: '', applied_rate: '', manual_reason: '' });
  const [tarifaForm, setTarifaForm] = useState({ origin: '', destination: '', distance_km: '', vehicle_type_id: '', rate: '' });
  const [showNewWeek, setShowNewWeek] = useState(false);
  const [newWeek, setNewWeek] = useState({ week_start_date: '', week_end_date: '' });

  const tabs = ['resumen','cortes','cuadrillas','fletes','tarifario','ajustes','pagos'];

  useEffect(() => { fetchAll(); loadCatalogs(); }, []);

  async function fetchAll(weekStart = null, weekEnd = null) {
    setLoading(true);
    try {
      let url = '/api/cuadrillas';
      if (weekStart && weekEnd) url += `?week_start=${weekStart}&week_end=${weekEnd}`;
      const res = await fetch(url);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setClosings(list);

      let target = selectedWeek;
      if (weekStart && weekEnd && list.length) target = list[0];
      else if (!target && list.length) target = list[0];

      setSelectedWeek(target);
      if (target) loadWeekData(target);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function loadWeekData(closing) {
    if (!closing) return;
    const cuts = Array.isArray(closing.crews) ? closing.crews : [];
    setCurrentCuts(cuts);
    setCurrentFreights(Array.isArray(closing.freights) ? closing.freights : []);
    setCurrentAdjustments(Array.isArray(closing.adjustments) ? closing.adjustments : []);
    setDailySummary(closing.daily_summary || []);
    setCrewSummary(closing.crew_summary || []);
  }

  async function loadCatalogs() {
    try {
      const [crewsRes, tarRes, cfgRes] = await Promise.all([
        fetch('/api/crews').then(r => r.ok ? r.json() : []).catch(()=>[]),
        fetch('/api/cuadrillas', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'get_tarifario'})}).then(r=>r.json()).catch(()=>[]),
        fetch('/api/app-config').then(r=>r.json()).catch(()=>({}))
      ]);
      setCrewsCatalog(Array.isArray(crewsRes) ? crewsRes : []);
      setTarifario(Array.isArray(tarRes) ? tarRes : []);
      const r = parseFloat(cfgRes?.operational_rules?.crew_default_rate || 1.40);
      setDefaultRate(r || 1.40);
    } catch {}
  }

  // Indicators (spec point 31)
  const totalKg = currentCuts.reduce((s,c) => s + parseFloat(c.payable_kg || c.real_kg || 0), 0);
  const payCuadrillas = currentCuts.reduce((s,c) => s + (parseFloat(c.crew_pay) || 0), 0);
  const payFletes = currentCuts.reduce((s,c) => s + parseFloat(c.applied_freight_amount || c.freight_cost || 0), 0) + currentFreights.reduce((s,f)=>s+parseFloat(f.price||0),0);
  const totalCosto = payCuadrillas + payFletes;
  const numCortes = currentCuts.length;
  const ajustesCount = currentAdjustments.length;
  const sinFlete = currentCuts.filter(c => !c.applied_freight_amount && !c.freight_cost).length;
  const pendientesAuth = currentCuts.filter(c => (c.status_crew || '').toUpperCase() !== 'AUTORIZADO').length;

  const filteredCuts = currentCuts.filter(c => {
    if (filterCrew && String(c.crew_id) !== filterCrew) return false;
    if (filterStatus && (c.status_crew || c.status || '').toUpperCase() !== filterStatus) return false;
    return true;
  });

  // Semana change
  const onWeekChange = (id) => {
    const found = closings.find(c => String(c.id) === String(id));
    setSelectedWeek(found);
    if (found) loadWeekData(found);
  };

  async function createWeek() {
    if (!newWeek.week_start_date || !newWeek.week_end_date) return alert('Rango requerido');
    await fetch('/api/cuadrillas', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'create_closing', ...newWeek}) });
    setShowNewWeek(false);
    setNewWeek({week_start_date:'', week_end_date:''});
    await fetchAll(newWeek.week_start_date, newWeek.week_end_date);
  }

  // Actions wired to cutting_orders as master
  async function assignCrew(cutId, crewId) {
    if (!crewId) return;
    await fetch('/api/cuadrillas', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'assign_crew', cutting_order_id: cutId, crew_id: crewId})});
    await fetchAll();
  }

  async function doAdjust() {
    if (!adjustForm.cutting_order_id || !adjustForm.justificacion) return alert('Corte + justificación obligatorios');
    const payload = {...adjustForm, adjustment_kg: parseFloat(adjustForm.adjustment_kg)};
    await fetch('/api/cuadrillas', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'adjust_cut', ...payload})});
    setAdjustForm({cutting_order_id:'', adjustment_kg:'', tipo_ajuste:'ERROR_PESAJE', justificacion:'', evidence_url:''});
    await fetchAll();
  }

  async function uploadEvidence(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const up = await fetch('/api/upload', {method:'POST', body: fd});
    const json = await up.json();
    if (json?.url) setAdjustForm(prev => ({...prev, evidence_url: json.url}));
  }

  async function assignFleteToCut() {
    if (!fleteForm.cutting_order_id || !fleteForm.applied_rate) return;
    await fetch('/api/cuadrillas', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'assign_freight', ...fleteForm})});
    setFleteForm({cutting_order_id:'', origin:'', destination:'', vehicle_type_id:'', applied_rate:'', manual_reason:''});
    await fetchAll();
  }

  async function authorizeCut(cutId) {
    await fetch('/api/cuadrillas', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'authorize_cut', cutting_order_id: cutId})});
    await fetchAll();
  }

  async function createPaymentForCrew(crewId) {
    if (!selectedWeek) return;
    await fetch('/api/cuadrillas', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
      action:'create_payment', crew_id: crewId, week_start_date: selectedWeek.week_start_date, week_end_date: selectedWeek.week_end_date
    })});
    alert('Pago generado. Ver en pestaña Pagos o Cierre Semanal.');
    await fetchAll();
  }

  async function saveTarifario() {
    if (!tarifaForm.origin || !tarifaForm.rate) return;
    await fetch('/api/cuadrillas', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'save_tarifario', ...tarifaForm})});
    setTarifaForm({origin:'', destination:'', distance_km:'', vehicle_type_id:'', rate:''});
    const t = await fetch('/api/cuadrillas', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'get_tarifario'})}).then(r=>r.json());
    setTarifario(Array.isArray(t) ? t : []);
  }

  // RESUMEN daily + crew summary (spec 28,29,30)
  function renderResumen() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">KG CORTADOS ESTA SEMANA</div><div className="text-2xl font-bold">{totalKg.toFixed(0)} kg</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">PAGO CUADRILLAS</div><div className="text-2xl font-bold text-green-700">{fmt(payCuadrillas)}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">COSTO DE FLETES</div><div className="text-2xl font-bold text-orange-600">{fmt(payFletes)}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">COSTO TOTAL CORTE</div><div className="text-2xl font-bold">{fmt(totalCosto)}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">NÚMERO DE CORTES</div><div className="text-2xl font-bold">{numCortes}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">AJUSTES REALIZADOS</div><div className="text-2xl font-bold text-amber-600">{ajustesCount}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">PENDIENTES AUTORIZACIÓN</div><div className="text-2xl font-bold text-red-600">{pendientesAuth}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">CORTES SIN FLETE</div><div className="text-2xl font-bold text-slate-700">{sinFlete}</div></div>
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-3">Resumen Diario por Cuadrilla</div>
          {dailySummary.length === 0 ? <div className="text-sm text-slate-500">Sin datos de la semana.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 border-b"><th className="py-1 text-left">Día</th><th>Cuadrilla</th><th className="text-right">Cortes</th><th className="text-right">Kg</th><th className="text-right">Importe</th></tr></thead>
                <tbody>
                  {dailySummary.map((d,i)=>(
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5">{safeDateStr(d.day)}</td>
                      <td>{d.crew_name}</td>
                      <td className="text-right">{d.cortes}</td>
                      <td className="text-right">{fmtKg(d.kg)}</td>
                      <td className="text-right font-semibold text-green-700">{fmt(d.crew_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-3">Resumen Semanal por Cuadrilla (Cuadrillas + Fletes separados)</div>
          {crewSummary.length === 0 ? <div className="text-sm text-slate-500">Sin datos.</div> : crewSummary.map((cs,i)=> (
            <div key={i} className="flex flex-wrap justify-between items-center py-2 border-b text-sm">
              <div>{cs.crew_name} — {cs.cortes} cortes</div>
              <div className="text-right">
                Kg orig: {fmtKg(cs.kg_originales)} | Ajustes: {fmtKg(cs.ajustes)} | Pagables: {fmtKg(cs.kg_pagables)}<br/>
                <span className="font-semibold text-green-700">Cuadrilla: {fmt(cs.importe_cuadrilla)}</span>
              </div>
              <button onClick={()=>createPaymentForCrew(cs.crew_id)} className="text-xs px-3 py-1 bg-green-600 text-white rounded">Generar Pago</button>
            </div>
          ))}
          <div className="mt-3 text-xs text-slate-500">Costo Total Operación = Cuadrillas + Fletes (separados).</div>
        </div>
      </div>
    );
  }

  // CORTES table (spec 25)
  function renderCortes() {
    return (
      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="p-3 border-b flex gap-2 items-center text-sm">
          <select value={filterCrew} onChange={e=>setFilterCrew(e.target.value)} className="border rounded px-2 py-1"><option value="">Todas cuadrillas</option>{crewsCatalog.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border rounded px-2 py-1"><option value="">Todos estatus</option><option>PROGRAMADO</option><option>EN_CORTE</option><option>CORTE_TERMINADO</option><option>AUTORIZADO</option><option>PAGADO</option></select>
          <div className="ml-auto text-xs text-slate-500">Fuente única: kg reales de Orden de Corte</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left">Fecha</th><th>Folio</th><th>Lote</th><th>Productor / Huerta</th>
                <th className="text-right">Kg Reales</th><th className="text-right">Ajuste</th><th className="text-right">Kg Pagables</th>
                <th>Cuadrilla</th><th className="text-right">Tarifa</th><th className="text-right">Importe Cuadrilla</th>
                <th>Tipo Flete</th><th>Destino</th><th className="text-right">Costo Flete</th><th className="text-right">Total Corte</th>
                <th>Estatus</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCuts.length === 0 && <tr><td colSpan={16} className="p-6 text-center text-slate-500">Sin cortes. Los datos vienen de Órdenes de Corte.</td></tr>}
              {filteredCuts.map((c,idx) => {
                const kgReal = parseFloat(c.real_kg || c.total_kg || 0);
                const kgPag = parseFloat(c.payable_kg || kgReal);
                const adj = parseFloat(c.adjustment_kg || 0);
                const rate = parseFloat(String(c.applied_rate || c.crew_pay ? (c.crew_pay / (kgPag||1)) : defaultRate));
                const impCuad = parseFloat(c.crew_pay) || (kgPag * rate);
                const flete = parseFloat(c.applied_freight_amount || c.freight_cost || 0);
                const total = impCuad + flete;
                const est = (c.status_crew || c.status || 'PENDIENTE').toUpperCase();
                return (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="p-2">{safeDateStr(c.cutting_date)}</td>
                    <td className="font-mono text-xs">{c.folio}</td>
                    <td className="text-xs">{c.lot_number || c.lot_id}</td>
                    <td>{c.producer_name} / {c.orchard_name}</td>
                    <td className="text-right">{fmtKg(kgReal)}</td>
                    <td className="text-right text-amber-600">{adj ? (adj>0?'+':'') + fmtKg(adj) : '—'}</td>
                    <td className="text-right font-medium">{fmtKg(kgPag)}</td>
                    <td>
                      <select value={c.crew_id || ''} onChange={e=>assignCrew(c.id, e.target.value)} className="text-xs border rounded p-0.5">
                        <option value="">—</option>
                        {crewsCatalog.map(cr=><option key={cr.id} value={cr.id}>{cr.clave || cr.nombre}</option>)}
                      </select>
                      <div className="text-[10px] text-slate-500">{c.crew_chief_name}</div>
                    </td>
                    <td className="text-right text-xs">{rate.toFixed(2)}</td>
                    <td className="text-right font-semibold text-green-700">{fmt(impCuad)}</td>
                    <td className="text-xs">{c.rate_source === 'MANUAL' ? 'Manual' : 'Tarifario'}</td>
                    <td className="text-xs">{c.freight_destination || c.freight_origin || '—'}</td>
                    <td className="text-right text-orange-600">{fmt(flete)}</td>
                    <td className="text-right font-bold">{fmt(total)}</td>
                    <td><span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100">{est}</span></td>
                    <td className="text-xs space-x-1">
                      <button onClick={()=>authorizeCut(c.id)} className="px-1.5 py-0.5 border rounded">Autorizar</button>
                      <button onClick={()=>{setAdjustForm({...adjustForm, cutting_order_id: c.id}); setActiveTab('ajustes');}} className="px-1.5 py-0.5 border rounded">Ajustar</button>
                      <button onClick={()=>{setFleteForm({...fleteForm, cutting_order_id: c.id}); setActiveTab('fletes');}} className="px-1.5 py-0.5 border rounded">Flete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 text-[11px] text-slate-500 border-t">Kg Reales = fuente maestra (Orden de Corte / pesada real). Kg Pagables = Reales + Ajuste autorizado. Tarifa congelada por corte.</div>
      </div>
    );
  }

  function renderCatalog() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-2">Catálogo de Cuadrillas</div>
          {crewsCatalog.length ? crewsCatalog.map(cr => (
            <div key={cr.id} className="py-1.5 border-b text-sm flex justify-between">
              <span>{cr.clave || 'CUA'} — {cr.nombre} ({cr.responsable || '—'})</span>
              <span className="text-xs text-slate-500">Base ${parseFloat(cr.tarifa_default_por_kg || defaultRate)}/kg</span>
            </div>
          )) : <div className="text-sm text-slate-500">Crea cuadrillas desde el catálogo central o Superadmin.</div>}
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-2">Resumen Semanal por Cuadrilla</div>
          {crewSummary.map((cs,i)=>(
            <div key={i} className="text-sm py-1 border-b"> {cs.crew_name}: {cs.cortes} cortes · {fmtKg(cs.kg_pagables)} · {fmt(cs.importe_cuadrilla)}</div>
          ))}
        </div>
      </div>
    );
  }

  function renderFletes() {
    return (
      <div className="space-y-4">
        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-3">Asignar Flete (Tarifario o Destino Independiente)</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            <select value={fleteForm.cutting_order_id} onChange={e=>setFleteForm({...fleteForm, cutting_order_id:e.target.value})} className="border p-2 rounded"><option value="">Orden de Corte</option>{currentCuts.map(c=><option key={c.id} value={c.id}>{c.folio}</option>)}</select>
            <input placeholder="Origen" value={fleteForm.origin} onChange={e=>setFleteForm({...fleteForm,origin:e.target.value})} className="border p-2 rounded" />
            <input placeholder="Destino" value={fleteForm.destination} onChange={e=>setFleteForm({...fleteForm,destination:e.target.value})} className="border p-2 rounded" />
            <select value={fleteForm.vehicle_type_id} onChange={e=>setFleteForm({...fleteForm,vehicle_type_id:e.target.value})} className="border p-2 rounded">{vehicleTypes.map(v=><option key={v.id} value={v.id}>{v.nombre}</option>)}</select>
            <input type="number" placeholder="Precio acordado" value={fleteForm.applied_rate} onChange={e=>setFleteForm({...fleteForm,applied_rate:e.target.value})} className="border p-2 rounded" />
          </div>
          <input placeholder="Justificación (obligatoria si manual / destino independiente)" value={fleteForm.manual_reason} onChange={e=>setFleteForm({...fleteForm,manual_reason:e.target.value})} className="mt-2 w-full border p-2 rounded text-sm" />
          <button onClick={assignFleteToCut} className="mt-2 px-4 py-1.5 bg-orange-600 text-white rounded-xl text-sm">Asignar Flete (congela tarifa)</button>
          <div className="text-xs mt-1 text-slate-500">Costo Flete siempre se muestra separado del pago a cuadrilla.</div>
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-2">Fletes de la semana</div>
          {currentFreights.length === 0 ? 'Sin fletes registrados.' : currentFreights.map((f,i)=><div key={i} className="text-sm py-0.5">{f.description || f.cutting_folio} — {fmt(f.price)}</div>)}
        </div>
      </div>
    );
  }

  function renderTarifario() {
    return (
      <div className="bg-white border rounded-2xl p-4">
        <div className="font-semibold mb-3">Tarifario de Fletes (central — cambios no afectan históricos)</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3 text-sm">
          <input placeholder="Origen" value={tarifaForm.origin} onChange={e=>setTarifaForm({...tarifaForm,origin:e.target.value})} className="border p-2 rounded" />
          <input placeholder="Destino" value={tarifaForm.destination} onChange={e=>setTarifaForm({...tarifaForm,destination:e.target.value})} className="border p-2 rounded" />
          <input placeholder="Km" type="number" value={tarifaForm.distance_km} onChange={e=>setTarifaForm({...tarifaForm,distance_km:e.target.value})} className="border p-2 rounded" />
          <select value={tarifaForm.vehicle_type_id} onChange={e=>setTarifaForm({...tarifaForm,vehicle_type_id:e.target.value})} className="border p-2 rounded">{vehicleTypes.map(v=><option key={v.id} value={v.id}>{v.nombre}</option>)}</select>
          <input placeholder="Tarifa $" type="number" value={tarifaForm.rate} onChange={e=>setTarifaForm({...tarifaForm,rate:e.target.value})} className="border p-2 rounded" />
        </div>
        <button onClick={saveTarifario} className="px-4 py-1 bg-slate-800 text-white rounded text-sm">Guardar tarifa</button>

        <div className="mt-4 text-xs text-slate-500">Tarifas actuales:</div>
        {tarifario.length ? tarifario.map((t,i)=><div key={i} className="text-sm py-0.5">{t.origin} → {t.destination} ({t.vehicle_type_name || '—'}) : {fmt(t.rate)}</div>) : <div className="text-sm text-slate-500">Sin tarifas configuradas.</div>}
      </div>
    );
  }

  function renderAjustes() {
    return (
      <div className="bg-white border rounded-2xl p-4 space-y-4">
        <div>
          <div className="font-semibold mb-2">Ajustar Corte (POSITIVO o NEGATIVO) — justificación + evidencia obligatorias</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <select value={adjustForm.cutting_order_id} onChange={e=>setAdjustForm({...adjustForm,cutting_order_id:e.target.value})} className="border p-2 rounded"><option value="">Selecciona corte</option>{currentCuts.map(c=><option key={c.id} value={c.id}>{c.folio} — {c.orchard_name}</option>)}</select>
            <input type="number" step="any" placeholder="Ajuste kg (ej -120 o +80)" value={adjustForm.adjustment_kg} onChange={e=>setAdjustForm({...adjustForm,adjustment_kg:e.target.value})} className="border p-2 rounded" />
            <select value={adjustForm.tipo_ajuste} onChange={e=>setAdjustForm({...adjustForm,tipo_ajuste:e.target.value})} className="border p-2 rounded">
              <option>ERROR_PESAJE</option><option>DIFERENCIA_CAMPO</option><option>FRUTA_NO_CORTADA</option><option>FRUTA_ADICIONAL</option><option>CORRECCION_CAPTURA</option><option>OTRO</option>
            </select>
            <input placeholder="Justificación obligatoria" value={adjustForm.justificacion} onChange={e=>setAdjustForm({...adjustForm,justificacion:e.target.value})} className="border p-2 rounded" />
          </div>
          <div className="mt-2">
            <input type="file" onChange={uploadEvidence} className="text-sm" />
            {adjustForm.evidence_url && <span className="ml-2 text-xs text-green-600">Evidencia adjunta</span>}
          </div>
          <button onClick={doAdjust} className="mt-3 px-4 py-1.5 bg-amber-600 text-white rounded-xl text-sm">Registrar Ajuste (congela originales)</button>
          <div className="text-xs mt-1 text-slate-500">kg_originales se conservan. Auditoría completa.</div>
        </div>

        <div>
          <div className="font-semibold mb-2">Historial de Ajustes</div>
          {currentAdjustments.length === 0 ? <div className="text-sm text-slate-500">Sin ajustes.</div> : currentAdjustments.map((a,i)=>(
            <div key={i} className="text-xs py-1 border-b"> {safeDateStr(a.fecha_hora)} — {a.folio}: {a.kg_originales} → {a.kg_resultantes} ({a.adjustment_kg}) — {a.justificacion} {a.evidence_url ? '📎' : ''}</div>
          ))}
        </div>
      </div>
    );
  }

  function renderPagos() {
    return (
      <div className="bg-white border rounded-2xl p-4">
        <div className="font-semibold mb-2">Pagos por Cuadrilla + Semana</div>
        <div className="text-sm">Genera desde el Resumen (botón Generar Pago por cuadrilla). Registra en crew_payments con folio PCUA-.</div>
        <div className="mt-4 text-sm">Total pagable semana actual: <b>{fmt(payCuadrillas)}</b></div>
        <div className="mt-2 text-xs text-slate-500">No permite doble pago del mismo corte. Integración con Cierre Semanal automática.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Cuadrillas</h1>
          <p className="text-slate-500 mt-1">Control de corte, cuadrillas, fletes y costos de campo. Fuente maestra: Órdenes de Corte + kg reales.</p>
          <p className="text-[10px] text-emerald-700 mt-0.5">REGLA FASE 03 B02: {'>'}5.000 kg cortados = por kg; ≤5.000 kg = por día. Excepciones (corredor/acuerdo) requieren autorización Super. Costo corte/flete registrado en fuente jamás duplicado en cierre semanal. Bonificaciones daño/maduración = movimientos separados (no alteran precio base).</p>
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">KG CORTADOS SEMANA</div><div className="text-2xl font-bold">{totalKg.toFixed(0)} kg</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">PAGO CUADRILLAS</div><div className="text-2xl font-bold text-green-700">{fmt(payCuadrillas)}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">COSTO DE FLETES</div><div className="text-2xl font-bold text-orange-600">{fmt(payFletes)}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">COSTO TOTAL CORTE</div><div className="text-2xl font-bold">{fmt(totalCosto)}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">NÚMERO DE CORTES</div><div className="text-2xl font-bold">{numCortes}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">AJUSTES</div><div className="text-2xl font-bold text-amber-600">{ajustesCount}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">PEND. AUTORIZAR</div><div className="text-2xl font-bold text-red-600">{pendientesAuth}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">SIN FLETE</div><div className="text-2xl font-bold">{sinFlete}</div></div>
        </div>

        {/* Semana principal */}
        <div className="flex flex-wrap gap-2 mb-4">
          <select value={selectedWeek?.id || ''} onChange={e=>onWeekChange(e.target.value)} className="border rounded-xl px-3 py-2 text-sm">
            {closings.map(c => <option key={c.id} value={c.id}>{c.week_start_date} — {c.week_end_date} ({c.status})</option>)}
          </select>
          <button onClick={()=>setShowNewWeek(!showNewWeek)} className="px-3 py-1.5 border rounded-xl text-sm">Nueva semana</button>
          <div className="ml-auto text-xs text-slate-500 self-center">Tarifa general: ${defaultRate}/kg (edita en Configuración)</div>
        </div>

        {showNewWeek && (
          <div className="bg-white border rounded-2xl p-3 mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
            <input type="date" value={newWeek.week_start_date} onChange={e=>setNewWeek({...newWeek,week_start_date:e.target.value})} className="border p-2 rounded" />
            <input type="date" value={newWeek.week_end_date} onChange={e=>setNewWeek({...newWeek,week_end_date:e.target.value})} className="border p-2 rounded" />
            <button onClick={createWeek} className="bg-brand-600 text-white rounded-xl">Crear Semana</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-4 border-b">
          {tabs.map(t => (
            <button key={t} onClick={()=>setActiveTab(t)} className={`px-4 py-2 text-sm font-medium rounded-t-xl ${activeTab===t ? 'bg-white border border-b-0' : 'text-slate-600 hover:bg-slate-100'}`}>{t.toUpperCase()}</button>
          ))}
        </div>

        {activeTab === 'resumen' && renderResumen()}
        {activeTab === 'cortes' && renderCortes()}
        {activeTab === 'cuadrillas' && renderCatalog()}
        {activeTab === 'fletes' && renderFletes()}
        {activeTab === 'tarifario' && renderTarifario()}
        {activeTab === 'ajustes' && renderAjustes()}
        {activeTab === 'pagos' && renderPagos()}

        {loading && <div className="text-xs text-slate-400 mt-4">Cargando...</div>}
      </div>
    </div>
  );
}
