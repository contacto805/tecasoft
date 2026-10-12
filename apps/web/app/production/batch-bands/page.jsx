'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Filter, Search, Calendar } from 'lucide-react';

export default function BatchBandsPage() {
  const [bands, setBands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    producer: '',
    broker: '',
    lotNumber: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchBands();
  }, []);

  const fetchBands = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/batch-bands');
      const data = await res.json();
      setBands(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error:', error);
      setBands([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.producer) params.append('producer', filters.producer);
    if (filters.broker) params.append('broker', filters.broker);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    fetch(`/api/batch-bands?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        let filtered = Array.isArray(data) ? data : [];
        if (filters.lotNumber) {
          filtered = filtered.filter(b => b.lot_number.toLowerCase().includes(filters.lotNumber.toLowerCase()));
        }
        setBands(filtered);
      })
      .catch(error => {
        console.error('Error:', error);
        setBands([]);
      })
      .finally(() => setLoading(false));
  };

  const clearFilters = () => {
    setFilters({
      producer: '',
      broker: '',
      lotNumber: '',
      startDate: '',
      endDate: ''
    });
    fetchBands();
  };

  const generatePDFReport = async (band) => {
    const reportWindow = window.open('', '_blank');
    
    reportWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte Banda de Lote - ${band.lot_number}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          
          body {
            font-family: 'Inter', Arial, sans-serif;
            margin: 0;
            padding: 30px;
            background: #fff;
            color: #1e293b;
          }
          .header {
            text-align: center;
            padding: 30px 20px;
            border-bottom: 4px solid #7c3aed;
            margin-bottom: 40px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          }
          .header h1 {
            margin: 0;
            color: #7c3aed;
            font-size: 32px;
            font-weight: 700;
          }
          .header p {
            margin: 8px 0 0 0;
            color: #64748b;
            font-size: 14px;
          }
          .section {
            background: #f8fafc;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
            border-left: 5px solid #7c3aed;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .section h2 {
            margin: 0 0 20px 0;
            color: #7c3aed;
            font-size: 20px;
            font-weight: 700;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
          .info-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }
          .info-label {
            font-size: 12px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .info-value {
            font-size: 18px;
            color: #1e293b;
            font-weight: 700;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 20px;
          }
          .metric-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            border: 2px solid #e2e8f0;
          }
          .metric-label {
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .metric-value {
            font-size: 28px;
            font-weight: 700;
            color: #7c3aed;
          }
          .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 30px;
            border-top: 2px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
          }
          .notes {
            background: #fef3c7;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
            margin-top: 20px;
          }
          .notes strong {
            color: #92400e;
          }
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏭 TECAVO FRUITS</h1>
          <p>RFC: TFR230302EU5 | Sistema de Gestión de Producción</p>
          <h2 style="margin-top: 15px; color: #7c3aed; font-size: 24px;">📊 Reporte de Banda de Lote</h2>
        </div>

        <div class="section">
          <h2>📦 Información del Lote</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Número de Lote</div>
              <div class="info-value">${band.lot_number}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Fecha del Lote</div>
              <div class="info-value">${new Date(band.lot_date).toLocaleDateString('es-MX')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Productor</div>
              <div class="info-value">${band.producer_name}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Corredor</div>
              <div class="info-value">${band.broker_name || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>🎯 Detalles de Producción</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Calibre</div>
              <div class="info-value">${band.caliber || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Clase</div>
              <div class="info-value">${band.class_name || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Precio de Banda</div>
              <div class="info-value">$${band.band_price ? parseFloat(band.band_price).toFixed(2) : '0.00'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Total KG</div>
              <div class="info-value">${band.total_kg ? parseFloat(band.total_kg).toFixed(2) : '0.00'} kg</div>
            </div>
          </div>

          <div class="metrics">
            <div class="metric-card">
              <div class="metric-label">Palets Completos</div>
              <div class="metric-value">${band.pallets_complete || 0}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Cajas 96 (10kg)</div>
              <div class="metric-value">${band.boxes_96 || 0}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Cajas 156 (6kg)</div>
              <div class="metric-value">${band.boxes_156 || 0}</div>
            </div>
          </div>
        </div>

        ${band.notes ? `
        <div class="notes">
          <strong>📝 Notas:</strong> ${band.notes}
        </div>
        ` : ''}

        <div class="footer">
          <p><strong>Tecavo Fruits</strong> - RFC: TFR230302EU5</p>
          <p>Reporte generado el ${new Date().toLocaleDateString('es-MX', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 40px;">
          <button onclick="window.print()" style="background: #7c3aed; color: white; padding: 14px 28px; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; margin-right: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
            🖨️ Imprimir / Guardar PDF
          </button>
          <button onclick="window.close()" style="background: #64748b; color: white; padding: 14px 28px; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; font-weight: 600;">
            ✕ Cerrar
          </button>
        </div>
      </body>
      </html>
    `);
    reportWindow.document.close();
  };

  const generateExcelReport = (band) => {
    const csvContent = `Reporte de Banda de Lote - ${band.lot_number}
Fecha de Generación:,${new Date().toLocaleDateString('es-MX')}

Información del Lote
Número de Lote:,${band.lot_number}
Fecha del Lote:,${new Date(band.lot_date).toLocaleDateString('es-MX')}
Productor:,${band.producer_name}
Corredor:,${band.broker_name || 'N/A'}

Detalles de Producción
Calibre:,${band.caliber || 'N/A'}
Clase:,${band.class_name || 'N/A'}
Precio de Banda:,$${band.band_price ? parseFloat(band.band_price).toFixed(2) : '0.00'}
Total KG:,${band.total_kg ? parseFloat(band.total_kg).toFixed(2) : '0.00'} kg

Métricas de Producción
Palets Completos:,${band.pallets_complete || 0}
Cajas 96 (10kg):,${band.boxes_96 || 0}
Cajas 156 (6kg):,${band.boxes_156 || 0}

Notas:,${band.notes || 'N/A'}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `banda_lote_${band.lot_number}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredBands = bands;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => window.location.href = '/production'}
            className="mb-4 text-purple-600 hover:text-purple-800 font-medium flex items-center gap-2"
          >
            ← Volver a Producción
          </button>
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-10 h-10 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-900">📊 BANDA DE LOTE</h1>
          </div>
          <p className="text-gray-600 text-lg">Reportes de producción por lote, productor, corredor y fecha</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-purple-100">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-purple-700 font-semibold text-lg hover:text-purple-900 mb-4"
          >
            <Filter className="w-5 h-5" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>

          {showFilters && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Productor
                  </label>
                  <input
                    type="text"
                    value={filters.producer}
                    onChange={(e) => setFilters({...filters, producer: e.target.value})}
                    placeholder="Buscar por productor"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Corredor
                  </label>
                  <input
                    type="text"
                    value={filters.broker}
                    onChange={(e) => setFilters({...filters, broker: e.target.value})}
                    placeholder="Buscar por corredor"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número de Lote
                  </label>
                  <input
                    type="text"
                    value={filters.lotNumber}
                    onChange={(e) => setFilters({...filters, lotNumber: e.target.value})}
                    placeholder="Buscar por lote"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={applyFilters}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium"
                >
                  <Search className="w-4 h-4" />
                  Aplicar Filtros
                </button>
                <button
                  onClick={clearFilters}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista de Bandas */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-purple-100">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6">
            <h2 className="text-2xl font-bold text-white">
              Registros de Banda de Lote ({filteredBands.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Cargando registros...</p>
            </div>
          ) : filteredBands.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No hay registros disponibles</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredBands.map((band) => (
                <div key={band.id} className="p-6 hover:bg-purple-50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold text-purple-900">{band.lot_number}</h3>
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                          {band.class_name || 'N/A'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 font-medium">Fecha</p>
                          <p className="text-gray-900 font-semibold">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            {new Date(band.lot_date).toLocaleDateString('es-MX')}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium">Productor</p>
                          <p className="text-gray-900 font-semibold">{band.producer_name}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium">Corredor</p>
                          <p className="text-gray-900 font-semibold">{band.broker_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium">Calibre</p>
                          <p className="text-gray-900 font-semibold">{band.caliber || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex gap-6 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Palets:</span>
                          <span className="font-bold text-purple-700">{band.pallets_complete || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Cajas 96:</span>
                          <span className="font-bold text-purple-700">{band.boxes_96 || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Cajas 156:</span>
                          <span className="font-bold text-purple-700">{band.boxes_156 || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Total:</span>
                          <span className="font-bold text-purple-700">{band.total_kg ? parseFloat(band.total_kg).toFixed(2) : '0.00'} kg</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => generatePDFReport(band)}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg"
                      >
                        <Download className="w-5 h-5" />
                        PDF
                      </button>
                      <button
                        onClick={() => generateExcelReport(band)}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg"
                      >
                        <Download className="w-5 h-5" />
                        Excel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
