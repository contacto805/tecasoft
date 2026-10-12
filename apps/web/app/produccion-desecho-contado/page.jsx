'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ProduccionDesechoContadoPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPeriod, setSelectedPeriod] = useState('hoy');
  const [selectedLot, setSelectedLot] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterProducer, setFilterProducer] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBroker, setFilterBroker] = useState('');
  
  const [dashboardData, setDashboardData] = useState(null);
  const [traceabilityData, setTraceabilityData] = useState(null);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);

  const [kgLabels, setKgLabels] = useState({proceso:'Proceso', desecho:'Desecho', procesados:'Procesados', produccion:'Producción'});
  const [showEditConcepts, setShowEditConcepts] = useState(false);
  const [editValues, setEditValues] = useState({proceso:'', desecho:'', procesados:'', produccion:''});

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      let start = startDate;
      let end = endDate;
      
      if (selectedPeriod === 'hoy') {
        start = end = format(new Date(), 'yyyy-MM-dd');
      } else if (selectedPeriod === 'semana') {
        start = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else if (selectedPeriod === 'mes') {
        start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        end = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      } else if (selectedPeriod === 'anio') {
        start = format(startOfYear(new Date()), 'yyyy-MM-dd');
        end = format(endOfYear(new Date()), 'yyyy-MM-dd');
      }

      const res = await fetch(`/api/contado-dashboard?startDate=${start}&endDate=${end}&producer=${filterProducer}&customer=${filterCustomer}&broker=${filterBroker}`);
      const data = await res.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch lots for dropdown
  const fetchLots = async () => {
    try {
      const res = await fetch('/api/lots');
      const data = await res.json();
      setLots(data);
    } catch (error) {
      console.error('Error fetching lots:', error);
    }
  };

  // Fetch kg concept labels
  const fetchKgLabels = async () => {
    try {
      const res = await fetch('/api/kg-concept-labels');
      const data = await res.json();
      const map = data.map || {};
      setKgLabels({
        proceso: map.proceso || 'Proceso',
        desecho: map.desecho || 'Desecho',
        procesados: map.procesados || 'Procesados',
        produccion: map.produccion || 'Producción'
      });
    } catch (e) {}
  };

  const saveKgLabel = async (key, name) => {
    try {
      await fetch('/api/kg-concept-labels', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ concept_key: key, display_name: name })
      });
      await fetchKgLabels();
    } catch(e) { alert('Error al guardar'); }
  };

  const openEditConcepts = () => {
    setEditValues({
      proceso: kgLabels.proceso,
      desecho: kgLabels.desecho,
      procesados: kgLabels.procesados,
      produccion: kgLabels.produccion
    });
    setShowEditConcepts(true);
  };

  // Fetch traceability for a specific lot
  const fetchTraceability = async (lotId) => {
    if (!lotId) {
      setTraceabilityData(null);
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/lot-traceability?lot_id=${lotId}`);
      const data = await res.json();
      setTraceabilityData(data);
    } catch (error) {
      console.error('Error fetching traceability:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
    fetchDashboardData();
    fetchKgLabels();
  }, [selectedPeriod, startDate, endDate, filterProducer, filterCustomer, filterBroker]);

  useEffect(() => {
    if (selectedLot) {
      fetchTraceability(selectedLot);
    }
  }, [selectedLot]);

  const L = kgLabels; // short

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-bold text-slate-800">Producción y Desecho</h1>
            <button onClick={openEditConcepts} className="text-xs px-3 py-1 bg-white border border-slate-300 hover:bg-neutral-50 text-slate-700 rounded-lg flex items-center gap-1">
              <i className="ph ph-pencil-simple"></i> Editar conceptos kg
            </button>
          </div>
          <p className="text-slate-600">Control integral de kilogramos, trazabilidad y análisis financiero</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
          {[
            { id: 'dashboard', label: 'Dashboard de Contado', icon: 'ph-chart-line-up' },
            { id: 'trazabilidad', label: 'Trazabilidad Completa', icon: 'ph-git-branch' },
            { id: 'rentabilidad', label: 'Análisis de Rentabilidad', icon: 'ph-coins' },
            { id: 'reportes', label: 'Reportes y Exportación', icon: 'ph-file-text' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <i className={`${tab.icon} text-lg`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Period Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex gap-2">
                  {[
                    { id: 'hoy', label: 'Hoy' },
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

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <input
                  type="text"
                  placeholder="Filtrar por productor"
                  value={filterProducer}
                  onChange={(e) => setFilterProducer(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  placeholder="Filtrar por cliente"
                  value={filterCustomer}
                  onChange={(e) => setFilterCustomer(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  placeholder="Filtrar por corredor"
                  value={filterBroker}
                  onChange={(e) => setFilterBroker(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Main KPIs - using dynamic labels */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <i className="ph-package text-3xl opacity-80"></i>
                  <span className="text-sm font-medium opacity-90">Recibidos</span>
                </div>
                <p className="text-3xl font-bold">{dashboardData?.kg_recibidos.toLocaleString('es-MX') || 0} kg</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <i className="ph-check-circle text-3xl opacity-80"></i>
                  <span className="text-sm font-medium opacity-90">{L.procesados}</span>
                </div>
                <p className="text-3xl font-bold">{dashboardData?.kg_procesados.toLocaleString('es-MX') || 0} kg</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <i className="ph-currency-dollar text-3xl opacity-80"></i>
                  <span className="text-sm font-medium opacity-90">Vendidos</span>
                </div>
                <p className="text-3xl font-bold">{dashboardData?.kg_vendidos.toLocaleString('es-MX') || 0} kg</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <i className="ph-trash text-3xl opacity-80"></i>
                  <span className="text-sm font-medium opacity-90">{L.desecho}</span>
                </div>
                <p className="text-3xl font-bold">{dashboardData?.kg_desecho.toLocaleString('es-MX') || 0} kg</p>
              </div>

              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <i className="ph-coins text-3xl opacity-80"></i>
                  <span className="text-sm font-medium opacity-90">Ingreso</span>
                </div>
                <p className="text-3xl font-bold">${dashboardData?.ingreso_generado.toLocaleString('es-MX') || 0}</p>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-600">{L.produccion}</span>
                  <i className="ph-package text-emerald-600 text-xl"></i>
                </div>
                <p className="text-2xl font-bold text-slate-800 mb-1">{dashboardData?.produccion_kg.toLocaleString('es-MX') || 0} kg</p>
                <p className="text-lg font-semibold text-emerald-600">${dashboardData?.produccion_valor.toLocaleString('es-MX') || 0}</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-600">Ventas</span>
                  <i className="ph-shopping-cart text-purple-600 text-xl"></i>
                </div>
                <p className="text-2xl font-bold text-slate-800 mb-1">{dashboardData?.ventas_kg.toLocaleString('es-MX') || 0} kg</p>
                <p className="text-lg font-semibold text-purple-600">${dashboardData?.ventas_monto.toLocaleString('es-MX') || 0}</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-600">{L.desecho}</span>
                  <i className="ph-trash text-orange-600 text-xl"></i>
                </div>
                <p className="text-2xl font-bold text-slate-800 mb-1">{dashboardData?.desecho_kg.toLocaleString('es-MX') || 0} kg</p>
                <p className="text-lg font-semibold text-orange-600">${dashboardData?.desecho_valor_perdido.toLocaleString('es-MX') || 0}</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-600">Recuperación</span>
                  <i className="ph-recycle text-teal-600 text-xl"></i>
                </div>
                <p className="text-2xl font-bold text-slate-800 mb-1">{dashboardData?.recuperacion_kg.toLocaleString('es-MX') || 0} kg</p>
                <p className="text-lg font-semibold text-teal-600">${dashboardData?.recuperacion_ingreso.toLocaleString('es-MX') || 0}</p>
              </div>
            </div>

            {/* Period Comparison */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Comparativo por Período</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-slate-600 mb-2">Semana</p>
                  <p className="text-2xl font-bold text-slate-800">${dashboardData?.semana_total.toLocaleString('es-MX') || 0}</p>
                  <p className="text-sm text-emerald-600 mt-1">
                    {dashboardData?.semana_comparativo > 0 ? '↑' : '↓'} {Math.abs(dashboardData?.semana_comparativo || 0).toFixed(1)}% vs anterior
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-2">Mes</p>
                  <p className="text-2xl font-bold text-slate-800">${dashboardData?.mes_total.toLocaleString('es-MX') || 0}</p>
                  <p className="text-sm text-emerald-600 mt-1">
                    {dashboardData?.mes_comparativo > 0 ? '↑' : '↓'} {Math.abs(dashboardData?.mes_comparativo || 0).toFixed(1)}% vs anterior
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-2">Año</p>
                  <p className="text-2xl font-bold text-slate-800">${dashboardData?.anio_total.toLocaleString('es-MX') || 0}</p>
                  <p className="text-sm text-slate-600 mt-1">Total acumulado</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trazabilidad Tab */}
        {activeTab === 'trazabilidad' && (
          <div className="space-y-6">
            
            {/* Lot Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Lote</label>
              <select
                value={selectedLot}
                onChange={(e) => setSelectedLot(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">-- Seleccione un lote --</option>
                {lots.map(lot => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lot_number} - {lot.producer} - {lot.fruit_type} - {format(new Date(lot.date), 'dd/MM/yyyy', { locale: es })}
                  </option>
                ))}
              </select>
            </div>

            {traceabilityData && (
              <>
                {/* Lot Info */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white shadow-lg">
                  <h3 className="text-2xl font-bold mb-4">Lote #{traceabilityData.lot.lot_number}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm opacity-80">Productor</p>
                      <p className="font-semibold">{traceabilityData.lot.producer}</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-80">Huerta</p>
                      <p className="font-semibold">{traceabilityData.lot.orchard_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-80">Corredor</p>
                      <p className="font-semibold">{traceabilityData.lot.broker_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-80">Fecha Ingreso</p>
                      <p className="font-semibold">{format(new Date(traceabilityData.lot.date), 'dd/MM/yyyy', { locale: es })}</p>
                    </div>
                  </div>
                </div>

                {/* Traceability Flow */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <i className="ph-package text-blue-600 text-xl"></i>
                      </div>
                      <span className="font-semibold text-slate-700">Recepción</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-1">{traceabilityData.ingreso.total_kg.toLocaleString('es-MX')} kg</p>
                    <p className="text-sm text-slate-500">{traceabilityData.ingreso.full_boxes} cajas llenas</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <i className="ph-check-circle text-emerald-600 text-xl"></i>
                      </div>
                      <span className="font-semibold text-slate-700">{L.procesados}</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-1">{traceabilityData.produccion.total_kg.toLocaleString('es-MX')} kg</p>
                    <p className="text-sm text-slate-500">{((traceabilityData.produccion.total_kg / traceabilityData.ingreso.total_kg) * 100).toFixed(1)}% rendimiento</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <i className="ph-currency-dollar text-purple-600 text-xl"></i>
                      </div>
                      <span className="font-semibold text-slate-700">Vendido</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-1">{(traceabilityData.ventas.empacado_kg + traceabilityData.ventas.proceso_kg + traceabilityData.ventas.desecho_kg).toLocaleString('es-MX')} kg</p>
                    <p className="text-sm text-emerald-600 font-semibold">${(traceabilityData.ventas.empacado_monto + traceabilityData.ventas.proceso_monto + traceabilityData.ventas.desecho_monto).toLocaleString('es-MX')}</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <i className="ph-trash text-orange-600 text-xl"></i>
                      </div>
                      <span className="font-semibold text-slate-700">{L.desecho}</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-1">{traceabilityData.produccion.desecho_kg.toLocaleString('es-MX')} kg</p>
                    <p className="text-sm text-slate-500">{((traceabilityData.produccion.desecho_kg / traceabilityData.ingreso.total_kg) * 100).toFixed(1)}% del total</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <i className="ph-warehouse text-slate-600 text-xl"></i>
                      </div>
                      <span className="font-semibold text-slate-700">Pendiente</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-1">{traceabilityData.resumen.kg_disponibles.toLocaleString('es-MX')} kg</p>
                    <p className="text-sm text-slate-500">En inventario</p>
                  </div>
                </div>

                {/* Balance Automático */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Balance Automático</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Kg Recibidos</p>
                      <p className="text-xl font-bold text-blue-600">{traceabilityData.resumen.kg_ingresados.toLocaleString('es-MX')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">(-) Kg Vendidos</p>
                      <p className="text-xl font-bold text-purple-600">{traceabilityData.resumen.kg_vendidos.toLocaleString('es-MX')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">(-) Kg {L.desecho}</p>
                      <p className="text-xl font-bold text-orange-600">{traceabilityData.produccion.desecho_kg.toLocaleString('es-MX')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">(=) Kg Restantes</p>
                      <p className="text-xl font-bold text-emerald-600">{traceabilityData.resumen.kg_disponibles.toLocaleString('es-MX')}</p>
                    </div>
                  </div>
                  
                  {Math.abs(traceabilityData.resumen.kg_disponibles) > 10 && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
                      <i className="ph-warning text-yellow-600 text-2xl"></i>
                      <p className="text-sm text-yellow-800">
                        <strong>Alerta:</strong> Existen diferencias de inventario en el lote. Revisar movimientos registrados.
                      </p>
                    </div>
                  )}
                </div>

                {/* Rentabilidad */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Rentabilidad del Lote</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Ingreso Total</p>
                      <p className="text-xl font-bold text-emerald-600">${traceabilityData.resumen.ingreso_total.toLocaleString('es-MX')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Costo Fruta</p>
                      <p className="text-xl font-bold text-red-600">${traceabilityData.resumen.costo_fruta.toLocaleString('es-MX')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Costo Materiales</p>
                      <p className="text-xl font-bold text-red-600">${traceabilityData.resumen.costo_materiales.toLocaleString('es-MX')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Costo Total</p>
                      <p className="text-xl font-bold text-red-600">${traceabilityData.resumen.costo_total.toLocaleString('es-MX')}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600">Utilidad Neta</p>
                      <p className={`text-2xl font-bold ${traceabilityData.resumen.utilidad_neta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ${traceabilityData.resumen.utilidad_neta.toLocaleString('es-MX')}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">${traceabilityData.resumen.utilidad_por_kg.toFixed(2)}/kg</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Rentabilidad Tab */}
        {activeTab === 'rentabilidad' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Análisis de Rentabilidad por Lote</h3>
            <p className="text-slate-600 mb-4">Seleccione un lote en la pestaña "Trazabilidad Completa" para ver análisis detallado de rentabilidad.</p>
            
            {/* Top Performers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
                <h4 className="font-semibold text-emerald-800 mb-3">Lotes Más Rentables</h4>
                <div className="space-y-2">
                  {dashboardData?.top_profitable_lots?.map((lot, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">{lot.lot_number}</span>
                      <span className="text-sm font-semibold text-emerald-600">${lot.profit.toLocaleString('es-MX')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-3">Mejor Rendimiento</h4>
                <div className="space-y-2">
                  {dashboardData?.top_performance_lots?.map((lot, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">{lot.lot_number}</span>
                      <span className="text-sm font-semibold text-blue-600">{lot.performance}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-3">Mayor Volumen</h4>
                <div className="space-y-2">
                  {dashboardData?.top_volume_lots?.map((lot, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">{lot.lot_number}</span>
                      <span className="text-sm font-semibold text-purple-600">{lot.volume.toLocaleString('es-MX')} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reportes Tab */}
        {activeTab === 'reportes' && (
          <div className="space-y-6">
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Generar Reportes</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { id: 'diario', label: 'Reporte Diario', icon: 'ph-calendar', color: 'blue' },
                  { id: 'semanal', label: 'Reporte Semanal', icon: 'ph-calendar-blank', color: 'emerald' },
                  { id: 'quincenal', label: 'Reporte Quincenal', icon: 'ph-calendar-check', color: 'purple' },
                  { id: 'mensual', label: 'Reporte Mensual', icon: 'ph-calendar-dots', color: 'orange' },
                  { id: 'anual', label: 'Reporte Anual', icon: 'ph-calendar-star', color: 'teal' },
                  { id: 'productor', label: 'Por Productor', icon: 'ph-user', color: 'indigo' },
                  { id: 'cliente', label: 'Por Cliente', icon: 'ph-briefcase', color: 'pink' },
                  { id: 'corredor', label: 'Por Corredor', icon: 'ph-handshake', color: 'cyan' },
                  { id: 'lote', label: 'Por Lote', icon: 'ph-package', color: 'lime' }
                ].map(report => (
                  <button
                    key={report.id}
                    onClick={() => {
                      alert(`Generando reporte ${report.label}...`);
                      // TODO: Implementar generación de reportes
                    }}
                    className={`p-6 bg-gradient-to-br from-${report.color}-50 to-${report.color}-100 hover:from-${report.color}-100 hover:to-${report.color}-200 rounded-xl border border-${report.color}-200 transition-all group`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 bg-${report.color}-100 group-hover:bg-${report.color}-200 rounded-full flex items-center justify-center transition-colors`}>
                        <i className={`${report.icon} text-${report.color}-600 text-xl`}></i>
                      </div>
                      <span className={`font-semibold text-${report.color}-800`}>{report.label}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-white rounded-lg text-xs font-medium text-slate-600">PDF</span>
                      <span className="px-3 py-1 bg-white rounded-lg text-xs font-medium text-slate-600">Excel</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Export History */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Historial de Reportes Generados</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <i className="ph-file-pdf text-red-500 text-2xl"></i>
                    <div>
                      <p className="font-medium text-slate-800">Reporte Semanal - Semana 12</p>
                      <p className="text-sm text-slate-500">Generado el 20/03/2024 por Admin</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                    Descargar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar Conceptos kg */}
        {showEditConcepts && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 border">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-slate-900">Editar Conceptos de Kg</h3>
                <button onClick={() => setShowEditConcepts(false)} className="text-xl">×</button>
              </div>
              <div className="space-y-4">
                {[{k:'proceso',l:'Proceso'},{k:'desecho',l:'Desecho'},{k:'procesados',l:'Procesados'},{k:'produccion',l:'Producción'}].map(item => (
                  <div key={item.k} className="flex flex-col">
                    <label className="text-sm text-slate-600 mb-1">Nombre actual: "{kgLabels[item.k]}"</label>
                    <div className="flex gap-2">
                      <input 
                        value={editValues[item.k]||''} 
                        onChange={e => setEditValues({...editValues, [item.k]: e.target.value})}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                        placeholder={`Nuevo nombre para ${item.l}`}
                      />
                      <button 
                        onClick={() => saveKgLabel(item.k, editValues[item.k]||kgLabels[item.k])} 
                        className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                      >Guardar</button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Cambia los nombres de las categorías de kg para que se reflejen en las secciones del módulo.</p>
              <div className="mt-4 text-right">
                <button onClick={() => setShowEditConcepts(false)} className="px-4 py-2 rounded-lg border">Cerrar</button>
              </div>
            </div>
          </div>
        )}

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
