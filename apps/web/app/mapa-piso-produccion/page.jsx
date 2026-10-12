'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProductionFloorMap() {
  const router = useRouter();
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [floorMap, setFloorMap] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const productionAreas = [
    { name: 'Recepción', order: 1, icon: '📥', color: 'bg-blue-50 border-blue-300' },
    { name: 'Pesaje', order: 2, icon: '⚖️', color: 'bg-indigo-50 border-indigo-300' },
    { name: 'Espera de Producción', order: 3, icon: '⏳', color: 'bg-purple-50 border-purple-300' },
    { name: 'Selección', order: 4, icon: '👁️', color: 'bg-pink-50 border-pink-300' },
    { name: 'Clasificación', order: 5, icon: '📊', color: 'bg-rose-50 border-rose-300' },
    { name: 'Empaque', order: 6, icon: '📦', color: 'bg-orange-50 border-orange-300' },
    { name: 'Producto Terminado', order: 7, icon: '✅', color: 'bg-green-50 border-green-300' },
    { name: 'Proceso', order: 8, icon: '🔄', color: 'bg-yellow-50 border-yellow-300' },
    { name: 'Desecho', order: 9, icon: '🗑️', color: 'bg-red-50 border-red-300' },
    { name: 'Merma', order: 10, icon: '📉', color: 'bg-gray-50 border-gray-300' },
    { name: 'Almacén Temporal', order: 11, icon: '🏪', color: 'bg-teal-50 border-teal-300' },
    { name: 'Salida a Almacén', order: 12, icon: '➡️', color: 'bg-cyan-50 border-cyan-300' },
    { name: 'Salida a Carga', order: 13, icon: '🚚', color: 'bg-emerald-50 border-emerald-300' },
  ];

  useEffect(() => {
    loadLots();
  }, []);

  useEffect(() => {
    if (selectedLot) {
      loadFloorMap(selectedLot.id);
    }
  }, [selectedLot]);

  const loadLots = async () => {
    try {
      const response = await fetch('/api/lots?status=production');
      if (response.ok) {
        const data = await response.json();
        setLots(data);
      }
    } catch (err) {
      console.error('Error loading lots:', err);
    }
  };

  const loadFloorMap = async (lot_id) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/production-floor-map?lot_id=${lot_id}`);
      if (response.ok) {
        const data = await response.json();
        setFloorMap(data);
      }
    } catch (err) {
      console.error('Error loading floor map:', err);
      setError('Error cargando mapa de piso');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, fromArea) => {
    e.dataTransfer.setData('fromArea', fromArea.area_name);
    e.dataTransfer.setData('kilos', fromArea.kilos_current || 0);
  };

  const handleDrop = async (e, toAreaName) => {
    e.preventDefault();
    const fromAreaName = e.dataTransfer.getData('fromArea');
    const kilosAvailable = parseFloat(e.dataTransfer.getData('kilos'));

    if (fromAreaName === toAreaName) {
      setError('No puedes mover a la misma área');
      return;
    }

    const kilos = prompt(`¿Cuántos kilos mover de "${fromAreaName}" a "${toAreaName}"? (Disponible: ${kilosAvailable} kg)`);
    if (!kilos || isNaN(kilos) || parseFloat(kilos) <= 0) return;

    if (parseFloat(kilos) > kilosAvailable) {
      setError('No hay suficientes kilos disponibles');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/production-floor-map', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: selectedLot.id,
          area_from: fromAreaName,
          area_to: toAreaName,
          kilos_moved: parseFloat(kilos),
          boxes_generated: 0,
          user_responsible: 'current_user',
          observations: `Movimiento de ${kilos} kg de ${fromAreaName} a ${toAreaName}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error moviendo producto');
      }

      setSuccess(`Movidos ${kilos} kg exitosamente de ${fromAreaName} a ${toAreaName}`);
      loadFloorMap(selectedLot.id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Error moviendo producto');
    } finally {
      setLoading(false);
    }
  };

  const getAreaData = (areaName) => {
    return floorMap.find((area) => area.area_name === areaName) || { kilos_current: 0, boxes_current: 0 };
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button onClick={() => router.push('/')} className="flex items-center gap-2 text-brand-700 hover:text-brand-800">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center border border-brand-500/20">
                <span className="text-xl">🏭</span>
              </div>
              <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Page Title */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center text-white text-2xl">
                🏭
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mapa de Piso de Producción en Tiempo Real</h1>
                <p className="text-slate-500 mt-1">Seguimiento del recorrido operativo de la fruta durante el empaque</p>
              </div>
            </div>
          </section>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-start gap-2">
              <span className="text-lg">✓</span>
              <span>{success}</span>
            </div>
          )}

          {/* Lot Selector */}
          <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Lote en Producción</label>
            <select
              value={selectedLot?.id || ''}
              onChange={(e) => {
                const lot = lots.find((l) => l.id === parseInt(e.target.value));
                setSelectedLot(lot || null);
              }}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg"
            >
              <option value="">Seleccionar un lote...</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lot_number} - {lot.producer} ({lot.fruit_type})
                </option>
              ))}
            </select>
          </div>

          {selectedLot && (
            <>
              {/* Production Floor Map Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                {productionAreas.map((area) => {
                  const areaData = getAreaData(area.name);
                  const hasProduct = areaData.kilos_current > 0;

                  return (
                    <div
                      key={area.name}
                      className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
                        hasProduct ? area.color + ' shadow-md' : 'bg-white border-slate-200'
                      }`}
                      draggable={hasProduct}
                      onDragStart={(e) => hasProduct && handleDragStart(e, areaData)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('ring-4', 'ring-purple-400');
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('ring-4', 'ring-purple-400');
                      }}
                      onDrop={(e) => {
                        e.currentTarget.classList.remove('ring-4', 'ring-purple-400');
                        handleDrop(e, area.name);
                      }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-3xl">{area.icon}</span>
                          <div>
                            <h3 className="font-bold text-sm text-slate-900">{area.name}</h3>
                            <p className="text-xs text-slate-500">Área {area.order}</p>
                          </div>
                        </div>
                        {hasProduct && (
                          <span className="px-2 py-1 bg-white rounded-full text-xs font-bold text-purple-700 shadow">
                            Activo
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600">Kilos:</span>
                          <span className="text-xl font-bold text-slate-900">{parseFloat(areaData.kilos_current || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600">Cajas:</span>
                          <span className="text-lg font-semibold text-slate-700">{areaData.boxes_current || 0}</span>
                        </div>
                        {areaData.caliber && (
                          <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">
                            Calibre: <span className="font-semibold">{areaData.caliber}</span>
                          </div>
                        )}
                      </div>

                      {hasProduct && (
                        <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-400">
                          🖱️ Arrastra para mover producto
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <p className="text-sm font-medium text-slate-500 mb-1">Total en Proceso</p>
                  <h3 className="text-3xl font-bold text-purple-600">
                    {floorMap.reduce((sum, area) => sum + parseFloat(area.kilos_current || 0), 0).toFixed(2)} kg
                  </h3>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <p className="text-sm font-medium text-slate-500 mb-1">Producto Terminado</p>
                  <h3 className="text-3xl font-bold text-green-600">
                    {(getAreaData('Producto Terminado').kilos_current || 0).toFixed(2)} kg
                  </h3>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <p className="text-sm font-medium text-slate-500 mb-1">Proceso</p>
                  <h3 className="text-3xl font-bold text-yellow-600">
                    {(getAreaData('Proceso').kilos_current || 0).toFixed(2)} kg
                  </h3>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <p className="text-sm font-medium text-slate-500 mb-1">Desecho + Merma</p>
                  <h3 className="text-3xl font-bold text-red-600">
                    {((getAreaData('Desecho').kilos_current || 0) + (getAreaData('Merma').kilos_current || 0)).toFixed(2)} kg
                  </h3>
                </div>
              </div>
            </>
          )}

          {!selectedLot && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🏭</div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Selecciona un lote para comenzar</h3>
              <p className="text-slate-500">El mapa de piso mostrará el flujo en tiempo real del lote seleccionado</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
