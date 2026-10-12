'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BatchFlowPage() {
  const router = useRouter();
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetails, setBatchDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/master-batches');
      const data = await response.json();
      setBatches(data);
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchDetails = async (batchId) => {
    try {
      const response = await fetch(`/api/master-batches?id=${batchId}`);
      const data = await response.json();
      setBatchDetails(data);
      setSelectedBatch(batchId);
    } catch (error) {
      console.error('Error fetching batch details:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'received': 'bg-blue-100 text-blue-800',
      'processing': 'bg-yellow-100 text-yellow-800',
      'ready': 'bg-green-100 text-green-800',
      'completed': 'bg-slate-100 text-slate-800'
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'received': '📦',
      'processing': '⚙️',
      'ready': '✅',
      'completed': '🎉'
    };
    return icons[status] || '📋';
  };

  const formatKg = (kg) => {
    return parseFloat(kg || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      <header className="fixed top-0 left-0 right-0 w-full z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-brand-700">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center border border-brand-500/20">
                <img src="/logo.svg" alt="Tecavo Fruits Soft" className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
            </div>
            
            <nav className="hidden lg:flex items-center gap-1">
              <button onClick={() => router.push('/')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                Dashboard Principal
              </button>
              <button className="px-4 py-2 rounded-lg bg-brand-50 text-brand-700 font-medium text-sm transition-colors cursor-default">
                Flujo de Lotes
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Flujo de Lotes Integrado</h1>
            <p className="text-slate-500 mt-1">Seguimiento de lotes desde ingreso hasta envío con inventario unificado</p>
          </section>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500">Cargando lotes...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Batches List */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                    <i className="ph-fill ph-package text-brand-600"></i>
                    Lotes Activos ({batches.length})
                  </h2>
                  
                  {batches.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <i className="ph ph-package text-4xl mb-2 block"></i>
                      <p className="text-sm">No hay lotes registrados</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {batches.map((batch) => (
                        <button
                          key={batch.id}
                          onClick={() => fetchBatchDetails(batch.id)}
                          className={`w-full text-left p-4 rounded-xl border transition-all ${
                            selectedBatch === batch.id 
                              ? 'border-brand-500 bg-brand-50' 
                              : 'border-slate-200 hover:border-brand-300 bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="font-bold text-slate-900 text-sm">{batch.batch_number}</div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(batch.status)}`}>
                              {getStatusIcon(batch.status)} {batch.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mb-1">
                            Lote: {batch.lot_number || 'N/A'}
                          </div>
                          <div className="text-xs text-slate-600 mb-1">
                            Productor: {batch.producer || 'N/A'}
                          </div>
                          <div className="text-xs text-slate-500">
                            Inventario: {formatKg(batch.total_kg_in_inventory)}
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div className="text-center">
                              <div className="text-slate-500">Pesadas</div>
                              <div className="font-semibold text-slate-700">{batch.weighing_count || 0}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-slate-500">Cortes</div>
                              <div className="font-semibold text-slate-700">{batch.cutting_order_count || 0}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-slate-500">Envíos</div>
                              <div className="font-semibold text-slate-700">{batch.shipment_count || 0}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Batch Details */}
              <div className="lg:col-span-2">
                {!selectedBatch ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                    <i className="ph ph-cursor-click text-6xl text-slate-300 mb-4 block"></i>
                    <p className="text-slate-500">Selecciona un lote para ver su flujo completo</p>
                  </div>
                ) : !batchDetails ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                    <p className="text-slate-500">Cargando detalles del lote...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Batch Header */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h2 className="font-bold text-2xl text-slate-900">{batchDetails.batch.batch_number}</h2>
                          <p className="text-slate-500 mt-1">Lote: {batchDetails.batch.lot_number} - {batchDetails.batch.producer}</p>
                        </div>
                        <span className={`text-sm px-3 py-1.5 rounded-full font-semibold ${getStatusColor(batchDetails.batch.status)}`}>
                          {getStatusIcon(batchDetails.batch.status)} {batchDetails.batch.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                          <div className="text-xs text-blue-600 mb-1">Recibido</div>
                          <div className="font-bold text-lg text-blue-900">{formatKg(batchDetails.batch.total_kg_received)}</div>
                        </div>
                        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                          <div className="text-xs text-yellow-600 mb-1">Procesado</div>
                          <div className="font-bold text-lg text-yellow-900">{formatKg(batchDetails.batch.total_kg_processed)}</div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                          <div className="text-xs text-green-600 mb-1">En Inventario</div>
                          <div className="font-bold text-lg text-green-900">{formatKg(batchDetails.batch.total_kg_in_inventory)}</div>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                          <div className="text-xs text-purple-600 mb-1">Enviado</div>
                          <div className="font-bold text-lg text-purple-900">{formatKg(batchDetails.batch.total_kg_shipped)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Flow Stages */}
                    <div className="space-y-4">
                      {/* Intake Stage */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">1</span>
                          Ingreso de Fruta
                        </h3>
                        {batchDetails.weighings.length === 0 ? (
                          <div className="text-sm text-slate-500 text-center py-4">No hay pesadas registradas</div>
                        ) : (
                          <div className="space-y-2">
                            {batchDetails.weighings.map((w) => (
                              <div key={w.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="text-sm">
                                  <div className="font-medium text-slate-900">Pesada #{w.id}</div>
                                  <div className="text-xs text-slate-600">{new Date(w.timestamp).toLocaleString('es-MX')}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-blue-900">{formatKg(w.net_weight)}</div>
                                  <div className="text-xs text-slate-600">{w.boxes || 0} cajas</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Cutting Stage */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold">2</span>
                          Órdenes de Corte
                        </h3>
                        {batchDetails.cuttingOrders.length === 0 ? (
                          <div className="text-sm text-slate-500 text-center py-4">No hay órdenes de corte registradas</div>
                        ) : (
                          <div className="space-y-2">
                            {batchDetails.cuttingOrders.map((co) => (
                              <div key={co.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                <div className="text-sm">
                                  <div className="font-medium text-slate-900">{co.folio}</div>
                                  <div className="text-xs text-slate-600">Jefe: {co.crew_chief_name} | {co.crew_workers_count || 0} cortadores</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-yellow-900">{co.boxes_count || 0} cajas</div>
                                  <div className="text-xs text-slate-600">{formatKg(co.net_weight)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Production Stage */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">3</span>
                          Producción e Inventario
                        </h3>
                        {batchDetails.inventory.length === 0 ? (
                          <div className="text-sm text-slate-500 text-center py-4">No hay producción registrada</div>
                        ) : (
                          <div className="space-y-2">
                            {batchDetails.inventory.map((inv) => (
                              <div key={inv.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                                <div className="text-sm">
                                  <div className="font-medium text-slate-900">{inv.pallet_type || 'Tarima'} - {inv.caliber || 'N/A'}</div>
                                  <div className="text-xs text-slate-600">Clase: {inv.class_name || 'N/A'} | {inv.pallet_count || 0} tarimas</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-green-900">{formatKg(inv.total_kg)}</div>
                                  <div className="text-xs text-slate-600">{new Date(inv.created_at).toLocaleDateString('es-MX')}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Shipping Stage */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">4</span>
                          Envíos
                        </h3>
                        {batchDetails.shipments.length === 0 ? (
                          <div className="text-sm text-slate-500 text-center py-4">No hay envíos registrados</div>
                        ) : (
                          <div className="space-y-2">
                            {batchDetails.shipments.map((ship) => (
                              <div key={ship.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                                <div className="text-sm">
                                  <div className="font-medium text-slate-900">{ship.customer_name || 'Cliente'} - {ship.destination || 'N/A'}</div>
                                  <div className="text-xs text-slate-600">{ship.caliber || 'N/A'} | {ship.pallets_count || 0} tarimas, {ship.boxes_count || 0} cajas</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-purple-900">{formatKg(ship.total_kg)}</div>
                                  <div className="text-xs text-slate-600">{new Date(ship.load_date).toLocaleDateString('es-MX')}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-6 text-sm text-slate-500 text-center">
          Tecavo Fruits Soft © 2024. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
