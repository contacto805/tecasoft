'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, RefreshCw, Plus, Download } from 'lucide-react';

export default function ProfitLossPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState(null);
  const [movements, setMovements] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filtros
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  
  // Formulario nuevo movimiento
  const [formData, setFormData] = useState({
    movementDate: today,
    movementType: 'EGRESO',
    category: 'Gasto Operativo',
    description: '',
    amount: '',
    notes: ''
  });

  const categoriesIngresos = [
    'Venta Principal',
    'Venta Proceso',
    'Venta Desecho',
    'Otros Ingresos'
  ];

  const categoriesEgresos = [
    'Compra Fruta',
    'Comisión Corredor',
    'Flete Foráneo',
    'Gasto Operativo',
    'Gasto Empaque',
    'Gasto Producción',
    'Gasto Administrativo',
    'Nómina',
    'Servicios',
    'Otros Gastos'
  ];

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/profit-loss/daily?startDate=${startDate}&endDate=${endDate}`);
      const result = await response.json();
      setData(result);
      setMovements(result.recentMovements || []);
    } catch (error) {
      console.error('Error fetching P&L data:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncMovements = async () => {
    setSyncing(true);
    try {
      // Sincronizar para cada día en el rango
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        await fetch('/api/profit-loss/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syncDate: dateStr })
        });
      }
      
      alert('Sincronización completada');
      fetchData();
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddMovement = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/daily-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('Movimiento registrado');
        setShowAddModal(false);
        setFormData({
          movementDate: today,
          movementType: 'EGRESO',
          category: 'Gasto Operativo',
          description: '',
          amount: '',
          notes: ''
        });
        fetchData();
      }
    } catch (error) {
      console.error('Error adding movement:', error);
      alert('Error al registrar movimiento');
    }
  };

  const exportCSV = () => {
    if (!movements.length) return;
    
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto'];
    const rows = movements.map(m => [
      m.movement_date,
      m.movement_type,
      m.category,
      m.description || '',
      m.amount
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perdidas_ganancias_${startDate}_${endDate}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  const totals = data?.totals || {};
  const utilidadNeta = (totals.total_ingresos || 0) - (totals.total_egresos || 0);
  const margen = totals.total_ingresos > 0 
    ? ((utilidadNeta / totals.total_ingresos) * 100).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pérdidas y Ganancias</h1>
              <p className="text-gray-600 mt-1">Análisis diario de ingresos y egresos</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={syncMovements}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Plus className="w-5 h-5" />
                Nuevo Movimiento
              </button>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download className="w-5 h-5" />
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Filtros de fecha */}
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <label className="text-sm text-gray-600">Desde:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Hasta:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Ingresos</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(totals.total_ingresos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Egresos</p>
                <p className="text-2xl font-bold text-red-600">
                  ${(totals.total_egresos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Utilidad Neta</p>
                <p className={`text-2xl font-bold ${utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${utilidadNeta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className={`w-10 h-10 ${utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Margen de Ganancia</p>
                <p className={`text-2xl font-bold ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {margen}%
                </p>
              </div>
              <TrendingUp className={`w-10 h-10 ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
        </div>

        {/* Gráfico de tendencia diaria */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Tendencia Diaria</h2>
          <div className="space-y-3">
            {(data?.summary || []).map((day, index) => {
              const dailyProfit = parseFloat(day.utilidad_neta || 0);
              const maxValue = Math.max(...(data?.summary || []).map(d => 
                Math.max(parseFloat(d.total_ingresos || 0), parseFloat(d.total_egresos || 0))
              ));
              
              return (
                <div key={index} className="border-b pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {new Date(day.movement_date).toLocaleDateString('es-MX', { 
                        weekday: 'short', 
                        day: 'numeric', 
                        month: 'short' 
                      })}
                    </span>
                    <span className={`text-sm font-bold ${dailyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${dailyProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-gray-600 mb-1">Ingresos</div>
                      <div className="bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div 
                          className="bg-green-500 h-full flex items-center justify-end pr-2"
                          style={{ width: `${(parseFloat(day.total_ingresos || 0) / maxValue) * 100}%` }}
                        >
                          <span className="text-xs text-white font-medium">
                            ${parseFloat(day.total_ingresos || 0).toLocaleString('es-MX')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-600 mb-1">Egresos</div>
                      <div className="bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div 
                          className="bg-red-500 h-full flex items-center justify-end pr-2"
                          style={{ width: `${(parseFloat(day.total_egresos || 0) / maxValue) * 100}%` }}
                        >
                          <span className="text-xs text-white font-medium">
                            ${parseFloat(day.total_egresos || 0).toLocaleString('es-MX')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desglose por categoría */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Ingresos por Categoría</h2>
            <div className="space-y-3">
              {(data?.categoryBreakdown || [])
                .filter(cat => cat.movement_type === 'INGRESO')
                .map((cat, index) => {
                  const percentage = totals.total_ingresos > 0 
                    ? ((parseFloat(cat.total_amount) / totals.total_ingresos) * 100).toFixed(1)
                    : 0;
                  
                  return (
                    <div key={index}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-700">{cat.category}</span>
                        <span className="text-sm font-medium text-gray-900">
                          ${parseFloat(cat.total_amount).toLocaleString('es-MX')} ({percentage}%)
                        </span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Egresos por Categoría</h2>
            <div className="space-y-3">
              {(data?.categoryBreakdown || [])
                .filter(cat => cat.movement_type === 'EGRESO')
                .map((cat, index) => {
                  const percentage = totals.total_egresos > 0 
                    ? ((parseFloat(cat.total_amount) / totals.total_egresos) * 100).toFixed(1)
                    : 0;
                  
                  return (
                    <div key={index}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-700">{cat.category}</span>
                        <span className="text-sm font-medium text-gray-900">
                          ${parseFloat(cat.total_amount).toLocaleString('es-MX')} ({percentage}%)
                        </span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Movimientos recientes */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Movimientos Recientes</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {movements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(movement.movement_date).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        movement.movement_type === 'INGRESO' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {movement.movement_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{movement.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{movement.description || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      ${parseFloat(movement.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Agregar Movimiento */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Nuevo Movimiento</h2>
            <form onSubmit={handleAddMovement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formData.movementDate}
                  onChange={(e) => setFormData({ ...formData, movementDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={formData.movementType}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    movementType: e.target.value,
                    category: e.target.value === 'INGRESO' ? categoriesIngresos[0] : categoriesEgresos[0]
                  })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="INGRESO">Ingreso</option>
                  <option value="EGRESO">Egreso</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  {(formData.movementType === 'INGRESO' ? categoriesIngresos : categoriesEgresos).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Ej: Pago de servicio de luz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows="3"
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
