'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProductionFloorMapPage() {
  const router = useRouter();
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [floorState, setFloorState] = useState({});
  const [draggingItem, setDraggingItem] = useState(null);
  const [loading, setLoading] = useState(false);

  const areas = [
    { id: 'reception', name: 'Recepción', order: 1, color: 'bg-blue-50 border-blue-300' },
    { id: 'weighing', name: 'Pesaje', order: 2, color: 'bg-indigo-50 border-indigo-300' },
    { id: 'waiting', name: 'Espera de Producción', order: 3, color: 'bg-purple-50 border-purple-300' },
    { id: 'selection', name: 'Selección', order: 4, color: 'bg-pink-50 border-pink-300' },
    { id: 'classification', name: 'Clasificación', order: 5, color: 'bg-rose-50 border-rose-300' },
    { id: 'packing', name: 'Empaque', order: 6, color: 'bg-orange-50 border-orange-300' },
    { id: 'finished', name: 'Producto Terminado', order: 7, color: 'bg-emerald-50 border-emerald-300' },
    { id: 'process', name: 'Proceso', order: 8, color: 'bg-amber-50 border-amber-300' },
    { id: 'waste', name: 'Desecho', order: 9, color: 'bg-red-50 border-red-300' },
    { id: 'shrinkage', name: 'Merma', order: 10, color: 'bg-gray-50 border-gray-300' },
    { id: 'temp_storage', name: 'Almacén Temporal', order: 11, color: 'bg-cyan-50 border-cyan-300' },
    { id: 'to_warehouse', name: 'Salida a Almacén', order: 12, color: 'bg-teal-50 border-teal-300' },
    { id: 'to_load', name: 'Salida a Carga', order: 13, color: 'bg-green-50 border-green-300' }
  ];

  useEffect(() => {
    loadLots();
  }, []);

  useEffect(() => {
    if (selectedLot) {
      loadFloorState(selectedLot.id);
    }
  }, [selectedLot]);

  const loadLots = async () => {
    try {
      const response = await fetch('/api/lots?status=production');
      if (response.ok) {
        const data = await response.json();
        setLots(data);
      }
    } catch (error) {
      console.error('Error loading lots:', error);
    }
  };

  const loadFloorState = async (lotId) => {
    try {
      const response = await fetch(`/api/production-floor-map?lotId=${lotId}`);
      if (response.ok) {
        const data = await response.json();
        const stateByArea = {};
        data.forEach(item => {
          stateByArea[item.area_name] = item;
        });
        setFloorState(stateByArea);
      }
    } catch (error) {
      console.error('Error loading floor state:', error);
    }
  };

  const handleDragStart = (areaId, data) => {
    setDraggingItem({ areaId, data });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (targetAreaId) => {
    if (!draggingItem || !selectedLot) return;

    const fromArea = draggingItem.areaId;
    const kilos = prompt(`¿Cuántos kilos mover de "${areas.find(a => a.id === fromArea)?.name}" a "${areas.find(a => a.id === targetAreaId)?.name}"?`);
    
    if (!kilos || parseFloat(kilos) <= 0) {
      setDraggingItem(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/production-floor-map/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: selectedLot.id,
          fromArea,
          toArea: targetAreaId,
          kilos: parseFloat(kilos),
          userId: 'current-user',
          userName: 'Usuario Actual'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error moviendo producto');
      }

      alert('✓ Producto movido exitosamente');
      loadFloorState(selectedLot.id);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      setDraggingItem(null);
    }
  };

  const handleCloseProduction = async () => {
    if (!selectedLot) return;

    if (!confirm('¿Cerrar producción de este lote? Se validarán los kilos y se enviará el producto terminado al inventario.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/production-floor-map/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: selectedLot.id,
          userId: 'current-user',
          userName: 'Usuario Actual'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error cerrando producción');
      }

      alert('✓ Producción cerrada exitosamente');
      setSelectedLot(null);
      setFloorState({});
      loadLots();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-brand-700 font-bold text-lg"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center border border-brand-500/20">
              🏭
            </div>
            Mapa de Piso de Producción
          </button>
          {selectedLot && (
            <button
              onClick={handleCloseProduction}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              ✓ Cerrar Producción del Lote
            </button>
          )}
        </div>
      </header>

      <main className="pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Mapa de Piso de Producción en Tiempo Real</h1>
            <p className="text-slate-500 mt-1">Rastrea el recorrido de la fruta durante el proceso de empaque</p>
          </section>

          {!selectedLot ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Selecciona un Lote en Producción</h2>
              {lots.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No hay lotes en producción actualmente</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lots.map(lot => (
                    <div
                      key={lot.id}
                      onClick={() => setSelectedLot(lot)}
                      className="p-4 border-2 border-slate-200 rounded-xl hover:border-brand-500 hover:bg-brand-50/30 cursor-pointer transition-all"
                    >
                      <h3 className="font-bold text-slate-900">{lot.lot_number}</h3>
                      <p className="text-sm text-slate-600 mt-1">Productor: {lot.producer}</p>
                      <p className="text-sm text-slate-600">Kg Recibidos: {lot.total_kg_received || 0}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-xl text-slate-900">Lote: {selectedLot.lot_number}</h2>
                  <p className="text-sm text-slate-600">Productor: {selectedLot.producer} | Kg Recibidos: {selectedLot.total_kg_received || 0}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedLot(null);
                    setFloorState({});
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  Cambiar Lote
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {areas.map(area => {
                  const areaData = floorState[area.id];
                  const hasProduct = areaData && parseFloat(areaData.kilos_current || 0) > 0;

                  return (
                    <div
                      key={area.id}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(area.id)}
                      className={`p-4 rounded-xl border-2 ${area.color} transition-all hover:shadow-lg min-h-[180px] flex flex-col`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-sm text-slate-900">{area.name}</h3>
                        <span className="text-xs bg-white/50 px-2 py-1 rounded-full font-medium">{area.order}</span>
                      </div>

                      {hasProduct ? (
                        <div
                          draggable
                          onDragStart={() => handleDragStart(area.id, areaData)}
                          className="flex-1 bg-white p-3 rounded-lg border border-slate-300 cursor-move hover:border-brand-500 hover:shadow-md transition-all"
                        >
                          <p className="text-2xl font-bold text-brand-700">{parseFloat(areaData.kilos_current).toFixed(2)} kg</p>
                          {areaData.boxes_current > 0 && (
                            <p className="text-sm text-slate-600 mt-1">📦 {areaData.boxes_current} cajas</p>
                          )}
                          {areaData.caliber && (
                            <p className="text-xs text-slate-500 mt-1">Calibre: {areaData.caliber}</p>
                          )}
                          {areaData.quality && (
                            <p className="text-xs text-slate-500">Calidad: {areaData.quality}</p>
                          )}
                          {areaData.personnel_assigned && (
                            <p className="text-xs text-slate-400 mt-2">👤 {areaData.personnel_assigned}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg">
                          <p className="text-slate-400 text-sm">Vacío</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-300">
                <h3 className="font-bold text-lg text-slate-900 mb-4">📊 Instrucciones de Uso</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li>✓ Arrastra las tarjetas de producto entre las áreas para registrar movimientos</li>
                  <li>✓ El sistema te pedirá cuántos kilos mover</li>
                  <li>✓ Los movimientos se registran automáticamente en tiempo real</li>
                  <li>✓ Al cerrar producción, se validan los kilos y se envía el producto terminado al inventario</li>
                  <li>✓ No se puede cerrar producción si hay diferencias sin justificar o producto sin ubicación</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
