'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BalanceProcesoDesechoPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('semana');
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [kgLabels, setKgLabels] = useState({proceso:'Proceso', desecho:'Desecho'});

  const fetchKgLabels = async () => {
    try {
      const res = await fetch('/api/kg-concept-labels');
      const data = await res.json();
      const map = data.map || {};
      setKgLabels({ proceso: map.proceso || 'Proceso', desecho: map.desecho || 'Desecho' });
    } catch(e){}
  };
  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      let start = startDate;
      let end = endDate;

      if (selectedPeriod === 'semana') {
        start = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else if (selectedPeriod === 'mes') {
        start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        end = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      } else if (selectedPeriod === 'anio') {
        start = format(startOfYear(new Date()), 'yyyy-MM-dd');
        end = format(endOfYear(new Date()), 'yyyy-MM-dd');
      }

      // This endpoint would return analytical data from production, lotifications, etc.
      const res = await fetch(`/api/analytics/balance-proceso-desecho?startDate=${start}&endDate=${end}`);
      const data = await res.json();
      setAnalyticsData(data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    fetchKgLabels();
  }, [selectedPeriod, startDate, endDate]);

  const L = kgLabels;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors mb-4"
          >
            <i className="ph-arrow-left text-lg"></i>
            <span className="font-medium text-slate-700">Regresar</span>
          </button>
          
          <div className="flex gap-2 mb-2 items-center">
            <h1 className="text-4xl font-bold text-slate-800">Balance de Proceso y Desecho</h1>
            <a href="/produccion-desecho-contado" className="text-xs px-2 py-1 border rounded bg-white">Editar conceptos kg →</a>
          </div>
          <p className="text-slate-600">Módulo exclusivamente analítico para visualizar rendimientos y conversión de fruta</p>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <i className="ph-info text-blue-600 text-xl"></i>
              <p className="text-sm text-blue-700">
                <strong>Módulo Analítico:</strong> Este módulo NO realiza ventas ni registros de cobros.
                Únicamente visualiza información proveniente de Recepción, Producción, Lotificaciones y Contado.
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2">
              {[
                { id: 'semana', label: 'Semana' },
                { id: 'mes', label: 'Mes' },
                { id: 'anio', label: 'Año' },
                { id: 'personalizado', label: 'Personalizado' }
              ].map(period => (
                <button
                  key={period.id}
                  onClick={() => setSelectedPeriod(period.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedPeriod === period.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
            
            {selectedPeriod === 'personalizado' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <span className="text-slate-500">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </>
            )}
          </div>
        </div>

        {/* Main Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-package text-4xl opacity-80"></i>
              <div>
                <p className="text-xs font-medium opacity-90 uppercase">Fruta Recibida</p>
              </div>
            </div>
            <p className="text-4xl font-bold mb-1">
              {analyticsData?.fruta_recibida_kg.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || 0}
            </p>
            <p className="text-sm opacity-80">kg totales</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-check-circle text-4xl opacity-80"></i>
              <div>
                <p className="text-xs font-medium opacity-90 uppercase">Conversión Proceso</p>
              </div>
            </div>
            <p className="text-4xl font-bold mb-1">
              {analyticsData?.conversion_proceso.toFixed(2) || 0}%
            </p>
            <p className="text-sm opacity-80">{L.proceso} • {analyticsData?.proceso_kg.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || 0} kg</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-trash text-4xl opacity-80"></i>
              <div>
                <p className="text-xs font-medium opacity-90 uppercase">Conversión Desecho</p>
              </div>
            </div>
            <p className="text-4xl font-bold mb-1">
              {analyticsData?.conversion_desecho.toFixed(2) || 0}%
            </p>
            <p className="text-sm opacity-80">{L.desecho} • {analyticsData?.desecho_kg.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || 0} kg</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-chart-bar text-4xl opacity-80"></i>
              <div>
                <p className="text-xs font-medium opacity-90 uppercase">Aprovechamiento</p>
              </div>
            </div>
            <p className="text-4xl font-bold mb-1">
              {analyticsData?.aprovechamiento_total.toFixed(2) || 0}%
            </p>
            <p className="text-sm opacity-80">rendimiento global</p>
          </div>
        </div>

        {/* Historical Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Comparativo Semanal</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Semana Actual</span>
                <span className="text-lg font-bold text-emerald-600">
                  {analyticsData?.semana_actual_kg.toLocaleString('es-MX') || 0} kg
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Semana Anterior</span>
                <span className="text-lg font-bold text-slate-600">
                  {analyticsData?.semana_anterior_kg.toLocaleString('es-MX') || 0} kg
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-sm font-semibold text-slate-700">Variación</span>
                <span className={`text-lg font-bold ${(analyticsData?.variacion_semanal || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {(analyticsData?.variacion_semanal || 0) >= 0 ? '↑' : '↓'} {Math.abs(analyticsData?.variacion_semanal || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Comparativo Mensual</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Mes Actual</span>
                <span className="text-lg font-bold text-purple-600">
                  {analyticsData?.mes_actual_kg.toLocaleString('es-MX') || 0} kg
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Mes Anterior</span>
                <span className="text-lg font-bold text-slate-600">
                  {analyticsData?.mes_anterior_kg.toLocaleString('es-MX') || 0} kg
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-sm font-semibold text-slate-700">Variación</span>
                <span className={`text-lg font-bold ${(analyticsData?.variacion_mensual || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {(analyticsData?.variacion_mensual || 0) >= 0 ? '↑' : '↓'} {Math.abs(analyticsData?.variacion_mensual || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Comparativo Anual</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Año en Curso</span>
                <span className="text-lg font-bold text-blue-600">
                  {analyticsData?.anio_actual_kg.toLocaleString('es-MX') || 0} kg
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Promedio Anual</span>
                <span className="text-lg font-bold text-slate-600">
                  {analyticsData?.promedio_anual_kg.toLocaleString('es-MX') || 0} kg
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-sm font-semibold text-slate-700">vs Promedio</span>
                <span className={`text-lg font-bold ${(analyticsData?.vs_promedio || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {(analyticsData?.vs_promedio || 0) >= 0 ? '↑' : '↓'} {Math.abs(analyticsData?.vs_promedio || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Relación Proceso vs Desecho - Histórico de Lotificaciones</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Lote</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Productor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Kg Recibidos</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Kg {L.proceso}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Kg {L.desecho}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">% Proceso</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">% Desecho</th>
                </tr>
              </thead>
              <tbody>
                {!analyticsData?.lotificaciones || analyticsData.lotificaciones.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                      No hay datos de lotificaciones para el período seleccionado
                    </td>
                  </tr>
                ) : (
                  analyticsData.lotificaciones.map((lot, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{lot.lot_number}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{lot.producer}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{lot.date}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600">{lot.kg_received.toLocaleString('es-MX')} kg</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{lot.kg_process.toLocaleString('es-MX')} kg</td>
                      <td className="px-4 py-3 text-sm font-semibold text-orange-600">{lot.kg_waste.toLocaleString('es-MX')} kg</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-700">{lot.percent_process.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-sm font-bold text-orange-700">{lot.percent_waste.toFixed(1)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {loading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 shadow-2xl flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
              <span className="font-medium text-slate-700">Cargando análisis...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
