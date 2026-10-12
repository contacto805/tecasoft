'use client';

import { useState, useEffect } from 'react';
import { Truck, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function ForeignFreightsPage() {
  const [loading, setLoading] = useState(true);
  const [freights, setFreights] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('Todos');
  
  const [formData, setFormData] = useState({
    loadId: '',
    lotId: '',
    driverName: '',
    truckPlates: '',
    trailerPlates: '',
    freightDate: new Date().toISOString().split('T')[0],
    freightAmount: '',
    notes: ''
  });

  useEffect(() => {
    fetchFreights();
  }, [filter]);

  const fetchFreights = async () => {
    setLoading(true);
    try {
      const url = filter !== 'Todos' 
        ? `/api/foreign-freights?status=${filter}`
        : '/api/foreign-freights';
      const response = await fetch(url);
      const data = await response.json();
      setFreights(data);
    } catch (error) {
      console.error('Error fetching freights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/foreign-freights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('Flete creado exitosamente');
        setShowModal(false);
        setFormData({
          loadId: '',
          lotId: '',
          driverName: '',
          truckPlates: '',
          trailerPlates: '',
          freightDate: new Date().toISOString().split('T')[0],
          freightAmount: '',
          notes: ''
        });
        fetchFreights();
      }
    } catch (error) {
      console.error('Error creating freight:', error);
      alert('Error al crear flete');
    }
  };

  const updateStatus = async (id, newStatus, paymentDate = null) => {
    try {
      const response = await fetch('/api/foreign-freights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: newStatus,
          paymentDate: paymentDate || new Date().toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        alert('Estado actualizado');
        fetchFreights();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar estado');
    }
  };

  const deleteFreight = async (id) => {
    if (!confirm('¿Eliminar este flete?')) return;
    
    try {
      const response = await fetch(`/api/foreign-freights?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Flete eliminado');
        fetchFreights();
      }
    } catch (error) {
      console.error('Error deleting freight:', error);
      alert('Error al eliminar flete');
    }
  };

  const statusColors = {
    'Pendiente': 'bg-yellow-100 text-yellow-800',
    'Pagado': 'bg-green-100 text-green-800',
    'Cancelado': 'bg-red-100 text-red-800'
  };

  const totalPendiente = freights
    .filter(f => f.status === 'Pendiente')
    .reduce((sum, f) => sum + parseFloat(f.freight_amount || 0), 0);

  const totalPagado = freights
    .filter(f => f.status === 'Pagado')
    .reduce((sum, f) => sum + parseFloat(f.freight_amount || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando fletes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Truck className="w-8 h-8 text-blue-600" />
                Fletes Foráneos
              </h1>
              <p className="text-gray-600 mt-1">Gestión de transportes de venta</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nuevo Flete
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">Pendientes de Pago</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    ${totalPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Pagados</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${totalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Truck className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Fletes</p>
                  <p className="text-2xl font-bold text-blue-600">{freights.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-2">
            {['Todos', 'Pendiente', 'Pagado', 'Cancelado'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de Fletes */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chofer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placas</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente/Destino</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lote</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {freights.map((freight) => (
                  <tr key={freight.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(freight.freight_date).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{freight.driver_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="text-xs">
                        <div>Tractor: {freight.truck_plates || '-'}</div>
                        <div>Remolque: {freight.trailer_plates || '-'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="text-xs">
                        <div>{freight.customer_name || '-'}</div>
                        <div className="text-gray-500">{freight.destination || '-'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{freight.lot_number || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      ${parseFloat(freight.freight_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[freight.status]}`}>
                        {freight.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {freight.status === 'Pendiente' && (
                          <>
                            <button
                              onClick={() => updateStatus(freight.id, 'Pagado')}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                            >
                              Marcar Pagado
                            </button>
                            <button
                              onClick={() => updateStatus(freight.id, 'Cancelado')}
                              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteFreight(freight.id)}
                          className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nuevo Flete */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Nuevo Flete Foráneo</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chofer *</label>
                <input
                  type="text"
                  value={formData.driverName}
                  onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placas Tractocamión</label>
                  <input
                    type="text"
                    value={formData.truckPlates}
                    onChange={(e) => setFormData({ ...formData, truckPlates: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placas Remolque</label>
                  <input
                    type="text"
                    value={formData.trailerPlates}
                    onChange={(e) => setFormData({ ...formData, trailerPlates: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={formData.freightDate}
                    onChange={(e) => setFormData({ ...formData, freightDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.freightAmount}
                    onChange={(e) => setFormData({ ...formData, freightAmount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows="3"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
