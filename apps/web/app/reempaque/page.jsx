'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReempaquePage() {
  const router = useRouter();
  const [tarimas, setTarimas] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [reempaques, setReempaques] = useState([]);
  const [step, setStep] = useState(1); // 1: select, 2: reseleccion, 3: costos, 4: confirm
  const [reselection, setReselection] = useState([]);
  const [form, setForm] = useState({ responsible: '', reason: '', notes: '' });
  const [costs, setCosts] = useState({ mano_obra: 0, materiales: 0, otros: 0 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const destinations = ['recuperada', 'cambio_calibre', 'cambio_calidad', 'madura', 'sobremadura', 'danada', 'proceso', 'desecho', 'merma'];

  useEffect(() => {
    loadAvailable();
    loadReempaques();
  }, []);

  const loadAvailable = async (q = '') => {
    try {
      const res = await fetch(`/api/reempaque?type=available&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setTarimas(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const loadReempaques = async () => {
    try {
      const res = await fetch('/api/reempaque?type=list');
      const data = await res.json();
      setReempaques(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const toggleSelect = (t) => {
    const exists = selected.find(s => s.id === t.id);
    if (exists) {
      setSelected(selected.filter(s => s.id !== t.id));
    } else {
      setSelected([...selected, { ...t, kg_to_withdraw: parseFloat(t.total_kg || 0) }]);
    }
  };

  const updateWithdraw = (id, kg) => {
    setSelected(selected.map(s => s.id === id ? { ...s, kg_to_withdraw: parseFloat(kg) || 0 } : s));
  };

  const startReselection = () => {
    if (selected.length === 0) { alert('Selecciona tarimas'); return; }
    // init reselection rows
    const init = [];
    selected.forEach(s => {
      init.push({
        source_pallet_id: s.id,
        lot_id: s.lot_id,
        caliber_from: s.caliber,
        class_from: s.class_name,
        destination_type: 'recuperada',
        caliber_to: s.caliber,
        class_to: s.class_name,
        kg: parseFloat(s.kg_to_withdraw || s.total_kg || 0),
        boxes: Math.round((parseFloat(s.kg_to_withdraw || s.total_kg || 0) / 10))
      });
    });
    setReselection(init);
    setStep(2);
  };

  const updateResel = (idx, field, val) => {
    const copy = [...reselection];
    copy[idx][field] = val;
    if (field === 'kg') copy[idx].boxes = Math.round(parseFloat(val || 0) / 10);
    setReselection(copy);
  };

  const addReselRow = (srcIdx) => {
    const src = reselection[srcIdx];
    if (!src) return;
    setReselection([...reselection, { ...src, destination_type: 'proceso', kg: 0, id: Date.now() }]);
  };

  const removeResel = (idx) => {
    setReselection(reselection.filter((_, i) => i !== idx));
  };

  const calcBalance = () => {
    const out = selected.reduce((s, t) => s + (parseFloat(t.kg_to_withdraw) || 0), 0);
    const rec = reselection.reduce((s, r) => s + (parseFloat(r.kg) || 0), 0);
    return { out, rec, diff: out - rec };
  };

  const goCosts = () => {
    const b = calcBalance();
    if (Math.abs(b.diff) > 0.5) {
      if (!confirm(`Balance: ${b.out.toFixed(1)} kg retirados vs ${b.rec.toFixed(1)} recuperados. Diferencia ${b.diff.toFixed(1)}. Continuar?`)) return;
    }
    setStep(3);
  };

  const confirm = async () => {
    setLoading(true);
    setMsg('');
    try {
      const payload = {
        selected_pallets: selected.map(s => ({ id: s.id, kg_to_withdraw: s.kg_to_withdraw })),
        operation_date: new Date().toISOString().slice(0,10),
        responsible: form.responsible || 'Operador',
        reason: form.reason || 'Reempaque',
        reselection,
        additional_costs: costs,
        notes: form.notes
      };
      const res = await fetch('/api/reempaque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMsg(`Reempaque ${data.folio} registrado. Inventario actualizado.`);
      setSelected([]);
      setReselection([]);
      setStep(1);
      await loadAvailable();
      await loadReempaques();
    } catch (e) {
      setMsg('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = tarimas.filter(t =>
    !search || (t.folio_tarima || '').toLowerCase().includes(search.toLowerCase()) || (t.lot_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const bal = calcBalance();

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white min-h-screen text-slate-900">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/')} className="text-sm text-emerald-700 hover:underline">← Volver</button>
          <h1 className="text-2xl font-bold tracking-tight">Reempaque y Reselección</h1>
          <p className="text-sm text-slate-500">Operaciones • Conserva trazabilidad y actualiza inventarios</p>
        </div>
        <div className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded">Paso {step}/4</div>
      </div>

      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-700">{msg}</div>}

      {/* Step 1: Tarimas */}
      {step === 1 && (
        <div>
          <div className="flex gap-3 mb-4">
            <input value={search} onChange={e => { setSearch(e.target.value); loadAvailable(e.target.value); }} placeholder="Buscar por folio, lote o calibre" className="flex-1 border rounded-xl px-4 py-2 text-sm" />
            <button onClick={() => loadAvailable(search)} className="px-4 py-2 border rounded-xl text-sm">Buscar</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {filtered.slice(0, 30).map(t => {
              const sel = selected.find(s => s.id === t.id);
              return (
                <div key={t.id} onClick={() => toggleSelect(t)} className={`border rounded-2xl p-4 cursor-pointer ${sel ? 'border-emerald-600 bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <div className="font-mono text-sm">{t.folio_tarima || 'TAR-' + t.id}</div>
                  <div className="text-lg font-semibold mt-1">{t.lot_number} • {t.caliber} • {t.class_name}</div>
                  <div className="text-sm text-slate-600 mt-1">{parseFloat(t.total_kg || 0).toFixed(1)} kg • {t.warehouse_slot || 'Sin ubicación'}</div>
                  {sel && (
                    <div className="mt-2">
                      <input type="number" value={sel.kg_to_withdraw} onClick={e => e.stopPropagation()} onChange={e => updateWithdraw(t.id, e.target.value)} className="w-full border px-2 py-1 rounded text-sm" />
                      <div className="text-xs text-emerald-700">kg a retirar</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button onClick={startReselection} disabled={selected.length === 0} className="px-6 py-3 bg-emerald-700 text-white rounded-2xl font-medium disabled:opacity-50">Continuar a Reselección</button>
            <button onClick={() => setStep(4)} className="px-4 py-3 border rounded-2xl">Ver historial</button>
          </div>
        </div>
      )}

      {/* Step 2: Reselección */}
      {step === 2 && (
        <div>
          <h2 className="font-semibold mb-3">Clasificación de salida (kg reales, no porcentajes)</h2>
          <div className="text-xs text-amber-600 mb-3">Balance obligatorio: Retirados = Recuperados + Proceso + Desecho + Merma + Otros</div>

          <div className="space-y-3 mb-6">
            {reselection.map((r, idx) => (
              <div key={idx} className="border rounded-xl p-4 grid grid-cols-1 md:grid-cols-7 gap-2 text-sm">
                <div className="text-xs text-slate-500">Origen</div>
                <div className="font-mono">{r.source_pallet_id} • {r.caliber_from} / {r.class_from}</div>

                <select value={r.destination_type} onChange={e => updateResel(idx, 'destination_type', e.target.value)} className="border rounded px-2 py-1">
                  {destinations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <input value={r.caliber_to} onChange={e => updateResel(idx, 'caliber_to', e.target.value)} placeholder="Calibre destino" className="border rounded px-2 py-1" />
                <input value={r.class_to} onChange={e => updateResel(idx, 'class_to', e.target.value)} placeholder="Clase" className="border rounded px-2 py-1" />

                <div>
                  <input type="number" value={r.kg} onChange={e => updateResel(idx, 'kg', e.target.value)} className="w-full border rounded px-2 py-1" />
                  <div className="text-[10px] text-slate-500">{r.boxes} cajas aprox</div>
                </div>

                <div className="flex gap-1">
                  <button onClick={() => addReselRow(idx)} className="text-xs px-2 border rounded">+</button>
                  <button onClick={() => removeResel(idx)} className="text-xs px-2 border rounded text-red-600">×</button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-50 rounded mb-4 text-sm">
            Retirados: <b>{bal.out.toFixed(1)}</b> kg • Registrados: <b>{bal.rec.toFixed(1)}</b> kg • Diferencia: <b className={Math.abs(bal.diff) > 0.5 ? 'text-red-600' : ''}>{bal.diff.toFixed(1)}</b> kg
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-5 py-2 border rounded-xl">Atrás</button>
            <button onClick={goCosts} className="px-6 py-3 bg-emerald-700 text-white rounded-2xl">Continuar a Costos</button>
          </div>
        </div>
      )}

      {/* Step 3: Costos */}
      {step === 3 && (
        <div>
          <h2 className="font-semibold mb-4">Costos adicionales del reempaque</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {['mano_obra', 'materiales', 'otros'].map(k => (
              <div key={k}>
                <label className="text-xs text-slate-500 block mb-1">{k.replace('_', ' ')} (MXN)</label>
                <input type="number" value={costs[k]} onChange={e => setCosts({ ...costs, [k]: parseFloat(e.target.value) || 0 })} className="border w-full px-3 py-2 rounded-xl" />
              </div>
            ))}
          </div>

          <div className="mb-6 text-xs text-slate-600">Se conserva costo histórico de la fruta original. Solo se suman los nuevos costos reales.</div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-5 py-2 border rounded-xl">Atrás</button>
            <button onClick={() => setStep(4)} className="px-6 py-3 bg-emerald-700 text-white rounded-2xl">Confirmar</button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm + Historial */}
      {step === 4 && (
        <div>
          <div className="mb-4">
            <div className="font-semibold mb-2">Confirmación</div>
            <input placeholder="Responsable" value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} className="border px-3 py-2 rounded w-full mb-2" />
            <input placeholder="Motivo" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="border px-3 py-2 rounded w-full mb-2" />
            <textarea placeholder="Notas" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="border px-3 py-2 rounded w-full" />
          </div>

          <button onClick={confirm} disabled={loading || selected.length === 0} className="w-full py-3 bg-emerald-700 text-white rounded-2xl font-medium disabled:opacity-60">
            {loading ? 'Registrando...' : 'Confirmar Reempaque'}
          </button>

          <div className="mt-8">
            <div className="font-semibold mb-3">Historial reciente</div>
            <div className="text-xs text-slate-500 mb-2">Cada reempaque actualiza inventario y se refleja en el cierre semanal de la fecha real de operación.</div>
            <div className="space-y-2">
              {reempaques.slice(0, 8).map(r => (
                <div key={r.id} className="border rounded p-3 text-sm flex justify-between">
                  <div>{r.folio} • {r.operation_date} • {r.responsible}</div>
                  <div className="text-emerald-700">{parseFloat(r.total_kg_recovered || 0).toFixed(0)} kg recuperados</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
