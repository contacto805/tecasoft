'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function ProductionPage() {
  const router = useRouter();
  const [lots, setLots] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calibers, setCalibers] = useState([]);
  const initialFormData = {
    production_date: new Date().toISOString().split('T')[0],
    caliber_data: [
      { caliber: '', class_name: '', process_kg: 0, waste_kg: 0, inventory_kg: 0 }
    ],
    notes: ''
  };
  const [formData, setFormData] = useState(initialFormData);

  // Load all existing lotes (no restrictive filter) + real-time pallet_output_summary
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [lotsRes, palletsRes] = await Promise.all([
          fetch('/api/lots'),
          fetch('/api/pallet-output')
        ]);
        if (lotsRes.ok) {
          const data = await lotsRes.json();
          setLots(Array.isArray(data) ? data : []);
        }
        if (palletsRes.ok) {
          const pData = await palletsRes.json();
          setPallets(Array.isArray(pData) ? pData : []);
        }
      } catch (error) {
        console.error('Error loading lots/pallets:', error);
      }
    };
    fetchAll();
    const iv = setInterval(fetchAll, 15000); // real-time refresh
    return () => clearInterval(iv);
  }, []);

  // Daily pallet count aggregator by lote (computed from real pallet_output_summary)
  const dailyAggregator = useMemo(() => {
    const byDateLote = {};
    pallets.forEach(p => {
      const d = (p.packing_date || p.created_at || '').toString().slice(0,10) || 'sin-fecha';
      const lote = p.lot_number || `Lote-${p.lot_id}`;
      const key = `${d}|${lote}`;
      if (!byDateLote[key]) byDateLote[key] = { date: d, lote, count: 0, kg: 0 };
      byDateLote[key].count += (parseInt(p.pallet_count) || 0);
      byDateLote[key].kg += parseFloat(p.total_kg || 0);
    });
    return Object.values(byDateLote).sort((a,b) => (b.date||'').localeCompare(a.date||''));
  }, [pallets]);

  // Auto-assign ubicacion based on available capacity (uses same slot pool as inventory map)
  const possibleSlots = ['A-1','A-2','A-3','A-4','B-1','B-2','B-3','B-4','C-1','C-2','C-3','C-4','A-5','B-5','C-5'];
  const autoAssignUbicacion = async (pallet) => {
    if (!pallet || !pallet.id) return;
    setLoading(true);
    try {
      const used = new Set(
        pallets
          .filter(pp => pp.warehouse_slot || pp.ubicacion_actual)
          .map(pp => (pp.warehouse_slot || pp.ubicacion_actual || '').toUpperCase())
      );
      const free = possibleSlots.find(s => !used.has(s));
      if (!free) {
        alert('No hay posiciones libres con capacidad disponible en este momento.');
        return;
      }
      const res = await fetch('/api/production/assign-to-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pallet_output_id: pallet.id, slot_id: free })
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error || 'No se pudo asignar');
      }
      // refresh list
      const pr = await fetch('/api/pallet-output');
      const fresh = pr.ok ? await pr.json() : [];
      setPallets(Array.isArray(fresh) ? fresh : []);
      alert(`Ubicación ${free} asignada a ${pallet.folio_tarima || 'TAR-'+String(pallet.id).padStart(6,'0')}`);
    } catch (e) {
      alert('Error al auto-asignar: ' + (e.message || 'intenta de nuevo'));
    } finally {
      setLoading(false);
    }
  };

  // Load caliber definitions
  useEffect(() => {
    const fetchCalibers = async () => {
      try {
        const response = await fetch('/api/calibers');
        if (response.ok) {
          const data = await response.json();
          setCalibers(data);
        }
      } catch (error) {
        console.error('Error loading calibers:', error);
      }
    };
    fetchCalibers();
  }, []);

  const handleAddCaliber = () => {
    setFormData(prev => ({
      ...prev,
      caliber_data: [
        ...prev.caliber_data,
        { caliber: '', class_name: '', process_kg: 0, waste_kg: 0, inventory_kg: 0 }
      ]
    }));
  };

  const handleRemoveCaliber = (index) => {
    setFormData(prev => ({
      ...prev,
      caliber_data: prev.caliber_data.filter((_, i) => i !== index)
    }));
  };

  const handleCaliberChange = (index, field, value) => {
    const updated = [...formData.caliber_data];
    updated[index][field] = value;
    setFormData({ ...formData, caliber_data: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedLot) {
      alert('Selecciona un lote');
      return;
    }

    if (formData.caliber_data.length === 0 || formData.caliber_data.some(c => !c.caliber)) {
      alert('Completa todos los calibres');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: selectedLot.id,
          production_date: formData.production_date,
          caliber_data: formData.caliber_data,
          notes: formData.notes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error creating production batch');
      }

      alert('✓ Lote procesado exitosamente');
      setSelectedLot(null);
      setFormData(initialFormData);
      
      // refresh both lots and real-time pallet list
      try {
        const [lRes, pRes] = await Promise.all([fetch('/api/lots'), fetch('/api/pallet-output')]);
        if (lRes.ok) setLots(await lRes.json());
        if (pRes.ok) setPallets(await pRes.json());
      } catch(_) {}
    } catch (error) {
      console.error('Error creating production:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-indigo-700 font-bold text-lg tracking-tight"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center border border-indigo-500/20">
                <i className="ph-fill ph-package text-indigo-600"></i>
              </div>
              Producción
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Módulo de Producción (Empacado)</h1>
            <p className="text-slate-500 mt-1">Registra calibres, proceso y desecho por lote</p>
          </section>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <i className="ph-fill ph-list text-indigo-600"></i>
              Lista de Tarimas (pallet_output_summary) — Fuente única
            </h2>
            <p className="text-sm text-slate-500 mb-4">Muestra todos los pallets generados en tiempo real. Folio, Lote, Cantidad y Estado.</p>

            {/* Daily pallet count aggregator by lote */}
            {dailyAggregator.length > 0 && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="font-semibold text-sm mb-2">Agregador diario de tarimas por lote</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {dailyAggregator.slice(0,6).map((a,i) => (
                    <div key={i} className="flex justify-between px-2 py-1 bg-white rounded border">
                      <span>{a.date} • {a.lote}</span>
                      <span className="font-semibold">{a.count} tarimas • {a.kg.toFixed(0)}kg</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pallets.length === 0 ? (
              <div className="text-center py-8">
                <i className="ph ph-inbox text-4xl text-slate-300 mb-2 block"></i>
                <p className="text-slate-500">No hay tarimas/pallets registrados aún en pallet_output_summary.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-3">Folio</th>
                      <th className="py-2 pr-3">Lote</th>
                      <th className="py-2 pr-3">Cantidad</th>
                      <th className="py-2 pr-3">Estado</th>
                      <th className="py-2 pr-3">Ubicación</th>
                      <th className="py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pallets.map((p, idx) => {
                      const folio = p.folio_tarima || 'TAR-' + String(p.id).padStart(6,'0');
                      const lote = p.lot_number || `L-${p.lot_id}`;
                      const cant = p.pallet_count || 0;
                      const est = p.estado || 'PENDIENTE_UBICACION';
                      const ubi = p.ubicacion_actual || p.warehouse_slot || '—';
                      return (
                        <tr key={p.id || idx} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-2 pr-3 font-mono text-xs">{folio}</td>
                          <td className="py-2 pr-3">{lote}</td>
                          <td className="py-2 pr-3">{cant} • {parseFloat(p.total_kg||0).toFixed(0)}kg</td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded text-xs ${est.includes('EMBARC')?'bg-red-100 text-red-700':est.includes('FRIO')||est.includes('DISPON')?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{est}</span>
                          </td>
                          <td className="py-2 pr-3 text-xs">{ubi}</td>
                          <td className="py-2">
                            <button
                              onClick={() => autoAssignUbicacion(p)}
                              disabled={loading || !! (p.warehouse_slot || p.ubicacion_actual)}
                              className="px-2 py-1 text-xs bg-indigo-600 text-white rounded disabled:bg-slate-300"
                            >
                              Auto ubicar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* All lotes summary derived from pallets */}
            {lots.length > 0 && (
              <div className="mt-4 text-xs text-slate-500">Lotes en sistema: {lots.length} (todos consultados desde DB)</div>
            )}

            {/* Compact lot selector to keep production registration working */}
            {lots.length > 0 && (
              <div className="mt-3">
                <label className="text-xs text-slate-600">Seleccionar lote para registrar nueva producción:</label>
                <select
                  className="ml-2 border px-2 py-1 text-sm rounded"
                  value={selectedLot?.id || ''}
                  onChange={(e) => {
                    const l = lots.find(x => x.id === parseInt(e.target.value));
                    setSelectedLot(l || null);
                  }}
                >
                  <option value="">-- elegir --</option>
                  {lots.map(l => <option key={l.id} value={l.id}>{l.lot_number} — {l.producer}</option>)}
                </select>
              </div>
            )}
          </div>

          {selectedLot && (
            <div className="mt-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                <i className="ph-fill ph-factory text-indigo-600"></i>
                Registrar Producción - Lote {selectedLot.lot_number}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Fecha de Producción</label>
                  <input
                    type="date"
                    value={formData.production_date}
                    onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <i className="ph ph-chart-bar text-indigo-600"></i>
                    Detalles de Calibres
                  </h3>

                  <div className="space-y-4">
                    {formData.caliber_data.map((caliber, index) => (
                      <div key={index} className="p-4 border border-slate-200 rounded-xl space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-medium text-slate-700">Calibre {index + 1}</span>
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCaliber(index)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Calibre *</label>
                            <select
                              value={caliber.caliber}
                              onChange={(e) => handleCaliberChange(index, 'caliber', e.target.value)}
                              required
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            >
                              <option value="">-- Selecciona calibre --</option>
                              {calibers.map((cal) => (
                                <option key={cal.id} value={cal.caliber_name}>
                                  {cal.display_name || cal.caliber_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Clase</label>
                            <select
                              value={caliber.class_name}
                              onChange={(e) => handleCaliberChange(index, 'class_name', e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            >
                              <option value="">-- Selecciona clase --</option>
                              <option value="Clase A">Clase A</option>
                              <option value="Clase B">Clase B</option>
                              <option value="Extra">Extra</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Kg Inventario *</label>
                            <input
                              type="number"
                              step="0.01"
                              value={caliber.inventory_kg}
                              onChange={(e) => handleCaliberChange(index, 'inventory_kg', e.target.value)}
                              placeholder="Kg empacoados"
                              required
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Kg Proceso</label>
                            <input
                              type="number"
                              step="0.01"
                              value={caliber.process_kg}
                              onChange={(e) => handleCaliberChange(index, 'process_kg', e.target.value)}
                              placeholder="Kg de proceso"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Kg Desecho</label>
                            <input
                              type="number"
                              step="0.01"
                              value={caliber.waste_kg}
                              onChange={(e) => handleCaliberChange(index, 'waste_kg', e.target.value)}
                              placeholder="Kg de desecho"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCaliber}
                    className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-2"
                  >
                    <i className="ph ph-plus text-lg"></i>
                    Agregar Calibre
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observaciones de la producción..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Resumen de Producción</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Total Inventario:</span>
                      <div className="text-lg font-bold text-slate-900">
                        {formData.caliber_data.reduce((sum, c) => sum + parseFloat(c.inventory_kg || '0'), 0).toFixed(2)} kg
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-600">Total Proceso:</span>
                      <div className="text-lg font-bold text-slate-900">
                        {formData.caliber_data.reduce((sum, c) => sum + parseFloat(c.process_kg || '0'), 0).toFixed(2)} kg
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-600">Total Desecho:</span>
                      <div className="text-lg font-bold text-slate-900">
                        {formData.caliber_data.reduce((sum, c) => sum + parseFloat(c.waste_kg || '0'), 0).toFixed(2)} kg
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <i className="ph ph-check-circle text-lg"></i>
                        Guardar Producción
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLot(null)}
                    className="px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
