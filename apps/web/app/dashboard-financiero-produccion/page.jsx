'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DashboardFinancieroProduccionPage() {
  const [selectedWeek, setSelectedWeek] = useState({
    start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    end: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  });
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard-financiero-produccion?weekStartDate=${selectedWeek.start}&weekEndDate=${selectedWeek.end}`);
      const data = await res.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedWeek]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Header with Back Button */}
        <div className="mb-8">
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors mb-4"
          >
            <i className="ph-arrow-left text-lg"></i>
            <span className="font-medium text-slate-700">← Regresar al Dashboard Principal</span>
          </button>
          
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Dashboard Financiero de Producción</h1>
          <p className="text-slate-600">Rentabilidad semanal de fruta procesada</p>
        </div>

        {/* Week Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Semana</label>
          <div className="flex items-center gap-4">
            <input
              type="week"
              value={`${format(new Date(selectedWeek.start), 'yyyy')}-W${format(new Date(selectedWeek.start), 'II')}`}
              onChange={(e) => {
                const [year, week] = e.target.value.split('-W');
                const firstDayOfYear = new Date(parseInt(year), 0, 1);
                const daysToFirstMonday = (8 - firstDayOfYear.getDay()) % 7;
                const firstMonday = new Date(parseInt(year), 0, 1 + daysToFirstMonday);
                const weekStart = new Date(firstMonday.getTime() + (parseInt(week) - 1) * 7 * 24 * 60 * 60 * 1000);
                const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
                setSelectedWeek({
                  start: format(weekStart, 'yyyy-MM-dd'),
                  end: format(weekEnd, 'yyyy-MM-dd')
                });
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex-1">
              <p className="text-sm text-slate-600">
                Semana del {format(new Date(selectedWeek.start), "dd 'de' MMMM", { locale: es })} al {format(new Date(selectedWeek.end), "dd 'de' MMMM, yyyy", { locale: es })}
              </p>
            </div>
          </div>
        </div>

        {/* 5 Main KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          
          {/* 1. Fruta Ingresada Semana (AZUL) */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-package text-4xl opacity-80"></i>
              <div className="flex-1">
                <p className="text-xs font-medium opacity-90 uppercase tracking-wide">Fruta Ingresada</p>
                <p className="text-xs opacity-75">Semana</p>
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">
              {dashboardData?.fruta_ingresada_kg.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || 0} Kg
            </p>
            <p className="text-xs opacity-75 mt-2">Recepcionados en báscula</p>
          </div>

          {/* 2. Fruta Proceso (VERDE) */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-check-circle text-4xl opacity-80"></i>
              <div className="flex-1">
                <p className="text-xs font-medium opacity-90 uppercase tracking-wide">Fruta Proceso</p>
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">
              {dashboardData?.fruta_proceso_kg.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || 0} Kg
            </p>
            <p className="text-lg font-semibold mt-2">
              ${dashboardData?.fruta_proceso_monto.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || 0} MXN
            </p>
          </div>

          {/* 3. Fruta Desecho (MORADO) */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-trash text-4xl opacity-80"></i>
              <div className="flex-1">
                <p className="text-xs font-medium opacity-90 uppercase tracking-wide">Fruta Desecho</p>
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">
              {dashboardData?.fruta_desecho_kg.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || 0} Kg
            </p>
            <p className="text-lg font-semibold mt-2">
              ${dashboardData?.fruta_desecho_monto.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || 0} MXN
            </p>
          </div>

          {/* 4. Rendimiento Proceso (VERDE OSCURO) */}
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-chart-line-up text-4xl opacity-80"></i>
              <div className="flex-1">
                <p className="text-xs font-medium opacity-90 uppercase tracking-wide">Rendimiento</p>
                <p className="text-xs opacity-75">Proceso</p>
              </div>
            </div>
            <p className="text-5xl font-bold mb-1">
              {dashboardData?.rendimiento_proceso.toFixed(2) || 0}%
            </p>
            <p className="text-xs opacity-75 mt-2">Del total ingresado</p>
          </div>

          {/* 5. Rendimiento Desecho (NARANJA) */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-chart-line-down text-4xl opacity-80"></i>
              <div className="flex-1">
                <p className="text-xs font-medium opacity-90 uppercase tracking-wide">Rendimiento</p>
                <p className="text-xs opacity-75">Desecho</p>
              </div>
            </div>
            <p className="text-5xl font-bold mb-1">
              {dashboardData?.rendimiento_desecho.toFixed(2) || 0}%
            </p>
            <p className="text-xs opacity-75 mt-2">Del total ingresado</p>
          </div>
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Breakdown Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Desglose de la Semana</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Kg Recepcionados</span>
                <span className="text-lg font-bold text-blue-600">
                  {dashboardData?.fruta_ingresada_kg.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || 0} kg
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Kg Clasificados como Proceso</span>
                <span className="text-lg font-bold text-green-600">
                  {dashboardData?.fruta_proceso_kg.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || 0} kg
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Kg Clasificados como Desecho</span>
                <span className="text-lg font-bold text-purple-600">
                  {dashboardData?.fruta_desecho_kg.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || 0} kg
                </span>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Resumen Financiero</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-sm font-medium text-slate-700">Venta de Proceso</span>
                <span className="text-lg font-bold text-emerald-600">
                  ${dashboardData?.fruta_proceso_monto.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-sm font-medium text-slate-700">Venta de Desecho</span>
                <span className="text-lg font-bold text-purple-600">
                  ${dashboardData?.fruta_desecho_monto.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border-2 border-emerald-300">
                <span className="text-sm font-semibold text-slate-800">Ingreso Total (Proc + Desecho)</span>
                <span className="text-xl font-bold text-emerald-700">
                  ${((dashboardData?.fruta_proceso_monto || 0) + (dashboardData?.fruta_desecho_monto || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <i className="ph-info text-blue-600 text-2xl"></i>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Información</h4>
              <p className="text-sm text-blue-700">
                Este dashboard muestra exclusivamente información analítica y financiera de la fruta procesada durante la semana seleccionada.
                Los datos se calculan automáticamente desde los módulos de Recepción, Producción y Lotificaciones.
                No se registran ventas ni cobros desde este módulo.
              </p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 shadow-2xl flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
              <span className="font-medium text-slate-700">Cargando datos...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
