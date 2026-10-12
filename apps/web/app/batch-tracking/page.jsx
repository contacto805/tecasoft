'use client';

import { useState, useEffect } from 'react';
import { useBatchTracking } from '@/hooks/useBatchTracking';

function BatchTrackingPage() {
  const { batches, selectedBatch, loading, error, setSelectedBatch, getBatchStats, refetch } = useBatchTracking();
  const [sortBy, setSortBy] = useState('profit');
  const [filterStatus, setFilterStatus] = useState('all');
  const stats = getBatchStats();

  useEffect(() => {
    if (sortBy === 'profit' && batches.length > 0) {
      const sorted = [...batches].sort((a, b) => (b.profit || 0) - (a.profit || 0));
      // Note: This would need state management to persist
    } else if (sortBy === 'margin' && batches.length > 0) {
      const sorted = [...batches].sort((a, b) => (b.profitMargin || 0) - (a.profitMargin || 0));
    }
  }, [sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full"></div>
            </div>
            <p className="mt-4 text-slate-500">Cargando datos de trazabilidad...</p>
          </div>
        </div>
      </div>
    );
  }

  if (selectedBatch) {
    return <BatchDetailView batch={selectedBatch} onBack={() => setSelectedBatch(null)} />;
  }

  return (
    <div className="min-h-screen pt-20 px-6 py-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <section className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Trazabilidad de Lotes</h1>
          <p className="text-slate-500 mt-2">Seguimiento detallado desde campo hasta venta, con análisis de rentabilidad por lote</p>
        </section>

        {/* Key Stats */}
        {stats && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Lotes Totales</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats.totalBatches}</h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Ingresos Totales</p>
              <h3 className="text-2xl font-bold text-emerald-600">₡{(stats.totalRevenue).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Costos Totales</p>
              <h3 className="text-2xl font-bold text-red-600">₡{(stats.totalCost).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</h3>
            </div>
            <div className={`bg-white p-5 rounded-xl border shadow-sm ${stats.totalProfit >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <p className="text-sm text-slate-500 mb-1">Ganancia Neta</p>
              <h3 className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ₡{(stats.totalProfit).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
              </h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Margen Promedio</p>
              <h3 className={`text-2xl font-bold ${stats.avgProfitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {(stats.avgProfitMargin).toFixed(1)}%
              </h3>
            </div>
          </section>
        )}

        {/* Controls */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 mb-6 flex flex-wrap gap-3 items-center">
          <div>
            <label className="text-sm text-slate-600 mr-2">Ordenar por:</label>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-brand-500"
            >
              <option value="profit">Mayor Ganancia</option>
              <option value="margin">Mayor Margen %</option>
              <option value="date">Más Reciente</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600 mr-2">Estado:</label>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-brand-500"
            >
              <option value="all">Todos</option>
              <option value="completado">Completados</option>
              <option value="en_proceso">En Proceso</option>
              <option value="iniciado">Iniciados</option>
            </select>
          </div>
          <button
            onClick={() => refetch()}
            className="ml-auto px-4 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium transition-colors"
          >
            Refrescar
          </button>
        </section>

        {/* Batches List */}
        {batches.length > 0 ? (
          <div className="grid gap-4">
            {batches.map((batch) => (
              <BatchCard 
                key={batch.id} 
                batch={batch}
                onClick={() => setSelectedBatch(batch)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
            <p className="text-slate-500">No hay lotes disponibles para mostrar</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BatchCard({ batch, onClick }) {
  const isProfit = batch.profit >= 0;
  
  return (
    <button
      onClick={onClick}
      className="bg-white p-6 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all text-left"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{batch.lot_number}</h3>
          <p className="text-sm text-slate-500">{batch.producer} • {batch.fruit_type}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
          batch.status === 'completado' ? 'bg-emerald-100 text-emerald-700' :
          batch.status === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
          'bg-slate-100 text-slate-700'
        }`}>
          {batch.status === 'completado' ? '✓ Completado' : 
           batch.status === 'en_proceso' ? '⏳ En Proceso' : 
           '○ Iniciado'}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Kg Procesados</p>
          <p className="font-bold text-slate-900">{batch.totalKg.toFixed(2)} kg</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Costo Total</p>
          <p className="font-bold text-red-600">₡{batch.cost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Ingresos</p>
          <p className="font-bold text-emerald-600">₡{batch.revenue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Ganancia Neta</p>
          <p className={`font-bold text-lg ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
            {isProfit ? '+' : ''}₡{batch.profit.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className={`flex-1 h-2 bg-slate-200 rounded-full overflow-hidden`}>
            <div
              className={`h-full ${isProfit ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(Math.abs(batch.profitMargin), 100)}%` }}
            ></div>
          </div>
          <span className={`text-sm font-semibold ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
            {batch.profitMargin.toFixed(1)}%
          </span>
        </div>
        <span className="text-slate-400 text-sm">Haz clic para ver detalles →</span>
      </div>
    </button>
  );
}

function BatchDetailView({ batch, onBack }) {
  return (
    <div className="min-h-screen pt-20 px-6 py-8 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 font-medium"
        >
          <span>←</span> Volver a Trazabilidad
        </button>

        {/* Lot Info */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{batch.lot.lot_number}</h1>
              <p className="text-slate-500 mt-1">{batch.lot.producer} • {batch.lot.origin}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Fecha de Ingreso</p>
              <p className="font-bold text-slate-900">{new Date(batch.lot.date).toLocaleDateString('es-MX')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">Tipo de Fruta</p>
              <p className="font-bold text-slate-900">{batch.lot.fruit_type}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Productor</p>
              <p className="font-bold text-slate-900">{batch.lot.producer}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Acopiador</p>
              <p className="font-bold text-slate-900">{batch.lot.collector_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Precio de Compra</p>
              <p className="font-bold text-slate-900">₡{parseFloat(batch.lot.fruit_price).toFixed(2)}/kg</p>
            </div>
          </div>
        </div>

        {/* Journey Timeline */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Recorrido del Lote</h2>
          <div className="space-y-4">
            {batch.checkpoints.map((checkpoint, index) => (
              <div key={index} className="relative pl-6 pb-6">
                {index < batch.checkpoints.length - 1 && (
                  <div className="absolute left-1.5 top-6 w-0.5 h-12 bg-slate-200"></div>
                )}
                <div className={`absolute left-0 top-0 w-3 h-3 rounded-full border-2 ${
                  checkpoint.status === 'completado' ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'
                }`}></div>
                
                <div className={`p-4 rounded-lg border ${
                  checkpoint.status === 'completado' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="text-lg">{checkpoint.icon}</span>
                      {checkpoint.stage}
                    </h3>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white">
                      {checkpoint.status === 'completado' ? '✓ Completado' : '○ Pendiente'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{checkpoint.description}</p>
                  <div className="text-sm">
                    <p className="font-bold text-slate-900">{checkpoint.metric}</p>
                    {checkpoint.date && (
                      <p className="text-slate-500 text-xs mt-1">{new Date(checkpoint.date).toLocaleDateString('es-MX')}</p>
                    )}
                    {checkpoint.subMetrics && (
                      <div className="mt-2 space-y-1 text-slate-600">
                        {checkpoint.subMetrics.returned !== undefined && (
                          <p>Cajas retornadas: {checkpoint.subMetrics.returned}</p>
                        )}
                        {checkpoint.subMetrics.missing !== undefined && (
                          <p>Cajas faltantes: {checkpoint.subMetrics.missing}</p>
                        )}
                        {checkpoint.subMetrics.waste !== undefined && (
                          <p>Merma: {checkpoint.subMetrics.waste.toFixed(2)} kg</p>
                        )}
                        {checkpoint.subMetrics.loss !== undefined && (
                          <p>Pérdida: {checkpoint.subMetrics.loss.toFixed(2)} kg</p>
                        )}
                        {checkpoint.subMetrics.yieldPercentage !== undefined && (
                          <p>Rendimiento: {checkpoint.subMetrics.yieldPercentage}%</p>
                        )}
                      </div>
                    )}
                    {checkpoint.revenue !== undefined && (
                      <p className="mt-2 font-bold text-emerald-600">Ingresos: ₡{checkpoint.revenue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Costs */}
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Desglose de Costos</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-slate-600">Costo de Fruta</span>
                <span className="font-bold text-slate-900">₡{batch.summary.inputCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-slate-600">Comisión</span>
                <span className="font-bold text-slate-900">₡{batch.summary.commissionCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-900 font-bold">Costo Total</span>
                <span className="font-bold text-lg text-red-600">₡{batch.summary.totalCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>

          {/* Revenue & Profit */}
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Resultado Financiero</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-slate-600">Ingresos por Venta</span>
                <span className="font-bold text-emerald-600">₡{batch.summary.totalRevenue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-slate-600">Menos: Costos</span>
                <span className="font-bold text-red-600">-₡{batch.summary.totalCost.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-900 font-bold">Ganancia Neta</span>
                <span className={`font-bold text-lg ${batch.summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {batch.summary.profit >= 0 ? '+' : ''}₡{batch.summary.profit.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Margen de Ganancia</span>
                <span className={`font-bold ${batch.summary.profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {batch.summary.profitMargin.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Details */}
        {batch.sales.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Detalle de Ventas</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Folio</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Comprador</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Producto</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-600">Kg</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-600">Precio Unit.</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">{sale.sales_folio || '-'}</td>
                      <td className="py-3 px-4">{sale.buyer_name}</td>
                      <td className="py-3 px-4">{sale.product_name}</td>
                      <td className="py-3 px-4 text-right">{parseFloat(sale.process_kg).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">₡{parseFloat(sale.unit_price).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        ₡{(parseFloat(sale.calculated_price) || parseFloat(sale.total_price) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BatchTrackingPage;
