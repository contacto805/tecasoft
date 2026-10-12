'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function fmt(n) {
  return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

export default function ControlFletesPage() {
  const router = useRouter();
  const [fletes, setFletes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ period: 'semana', cliente: '', transportista: '', estatus: '', destino: '' });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ credit_days: '', amount_paid: '', due_date: '', notes: '' });
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('pendientes');
  const [trailerTime] = useState(new Date().toLocaleString('es-MX'));

  useEffect(() => { loadAll(); }, [filters]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [fs, vs] = await Promise.all([
        fetch('/api/foreign-freights').then(r => r.json()).catch(() => []),
        fetch('/api/vehicles').then(r => r.json()).catch(() => [])
      ]);
      setFletes(Array.isArray(fs) ? fs : []);
      setVehicles(Array.isArray(vs) ? vs : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Apply client filters + period week logic
  const filtered = React.useMemo(() => {
    const today = new Date();
    let weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + 1); // approx Mon
    let weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 5);

    return (fletes || []).filter(f => {
      // period
      if (filters.period === 'semana') {
        const fd = f.due_date ? new Date(f.due_date) : (f.freight_date ? new Date(f.freight_date) : null);
        if (!fd) return false;
        if (!(fd >= weekStart && fd <= weekEnd)) return false;
      } else if (filters.period === 'mes') {
        const fd = new Date(f.due_date || f.freight_date);
        if (fd.getMonth() !== today.getMonth() || fd.getFullYear() !== today.getFullYear()) return false;
      }
      if (filters.cliente && !(f.customer_name || '').toLowerCase().includes(filters.cliente.toLowerCase())) return false;
      if (filters.transportista && !(f.driver_name || '').toLowerCase().includes(filters.transportista.toLowerCase())) return false;
      if (filters.destino && !(f.destination || '').toLowerCase().includes(filters.destino.toLowerCase())) return false;
      if (filters.estatus) {
        const st = f.payment_status || f.status || '';
        if (!st.toLowerCase().includes(filters.estatus.toLowerCase())) return false;
      }
      return true;
    });
  }, [fletes, filters]);

  const kpis = React.useMemo(() => {
    const pend = filtered.filter(f => (f.payment_status || f.status) !== 'Pagado');
    const totalPend = pend.reduce((s, f) => s + Math.max(0, parseFloat(f.freight_amount || 0) - parseFloat(f.amount_paid || 0)), 0);
    const totalPag = filtered.reduce((s, f) => s + parseFloat(f.amount_paid || 0), 0);
    const venc = filtered.filter(f => {
      const d = f.due_date ? new Date(f.due_date) : null;
      const saldo = parseFloat(f.freight_amount || 0) - parseFloat(f.amount_paid || 0);
      return d && d < new Date() && saldo > 0;
    }).length;
    const prox7 = filtered.filter(f => {
      const d = f.due_date ? new Date(f.due_date) : null;
      if (!d) return false;
      const diff = Math.ceil((d - new Date()) / (1000*60*60*24));
      const sd = parseFloat(f.freight_amount || 0) - parseFloat(f.amount_paid || 0);
      return diff >= 0 && diff <= 7 && sd > 0;
    }).length;
    return { totalPend, totalPag, venc, prox7, count: filtered.length };
  }, [filtered]);

  const sortedList = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date) : new Date(2999,12);
      const db = b.due_date ? new Date(b.due_date) : new Date(2999,12);
      if (da.getTime() !== db.getTime()) return da - db;
      return (parseFloat(b.freight_amount||0) - parseFloat(b.amount_paid||0)) - (parseFloat(a.freight_amount||0) - parseFloat(a.amount_paid||0));
    });
  }, [filtered]);

  const openEdit = (f) => {
    setEditing(f);
    setEditForm({
      credit_days: f.credit_days || '0',
      amount_paid: f.amount_paid || '0',
      due_date: f.due_date || '',
      notes: f.notes || ''
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const body = {
        id: editing.id,
        credit_days: parseInt(editForm.credit_days) || 0,
        amount_paid: parseFloat(editForm.amount_paid) || 0,
        due_date: editForm.due_date || null,
        notes: editForm.notes
      };
      const res = await fetch('/api/foreign-freights', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      setEditing(null);
      loadAll();
    } catch (e) {
      alert('Error guardando: ' + e.message);
    }
  };

  // Reglas: marcar pagado, pagar parcial simple
  const quickPay = async (f, full = true) => {
    const paid = full ? parseFloat(f.freight_amount || 0) : (parseFloat(f.amount_paid || 0) + Math.round(parseFloat(f.freight_amount || 0) * 0.5));
    await fetch('/api/foreign-freights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id, amount_paid: paid })
    });
    loadAll();
  };

  // Reports: Excel, PDF, CSV (use browser libs already present in the app)
  const downloadReport = async (type) => {
    const data = type === 'semana' ? sortedList : type === 'transportista' ? sortedList : type === 'pendientes' ? filtered.filter(x => (x.payment_status || x.status) !== 'Pagado') : filtered;
    const rows = data.map(f => ({
      Transportista: f.driver_name || '',
      FechaCarga: f.freight_date ? new Date(f.freight_date).toLocaleDateString('es-MX') : '',
      Cliente: f.customer_name || '',
      Destino: f.destination || '',
      FletePactado: parseFloat(f.freight_amount || 0),
      Vence: f.due_date ? new Date(f.due_date).toLocaleDateString('es-MX') : '',
      Pagado: parseFloat(f.amount_paid || 0),
      Saldo: Math.max(0, parseFloat(f.freight_amount || 0) - parseFloat(f.amount_paid || 0)),
      Estatus: f.payment_status || f.status || ''
    }));

    if (type === 'excel' || type === 'semana' || type === 'pendientes') {
      try {
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Fletes');
        XLSX.writeFile(wb, `Fletes_${type}_${new Date().toISOString().slice(0,10)}.xlsx`);
      } catch (e) { alert('XLSX lib no cargada. Usando CSV.'); downloadCSV(rows, type); }
    } else if (type === 'pdf') {
      try {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF();
        doc.text(`Reporte Fletes - ${type}`, 14, 16);
        const tableData = rows.slice(0,40).map(r => [r.Transportista, r.Cliente, r.Vence, r.FletePactado.toFixed(2), r.Saldo.toFixed(2), r.Estatus]);
        autoTable(doc, { head: [['Transportista','Cliente','Vence','Pactado','Saldo','Estado']], body: tableData, startY: 24 });
        doc.save(`Fletes_${type}.pdf`);
      } catch (e) { alert('PDF lib error. Usa CSV/Excel'); downloadCSV(rows, type); }
    } else {
      downloadCSV(rows, type);
    }
    setShowReportModal(false);
  };

  function downloadCSV(rows, prefix) {
    const headers = ['Transportista','Cliente','Destino','FletePactado','Vence','Saldo','Estatus'];
    const csv = [headers.join(',')].concat(rows.map(r => [r.Transportista,r.Cliente||'',r.Destino||'',r.FletePactado,r.Vence,r.Saldo,r.Estatus].join(','))).join('\n');
    const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = `fletes_${prefix || 'report'}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const getSemaforo = (f) => {
    const due = f.due_date ? new Date(f.due_date) : null;
    const saldo = Math.max(0, parseFloat(f.freight_amount || 0) - parseFloat(f.amount_paid || 0));
    if (!due || saldo <= 0) return { color: 'bg-emerald-100 text-emerald-700', label: 'Pagado' };
    const days = Math.ceil((due - new Date()) / (1000*60*60*24));
    if (days < 0) return { color: 'bg-red-200 text-red-800', label: 'Vencido' };
    if (days <= 3) return { color: 'bg-red-100 text-red-700', label: 'Alerta roja ' + days + 'd' };
    if (days <= 7) return { color: 'bg-yellow-100 text-yellow-800', label: 'Próximo ' + days + 'd' };
    return { color: 'bg-green-100 text-green-700', label: 'Verde ' + days + 'd' };
  };

  if (loading) return <div className="p-8 text-center">Cargando control de fletes...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Control de Fletes</h1>
            <p className="text-slate-500">Obligaciones de transporte • Integrado con cargas/embarques y cuadrillas</p>
          </div>
          <div className="ml-auto text-right text-xs font-mono px-3 py-1 bg-white border rounded">{trailerTime} <span className="text-emerald-700 font-bold">(trailer)</span></div>
          <div className="flex gap-2">
            <button onClick={() => loadAll()} className="px-4 py-2 rounded-xl border bg-white text-sm">Actualizar</button>
            <button onClick={() => setShowReportModal(true)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm flex items-center gap-2">
              <i className="ph ph-download-simple" /> Reportes
            </button>
            <button onClick={() => router.push('/cuadrillas')} className="px-4 py-2 rounded-xl border bg-white text-sm">Cuadrillas</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-2xl border p-4">
            <div className="text-xs text-slate-500">TOTAL FLETES PENDIENTES</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{fmt(kpis.totalPend)}</div>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <div className="text-xs text-slate-500">TOTAL PAGADO</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{fmt(kpis.totalPag)}</div>
          </div>
          <div className="bg-white rounded-2xl border p-4 border-red-100">
            <div className="text-xs text-red-600">FLETES VENCIDOS</div>
            <div className="text-2xl font-bold text-red-700 mt-1">{kpis.venc}</div>
          </div>
          <div className="bg-white rounded-2xl border p-4 border-amber-100">
            <div className="text-xs text-amber-600">PRÓXIMOS A VENCER (7d)</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{kpis.prox7}</div>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <div className="text-xs text-slate-500">REGISTROS EN FILTRO</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{kpis.count}</div>
          </div>
        </div>

        {/* ALERTAS */}
        {kpis.venc > 0 && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
            <i className="ph ph-warning-circle text-lg mt-0.5" />
            <div>ALERTA CRÍTICA: {kpis.venc} fletes vencidos con saldo pendiente. Revisar y liquidar.</div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white p-4 rounded-2xl border mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Periodo</label>
            <select value={filters.period} onChange={e => setFilters({ ...filters, period: e.target.value })} className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="semana">Esta semana</option>
              <option value="mes">Este mes</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Transportista</label>
            <input value={filters.transportista} onChange={e=>setFilters({...filters, transportista:e.target.value})} placeholder="Nombre..." className="border px-3 py-1.5 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Cliente</label>
            <input value={filters.cliente} onChange={e=>setFilters({...filters, cliente:e.target.value})} placeholder="Cliente..." className="border px-3 py-1.5 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Estatus</label>
            <select value={filters.estatus} onChange={e=>setFilters({...filters, estatus:e.target.value})} className="border px-3 py-1.5 rounded-lg text-sm">
              <option value="">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Parcial">Parcial</option>
              <option value="Pagado">Pagado</option>
            </select>
          </div>
          <button onClick={() => setFilters({ period:'semana', cliente:'', transportista:'', estatus:'', destino:'' })} className="text-xs px-3 py-1 bg-slate-100 rounded">Limpiar</button>
        </div>

        {/* Tabla principal */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Transportista</th>
                  <th className="px-4 py-3 text-left">Carga / Lote</th>
                  <th className="px-4 py-3 text-left">Cliente / Destino</th>
                  <th className="px-4 py-3 text-right">Flete Pactado</th>
                  <th className="px-4 py-3 text-right">Pagado</th>
                  <th className="px-4 py-3 text-center">Vence</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-center">Estatus</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedList.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-slate-400">No hay fletes que coincidan con los filtros</td></tr>
                )}
                {sortedList.map(f => {
                  const saldo = Math.max(0, parseFloat(f.freight_amount || 0) - parseFloat(f.amount_paid || 0));
                  const sem = getSemaforo(f);
                  return (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{f.driver_name || '—'} {f.trailer_plates || (f.notes || '').includes('trailer') ? <span className="text-[10px] text-emerald-700 font-bold">(trailer)</span> : ''} <span className="text-[10px] text-slate-400">{f.truck_plates ? `(${f.truck_plates})` : ''}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-600">{f.load_id ? `Carga #${f.load_id}` : ''} {f.lot_number && <span>• {f.lot_number}</span>}</td>
                      <td className="px-4 py-3 text-xs">{f.customer_name || '-'}<br /><span className="text-slate-400">{f.destination || ''}</span></td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(f.freight_amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{fmt(f.amount_paid)}</td>
                      <td className="px-4 py-3 text-center text-sm">{f.due_date ? new Date(f.due_date).toLocaleDateString('es-MX') : '—'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${saldo > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>{fmt(saldo)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline px-2 py-0.5 rounded-full text-[10px] font-medium ${sem.color}`}>{sem.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(f)} className="text-blue-600 text-xs px-2">Editar</button>
                        {saldo > 0 && (
                          <button onClick={() => quickPay(f, true)} className="ml-2 text-xs px-2 py-0.5 bg-emerald-600 text-white rounded">Pagar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info sections */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-4 text-xs">
            <h4 className="font-semibold mb-2">Reglas de Fletes</h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Precio de flete pactado es obligatorio al crear.</li>
              <li>Fecha de vencimiento = Fecha de carga + Días de crédito (calculada).</li>
              <li>Saldo = Pactado − Pagado. Actualiza en cualquier momento con Editar o Pagar rápido.</li>
              <li>Sólo se reporta en esta pantalla el saldo pendiente.</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border p-4 text-xs">
            <h4 className="font-semibold mb-2">Vehículos Cuadrilla (actuales)</h4>
            <div className="grid grid-cols-3 gap-2">
              {vehicles.slice(0,6).map(v => (
                <div key={v.id} className="border rounded p-2">
                  <div className="font-semibold text-sm">{v.name}</div>
                  <div className="text-xs text-slate-400">{v.plates}</div>
                  <div className="font-mono text-xs mt-1 text-emerald-700">${parseFloat(v.current_price_per_trip || 0).toFixed(0)} / viaje</div>
                </div>
              ))}
              {vehicles.length === 0 && <div className="col-span-3 text-slate-400">Sin camionetas configuradas (ver Cuadrillas → Config)</div>}
            </div>
            <div className="mt-3 text-[10px] text-slate-400">Precios vigentes aplican sólo a viajes/fletes futuros registrados. Historial preservado.</div>
          </div>
        </div>

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white max-w-md w-full rounded-2xl border p-5">
              <h3 className="font-bold text-lg mb-3">Editar Flete — {editing.driver_name}</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-slate-500">Días de crédito</label>
                  <input type="number" value={editForm.credit_days} onChange={e=>setEditForm({...editForm,credit_days:e.target.value})} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Importe pagado</label>
                  <input type="number" step="0.01" value={editForm.amount_paid} onChange={e=>setEditForm({...editForm,amount_paid:e.target.value})} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Fecha vencimiento</label>
                  <input type="date" value={editForm.due_date} onChange={e=>setEditForm({...editForm,due_date:e.target.value})} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Observaciones</label>
                  <textarea value={editForm.notes} onChange={e=>setEditForm({...editForm,notes:e.target.value})} rows={2} className="w-full border rounded px-3 py-2" />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setEditing(null)} className="px-4 rounded-lg border py-2 text-sm">Cancelar</button>
                <button onClick={saveEdit} className="px-4 rounded-lg bg-brand-600 text-white py-2 text-sm">Guardar cambios</button>
              </div>
              <div className="mt-3 text-[11px] text-amber-700">Los cambios se auditan. Sólo los viernes se recomienda programar liquidación.</div>
            </div>
          </div>
        )}

        {/* Report modal */}
        {showReportModal && (
          <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 w-full max-w-xs">
              <h3 className="font-semibold mb-3 text-lg">Generar Reporte</h3>
              <div className="space-y-2">
                <button onClick={() => downloadReport('pendientes')} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded border">Fletes Pendientes (CSV/Excel)</button>
                <button onClick={() => downloadReport('semana')} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded border">Fletes por Semana</button>
                <button onClick={() => downloadReport('transportista')} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded border">Fletes por Transportista</button>
                <button onClick={() => downloadReport('pdf')} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded border">PDF completo</button>
              </div>
              <button onClick={() => setShowReportModal(false)} className="mt-4 w-full border rounded py-2 text-sm">Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
