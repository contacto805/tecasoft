'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function LotTraceabilityPage() {
  const router = useRouter();
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [traceabilityData, setTraceabilityData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('lot_number');

  useEffect(() => {
    fetchLots();
  }, []);

  const fetchLots = async () => {
    try {
      const response = await fetch('/api/lots');
      const data = await response.json();
      setLots(data);
    } catch (error) {
      console.error('Error fetching lots:', error);
    }
  };

  const fetchTraceability = async (lotId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lot-traceability?lot_id=${lotId}`);
      const data = await response.json();
      setTraceabilityData(data);
    } catch (error) {
      console.error('Error fetching traceability:', error);
      alert('Error al obtener la trazabilidad del lote');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLot = (lot) => {
    setSelectedLot(lot);
    fetchTraceability(lot.id);
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      alert('Por favor ingresa un término de búsqueda');
      return;
    }

    const foundLot = lots.find(lot => {
      if (searchType === 'lot_number') {
        return lot.lot_number?.toLowerCase().includes(searchTerm.toLowerCase());
      } else if (searchType === 'producer') {
        return lot.producer?.toLowerCase().includes(searchTerm.toLowerCase());
      } else if (searchType === 'orchard') {
        return lot.orchard_name?.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return false;
    });

    if (foundLot) {
      handleSelectLot(foundLot);
    } else {
      alert('No se encontró ningún lote con ese criterio');
    }
  };

  const downloadReport = (format) => {
    if (!selectedLot) return;
    
    const url = `/api/lot-traceability/report?lot_id=${selectedLot.id}&format=${format}`;
    window.open(url, '_blank');
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
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Trazabilidad del Lote</h1>
            <p className="text-slate-500 mt-1">Consulta el historial completo de cualquier lote desde el corte hasta la venta</p>
          </section>

          {/* Búsqueda */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <h2 className="font-bold text-lg text-slate-900 mb-4">Buscar Lote</h2>
            <div className="flex gap-3">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              >
                <option value="lot_number">Número de Lote</option>
                <option value="producer">Productor</option>
                <option value="orchard">Huerta</option>
              </select>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={`Buscar por ${searchType === 'lot_number' ? 'número de lote' : searchType === 'producer' ? 'productor' : 'huerta'}...`}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              />
              <button
                onClick={handleSearch}
                className="px-6 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 flex items-center gap-2"
              >
                <i className="ph ph-magnifying-glass"></i>
                Buscar
              </button>
            </div>
          </div>

          {/* Lista de lotes recientes */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <h2 className="font-bold text-lg text-slate-900 mb-4">Lotes Recientes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {lots.slice(0, 9).map((lot) => (
                <button
                  key={lot.id}
                  onClick={() => handleSelectLot(lot)}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:border-brand-500 ${
                    selectedLot?.id === lot.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                  }`}
                >
                  <div className="font-bold text-slate-900">{lot.lot_number}</div>
                  <div className="text-sm text-slate-600 mt-1">{lot.producer}</div>
                  <div className="text-sm text-slate-600">{lot.orchard_name}</div>
                  <div className="text-xs text-slate-500 mt-2">
                    {new Date(lot.date).toLocaleDateString('es-MX')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Datos de trazabilidad */}
          {loading && (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-brand-600"></div>
              <p className="mt-4 text-slate-600">Cargando trazabilidad...</p>
            </div>
          )}

          {!loading && traceabilityData && selectedLot && (
            <div className="space-y-6">
              {/* Header con info del lote y botones de descarga */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-slate-900">{selectedLot.lot_number}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-slate-500">Productor</p>
                        <p className="font-medium text-slate-900">{selectedLot.producer}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Huerta</p>
                        <p className="font-medium text-slate-900">{selectedLot.orchard_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Fecha de Corte</p>
                        <p className="font-medium text-slate-900">
                          {new Date(selectedLot.date).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Estado</p>
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {selectedLot.status || 'Activo'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-6">
                    <QRCodeSVG value={`LOT-${selectedLot.lot_number}`} size={100} />
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
                  <button
                    onClick={() => downloadReport('pdf')}
                    className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <i className="ph-fill ph-file-pdf"></i>
                    Descargar PDF
                  </button>
                  <button
                    onClick={() => downloadReport('excel')}
                    className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <i className="ph-fill ph-file-xls"></i>
                    Descargar Excel
                  </button>
                  <button
                    onClick={() => downloadReport('jpg')}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <i className="ph-fill ph-image"></i>
                    Descargar JPG
                  </button>
                </div>
              </div>

              {/* Ingreso */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-truck text-green-600"></i>
                  Ingreso
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Kilos Ingresados</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Number(traceabilityData.ingreso?.total_kg || 0).toLocaleString('es-MX')} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Cajas de Campo Llenas</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {traceabilityData.ingreso?.full_boxes || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Cajas de Campo Vacías</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {traceabilityData.ingreso?.empty_boxes || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Producción */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-package text-blue-600"></i>
                  Producción (Empacado)
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Total Empacado</p>
                      <p className="text-xl font-bold text-slate-900">
                        {Number(traceabilityData.produccion?.total_kg || 0).toLocaleString('es-MX')} kg
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Proceso</p>
                      <p className="text-xl font-bold text-orange-600">
                        {Number(traceabilityData.produccion?.proceso_kg || 0).toLocaleString('es-MX')} kg
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Desecho</p>
                      <p className="text-xl font-bold text-red-600">
                        {Number(traceabilityData.produccion?.desecho_kg || 0).toLocaleString('es-MX')} kg
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Rendimiento</p>
                      <p className="text-xl font-bold text-green-600">
                        {((traceabilityData.produccion?.total_kg / traceabilityData.ingreso?.total_kg) * 100 || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {traceabilityData.produccion?.by_caliber && traceabilityData.produccion.by_caliber.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-700 mb-2">Desglose por Calibre</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {traceabilityData.produccion.by_caliber.map((item, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-sm font-medium text-slate-700">{item.caliber} - {item.class_name}</p>
                            <p className="text-lg font-bold text-slate-900">{Number(item.total_kg || 0).toLocaleString('es-MX')} kg</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Inventario Actual */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-warehouse text-purple-600"></i>
                  Inventario Actual
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Empacado Disponible</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Number(traceabilityData.inventario?.empacado_kg || 0).toLocaleString('es-MX')} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Proceso Disponible</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {Number(traceabilityData.inventario?.proceso_kg || 0).toLocaleString('es-MX')} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Desecho Disponible</p>
                    <p className="text-2xl font-bold text-red-600">
                      {Number(traceabilityData.inventario?.desecho_kg || 0).toLocaleString('es-MX')} kg
                    </p>
                  </div>
                </div>
              </div>

              {/* Ventas */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-currency-dollar text-green-600"></i>
                  Ventas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-slate-500">Empacado Vendido</p>
                    <p className="text-xl font-bold text-slate-900">
                      {Number(traceabilityData.ventas?.empacado_kg || 0).toLocaleString('es-MX')} kg
                    </p>
                    <p className="text-sm text-green-600 font-medium">
                      ${Number(traceabilityData.ventas?.empacado_monto || 0).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Proceso Vendido</p>
                    <p className="text-xl font-bold text-orange-600">
                      {Number(traceabilityData.ventas?.proceso_kg || 0).toLocaleString('es-MX')} kg
                    </p>
                    <p className="text-sm text-green-600 font-medium">
                      ${Number(traceabilityData.ventas?.proceso_monto || 0).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Desecho Vendido</p>
                    <p className="text-xl font-bold text-red-600">
                      {Number(traceabilityData.ventas?.desecho_kg || 0).toLocaleString('es-MX')} kg
                    </p>
                    <p className="text-sm text-green-600 font-medium">
                      ${Number(traceabilityData.ventas?.desecho_monto || 0).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Vendido</p>
                    <p className="text-xl font-bold text-green-600">
                      {Number((traceabilityData.ventas?.empacado_kg || 0) + (traceabilityData.ventas?.proceso_kg || 0) + (traceabilityData.ventas?.desecho_kg || 0)).toLocaleString('es-MX')} kg
                    </p>
                    <p className="text-sm text-green-600 font-medium">
                      ${Number((traceabilityData.ventas?.empacado_monto || 0) + (traceabilityData.ventas?.proceso_monto || 0) + (traceabilityData.ventas?.desecho_monto || 0)).toLocaleString('es-MX')}
                    </p>
                  </div>
                </div>

                {traceabilityData.ventas?.cargas && traceabilityData.ventas.cargas.length > 0 && (
                  <div>
                    <p className="font-medium text-slate-700 mb-2">Cargas Realizadas ({traceabilityData.ventas.cargas.length})</p>
                    <div className="space-y-2">
                      {traceabilityData.ventas.cargas.map((carga, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                          <div>
                            <p className="font-medium text-slate-900">{carga.customer_name}</p>
                            <p className="text-sm text-slate-600">{new Date(carga.load_date).toLocaleDateString('es-MX')}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900">{Number(carga.total_kg || 0).toLocaleString('es-MX')} kg</p>
                            <p className="text-sm text-green-600">${Number(carga.total_amount || 0).toLocaleString('es-MX')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Resumen */}
              <div className="bg-gradient-to-br from-brand-50 to-purple-50 p-6 rounded-2xl border-2 border-brand-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-chart-bar text-brand-600"></i>
                  Resumen
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Kilos Cortados</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Number(traceabilityData.resumen?.kg_cortados || 0).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Kilos Ingresados</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Number(traceabilityData.resumen?.kg_ingresados || 0).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Kilos Empacados</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Number(traceabilityData.resumen?.kg_empacados || 0).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Kilos Disponibles</p>
                    <p className="text-2xl font-bold text-green-600">
                      {Number(traceabilityData.resumen?.kg_disponibles || 0).toLocaleString('es-MX')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && !traceabilityData && (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
              <i className="ph ph-magnifying-glass text-6xl text-slate-300 mb-4 block"></i>
              <p className="text-slate-500">Selecciona un lote para ver su trazabilidad completa</p>
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
