'use client';

import { useState, useEffect } from 'react';
import { useBatchTracking } from '@/hooks/useBatchTracking';

export function BatchTrackingPanel() {
  const { batches, loading, error, getBatchStats } = useBatchTracking();
  const stats = getBatchStats() || { totalProfit: 0, avgProfitMargin: 0, profitableCount: 0, totalBatches: 0 };
  const safeBatches = Array.isArray(batches) ? batches : [];
  const [displayCount, setDisplayCount] = useState(5);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin">
            <div className="w-6 h-6 border-4 border-brand-200 border-t-brand-600 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-xl border border-red-200 bg-red-50">
        <p className="text-red-600 text-sm">Error cargando datos de trazabilidad: {error}</p>
      </div>
    );
  }

  if (!stats || !safeBatches.length) {
    return null;
  }

  // Sort batches by profit (highest first)
  const sortedBatches = [...safeBatches].sort((a, b) => ((b && b.profit) || 0) - ((a && a.profit) || 0));
  const displayedBatches = sortedBatches.slice(0, displayCount);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="text-2xl">📊</span>
              Trazabilidad de Lotes
            </h3>
            <p className="text-sm text-slate-500 mt-1">Análisis de rentabilidad por lote</p>
          </div>
          <a 
            href="/batch-tracking"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
          >
            Ver todo <span>→</span>
          </a>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Ganancia Neta</p>
          <p className={`text-lg font-bold ${stats.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {stats.totalProfit >= 0 ? '+' : ''}₡{(stats.totalProfit / 1000).toFixed(1)}k
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Margen Promedio</p>
          <p className={`text-lg font-bold ${stats.avgProfitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {stats.avgProfitMargin.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Lotes Exitosos</p>
          <p className="text-lg font-bold text-emerald-600">{stats.profitableCount}/{stats.totalBatches}</p>
        </div>
      </div>

      {/* Batch List */}
      <div className="divide-y divide-slate-100">
        {displayedBatches.length > 0 ? (
          displayedBatches.map((batch) => (
            <BatchTrackingRow key={batch.id} batch={batch} />
          ))
        ) : (
          <div className="px-6 py-8 text-center text-slate-500 text-sm">
            No hay lotes disponibles para mostrar
          </div>
        )}
      </div>

      {/* Footer */}
      {safeBatches.length > displayCount && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={() => setDisplayCount(displayCount + 5)}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Ver {Math.min(5, safeBatches.length - displayCount)} más
          </button>
        </div>
      )}
    </div>
  );
}

function BatchTrackingRow({ batch }) {
  const b = batch || {};
  const isProfit = (b.profit || 0) >= 0;

  return (
    <div className="px-6 py-4 hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            {b.lot_number || '—'}
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              b.status === 'completado' ? 'bg-emerald-100 text-emerald-700' :
              b.status === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {b.status === 'completado' ? '✓' : b.status === 'en_proceso' ? '⏳' : '○'}
            </span>
          </h4>
          <p className="text-xs text-slate-500 mt-1">{b.producer || '—'} • {b.fruit_type || '—'}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
            {isProfit ? '+' : ''}₡{((b.profit || 0) / 1000).toFixed(1)}k
          </p>
          <p className={`text-xs font-semibold ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
            {(b.profitMargin || 0).toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
        <div>
          <span className="text-slate-500">Kg:</span>
          <span className="ml-1 font-semibold text-slate-900">{(b.totalKg || 0).toFixed(0)}</span>
        </div>
        <div>
          <span className="text-slate-500">Costo:</span>
          <span className="ml-1 font-semibold text-slate-900">₡{((b.cost || 0) / 1000).toFixed(1)}k</span>
        </div>
        <div>
          <span className="text-slate-500">Ingreso:</span>
          <span className="ml-1 font-semibold text-emerald-600">₡{((b.revenue || 0) / 1000).toFixed(1)}k</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${isProfit ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(Math.abs(b.profitMargin || 0), 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
