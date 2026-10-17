'use client';

import { useState, useEffect } from 'react';

export default function WeeklySummaryReport() {
  const [reports, setReports] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoGenEnabled, setAutoGenEnabled] = useState(true);

  useEffect(() => {
    fetchReports();
    
    // Auto-generate weekly report every Thursday at 17:00 (V3 - after linking Corte/Cuadrillas/Fletes/Nómina/Comisiones/Admin)
    if (autoGenEnabled) {
      checkAndGenerateWeeklyReport();
      const interval = setInterval(checkAndGenerateWeeklyReport, 3600000); // Check every hour
      return () => clearInterval(interval);
    }
  }, [autoGenEnabled]);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports/weekly-summary?limit=10');
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const checkAndGenerateWeeklyReport = async () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 4 = Thursday
    const hour = now.getHours();

    // V3 Thursday 17:00
    if (dayOfWeek === 4 && hour === 17) {
      await generateWeeklyReport();
    }
  };

  const generateWeeklyReport = async () => {
    setIsGenerating(true);
    try {
      // Calculate last week's date range
      const today = new Date();
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - today.getDay() - 6);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);

      const response = await fetch('/api/reports/weekly-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start_date: lastMonday.toISOString().split('T')[0],
          week_end_date: lastSunday.toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        alert('Reporte semanal generado exitosamente');
        fetchReports();
      }
    } catch (error) {
      console.error('Error generating weekly report:', error);
      alert('Error al generar el reporte semanal');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatMetrics = (metrics) => {
    if (!metrics) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-slate-50 rounded-lg">
        <div>
          <div className="text-xs text-slate-500">Lotes</div>
          <div className="font-bold text-slate-900">{metrics.lots?.count || 0}</div>
          <div className="text-xs text-slate-600">{metrics.lots?.total_kg?.toFixed(2) || 0} kg</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Órdenes de Corte</div>
          <div className="font-bold text-slate-900">{metrics.cutting_orders?.count || 0}</div>
          <div className="text-xs text-slate-600">{metrics.cutting_orders?.total_kg?.toFixed(2) || 0} kg</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Cargas</div>
          <div className="font-bold text-slate-900">{metrics.loads?.count || 0}</div>
          <div className="text-xs text-slate-600">${metrics.loads?.revenue?.toFixed(2) || 0}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Costos Operativos</div>
          <div className="font-bold text-slate-900">${metrics.operating_costs?.total?.toFixed(2) || 0}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Control de Cajas</div>
          <div className="font-bold text-slate-900">{metrics.box_control?.boxes_out || 0} salidas</div>
          <div className="text-xs text-slate-600">{metrics.box_control?.missing || 0} faltantes</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Ventas Proceso/Desecho</div>
          <div className="font-bold text-slate-900">{metrics.sales_process_waste?.count || 0}</div>
          <div className="text-xs text-slate-600">${metrics.sales_process_waste?.revenue?.toFixed(2) || 0}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Órdenes de Compra</div>
          <div className="font-bold text-slate-900">{metrics.purchase_orders?.count || 0}</div>
          <div className="text-xs text-slate-600">${metrics.purchase_orders?.total?.toFixed(2) || 0}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Pagos Pendientes</div>
          <div className="font-bold text-slate-900">{metrics.pending_payments?.count || 0}</div>
          <div className="text-xs text-slate-600">${metrics.pending_payments?.total?.toFixed(2) || 0}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Reportes Semanales Automáticos</h3>
          <p className="text-sm text-slate-500 mt-1">Se generan automáticamente cada jueves 17:00 (V3 - pagos productores + gastos operativos semanales)</p>
        </div>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoGenEnabled}
              onChange={(e) => setAutoGenEnabled(e.target.checked)}
              className="w-4 h-4 text-[#024D32] border-slate-300 rounded focus:ring-[#024D32]"
            />
            <span className="text-slate-600">Auto-generar</span>
          </label>
          <button
            onClick={generateWeeklyReport}
            disabled={isGenerating}
            className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-all inline-flex items-center gap-2 ${
              isGenerating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#E8D547] text-slate-900 hover:bg-[#ddc635] shadow-sm hover:shadow-md'
            }`}
          >
            <i className={`ph ${isGenerating ? 'ph-spinner ph-spin' : 'ph-file-text'}`}></i>
            {isGenerating ? 'Generando...' : 'Generar Ahora'}
          </button>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <i className="ph ph-file-text text-4xl mb-2"></i>
          <p>No hay reportes semanales generados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold text-slate-900">
                    Semana {report.week_number} - {report.week_year}
                  </div>
                  <div className="text-sm text-slate-500">
                    {new Date(report.week_start_date).toLocaleDateString('es-MX')} - {new Date(report.week_end_date).toLocaleDateString('es-MX')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    report.auto_generated 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {report.auto_generated ? 'Auto-generado' : 'Manual'}
                  </span>
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                    {report.status}
                  </span>
                </div>
              </div>
              {formatMetrics(report.metrics_summary)}
              <div className="text-xs text-slate-400 mt-3">
                Generado: {new Date(report.generated_at).toLocaleString('es-MX')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
