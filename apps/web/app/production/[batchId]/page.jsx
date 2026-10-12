'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useBranding } from '@/hooks/useBranding';
import Link from 'next/link';

function ProductionBatchDetailContent() {
  const params = useParams();
  const batchId = params.batchId;
  const { branding } = useBranding();
  const [batch, setBatch] = useState(null);
  const [traceabilityLogs, setTraceabilityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');

  useEffect(() => {
    if (batchId) {
      fetchBatchDetails();
      fetchTraceabilityLogs();
    }
  }, [batchId]);

  const fetchBatchDetails = async () => {
    try {
      const response = await fetch(`/api/master-batches?id=${batchId}`);
      const data = await response.json();
      setBatch(data);
    } catch (error) {
      console.error('Error fetching batch:', error);
    }
  };

  const fetchTraceabilityLogs = async () => {
    try {
      const response = await fetch(`/api/traceability?batchId=${batchId}`);
      const data = await response.json();
      setTraceabilityLogs(data);
    } catch (error) {
      console.error('Error fetching traceability logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      intake: 'bg-blue-100 text-blue-800 border-blue-200',
      cutting: 'bg-purple-100 text-purple-800 border-purple-200',
      production: 'bg-green-100 text-green-800 border-green-200',
      materials: 'bg-orange-100 text-orange-800 border-orange-200',
      inventory: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      shipment: 'bg-pink-100 text-pink-800 border-pink-200',
      quality: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      status: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      intake: '📥',
      cutting: '✂️',
      production: '🏭',
      materials: '📦',
      inventory: '📊',
      shipment: '🚚',
      quality: '✅',
      status: '🔄'
    };
    return icons[category] || '📝';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Lote no encontrado</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link 
            href="/production" 
            className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ← Volver
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">
            {batch.batch?.batch_number || 'Batch Detail'}
          </h1>
        </div>

        {/* Batch Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Lote</div>
            <div className="text-xl font-bold text-gray-800">
              {batch.batch?.lot_number || 'N/A'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Productor</div>
            <div className="text-xl font-bold text-gray-800">
              {batch.batch?.producer || 'N/A'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Estado</div>
            <div className="text-xl font-bold text-gray-800 capitalize">
              {batch.batch?.status || 'N/A'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Recibido</div>
            <div className="text-xl font-bold text-gray-800">
              {batch.batch?.total_kg_received?.toLocaleString() || '0'} kg
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'timeline'
                  ? 'border-b-2 text-gray-800'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              style={activeTab === 'timeline' ? { borderColor: branding.primaryColor } : {}}
            >
              📅 Línea de Tiempo
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'materials'
                  ? 'border-b-2 text-gray-800'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              style={activeTab === 'materials' ? { borderColor: branding.primaryColor } : {}}
            >
              📦 Materiales Usados
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'summary'
                  ? 'border-b-2 text-gray-800'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              style={activeTab === 'summary' ? { borderColor: branding.primaryColor } : {}}
            >
              📊 Resumen
            </button>
          </div>

          <div className="p-6">
            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold mb-4">Trazabilidad Completa</h2>
                
                {traceabilityLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No hay eventos registrados
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                    {/* Timeline events */}
                    {traceabilityLogs.map((log, index) => (
                      <div key={log.id} className="relative pl-16 pb-8">
                        {/* Timeline dot */}
                        <div 
                          className="absolute left-6 w-5 h-5 rounded-full border-4 border-white shadow"
                          style={{ backgroundColor: branding.primaryColor }}
                        ></div>

                        {/* Event card */}
                        <div className={`border rounded-lg p-4 ${getCategoryColor(log.event_category)}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{getCategoryIcon(log.event_category)}</span>
                              <div>
                                <h3 className="font-bold text-lg capitalize">
                                  {log.event_type.replace(/_/g, ' ')}
                                </h3>
                                <p className="text-sm opacity-75">
                                  {formatDate(log.timestamp)}
                                </p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(log.event_category)}`}>
                              {log.event_category}
                            </span>
                          </div>

                          {log.event_description && (
                            <p className="mb-2 font-medium">{log.event_description}</p>
                          )}

                          {log.user_name && (
                            <p className="text-sm opacity-75 mb-2">
                              👤 {log.user_name}
                            </p>
                          )}

                          {/* Materials quantities */}
                          {log.material_quantities && Array.isArray(log.material_quantities) && (
                            <div className="mt-3 bg-white bg-opacity-50 rounded p-3">
                              <div className="font-medium text-sm mb-2">Materiales Deducidos:</div>
                              <div className="space-y-1">
                                {log.material_quantities.map((mat, idx) => (
                                  <div key={idx} className="text-sm flex justify-between">
                                    <span>{mat.material_name}</span>
                                    <span className="font-medium">
                                      {mat.quantity_deducted || mat.quantity_used} {mat.unit}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          {log.metadata && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-sm font-medium opacity-75 hover:opacity-100">
                                Ver detalles técnicos
                              </summary>
                              <pre className="mt-2 text-xs bg-white bg-opacity-50 rounded p-2 overflow-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Materials Tab */}
            {activeTab === 'materials' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold mb-4">Materiales Usados</h2>
                
                {(() => {
                  const materialsLogs = traceabilityLogs.filter(
                    log => log.event_category === 'materials' && log.material_quantities
                  );

                  if (materialsLogs.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-500">
                        No hay registros de materiales
                      </div>
                    );
                  }

                  // Aggregate materials by name
                  const materialsSummary = {};
                  materialsLogs.forEach(log => {
                    if (Array.isArray(log.material_quantities)) {
                      log.material_quantities.forEach(mat => {
                        const name = mat.material_name;
                        const qty = mat.quantity_deducted || mat.quantity_used || 0;
                        if (!materialsSummary[name]) {
                          materialsSummary[name] = {
                            name,
                            unit: mat.unit,
                            total: 0,
                            events: []
                          };
                        }
                        materialsSummary[name].total += qty;
                        materialsSummary[name].events.push({
                          date: log.timestamp,
                          quantity: qty,
                          description: log.event_description
                        });
                      });
                    }
                  });

                  return (
                    <div className="space-y-4">
                      {Object.values(materialsSummary).map((material, idx) => (
                        <div key={idx} className="border rounded-lg p-4 bg-white">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold">{material.name}</h3>
                            <span className="text-2xl font-bold" style={{ color: branding.primaryColor }}>
                              {material.total.toLocaleString()} {material.unit}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {material.events.map((event, eventIdx) => (
                              <div key={eventIdx} className="flex justify-between text-sm text-gray-600 border-t pt-2">
                                <div>
                                  <div className="font-medium">{event.description}</div>
                                  <div className="text-xs text-gray-500">{formatDate(event.date)}</div>
                                </div>
                                <div className="font-medium">
                                  -{event.quantity} {material.unit}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold mb-4">Resumen de Batch</h2>

                {/* Production Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm text-blue-600 mb-1">Total Recibido</div>
                    <div className="text-2xl font-bold text-blue-800">
                      {batch.batch?.total_kg_received?.toLocaleString() || '0'} kg
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm text-green-600 mb-1">Total Procesado</div>
                    <div className="text-2xl font-bold text-green-800">
                      {batch.batch?.total_kg_processed?.toLocaleString() || '0'} kg
                    </div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="text-sm text-purple-600 mb-1">En Inventario</div>
                    <div className="text-2xl font-bold text-purple-800">
                      {batch.batch?.total_kg_in_inventory?.toLocaleString() || '0'} kg
                    </div>
                  </div>
                </div>

                {/* Event counts by category */}
                <div>
                  <h3 className="text-xl font-bold mb-3">Eventos por Categoría</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['intake', 'cutting', 'production', 'materials', 'inventory', 'shipment', 'quality', 'status'].map(category => {
                      const count = traceabilityLogs.filter(log => log.event_category === category).length;
                      if (count === 0) return null;
                      return (
                        <div key={category} className={`border rounded-lg p-3 ${getCategoryColor(category)}`}>
                          <div className="text-2xl mb-1">{getCategoryIcon(category)}</div>
                          <div className="text-sm opacity-75 capitalize">{category}</div>
                          <div className="text-xl font-bold">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Related entities */}
                <div>
                  <h3 className="text-xl font-bold mb-3">Entidades Relacionadas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-2">Órdenes de Corte</div>
                      <div className="text-2xl font-bold">
                        {batch.cuttingOrders?.length || 0}
                      </div>
                    </div>
                    <div className="bg-white border rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-2">Batches de Producción</div>
                      <div className="text-2xl font-bold">
                        {batch.productionBatches?.length || 0}
                      </div>
                    </div>
                    <div className="bg-white border rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-2">Salidas de Tarimas</div>
                      <div className="text-2xl font-bold">
                        {batch.inventory?.length || 0}
                      </div>
                    </div>
                    <div className="bg-white border rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-2">Embarques</div>
                      <div className="text-2xl font-bold">
                        {batch.shipments?.length || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductionBatchDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <ProductionBatchDetailContent />
    </Suspense>
  );
}
