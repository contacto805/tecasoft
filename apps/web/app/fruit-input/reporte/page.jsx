'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

function getWeekBounds(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

function ReportContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [availableProducers, setAvailableProducers] = useState([]);
  const [availableBrokers, setAvailableBrokers] = useState([]);
  
  const [filters, setFilters] = useState({
    startDate: getWeekBounds(0).start,
    endDate: getWeekBounds(0).end,
    producer: 'all',
    broker: 'all',
    weekNumber: ''
  });

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      
      if (filters.producer && filters.producer !== 'all') {
        params.append('producer', filters.producer);
      }
      
      if (filters.broker && filters.broker !== 'all') {
        params.append('brokerId', filters.broker);
      }
      
      const res = await fetch(`/api/fruit-input/weekly-report?${params}`);
      
      if (!res.ok) {
        throw new Error('Error al cargar el reporte');
      }
      
      const data = await res.json();
      setReportData(data);
      
      if (data.filters) {
        setAvailableProducers(data.filters.producers || []);
        setAvailableBrokers(data.filters.brokers || []);
      }
    } catch (error) {
      console.error('Error loading report:', error);
      alert('Error al cargar el reporte. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyWeekFilter = (weekOffset) => {
    const week = getWeekBounds(weekOffset);
    setFilters(prev => ({
      ...prev,
      startDate: week.start,
      endDate: week.end,
      weekNumber: getWeekNumber(week.start).toString()
    }));
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte Semanal de Ingresos - ${filters.startDate} a ${filters.endDate}</title>
        <style>
          @page { size: letter landscape; margin: 15mm; }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
            font-size: 10pt;
          }
          .header { 
            text-align: center; 
            margin-bottom: 10mm;
            border-bottom: 2px solid #000;
            padding-bottom: 5mm;
          }
          .company-name {
            font-size: 18pt;
            font-weight: bold;
            color: #059669;
          }
          .report-title {
            font-size: 14pt;
            font-weight: bold;
            margin-top: 2mm;
          }
          .date-range {
            font-size: 11pt;
            margin-top: 2mm;
            color: #555;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 5mm 0;
          }
          th, td {
            border: 1px solid #333;
            padding: 3mm 2mm;
            text-align: left;
          }
          th {
            background: #e5e7eb;
            font-weight: bold;
            font-size: 9pt;
          }
          td {
            font-size: 9pt;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .totals {
            margin-top: 8mm;
            padding: 5mm;
            background: #f3f4f6;
            border: 2px solid #059669;
            border-radius: 3mm;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            margin: 2mm 0;
            font-size: 11pt;
          }
          .totals-label {
            font-weight: bold;
          }
          .grand-total {
            font-size: 14pt;
            color: #059669;
            padding-top: 3mm;
            margin-top: 3mm;
            border-top: 2px solid #059669;
          }
          .footer {
            margin-top: 10mm;
            text-align: center;
            font-size: 8pt;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div className="header">
          <div className="company-name">TECAVO FRUITS</div>
          <div style="font-size: 11pt; margin-top: 2mm; color: #555;">RFC: TFR230302EU5</div>
          <div className="report-title">Reporte Semanal de Ingresos de Fruta</div>
          <div className="date-range">${new Date(filters.startDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} - ${new Date(filters.endDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-center">Fecha</th>
              <th>Lote</th>
              <th>Huerta</th>
              <th>Productor</th>
              <th>Corredor</th>
              <th class="text-right">Cajas</th>
              <th class="text-right">Kilos</th>
              <th class="text-right">Precio/kg</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${reportData?.lots.map((lot) => `
              <tr>
                <td class="text-center">${new Date(lot.date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                <td><strong>${lot.lot_number}</strong></td>
                <td>${lot.orchard_name || '-'}</td>
                <td>${lot.producer || '-'}</td>
                <td>${lot.collector_name || '-'}</td>
                <td class="text-right">${parseFloat(lot.total_boxes || 0).toFixed(0)}</td>
                <td class="text-right">${parseFloat(lot.total_kg || 0).toFixed(2)} kg</td>
                <td class="text-right">$${parseFloat(lot.fruit_price || 0).toFixed(2)}</td>
                <td class="text-right"><strong>$${parseFloat(lot.total_value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span class="totals-label">Total de Lotes:</span>
            <span><strong>${reportData?.totals.totalLots || 0}</strong></span>
          </div>
          <div class="totals-row">
            <span class="totals-label">Total de Cajas:</span>
            <span><strong>${reportData?.totals.totalBoxes.toFixed(0) || 0}</strong></span>
          </div>
          <div class="totals-row">
            <span class="totals-label">Total de Kilogramos:</span>
            <span><strong>${reportData?.totals.totalKg.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} kg</strong></span>
          </div>
          <div class="totals-row grand-total">
            <span class="totals-label">VALOR TOTAL:</span>
            <span>$${reportData?.totals.totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
          </div>
        </div>

        <div class="footer">
          <p>Reporte generado el ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} a las ${new Date().toLocaleTimeString('es-MX')}</p>
          <p>Tecavo Fruits - RFC: TFR230302EU5 - Sistema de Gestión Agroindustrial</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-green-50 via-white to-blue-50">
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button
              onClick={() => router.push('/fruit-input')}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <i className="ph ph-arrow-left text-lg"></i>
            </button>
            <div className="flex items-center gap-2 text-green-700">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center border border-green-500/20">
                <i className="ph-fill ph-chart-bar text-green-600"></i>
              </div>
              <span className="font-bold text-lg tracking-tight">Reporte Semanal</span>
            </div>
          </div>
          
          <button
            onClick={printReport}
            disabled={!reportData || loading}
            className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ph ph-printer text-lg"></i>
            Imprimir Reporte
          </button>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reporte Semanal de Ingresos</h1>
            <p className="text-slate-500 mt-1">Consulta y filtra los ingresos de fruta por semana</p>
          </section>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
              <i className="ph-fill ph-funnel text-green-600"></i>
              Filtros de Búsqueda
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Fecha Inicio</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Fecha Fin</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Productor</label>
                <select
                  value={filters.producer}
                  onChange={(e) => handleFilterChange('producer', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                >
                  <option value="all">Todos los productores</option>
                  {availableProducers.map((producer) => (
                    <option key={producer} value={producer}>{producer}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Corredor</label>
                <select
                  value={filters.broker}
                  onChange={(e) => handleFilterChange('broker', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                >
                  <option value="all">Todos los corredores</option>
                  {availableBrokers.map((broker) => (
                    <option key={broker} value={broker}>{broker}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Número de Semana</label>
                <input
                  type="text"
                  value={filters.weekNumber}
                  onChange={(e) => handleFilterChange('weekNumber', e.target.value)}
                  placeholder="Ej. 23"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => applyWeekFilter(0)}
                className="px-4 py-2 bg-green-100 text-green-700 font-medium rounded-lg hover:bg-green-200 transition-colors text-sm"
              >
                Semana Actual
              </button>
              <button
                onClick={() => applyWeekFilter(-1)}
                className="px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 transition-colors text-sm"
              >
                Semana Pasada
              </button>
              <button
                onClick={() => applyWeekFilter(-2)}
                className="px-4 py-2 bg-purple-100 text-purple-700 font-medium rounded-lg hover:bg-purple-200 transition-colors text-sm"
              >
                Hace 2 Semanas
              </button>
              <button
                onClick={loadReport}
                disabled={loading}
                className="px-5 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Cargando...
                  </>
                ) : (
                  <>
                    <i className="ph ph-magnifying-glass"></i>
                    Buscar
                  </>
                )}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
              <p className="text-slate-500 mt-4">Cargando reporte...</p>
            </div>
          ) : reportData ? (
            <>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Lote</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Huerta</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Productor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Corredor</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Cajas</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Kilos</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Precio/kg</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.lots.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="px-4 py-8 text-center text-slate-500">
                            No hay datos para el rango de fechas seleccionado
                          </td>
                        </tr>
                      ) : (
                        reportData.lots.map((lot, index) => (
                          <tr key={lot.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-slate-600 text-center whitespace-nowrap">
                              {new Date(lot.date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{lot.lot_number}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{lot.orchard_name || '-'}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{lot.producer || '-'}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{lot.collector_name || '-'}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right font-medium">{parseFloat(lot.total_boxes || 0).toFixed(0)}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 text-right font-medium">{parseFloat(lot.total_kg || 0).toFixed(2)} kg</td>
                            <td className="px-4 py-3 text-sm text-slate-600 text-right">${parseFloat(lot.fruit_price || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-green-700 text-right font-bold">
                              ${parseFloat(lot.total_value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-300 shadow-lg p-6">
                <h3 className="font-bold text-lg text-green-800 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-chart-line-up text-green-600"></i>
                  Resumen Total
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl p-4 border border-green-200">
                    <div className="text-sm text-slate-600 mb-1">Total de Lotes</div>
                    <div className="text-3xl font-bold text-slate-900">{reportData.totals.totalLots}</div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-4 border border-green-200">
                    <div className="text-sm text-slate-600 mb-1">Total de Cajas</div>
                    <div className="text-3xl font-bold text-slate-900">{reportData.totals.totalBoxes.toFixed(0)}</div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-4 border border-green-200">
                    <div className="text-sm text-slate-600 mb-1">Total de Kilos</div>
                    <div className="text-3xl font-bold text-green-700">
                      {reportData.totals.totalKg.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-4 border border-green-200">
                    <div className="text-sm text-slate-600 mb-1">Valor Total</div>
                    <div className="text-3xl font-bold text-green-700">
                      ${reportData.totals.totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
