'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TraceabilityPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [lots, setLots] = useState([]);
  const [filteredLots, setFilteredLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [traceabilityData, setTraceabilityData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load all lots
  useEffect(() => {
    const fetchLots = async () => {
      try {
        const response = await fetch('/api/lots');
        if (response.ok) {
          const data = await response.json();
          setLots(data);
          setFilteredLots(data);
        }
      } catch (error) {
        console.error('Error loading lots:', error);
      }
    };
    fetchLots();
  }, []);

  // Filter lots based on search
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredLots(lots);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredLots(lots.filter(lot =>
        lot.lot_number.toLowerCase().includes(term) ||
        lot.producer.toLowerCase().includes(term) ||
        lot.orchard_name.toLowerCase().includes(term) ||
        lot.client_name?.toLowerCase().includes(term)
      ));
    }
  }, [searchTerm, lots]);

  const handleSelectLot = async (lot) => {
    setSelectedLot(lot);
    setLoading(true);
    try {
      const response = await fetch(`/api/lot-traceability?lotId=${lot.id}`);
      if (response.ok) {
        const data = await response.json();
        setTraceabilityData(data);
      }
    } catch (error) {
      console.error('Error loading traceability:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = (format) => {
    if (!selectedLot) return;
    window.open(`/api/lot-traceability/report?lotId=${selectedLot.id}&format=${format}`, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cyan-50 via-white to-blue-50">
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-cyan-700 font-bold text-lg tracking-tight"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center border border-cyan-500/20">
              <i className="ph-fill ph-map-pin text-cyan-600"></i>
            </div>
            Trazabilidad del Lote
          </button>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Trazabilidad Completa del Lote</h1>
            <p className="text-slate-500 mt-1">Seguimiento detallado desde la orden de corte hasta la venta final</p>
          </section>

          {/* Search */}
          <div className="mb-8">
            <div className="relative">
              <i className="ph ph-magnifying-glass absolute left-4 top-3.5 text-slate-400 text-lg"></i>
              <input
                type="text"
                placeholder="Buscar por lote, productor, huerta o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          {/* Lots List */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
              <i className="ph-fill ph-list text-cyan-600"></i>
              Lotes Disponibles
            </h2>

            {filteredLots.length === 0 ? (
              <div className="text-center py-12">
                <i className="ph ph-inbox text-4xl text-slate-300 mb-3 block"></i>
                <p className="text-slate-500">No se encontraron lotes</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredLots.map((lot) => (
                  <div
                    key={lot.id}
                    className="p-4 border border-slate-200 rounded-xl hover:border-cyan-300 hover:bg-cyan-50/30 transition-all cursor-pointer"
                    onClick={() => handleSelectLot(lot)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900">{lot.lot_number}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          {lot.producer} | {lot.orchard_name} | Cliente: {lot.client_name}
                        </p>
                        <div className="flex gap-4 mt-2 text-xs text-slate-500">
                          <span>Entrada: {lot.total_kg_received} kg</span>
                          <span>Vendido: {lot.total_kg_sold} kg</span>
                          <span>Estado: {lot.lot_traceability_status}</span>
                        </div>
                      </div>
                      {selectedLot?.id === lot.id && (
                        <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium">
                          Seleccionado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Traceability Details */}
          {selectedLot && traceabilityData && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-8 rounded-2xl shadow-lg text-white">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">{selectedLot.lot_number}</h2>
                    <p className="opacity-90">
                      {selectedLot.producer} - {selectedLot.orchard_name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadReport('csv')}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-all flex items-center gap-2"
                    >
                      <i className="ph ph-download text-lg"></i>
                      CSV
                    </button>
                    <button
                      onClick={() => downloadReport('pdf')}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-all flex items-center gap-2"
                    >
                      <i className="ph ph-file-pdf text-lg"></i>
                      PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                  <i className="ph-fill ph-timeline text-cyan-600"></i>
                  Flujo del Lote
                </h3>

                <div className="space-y-6">
                  {/* Orden de Corte */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-green-100 border-4 border-green-500 flex items-center justify-center text-green-600 font-bold text-lg">
                        1
                      </div>
                      <div className="w-0.5 h-20 bg-green-300 my-2"></div>
                    </div>
                    <div className="pb-6">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <i className="ph ph-scissors text-green-600"></i>
                        Orden de Corte
                      </h4>
                      <p className="text-sm text-slate-600 mt-1">
                        Fecha: {selectedLot.date}
                      </p>
                      <p className="text-sm text-slate-600">
                        Kg Cortados: {selectedLot.total_kg_cut || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Ingreso */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-blue-100 border-4 border-blue-500 flex items-center justify-center text-blue-600 font-bold text-lg">
                        2
                      </div>
                      <div className="w-0.5 h-20 bg-blue-300 my-2"></div>
                    </div>
                    <div className="pb-6">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <i className="ph ph-package text-blue-600"></i>
                        Ingreso de Fruta
                      </h4>
                      <p className="text-sm text-slate-600 mt-1">
                        Kg Ingresados: {traceabilityData?.ingreso?.total_kg_received || 0}
                      </p>
                      <p className="text-sm text-slate-600">
                        Fecha: {traceabilityData?.ingreso?.ingreso_date || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Producción */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-purple-100 border-4 border-purple-500 flex items-center justify-center text-purple-600 font-bold text-lg">
                        3
                      </div>
                      <div className="w-0.5 h-20 bg-purple-300 my-2"></div>
                    </div>
                    <div className="pb-6">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <i className="ph ph-factory text-purple-600"></i>
                        Producción (Empacado)
                      </h4>
                      <p className="text-sm text-slate-600 mt-1">
                        Kg Empacados: {traceabilityData?.production?.total_kg_packed || 0}
                      </p>
                      <div className="mt-2 space-y-1">
                        {traceabilityData?.production?.details_by_caliber?.map((cal, i) => (
                          <p key={i} className="text-xs text-slate-500">
                            {cal.caliber} {cal.class_name}: {cal.kg_packed} kg
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Inventario */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-yellow-100 border-4 border-yellow-500 flex items-center justify-center text-yellow-600 font-bold text-lg">
                        4
                      </div>
                      <div className="w-0.5 h-20 bg-yellow-300 my-2"></div>
                    </div>
                    <div className="pb-6">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <i className="ph ph-warehouse text-yellow-600"></i>
                        Inventario
                      </h4>
                      <p className="text-sm text-slate-600 mt-1">
                        Kg Disponibles: {traceabilityData?.summary?.kg_available_inventory || 0}
                      </p>
                      <div className="mt-2 space-y-1">
                        {traceabilityData?.inventory?.by_caliber?.map((inv, i) => (
                          <p key={i} className="text-xs text-slate-500">
                            {inv.caliber} {inv.class_name}: {inv.kg_available} kg
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Ventas */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 border-4 border-emerald-500 flex items-center justify-center text-emerald-600 font-bold text-lg">
                        5
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <i className="ph ph-truck text-emerald-600"></i>
                        Ventas
                      </h4>
                      <p className="text-sm text-slate-600 mt-1">
                        Kg Vendidos: {traceabilityData?.summary?.kg_sold || 0}
                      </p>
                      <div className="mt-2 space-y-1">
                        {traceabilityData?.sales?.main_sales?.map((sale, i) => (
                          <p key={i} className="text-xs text-slate-500">
                            {sale.customer}: {sale.kg_sold} kg - ${sale.total_amount.toFixed(2)}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Operativo Summary */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                    <i className="ph-fill ph-chart-bar text-blue-600"></i>
                    Resumen Operativo (Kg)
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Cortados:</span>
                      <span className="font-bold">{traceabilityData?.summary?.kg_cut || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Ingresados:</span>
                      <span className="font-bold">{traceabilityData?.summary?.kg_received || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Empacados:</span>
                      <span className="font-bold">{traceabilityData?.summary?.kg_packed || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Proceso:</span>
                      <span className="font-bold">{traceabilityData?.summary?.kg_process || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Desecho:</span>
                      <span className="font-bold">{traceabilityData?.summary?.kg_waste || 0}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Disponible:</span>
                      <span className="text-emerald-600">{traceabilityData?.summary?.kg_available_inventory || 0}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-600">
                      <span>Vendidos:</span>
                      <span>{traceabilityData?.summary?.kg_sold || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                    <i className="ph-fill ph-coins text-yellow-600"></i>
                    Resumen Financiero
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Ingresos:</span>
                      <span className="font-bold text-emerald-600">${traceabilityData?.summary?.total_revenue?.toFixed(2) || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Costos:</span>
                      <span className="font-bold text-red-600">${traceabilityData?.summary?.total_cost?.toFixed(2) || 0}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Utilidad Neta:</span>
                      <span className={traceabilityData?.summary?.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        ${traceabilityData?.summary?.net_profit?.toFixed(2) || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
