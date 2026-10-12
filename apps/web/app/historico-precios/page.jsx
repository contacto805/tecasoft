'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function HistoricoPreciosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentWeek, setCurrentWeek] = useState(null);
  const [weeksList, setWeeksList] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [pricesGramaje, setPricesGramaje] = useState([]);
  const [pricesBanda, setPricesBanda] = useState([]);
  const [categories, setCategories] = useState([]);
  const [relatedLots, setRelatedLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  
  // Formularios
  const [showGramajeForm, setShowGramajeForm] = useState(false);
  const [showBandaForm, setShowBandaForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  const [gramajeForm, setGramajeForm] = useState({
    zone: '',
    region: '',
    fruitType: 'Aguacate',
    category: '',
    gramaje: '',
    pricePerKg: '',
    currency: 'MXN',
    observations: ''
  });

  const [bandaForm, setBandaForm] = useState({
    zone: '',
    fruitType: 'Aguacate',
    priceMin: '',
    priceMax: '',
    priceAverage: '',
    priceAuthorized: '',
    qualityConditions: '',
    volumeConditions: '',
    observations: ''
  });

  const [categoryForm, setCategoryForm] = useState({
    categoryCode: '',
    categoryName: '',
    displayOrder: 0
  });

  useEffect(() => {
    loadData();
    checkWeeklyAlert();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar semana actual
      const weekRes = await fetch('/api/weekly-price-history?currentWeek=true');
      const week = await weekRes.json();
      setCurrentWeek(week);
      setSelectedWeek(week);

      // Cargar todas las semanas
      const weeksRes = await fetch('/api/weekly-price-history');
      const weeks = await weeksRes.json();
      setWeeksList(weeks);

      // Cargar categorías
      const catRes = await fetch('/api/price-categories?activeOnly=true');
      const cats = await catRes.json();
      setCategories(cats);

      // Si hay semana seleccionada, cargar precios
      if (week?.id) {
        await loadWeekPrices(week.id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeekPrices = async (weekId) => {
    try {
      const [gramajeRes, bandaRes, lotsRes] = await Promise.all([
        fetch(`/api/weekly-prices-gramaje?weekHistoryId=${weekId}`),
        fetch(`/api/weekly-prices-banda?weekHistoryId=${weekId}`),
        fetch(`/api/lot-price-snapshot?weekHistoryId=${weekId}`)
      ]);

      const gramaje = await gramajeRes.json();
      const banda = await bandaRes.json();
      const lots = await lotsRes.json();

      setPricesGramaje(gramaje);
      setPricesBanda(banda);
      setRelatedLots(lots);
    } catch (error) {
      console.error('Error loading week prices:', error);
    }
  };

  const checkWeeklyAlert = () => {
    const today = new Date().getDay(); // 0 = domingo, 1 = lunes, 2 = martes
    const hour = new Date().getHours();

    // Mostrar alerta si es miércoles o posterior y no se han capturado precios
    if (today >= 3 && currentWeek?.status === 'pending') {
      setShowAlert(true);
      setAlertMessage('⚠️ Precios semanales pendientes de captura. Operación restringida.');
    }
  };

  const handleCaptureWeekPrices = async () => {
    if (!currentWeek) return;

    try {
      await fetch('/api/weekly-price-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentWeek.id,
          status: 'captured',
          capturedBy: 'Usuario Actual'
        })
      });

      setShowAlert(false);
      loadData();
    } catch (error) {
      console.error('Error capturing week:', error);
    }
  };

  const handleSaveGramajePrice = async () => {
    if (!currentWeek || !gramajeForm.pricePerKg) {
      alert('Faltan datos obligatorios');
      return;
    }

    try {
      const url = editingPrice 
        ? '/api/weekly-prices-gramaje'
        : '/api/weekly-prices-gramaje';
      
      const method = editingPrice ? 'PUT' : 'POST';
      
      const payload = editingPrice
        ? { id: editingPrice.id, ...gramajeForm }
        : {
            weekHistoryId: currentWeek.id,
            weekNumber: currentWeek.week_number,
            weekYear: currentWeek.week_year,
            ...gramajeForm,
            createdBy: 'Usuario Actual'
          };

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setShowGramajeForm(false);
      setEditingPrice(null);
      setGramajeForm({
        zone: '',
        region: '',
        fruitType: 'Aguacate',
        category: '',
        gramaje: '',
        pricePerKg: '',
        currency: 'MXN',
        observations: ''
      });
      loadWeekPrices(currentWeek.id);
    } catch (error) {
      console.error('Error saving gramaje price:', error);
    }
  };

  const handleSaveBandaPrice = async () => {
    if (!currentWeek || !bandaForm.priceAuthorized) {
      alert('Precio autorizado es obligatorio');
      return;
    }

    try {
      const url = editingPrice 
        ? '/api/weekly-prices-banda'
        : '/api/weekly-prices-banda';
      
      const method = editingPrice ? 'PUT' : 'POST';
      
      const payload = editingPrice
        ? { id: editingPrice.id, ...bandaForm }
        : {
            weekHistoryId: currentWeek.id,
            weekNumber: currentWeek.week_number,
            weekYear: currentWeek.week_year,
            ...bandaForm,
            createdBy: 'Usuario Actual'
          };

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setShowBandaForm(false);
      setEditingPrice(null);
      setBandaForm({
        zone: '',
        fruitType: 'Aguacate',
        priceMin: '',
        priceMax: '',
        priceAverage: '',
        priceAuthorized: '',
        qualityConditions: '',
        volumeConditions: '',
        observations: ''
      });
      loadWeekPrices(currentWeek.id);
    } catch (error) {
      console.error('Error saving banda price:', error);
    }
  };

  const handleCloseWeek = async () => {
    if (!currentWeek) return;
    
    if (!confirm('¿Cerrar la semana? No se podrán realizar modificaciones sin autorización de Superadministrador.')) {
      return;
    }

    try {
      await fetch('/api/weekly-price-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentWeek.id,
          status: 'closed',
          closedBy: 'Usuario Actual'
        })
      });

      loadData();
    } catch (error) {
      console.error('Error closing week:', error);
    }
  };

  const handleReopenWeek = async () => {
    if (!currentWeek) return;
    
    if (!confirm('¿Reabrir esta semana? Solo Superadministrador puede realizar esta acción.')) {
      return;
    }

    try {
      await fetch('/api/weekly-price-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentWeek.id,
          status: 'reopened',
          closedBy: 'Usuario Actual'
        })
      });

      loadData();
    } catch (error) {
      console.error('Error reopening week:', error);
    }
  };

  const generatePDF = (type) => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Reporte de Precios Semanales', 105, 15, { align: 'center' });
    
    if (selectedWeek) {
      doc.setFontSize(10);
      doc.text(`Semana ${selectedWeek.week_number} - ${selectedWeek.week_year}`, 105, 25, { align: 'center' });
      doc.text(`Del ${selectedWeek.week_start_date} al ${selectedWeek.week_end_date}`, 105, 32, { align: 'center' });
    }

    let yPos = 40;

    if (type === 'precios' || type === 'completo') {
      doc.setFontSize(12);
      doc.text('Precios por Gramaje', 14, yPos);
      yPos += 5;

      const gramajeData = pricesGramaje.map(p => [
        p.category || '',
        p.gramaje || '',
        p.zone || '',
        `$${p.price_per_kg} ${p.currency}`,
        p.observations || ''
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['Categoría', 'Gramaje', 'Zona', 'Precio/Kg', 'Observaciones']],
        body: gramajeData,
        theme: 'grid',
        headStyles: { fillColor: [2, 77, 50] }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      doc.text('Precios a la Banda', 14, yPos);
      yPos += 5;

      const bandaData = pricesBanda.map(p => [
        p.zone || '',
        p.fruit_type || '',
        `$${p.price_min || 0}`,
        `$${p.price_max || 0}`,
        `$${p.price_authorized}`
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['Zona', 'Tipo Fruta', 'Precio Min', 'Precio Max', 'Precio Autorizado']],
        body: bandaData,
        theme: 'grid',
        headStyles: { fillColor: [2, 77, 50] }
      });
    }

    if (type === 'lotes' || type === 'completo') {
      if (type === 'completo') {
        doc.addPage();
        yPos = 20;
      }

      doc.text('Lotes Relacionados', 14, yPos);
      yPos += 5;

      const lotsData = relatedLots.map(l => [
        l.lot_number || '',
        l.producer || '',
        new Date(l.lot_date).toLocaleDateString(),
        `${l.kg_received || 0} kg`,
        `$${l.price_applied}`,
        `$${l.total_cost || 0}`
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['Lote', 'Productor', 'Fecha', 'Kilos', 'Precio/Kg', 'Costo Total']],
        body: lotsData,
        theme: 'grid',
        headStyles: { fillColor: [2, 77, 50] }
      });
    }

    doc.save(`precios_semanales_${selectedWeek?.week_number || 'reporte'}.pdf`);
  };

  const generateExcel = (type) => {
    const wb = XLSX.utils.book_new();

    if (type === 'precios' || type === 'completo') {
      const gramajeData = pricesGramaje.map(p => ({
        'Categoría': p.category || '',
        'Gramaje': p.gramaje || '',
        'Zona': p.zone || '',
        'Precio/Kg': p.price_per_kg,
        'Moneda': p.currency,
        'Observaciones': p.observations || ''
      }));

      const wsGramaje = XLSX.utils.json_to_sheet(gramajeData);
      XLSX.utils.book_append_sheet(wb, wsGramaje, 'Precios Gramaje');

      const bandaData = pricesBanda.map(p => ({
        'Zona': p.zone || '',
        'Tipo Fruta': p.fruit_type || '',
        'Precio Min': p.price_min || 0,
        'Precio Max': p.price_max || 0,
        'Precio Promedio': p.price_average || 0,
        'Precio Autorizado': p.price_authorized
      }));

      const wsBanda = XLSX.utils.json_to_sheet(bandaData);
      XLSX.utils.book_append_sheet(wb, wsBanda, 'Precios Banda');
    }

    if (type === 'lotes' || type === 'completo') {
      const lotsData = relatedLots.map(l => ({
        'Lote': l.lot_number || '',
        'Productor': l.producer || '',
        'Fecha': new Date(l.lot_date).toLocaleDateString(),
        'Kilos': l.kg_received || 0,
        'Precio/Kg': l.price_applied,
        'Costo Total': l.total_cost || 0
      }));

      const wsLots = XLSX.utils.json_to_sheet(lotsData);
      XLSX.utils.book_append_sheet(wb, wsLots, 'Lotes Relacionados');
    }

    XLSX.writeFile(wb, `precios_semanales_${selectedWeek?.week_number || 'reporte'}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#024D32] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#024D32] to-[#026647] text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Histórico de Precios Semanales</h1>
              <p className="text-green-100 mt-1">Gestión y trazabilidad de precios de compra</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="bg-white text-[#024D32] px-4 py-2 rounded-lg hover:bg-green-50 transition"
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>

      {/* Alerta Crítica */}
      {showAlert && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-800 font-semibold">{alertMessage}</p>
              <p className="text-red-600 text-sm mt-1">
                No se pueden realizar nuevas órdenes de corte, negociaciones, compras ni reportes financieros finales hasta capturar los precios.
              </p>
            </div>
            <button
              onClick={handleCaptureWeekPrices}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Capturar Precios Ahora
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="flex border-b">
            {['dashboard', 'gramaje', 'banda', 'historico', 'categorias', 'reportes'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 text-center font-medium transition ${
                  activeTab === tab
                    ? 'bg-[#024D32] text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab === 'dashboard' && '📊 Dashboard'}
                {tab === 'gramaje' && '⚖️ Precios por Gramaje'}
                {tab === 'banda' && '🎯 Precios a la Banda'}
                {tab === 'historico' && '📚 Histórico'}
                {tab === 'categorias' && '🏷️ Categorías'}
                {tab === 'reportes' && '📄 Reportes'}
              </button>
            ))}
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Resumen Semana Actual</h2>
              
              {currentWeek && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium">Semana Activa</p>
                    <p className="text-3xl font-bold text-blue-900 mt-2">
                      Semana {currentWeek.week_number}
                    </p>
                    <p className="text-sm text-blue-700 mt-1">{currentWeek.week_year}</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
                    <p className="text-sm text-green-600 font-medium">Estatus</p>
                    <p className="text-2xl font-bold text-green-900 mt-2">
                      {currentWeek.status === 'pending' && '⏳ Pendiente'}
                      {currentWeek.status === 'captured' && '✅ Capturado'}
                      {currentWeek.status === 'closed' && '🔒 Cerrado'}
                      {currentWeek.status === 'reopened' && '🔓 Reabierto'}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      {currentWeek.week_start_date} al {currentWeek.week_end_date}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-600 font-medium">Lotes Relacionados</p>
                    <p className="text-3xl font-bold text-purple-900 mt-2">
                      {relatedLots.length}
                    </p>
                    <p className="text-sm text-purple-700 mt-1">
                      {relatedLots.reduce((sum, l) => sum + (parseFloat(l.kg_received) || 0), 0).toFixed(2)} kg totales
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Precios por Gramaje */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Precios por Gramaje</h3>
                  <div className="space-y-2">
                    {pricesGramaje.length === 0 ? (
                      <p className="text-gray-500 text-sm">No hay precios capturados</p>
                    ) : (
                      pricesGramaje.slice(0, 5).map((price) => (
                        <div key={price.id} className="flex justify-between items-center border-b pb-2">
                          <span className="text-sm font-medium text-gray-700">
                            {price.category} - {price.gramaje}
                          </span>
                          <span className="text-sm font-bold text-[#024D32]">
                            ${price.price_per_kg} {price.currency}/kg
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab('gramaje')}
                    className="mt-4 text-sm text-[#024D32] hover:underline"
                  >
                    Ver todos →
                  </button>
                </div>

                {/* Precios a la Banda */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Precios a la Banda</h3>
                  <div className="space-y-2">
                    {pricesBanda.length === 0 ? (
                      <p className="text-gray-500 text-sm">No hay precios capturados</p>
                    ) : (
                      pricesBanda.map((price) => (
                        <div key={price.id} className="flex justify-between items-center border-b pb-2">
                          <span className="text-sm font-medium text-gray-700">
                            {price.zone} - {price.fruit_type}
                          </span>
                          <span className="text-sm font-bold text-[#024D32]">
                            ${price.price_authorized}/kg
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab('banda')}
                    className="mt-4 text-sm text-[#024D32] hover:underline"
                  >
                    Ver todos →
                  </button>
                </div>
              </div>

              {/* Acciones */}
              <div className="mt-6 flex gap-4">
                {currentWeek?.status !== 'closed' && (
                  <button
                    onClick={handleCloseWeek}
                    className="bg-[#024D32] text-white px-6 py-3 rounded-lg hover:bg-[#026647] transition font-medium"
                  >
                    🔒 Cerrar Semana
                  </button>
                )}
                
                {currentWeek?.status === 'closed' && (
                  <button
                    onClick={handleReopenWeek}
                    className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition font-medium"
                  >
                    🔓 Reabrir Semana (Solo Superadmin)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Precios por Gramaje Tab */}
          {activeTab === 'gramaje' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Precios por Gramaje</h2>
                <button
                  onClick={() => {
                    setShowGramajeForm(true);
                    setEditingPrice(null);
                  }}
                  className="bg-[#024D32] text-white px-4 py-2 rounded-lg hover:bg-[#026647] transition"
                  disabled={currentWeek?.status === 'closed'}
                >
                  + Agregar Precio
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Categoría</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Gramaje</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Zona</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Región</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Precio/Kg</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Observaciones</th>
                      <th className="text-center p-3 text-sm font-medium text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricesGramaje.map((price) => (
                      <tr key={price.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">{price.category}</td>
                        <td className="p-3 text-sm">{price.gramaje}</td>
                        <td className="p-3 text-sm">{price.zone}</td>
                        <td className="p-3 text-sm">{price.region}</td>
                        <td className="p-3 text-sm font-bold text-[#024D32]">
                          ${price.price_per_kg} {price.currency}
                        </td>
                        <td className="p-3 text-sm text-gray-600">{price.observations}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              setEditingPrice(price);
                              setGramajeForm({
                                zone: price.zone || '',
                                region: price.region || '',
                                fruitType: price.fruit_type || 'Aguacate',
                                category: price.category || '',
                                gramaje: price.gramaje || '',
                                pricePerKg: price.price_per_kg || '',
                                currency: price.currency || 'MXN',
                                observations: price.observations || ''
                              });
                              setShowGramajeForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                            disabled={currentWeek?.status === 'closed'}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar este precio?')) {
                                await fetch(`/api/weekly-prices-gramaje?id=${price.id}`, { method: 'DELETE' });
                                loadWeekPrices(currentWeek.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                            disabled={currentWeek?.status === 'closed'}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Precios a la Banda Tab */}
          {activeTab === 'banda' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Precios a la Banda</h2>
                <button
                  onClick={() => {
                    setShowBandaForm(true);
                    setEditingPrice(null);
                  }}
                  className="bg-[#024D32] text-white px-4 py-2 rounded-lg hover:bg-[#026647] transition"
                  disabled={currentWeek?.status === 'closed'}
                >
                  + Agregar Precio
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Zona</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Tipo Fruta</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Precio Min</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Precio Max</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Precio Promedio</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Precio Autorizado</th>
                      <th className="text-center p-3 text-sm font-medium text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricesBanda.map((price) => (
                      <tr key={price.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">{price.zone}</td>
                        <td className="p-3 text-sm">{price.fruit_type}</td>
                        <td className="p-3 text-sm">${price.price_min || 0}</td>
                        <td className="p-3 text-sm">${price.price_max || 0}</td>
                        <td className="p-3 text-sm">${price.price_average || 0}</td>
                        <td className="p-3 text-sm font-bold text-[#024D32]">${price.price_authorized}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              setEditingPrice(price);
                              setBandaForm({
                                zone: price.zone || '',
                                fruitType: price.fruit_type || 'Aguacate',
                                priceMin: price.price_min || '',
                                priceMax: price.price_max || '',
                                priceAverage: price.price_average || '',
                                priceAuthorized: price.price_authorized || '',
                                qualityConditions: price.quality_conditions || '',
                                volumeConditions: price.volume_conditions || '',
                                observations: price.observations || ''
                              });
                              setShowBandaForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                            disabled={currentWeek?.status === 'closed'}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar este precio?')) {
                                await fetch(`/api/weekly-prices-banda?id=${price.id}`, { method: 'DELETE' });
                                loadWeekPrices(currentWeek.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                            disabled={currentWeek?.status === 'closed'}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Histórico Tab */}
          {activeTab === 'historico' && (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Histórico de Semanas</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Semana</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Año</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Periodo</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Estatus</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-700">Capturado Por</th>
                      <th className="text-center p-3 text-sm font-medium text-gray-700">Lotes</th>
                      <th className="text-center p-3 text-sm font-medium text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeksList.map((week) => (
                      <tr key={week.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm font-medium">{week.week_number}</td>
                        <td className="p-3 text-sm">{week.week_year}</td>
                        <td className="p-3 text-sm">
                          {week.week_start_date} al {week.week_end_date}
                        </td>
                        <td className="p-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            week.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            week.status === 'captured' ? 'bg-green-100 text-green-800' :
                            week.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {week.status}
                          </span>
                        </td>
                        <td className="p-3 text-sm">{week.captured_by || '-'}</td>
                        <td className="p-3 text-sm text-center">
                          <button
                            onClick={async () => {
                              setSelectedWeek(week);
                              await loadWeekPrices(week.id);
                              setActiveTab('dashboard');
                            }}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Ver Lotes
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={async () => {
                              setSelectedWeek(week);
                              await loadWeekPrices(week.id);
                              setActiveTab('reportes');
                            }}
                            className="text-[#024D32] hover:text-[#026647] text-sm"
                          >
                            📄 Reportes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Categorías Tab */}
          {activeTab === 'categorias' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Gestión de Categorías</h2>
                <button
                  onClick={() => {
                    setShowCategoryForm(true);
                    setEditingCategory(null);
                  }}
                  className="bg-[#024D32] text-white px-4 py-2 rounded-lg hover:bg-[#026647] transition"
                >
                  + Nueva Categoría
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <div key={cat.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-800">{cat.category_name}</p>
                        <p className="text-sm text-gray-500 mt-1">Código: {cat.category_code}</p>
                        <p className="text-xs text-gray-400 mt-1">Orden: {cat.display_order}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingCategory(cat);
                            setCategoryForm({
                              categoryCode: cat.category_code,
                              categoryName: cat.category_name,
                              displayOrder: cat.display_order
                            });
                            setShowCategoryForm(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('¿Desactivar esta categoría?')) {
                              await fetch(`/api/price-categories?id=${cat.id}`, { method: 'DELETE' });
                              const res = await fetch('/api/price-categories?activeOnly=true');
                              const cats = await res.json();
                              setCategories(cats);
                            }
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reportes Tab */}
          {activeTab === 'reportes' && (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Generador de Reportes</h2>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4">Seleccionar Tipo de Reporte</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <button
                    onClick={() => {
                      generatePDF('precios');
                      generateExcel('precios');
                    }}
                    className="bg-blue-600 text-white p-6 rounded-lg hover:bg-blue-700 transition text-center"
                  >
                    <p className="text-2xl mb-2">📊</p>
                    <p className="font-bold">Reporte de Precios</p>
                    <p className="text-sm mt-2 opacity-90">Solo precios por gramaje y banda</p>
                  </button>

                  <button
                    onClick={() => {
                      generatePDF('lotes');
                      generateExcel('lotes');
                    }}
                    className="bg-green-600 text-white p-6 rounded-lg hover:bg-green-700 transition text-center"
                  >
                    <p className="text-2xl mb-2">📦</p>
                    <p className="font-bold">Reporte de Lotes</p>
                    <p className="text-sm mt-2 opacity-90">Lotes relacionados a la semana</p>
                  </button>

                  <button
                    onClick={() => {
                      generatePDF('completo');
                      generateExcel('completo');
                    }}
                    className="bg-purple-600 text-white p-6 rounded-lg hover:bg-purple-700 transition text-center"
                  >
                    <p className="text-2xl mb-2">📄</p>
                    <p className="font-bold">Reporte Completo</p>
                    <p className="text-sm mt-2 opacity-90">Precios + Lotes + Comparativos</p>
                  </button>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-bold mb-3">Lotes Relacionados a Esta Semana</h4>
                  {relatedLots.length === 0 ? (
                    <p className="text-gray-500 text-sm">No hay lotes relacionados a esta semana</p>
                  ) : (
                    <div className="space-y-2">
                      {relatedLots.map((lot) => (
                        <div key={lot.id} className="flex justify-between items-center bg-white border p-3 rounded">
                          <div>
                            <p className="font-medium">{lot.lot_number}</p>
                            <p className="text-sm text-gray-600">{lot.producer} - {lot.kg_received} kg</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[#024D32]">${lot.price_applied}/kg</p>
                            <p className="text-sm text-gray-600">Total: ${lot.total_cost}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Precio Gramaje */}
      {showGramajeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">
                {editingPrice ? 'Editar Precio por Gramaje' : 'Agregar Precio por Gramaje'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Zona</label>
                  <input
                    type="text"
                    value={gramajeForm.zone}
                    onChange={(e) => setGramajeForm({...gramajeForm, zone: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Región</label>
                  <input
                    type="text"
                    value={gramajeForm.region}
                    onChange={(e) => setGramajeForm({...gramajeForm, region: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Tipo de Fruta</label>
                  <input
                    type="text"
                    value={gramajeForm.fruitType}
                    onChange={(e) => setGramajeForm({...gramajeForm, fruitType: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Categoría *</label>
                  <select
                    value={gramajeForm.category}
                    onChange={(e) => setGramajeForm({...gramajeForm, category: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="">Seleccionar</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.category_name}>{cat.category_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Gramaje</label>
                  <input
                    type="text"
                    value={gramajeForm.gramaje}
                    onChange={(e) => setGramajeForm({...gramajeForm, gramaje: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="ej: 100+"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Precio/Kg *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gramajeForm.pricePerKg}
                    onChange={(e) => setGramajeForm({...gramajeForm, pricePerKg: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Moneda</label>
                  <select
                    value={gramajeForm.currency}
                    onChange={(e) => setGramajeForm({...gramajeForm, currency: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Observaciones</label>
                <textarea
                  value={gramajeForm.observations}
                  onChange={(e) => setGramajeForm({...gramajeForm, observations: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  rows="3"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowGramajeForm(false);
                  setEditingPrice(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGramajePrice}
                className="px-4 py-2 bg-[#024D32] text-white rounded-lg hover:bg-[#026647] transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Precio Banda */}
      {showBandaForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">
                {editingPrice ? 'Editar Precio a la Banda' : 'Agregar Precio a la Banda'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Zona</label>
                  <input
                    type="text"
                    value={bandaForm.zone}
                    onChange={(e) => setBandaForm({...bandaForm, zone: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tipo de Fruta</label>
                  <input
                    type="text"
                    value={bandaForm.fruitType}
                    onChange={(e) => setBandaForm({...bandaForm, fruitType: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Precio Mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bandaForm.priceMin}
                    onChange={(e) => setBandaForm({...bandaForm, priceMin: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Precio Máximo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bandaForm.priceMax}
                    onChange={(e) => setBandaForm({...bandaForm, priceMax: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Precio Promedio</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bandaForm.priceAverage}
                    onChange={(e) => setBandaForm({...bandaForm, priceAverage: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Precio Autorizado *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bandaForm.priceAuthorized}
                    onChange={(e) => setBandaForm({...bandaForm, priceAuthorized: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Condiciones de Calidad</label>
                <textarea
                  value={bandaForm.qualityConditions}
                  onChange={(e) => setBandaForm({...bandaForm, qualityConditions: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  rows="2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Condiciones de Volumen</label>
                <textarea
                  value={bandaForm.volumeConditions}
                  onChange={(e) => setBandaForm({...bandaForm, volumeConditions: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  rows="2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Observaciones</label>
                <textarea
                  value={bandaForm.observations}
                  onChange={(e) => setBandaForm({...bandaForm, observations: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  rows="3"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowBandaForm(false);
                  setEditingPrice(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBandaPrice}
                className="px-4 py-2 bg-[#024D32] text-white rounded-lg hover:bg-[#026647] transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Categoría */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Código *</label>
                <input
                  type="text"
                  value={categoryForm.categoryCode}
                  onChange={(e) => setCategoryForm({...categoryForm, categoryCode: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  disabled={!!editingCategory}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Nombre *</label>
                <input
                  type="text"
                  value={categoryForm.categoryName}
                  onChange={(e) => setCategoryForm({...categoryForm, categoryName: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Orden de Visualización</label>
                <input
                  type="number"
                  value={categoryForm.displayOrder}
                  onChange={(e) => setCategoryForm({...categoryForm, displayOrder: parseInt(e.target.value)})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCategoryForm(false);
                  setEditingCategory(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!categoryForm.categoryCode || !categoryForm.categoryName) {
                    alert('Código y nombre son obligatorios');
                    return;
                  }

                  try {
                    const url = '/api/price-categories';
                    const method = editingCategory ? 'PUT' : 'POST';
                    const payload = editingCategory
                      ? { id: editingCategory.id, ...categoryForm }
                      : categoryForm;

                    await fetch(url, {
                      method,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });

                    setShowCategoryForm(false);
                    setEditingCategory(null);
                    
                    const res = await fetch('/api/price-categories?activeOnly=true');
                    const cats = await res.json();
                    setCategories(cats);
                  } catch (error) {
                    console.error('Error saving category:', error);
                  }
                }}
                className="px-4 py-2 bg-[#024D32] text-white rounded-lg hover:bg-[#026647] transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
