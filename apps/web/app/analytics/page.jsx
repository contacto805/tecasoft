'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function fmt(n) {
  return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

function fmtKg(n) {
  return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 }) + ' kg';
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(dateRange);
      const res = await fetch(`/api/analytics/dashboard?${params}`);
      const analyticsData = await res.json();
      setData(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="ph ph-circle-notch text-5xl animate-spin text-brand-600 block mb-3"></i>
          <p className="text-slate-600 text-lg">Cargando análisis...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">No hay datos disponibles</p>
      </div>
    );
  }

  const summary = data.summary || {};
  const profitability = data.profitability || {};
  const topProducers = data.top_producers || [];
  const topOrchards = data.top_orchards || [];
  const calibers = data.caliber_distribution || [];
  const dailyTrend = data.daily_trend || [];
  const weeklySummary = data.weekly_summary || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Dashboard Analítico</h1>
              <p className="text-slate-500 mt-1">Análisis de rentabilidad y rendimiento por lote</p>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Desde</label>\n                <input
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500/20 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Hasta</label>
                <input
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500/20 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Summary Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Lotes</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{summary.total_lots || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <i className="ph-fill ph-boxes text-2xl"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Ingresos</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{fmt(summary.total_revenue)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                <i className="ph-fill ph-currency-circle-dollar text-2xl"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Utilidad</p>
                <p className="text-2xl font-bold text-brand-600 mt-1">{fmt(summary.total_profit)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600">
                <i className="ph-fill ph-trend-up text-2xl"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Margen Promedio</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{profitability.avg_margin}%</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                <i className="ph-fill ph-percent text-2xl"></i>
              </div>
            </div>
          </div>
        </section>

        {/* Operational Metrics */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Métricas Operativas</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Cortado</p>
              <p className="text-lg font-bold text-slate-900">{fmtKg(summary.total_kg_cut)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Ingresado</p>
              <p className="text-lg font-bold text-slate-900">{fmtKg(summary.total_kg_received)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Empacado</p>
              <p className="text-lg font-bold text-blue-600">{fmtKg(summary.total_kg_packed)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Proceso</p>
              <p className="text-lg font-bold text-orange-600">{fmtKg(summary.total_kg_process)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Desecho</p>
              <p className="text-lg font-bold text-red-600">{fmtKg(summary.total_kg_waste)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Vendido</p>
              <p className="text-lg font-bold text-green-600">{fmtKg(summary.total_kg_sold)}</p>
            </div>
          </div>
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Daily Trend */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Tendencia Diaria</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => `$${value.toLocaleString('es-MX')}`}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" name="Ingresos" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" stroke="#3b82f6" name="Utilidad" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Weekly Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Resumen Semanal</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklySummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week_start" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => `${value.toLocaleString('es-MX')}`}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="Ingresos" />
                <Bar dataKey="profit" fill="#3b82f6" name="Utilidad" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Top Producers & Orchards */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Producers */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="ph-fill ph-user-circle text-brand-600"></i>
              Mejores Productores
            </h3>
            <div className="space-y-3">
              {topProducers.slice(0, 5).map((producer, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">{producer.name}</p>
                    <p className="text-xs text-slate-500">{producer.lots_count} lotes • {fmtKg(producer.total_kg)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600 text-sm">{fmt(producer.total_profit)}</p>
                    <p className="text-xs text-slate-500">{producer.avg_margin}% margen</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Orchards */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="ph-fill ph-tree text-green-600"></i>
              Mejores Huertas
            </h3>
            <div className="space-y-3">
              {topOrchards.slice(0, 5).map((orchard, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">{orchard.name}</p>
                    <p className="text-xs text-slate-500">{orchard.lots_count} lotes • {fmtKg(orchard.total_kg_received)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600 text-sm">{fmt(orchard.total_profit)}</p>
                    <p className="text-xs text-slate-500">{fmtKg(orchard.total_kg_received)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Caliber Distribution */}
        {calibers.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Distribución de Calibres</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={calibers}
                  dataKey="total_kg"
                  nameKey="caliber"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, total_kg }) => `${name}: ${fmtKg(total_kg)}`}
                >
                  {calibers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => fmtKg(value)} />
              </PieChart>
            </ResponsiveContainer>
          </section>
        )}

        {/* Profitability Summary */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mt-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Resumen de Rentabilidad</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Lotes Rentables</p>
              <p className="text-2xl font-bold text-green-600">{profitability.profitable_lots || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Lotes con Pérdida</p>
              <p className="text-2xl font-bold text-red-600">{profitability.unprofitable_lots || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Margen Promedio</p>
              <p className="text-2xl font-bold text-blue-600">{profitability.avg_margin}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Margen Mín</p>
              <p className="text-2xl font-bold text-orange-600">{profitability.min_margin}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium mb-1">Margen Máx</p>
              <p className="text-2xl font-bold text-green-600">{profitability.max_margin}%</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
