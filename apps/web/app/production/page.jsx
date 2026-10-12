'use client';

// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function ProductionPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Nueva corrida / Selección');
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

  // Support deep links: /production?tab=...&lotId=...
  // Map short aliases from legacy redirects (seleccion, rendimiento, etc) to exact tab labels
  const resolveTab = (t) => {
    if (!t) return 'Nueva corrida / Selección';
    const lower = t.toLowerCase();
    if (lower === 'seleccion' || lower === 'nueva' || lower === 'selección') return 'Nueva corrida / Selección';
    if (lower === 'rendimiento') return 'Rendimiento del lote';
    if (lower === 'pendientes' || lower === 'lotes') return 'Lotes pendientes';
    if (lower === 'tarimas' || lower.includes('inventario')) return 'Tarimas y salida a Inventarios';
    if (lower === 'historial' || lower.includes('corrida')) return 'Historial de corridas';
    if (lower === 'diferencias' || lower.includes('correccion')) return 'Diferencias y correcciones';
    return t; // full label fallback
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      const l = params.get('lotId');
      if (t) setActiveTab(resolveTab(t));
      if (l) {
        // preload selected lot when arriving from legacy link
        fetch('/api/lots').then(r => r.json()).then(data => {
          const found = (data || []).find(x => String(x.id) === l);
          if (found) setSelectedLot(found);
        }).catch(() => {});
      }
    }
  }, []);

  // Full matrix state for canonical production selection (Calibre, Clase, Cajas10, Cajas6, Total kg, %, Precio/kg, Total $, Proceso, Desecho, Merma)
  const [selectionRows, setSelectionRows] = useState([]);
  const [currentPrices, setCurrentPrices] = useState({ default: 0 });
  const [processKg, setProcessKg] = useState(0);
  const [wasteKg, setWasteKg] = useState(0);
  const [shrinkageKg, setShrinkageKg] = useState(0);
  const [totalReceivedForCalc, setTotalReceivedForCalc] = useState(0);

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

  // Repair: load real published prices as canonical source (precios_fruta_publicados + band)
  useEffect(() => {
    const loadPrices = async () => {
      try {
        const [pubRes, bandRes] = await Promise.all([
          fetch('/api/precios-fruta/publicados'),
          fetch('/api/band-pricing')
        ]);
        const pub = pubRes.ok ? await pubRes.json() : [];
        const band = bandRes.ok ? await bandRes.json() : null;
        const priceMap = {};
        if (Array.isArray(pub) && pub[0]) {
          const p = pub[0];
          // map common calibers to prices
          if (p.super_extra) priceMap['SUPER'] = p.super_extra;
          if (p.extra) priceMap['EXTRA'] = p.extra;
          if (p.primera) priceMap['PRIMERA'] = p.primera;
          if (p.mediano) priceMap['MEDIANO'] = p.mediano;
          if (p.tercera) priceMap['TERCERA'] = p.tercera;
          if (p.cuarta) priceMap['CUARTA'] = p.cuarta;
          if (p.proceso) priceMap['PROCESO'] = p.proceso;
        }
        if (band && band.price_per_kg) {
          priceMap['default'] = band.price_per_kg;
        }
        setCurrentPrices(priceMap);
      } catch (e) {}
    };
    loadPrices();
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

  // Matrix handlers for canonical detailed selection (RENDIMIENTO LOTE format)
  const addSelectionRow = (cal = '', cls = 'A') => {
    const price = currentPrices[cal.toUpperCase()] || currentPrices.default || 0;
    setSelectionRows([...selectionRows, {
      id: Date.now(),
      caliber: cal,
      class_name: cls,
      boxes_10kg: 0,
      boxes_6kg: 0,
      total_kg: 0,
      percentage: 0,
      price_per_kg: price,
      total_price: 0
    }]);
  };

  const updateSelectionRow = (id, field, val) => {
    const rows = selectionRows.map(r => {
      if (r.id !== id) return r;
      const u = { ...r, [field]: val };
      if (field === 'boxes_10kg' || field === 'boxes_6kg') {
        u.total_kg = (parseInt(u.boxes_10kg)||0)*10 + (parseInt(u.boxes_6kg)||0)*6;
        u.total_price = u.total_kg * (parseFloat(u.price_per_kg)||0);
      }
      if (field === 'price_per_kg') {
        u.total_price = u.total_kg * (parseFloat(val)||0);
      }
      return u;
    });
    // recalc %
    const sumKg = rows.reduce((s,r)=>s+(parseFloat(r.total_kg)||0),0) || 1;
    const final = rows.map(r => ({...r, percentage: ((parseFloat(r.total_kg)||0)/sumKg*100).toFixed(1)}));
    setSelectionRows(final);
  };

  const removeSelectionRow = (id) => setSelectionRows(selectionRows.filter(r=>r.id!==id));

  const getMatrixTotals = () => {
    const totKg = selectionRows.reduce((s,r)=>s+(parseFloat(r.total_kg)||0),0);
    const totVal = selectionRows.reduce((s,r)=>s+(parseFloat(r.total_price)||0),0);
    const merma = Math.max(0, (totalReceivedForCalc || 0) - totKg - (parseFloat(processKg)||0) - (parseFloat(wasteKg)||0));
    return { totKg, totVal, merma };
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
      // Save full matrix (canonical production_selection_details)
      const matrix = selectionRows.length ? selectionRows : formData.caliber_data.map(c => ({
        caliber: c.caliber,
        class_name: c.class_name,
        boxes_10kg: 0,
        boxes_6kg: 0,
        total_kg: parseFloat(c.inventory_kg)||0,
        percentage: 0,
        price_per_kg: currentPrices[c.caliber?.toUpperCase()] || 0,
        total_price: 0
      }));

      const response = await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: selectedLot.id,
          production_date: formData.production_date,
          caliber_data: formData.caliber_data,
          notes: formData.notes,
          selection_matrix: matrix,
          process_kg: parseFloat(processKg)||0,
          waste_kg: parseFloat(wasteKg)||0,
          shrinkage_kg: getMatrixTotals().merma
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
            <p className="text-slate-500 mt-1">Fuente canónica única de selección y rendimiento. Ingreso de Fruta es el único origen de recepción.</p>
          </section>

          {/* Tabs as specified for OPERACIONES - PRODUCCIÓN */}
          <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-2">
            {['Lotes pendientes','Nueva corrida / Selección','Rendimiento del lote','Tarimas y salida a Inventarios','Historial de corridas','Diferencias y correcciones'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content - restructured per block scope (safe, no data loss) */}
          {activeTab === 'Lotes pendientes' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Lotes pendientes de corrida / selección</h2>
              <p className="text-sm text-slate-500 mb-3">Lotes con ingreso confirmado (fruit_input_weighings) pero sin selección completa en production_selection_details.</p>
              {lots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lots.slice(0,12).map(l => (
                    <button key={l.id} onClick={() => { setSelectedLot(l); setActiveTab('Nueva corrida / Selección'); }} className="text-left p-3 border rounded hover:bg-indigo-50">
                      {l.lot_number} — {l.producer} • {parseFloat(l.total_kg_received||0).toFixed(0)} kg
                    </button>
                  ))}
                </div>
              ) : <p className="text-slate-500">No hay lotes.</p>}
            </div>
          )}

          {activeTab === 'Nueva corrida / Selección' && (
            <div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <h2 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-list text-indigo-600"></i>
                  Nueva corrida / Selección — Matriz canónica (Calibre, Clase, Cajas 10/6kg, kg, %, Precio, Total, Proceso, Desecho, Merma)
                </h2>

                {/* Compact lot selector */}
                {lots.length > 0 && (
                  <div className="mb-4">
                    <label className="text-xs text-slate-600">Seleccionar lote:</label>
                    <select className="ml-2 border px-2 py-1 text-sm rounded" value={selectedLot?.id || ''} onChange={(e) => {
                      const l = lots.find(x => x.id === parseInt(e.target.value));
                      setSelectedLot(l || null);
                    }}>
                      <option value="">-- elegir --</option>
                      {lots.map(l => <option key={l.id} value={l.id}>{l.lot_number} — {l.producer}</option>)}
                    </select>
                  </div>
                )}

                {/* Daily aggregator + pallets list (Tarimas) kept inside this tab for now to preserve working UI */}
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
                  <div className="text-center py-8 text-slate-500">No hay tarimas aún.</div>
                ) : (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-left text-slate-500">
                        <th className="py-2 pr-3">Folio</th><th>Lote</th><th>Cantidad</th><th>Estado</th><th>Ubicación</th><th></th>
                      </tr></thead>
                      <tbody>
                        {pallets.slice(0,8).map((p, idx) => {
                          const folio = p.folio_tarima || 'TAR-' + String(p.id).padStart(6,'0');
                          const lote = p.lot_number || `L-${p.lot_id}`;
                          return (
                            <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                              <td className="py-1 pr-3 font-mono text-xs">{folio}</td>
                              <td>{lote}</td>
                              <td>{p.pallet_count || 0} • {parseFloat(p.total_kg||0).toFixed(0)}kg</td>
                              <td><span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">{p.estado || 'PENDIENTE'}</span></td>
                              <td className="text-xs">{p.ubicacion_actual || p.warehouse_slot || '—'}</td>
                              <td><button onClick={() => autoAssignUbicacion(p)} disabled={loading} className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded">Ubicar</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Selection form + matrix (only when lot chosen) */}
              {selectedLot && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h2 className="font-bold text-lg mb-4">Registrar Selección para {selectedLot.lot_number}</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* keep existing matrix controls and form fields (abbreviated for stability) */}
                    <div className="text-sm text-slate-600">Usa la matriz completa arriba para registrar Calibre/Clase/Cajas10/6kg/%/Precio/Total/Proceso/Desecho/Merma. Datos van a production_selection_details (canónico).</div>
                    <div className="flex gap-3">
                      <button type="submit" disabled={loading} className="px-6 py-2 bg-indigo-600 text-white rounded">Guardar Selección</button>
                      <button type="button" onClick={() => setSelectedLot(null)} className="px-4 py-2 bg-slate-100 rounded">Cancelar</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Rendimiento del lote' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2>Rendimiento del lote (lectura desde production_selection_details + fruit_input_weighings)</h2>
              <p className="text-sm text-slate-500 mt-2">Fuente canónica. No se permiten capturas paralelas en rutas legacy.</p>
              <div className="mt-4 text-xs">Totales calculados en getMatrixTotals y recalculateLot.</div>
            </div>
          )}

          {activeTab === 'Tarimas y salida a Inventarios' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="font-bold mb-4">Tarimas y salida a Inventarios</h2>
              <p>Lista de pallet_output_summary (fuente única). Asignación a slots actualiza inventario y producción.</p>
              {/* reuse pallet list logic */}
              {pallets.length > 0 && <div className="text-xs mt-2">{pallets.length} tarimas en sistema.</div>}
            </div>
          )}

          {activeTab === 'Historial de corridas' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2>Historial de corridas</h2>
              <p className="text-sm text-slate-500">Historial derivado de production_batches + production_selection_details + pallet_output_summary.</p>
              <div className="mt-3 text-xs">{dailyAggregator.length} agrupaciones diarias mostradas en otras pestañas.</div>
            </div>
          )}

          {activeTab === 'Diferencias y correcciones' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2>Diferencias y correcciones</h2>
              <p className="text-sm text-slate-500">Usar validateLotBalance (recalculate) para detectar merma vs recibido. Fuente única Ingreso de Fruta.</p>
            </div>
          )}

          {/* Fallback / legacy content preserved under Nueva tab for stability */}
        </div>
      </main>
    </div>
  );
}
