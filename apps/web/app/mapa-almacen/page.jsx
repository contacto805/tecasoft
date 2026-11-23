'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MapaAlmacenPage() {
  const router = useRouter();
  const [warehouseSlots, setWarehouseSlots] = useState({});
  const [pendingItems, setPendingItems] = useState([]);
  const [allPallets, setAllPallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCaliber, setFilterCaliber] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetSlot, setAssignTargetSlot] = useState(null);
  const [moveSource, setMoveSource] = useState(null); // {slotId, palletData} when moving
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const cols = ['A', 'B', 'C'];
  const rows = Array.from({ length: 13 }, (_, i) => i + 1);

  const allCalibres = ["Super (40's)", "Extra (48's)", "Primera (60's)", "Mediano (70's)", "Tercera (84's)", "Cuarta"];

  // Load real data from system (pallet_output_summary is single source)
  const loadData = async (showLoading=true) => {
    if (showLoading) {setLoading(true);setError('');}
    try {
      const [palletRes, pendingRes] = await Promise.all([
        fetch('/api/pallet-output'),
        fetch('/api/production/pending-inventory')
      ]);

      const pallets = palletRes.ok ? await palletRes.json() : [];
      const pending = pendingRes.ok ? await pendingRes.json() : [];

      setAllPallets(Array.isArray(pallets) ? pallets : []);

      // Build occupied slots from current warehouse locations (only active cold inventory)
      const newSlots = {};
      (Array.isArray(pallets) ? pallets : []).forEach(p => {
        const slot = (p.warehouse_slot || p.ubicacion_actual || '').toUpperCase().trim();
        const estado = (p.estado || '').toUpperCase();
        if (!slot || p.embarque_id || ['EMBARCADA','CANCELADA','REEMPACADA'].includes(estado)) return;
        
        const is6 = (p.pallet_type || '').toLowerCase().includes('6');
        const boxesPer = is6 ? 40 : 96;
        
        newSlots[slot] = {
          pallet_id: p.id,
          folio: p.folio_tarima || ('TAR-' + String(p.id).padStart(6, '0')),
          lot_id: p.lot_id,
          lot_number: p.lot_number || '',
          producer: p.producer || '',
          caliber: p.caliber || '',
          class_name: p.class_name || 'A',
          boxes: (p.pallet_count || 1) * boxesPer,
          total_kg: parseFloat(p.total_kg || 0),
          cold_date: p.cold_date ? String(p.cold_date).slice(0, 10) : (p.packing_date ? String(p.packing_date).slice(0, 10) : ''),
          presentation: is6 ? '6 kg' : '10 kg',
          estado: /^TRAILER-/i.test(p.ubicacion_actual || '') ? 'RESERVADA PARA CARGA' : estado || 'EN_FRIO'
        };
      });
      setWarehouseSlots(newSlots);

      // Pending = those without slot or explicitly pending (real from system)
      const pendingList = Array.isArray(pending) ? pending : (Array.isArray(pallets) ? pallets.filter(p => {
        const s = (p.warehouse_slot || p.ubicacion_actual || '').trim();
        const st = (p.estado || '').toUpperCase();
        return !s && !['EMBARCADA', 'CANCELADA'].includes(st);
      }) : []);
      setPendingItems(pendingList);
    } catch (e) {
      setError('Error cargando datos del almacén');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const refresh = () => {if (!document.hidden) loadData(false);};
    const timer = setInterval(refresh,8000);
    window.addEventListener('focus',refresh);
    return () => {clearInterval(timer);window.removeEventListener('focus',refresh);};
  }, []);

  // Filtered pending for assign/search
  const filteredPending = pendingItems.filter(item => {
    const term = searchTerm.toLowerCase();
    const cal = (item.caliber || '').toLowerCase();
    const matchesSearch = !term || 
      (item.lot_number || '').toLowerCase().includes(term) ||
      (item.folio_tarima || '').toLowerCase().includes(term) ||
      cal.includes(term);
    const matchesCal = !filterCaliber || (item.caliber || '').includes(filterCaliber);
    return matchesSearch && matchesCal;
  });

  const getSlotData = (slotId) => warehouseSlots[slotId];

  // Click empty slot -> open assign modal
  const handleSlotClick = (slotId) => {
    const occupied = getSlotData(slotId);
    if (occupied) {
      setSelectedSlot(slotId);
    } else {
      if (moveSource) {
        // completing a move into this empty slot
        completeMoveToSlot(slotId);
      } else {
        setAssignTargetSlot(slotId);
        setShowAssignModal(true);
        setSearchTerm('');
        setFilterCaliber('');
      }
    }
  };

  // Assign a pending tarima to a slot (uses canonical assign endpoint)
  const assignToSlot = async (slotId, item) => {
    if (!item || !item.id) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/production/assign-to-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_output_id: item.id,
          slot_id: slotId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al asignar');

      setMessage(`Tarima ${item.folio_tarima || item.id} asignada a ${slotId}`);
      setShowAssignModal(false);
      setAssignTargetSlot(null);
      setSelectedSlot(null);
      await loadData(); // real reload from DB
      setTimeout(() => setMessage(''), 2500);
    } catch (e) {
      setError(e.message || 'No se pudo asignar la ubicación');
    } finally {
      setLoading(false);
    }
  };

  // Clear a position (return to pending) using canonical pallet update
  const clearSlot = async (slotId) => {
    const data = getSlotData(slotId);
    if (!data || !data.pallet_id) return;
    if (!confirm(`¿Quitar la tarima de ${slotId} y volverla a pendiente?`)) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/pallet-output', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.pallet_id, action: 'clear' })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Error al quitar ubicación');
      }
      setMessage(`Posición ${slotId} liberada`);
      setSelectedSlot(null);
      await loadData();
      setTimeout(() => setMessage(''), 2200);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Start move from an occupied slot (select target empty next)
  const startMove = (currentSlotId) => {
    const data = getSlotData(currentSlotId);
    if (!data) return;
    setSelectedSlot(null);
    setMoveSource({ slotId: currentSlotId, data });
    setMessage(`Elige posición destino vacía para mover desde ${currentSlotId}`);
  };

  const completeMoveToSlot = async (newSlotId) => {
    if (!moveSource || !moveSource.data) {
      setMoveSource(null);
      setShowAssignModal(false);
      return;
    }
    const { slotId: oldSlot, data: src } = moveSource;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/production/assign-to-slot', {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({pallet_output_id:src.pallet_id,slot_id:newSlotId})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`Movida: ${oldSlot} → ${newSlotId}`);
      setMoveSource(null);
      setShowAssignModal(false);
      await loadData();
      setTimeout(() => setMessage(''), 2400);
    } catch (e) {
      setError(e.message || 'Error al mover la tarima');
    } finally {
      setLoading(false);
    }
  };

  // Quick stats
  const totalTarimas = Object.keys(warehouseSlots).length;
  const totalCajas = Object.values(warehouseSlots).reduce((s, v) => s + (v.boxes || 0), 0);
  const totalKg = Object.values(warehouseSlots).reduce((s, v) => s + (v.total_kg || 0), 0);

  // Filtered grid display
  const getVisiblePending = () => filteredPending;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-emerald-700 hover:text-emerald-800">←</button>
            <div>
              <span className="font-semibold text-xl tracking-tight text-slate-900">Mapa de Almacén</span>
              <span className="ml-2 text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">Inventario en Frío • SoftTecavo</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={loadData} disabled={loading} className="px-3 py-1.5 border rounded-lg hover:bg-white disabled:opacity-60">Actualizar</button>
            <button onClick={() => router.push('/inventory')} className="px-3 py-1.5 border rounded-lg hover:bg-white">Ver Inventario Completo</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-end gap-3 mb-6">
          <div>
            <div className="text-xs uppercase tracking-[1px] text-slate-500">TECAVO FRUITS • CÁMARAS FRÍAS</div>
            <h1 className="text-3xl font-semibold tracking-tighter text-slate-900">Actualizar ubicaciones del inventario</h1>
          </div>
          <div className="flex-1" />
          <div className="flex gap-2 items-center">
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar lote, folio o calibre..."
              className="border px-3 py-2 rounded-xl text-sm w-64"
            />
            <select value={filterCaliber} onChange={e => setFilterCaliber(e.target.value)} className="border px-3 py-2 rounded-xl text-sm">
              <option value="">Todos calibres</option>
              {allCalibres.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => { setSearchTerm(''); setFilterCaliber(''); }} className="text-xs px-3 py-2 border rounded-xl">Limpiar</button>
          </div>
        </div>

        {/* Messages */}
        {message && <div className="mb-4 px-4 py-2 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-200">{message}</div>}
        {error && <div className="mb-4 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border rounded-2xl p-4">
            <div className="text-xs text-slate-500">Tarimas en frío</div>
            <div className="text-3xl font-semibold mt-1">{totalTarimas}</div>
          </div>
          <div className="bg-white border rounded-2xl p-4">
            <div className="text-xs text-slate-500">Cajas totales</div>
            <div className="text-3xl font-semibold mt-1">{totalCajas}</div>
          </div>
          <div className="bg-white border rounded-2xl p-4">
            <div className="text-xs text-slate-500">Kg en inventario frío</div>
            <div className="text-3xl font-semibold mt-1">{totalKg.toFixed(0)}</div>
          </div>
          <div className="bg-white border rounded-2xl p-4">
            <div className="text-xs text-slate-500">Pendientes de ubicar</div>
            <div className="text-3xl font-semibold mt-1 text-amber-600">{pendingItems.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* MAP GRID */}
          <div className="lg:col-span-8 bg-white border rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-lg">Mapa de posiciones (A/B/C × 1-13)</div>
              <div className="text-xs text-slate-500">Clic en espacio vacío = asignar • Clic en ocupado = acciones</div>
            </div>

            <div className="overflow-x-auto">
              <div className="inline-grid grid-cols-[auto,1fr,1fr,1fr] gap-1.5 min-w-[620px]">
                {/* Headers */}
                <div />
                {cols.map(c => (
                  <div key={c} className="text-center text-xs font-bold py-1 text-emerald-800">Columna {c}</div>
                ))}

                {rows.map(row => (
                  <React.Fragment key={row}>
                    <div className="text-xs font-semibold pr-2 pt-2 text-right text-slate-500">Fila {row}</div>
                    {cols.map(col => {
                      const slotId = `${col}-${row}`;
                      const data = getSlotData(slotId);
                      const isOccupied = !!data;
                      return (
                        <div
                          key={slotId}
                          onClick={() => handleSlotClick(slotId)}
                          className={`min-h-[92px] border-2 rounded-2xl p-2.5 cursor-pointer transition-all text-xs ${isOccupied 
                            ? 'bg-emerald-50 border-emerald-400 hover:border-emerald-600' 
                            : 'bg-slate-50 border-slate-300 hover:border-emerald-300 hover:bg-emerald-50/40'}`}
                        >
                          <div className="font-mono font-bold text-[10px] text-slate-400 mb-0.5">{slotId}</div>
                          {isOccupied ? (
                            <div>
                              <div className="font-semibold text-emerald-900 leading-tight truncate">{data.folio}</div>
                              <div className="text-[10px] text-emerald-700 truncate">{data.lot_number || ''}</div>
                              <div className="mt-0.5 text-emerald-800">{data.caliber} · {data.class_name}</div>
                              <div className="text-[10px] text-slate-600">{data.boxes} cajas · {data.presentation}</div>
                              <div className="text-[9px] text-emerald-600 mt-0.5">{data.cold_date}</div>
                            </div>
                          ) : (
                            <div className="h-12 flex items-center justify-center text-slate-400 text-[10px]">Vacío • clic para ubicar</div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-3">Fuente: pallet_output_summary (única). Cambios se reflejan en Producción, Embarques y Cierres.</div>
          </div>

          {/* Sidebar: Pending + Selected */}
          <div className="lg:col-span-4 space-y-4">
            {/* Selected slot actions */}
            {selectedSlot && (
              <div className="bg-white border rounded-3xl p-4">
                <div className="font-semibold mb-1">Posición {selectedSlot}</div>
                {getSlotData(selectedSlot) ? (
                  <div className="text-sm space-y-1">
                    <div><b>{getSlotData(selectedSlot).folio}</b> — {getSlotData(selectedSlot).lot_number}</div>
                    <div>{getSlotData(selectedSlot).caliber} / {getSlotData(selectedSlot).class_name}</div>
                    <div>{getSlotData(selectedSlot).boxes} cajas • {getSlotData(selectedSlot).total_kg.toFixed(0)} kg</div>
                    <div className="pt-2 flex gap-2">
                      <button onClick={() => startMove(selectedSlot)} className="flex-1 text-xs py-2 bg-blue-600 text-white rounded-xl">Mover</button>
                      <button onClick={() => clearSlot(selectedSlot)} className="flex-1 text-xs py-2 bg-red-600 text-white rounded-xl">Quitar ubicación</button>
                      <button onClick={() => setSelectedSlot(null)} className="px-3 text-xs border rounded-xl">Cerrar</button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Pending list */}
            <div className="bg-white border rounded-3xl p-4 max-h-[520px] overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Pendientes de ubicación ({getVisiblePending().length})</div>
                <div className="text-[10px] text-amber-600">Arrastra o clic para asignar</div>
              </div>
              {getVisiblePending().length === 0 && (
                <div className="text-sm text-slate-500 py-6 text-center">No hay tarimas pendientes con el filtro actual.</div>
              )}
              <div className="space-y-1.5 text-sm">
                {getVisiblePending().slice(0, 18).map((item, idx) => {
                  const fid = item.folio_tarima || item.folio || ('TAR-' + String(item.id || idx).padStart(6, '0'));
                  return (
                    <div 
                      key={item.id || idx} 
                      onClick={() => {
                        if (assignTargetSlot) {
                          assignToSlot(assignTargetSlot, item);
                        } else {
                          // quick assign to first empty if possible
                          const firstEmpty = Object.keys(warehouseSlots).length < 39 ? 
                            Array.from({length:39}).map((_,i) => `${cols[Math.floor(i/13)]}-${(i%13)+1}`).find(s => !warehouseSlots[s]) : null;
                          if (firstEmpty) assignToSlot(firstEmpty, item);
                        }
                      }}
                      className="p-2.5 border rounded-2xl hover:bg-emerald-50 cursor-pointer flex justify-between items-start"
                    >
                      <div>
                        <div className="font-medium">{fid} • {item.lot_number || '—'}</div>
                        <div className="text-xs text-slate-600">{item.caliber || '—'} / {item.class_name || '—'} • {(item.pallet_count || 1)} tar • {parseFloat(item.total_kg || 0).toFixed(0)} kg</div>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-medium mt-1">Asignar</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] mt-3 text-slate-400">Las ubicaciones se guardan inmediatamente en el sistema y afectan todo SoftTecavo.</div>
            </div>

            <button onClick={() => router.push('/embarques')} className="w-full py-2 text-sm border rounded-2xl hover:bg-white">Ir a Embarques (usar este mapa)</button>
          </div>
        </div>
      </div>

      {/* Assign modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowAssignModal(false); setAssignTargetSlot(null); }}>
          <div className="bg-white w-full max-w-md rounded-3xl p-5 max-h-[82vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="font-semibold text-lg mb-1">Asignar a posición {assignTargetSlot}</div>
            <p className="text-sm text-slate-500 mb-3">Elige una tarima pendiente. La ubicación se actualiza en tiempo real.</p>

            <div className="space-y-1">
              {getVisiblePending().length === 0 ? <div className="text-sm py-6 text-center text-slate-500">Sin pendientes.</div> : 
                getVisiblePending().map((item, i) => (
                  <button key={i} onClick={() => {
                    if (assignTargetSlot) assignToSlot(assignTargetSlot, item);
                  }} className="w-full text-left border rounded-2xl p-3 hover:border-emerald-400 text-sm">
                    <div className="font-medium">{item.folio_tarima || item.folio || item.id} — {item.lot_number}</div>
                    <div className="text-xs text-slate-600">{item.caliber} • {item.class_name} • {item.pallet_count || 1} tar • {parseFloat(item.total_kg||0).toFixed(0)} kg</div>
                  </button>
                ))
              }
            </div>

            <button onClick={() => { setShowAssignModal(false); setAssignTargetSlot(null); setMoveSource(null); }} className="mt-4 w-full py-2 border rounded-2xl text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
