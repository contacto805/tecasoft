'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Trash2, Edit2, Plus, Save, X } from 'lucide-react';

export default function MaterialAlertsPage() {
  const [materials, setMaterials] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [formData, setFormData] = useState({
    material_id: '',
    alert_type: 'LOW_STOCK',
    alert_threshold: '',
    alert_message: '',
  });

  // Load materials and alerts
  useEffect(() => {
    const loadData = async () => {
      try {
        const [matsRes, alertsRes] = await Promise.all([
          fetch('/api/materials'),
          fetch('/api/material-alerts?activeOnly=true'),
        ]);

        if (matsRes.ok) {
          const mats = await matsRes.json();
          setMaterials(mats);
        }

        if (alertsRes.ok) {
          const alts = await alertsRes.json();
          setAlerts(alts);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleAddAlert = async (e) => {
    e.preventDefault();

    if (!formData.material_id || !formData.alert_threshold) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      const method = editingAlert ? 'PUT' : 'POST';
      const url = editingAlert
        ? '/api/material-alerts'
        : '/api/material-alerts';
      const body = editingAlert
        ? {
            id: editingAlert.id,
            alert_threshold: parseFloat(formData.alert_threshold),
            alert_message: formData.alert_message,
          }
        : {
            material_id: parseInt(formData.material_id),
            alert_type: formData.alert_type,
            alert_threshold: parseFloat(formData.alert_threshold),
            alert_message: formData.alert_message,
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.error}`);
        return;
      }

      const result = await response.json();

      if (editingAlert) {
        setAlerts(alerts.map((a) => (a.id === result.id ? result : a)));
      } else {
        setAlerts([...alerts, result]);
      }

      setFormData({
        material_id: '',
        alert_type: 'LOW_STOCK',
        alert_threshold: '',
        alert_message: '',
      });
      setEditingAlert(null);
      setShowForm(false);
      alert('✓ Alerta guardada exitosamente');
    } catch (error) {
      console.error('Error saving alert:', error);
      alert('Error al guardar la alerta');
    }
  };

  const handleEditAlert = (alert) => {
    setEditingAlert(alert);
    setFormData({
      material_id: alert.material_id,
      alert_type: alert.alert_type,
      alert_threshold: alert.alert_threshold.toString(),
      alert_message: alert.alert_message || '',
    });
    setShowForm(true);
  };

  const handleDeleteAlert = async (id) => {
    if (!confirm('¿Eliminar esta alerta?')) return;

    try {
      const response = await fetch(`/api/material-alerts?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAlerts(alerts.filter((a) => a.id !== id));
        alert('✓ Alerta eliminada');
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      alert('Error al eliminar la alerta');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAlert(null);
    setFormData({
      material_id: '',
      alert_type: 'LOW_STOCK',
      alert_threshold: '',
      alert_message: '',
    });
  };

  const getMaterialStatus = (materialId) => {
    const alert = alerts.find((a) => a.material_id === materialId);
    if (!alert) return null;
    const material = materials.find((m) => m.id === materialId);
    if (!material) return null;

    const triggered =
      material.quantity_available <= alert.alert_threshold;
    return {
      triggered,
      percentage: (
        (material.quantity_available / alert.alert_threshold) *
        100
      ).toFixed(1),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <AlertCircle className="text-red-600" />
              Configuración de Alertas de Materiales
            </h1>
            <p className="text-gray-600 mt-2">
              Define umbrales de alerta para recibir notificaciones cuando el
              stock sea bajo
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Nueva Alerta
          </button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingAlert
                    ? 'Editar Alerta'
                    : 'Crear Nueva Alerta'}
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddAlert} className="space-y-4">
                {!editingAlert && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Material *
                    </label>
                    <select
                      value={formData.material_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          material_id: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                    >
                      <option value="">Selecciona un material</option>
                      {materials.map((mat) => (
                        <option key={mat.id} value={mat.id}>
                          {mat.material_name} (Stock: {mat.quantity_available})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!editingAlert && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Alerta *
                    </label>
                    <select
                      value={formData.alert_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          alert_type: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                    >
                      <option value="LOW_STOCK">Stock Bajo</option>
                      <option value="OUT_OF_STOCK">Sin Stock</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Umbral de Alerta (cantidad) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.alert_threshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        alert_threshold: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                    placeholder="Ej: 50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mensaje de Alerta
                  </label>
                  <textarea
                    value={formData.alert_message}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        alert_message: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                    placeholder="Ej: Reabastecer inmediatamente"
                    rows="3"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Save size={18} />
                    {editingAlert ? 'Guardar Cambios' : 'Crear Alerta'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Alerts Grid */}
        <div className="grid grid-cols-1 gap-4">
          {alerts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600">
                No hay alertas configuradas. Crea una nueva alerta para
                empezar.
              </p>
            </div>
          ) : (
            alerts.map((alert) => {
              const material = materials.find(
                (m) => m.id === alert.material_id
              );
              const status = getMaterialStatus(alert.material_id);

              return (
                <div
                  key={alert.id}
                  className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                    status?.triggered
                      ? 'border-l-red-600'
                      : 'border-l-green-600'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {material?.material_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Categoría: {material?.category}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditAlert(alert)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-600">Stock Actual</p>
                      <p className="text-lg font-bold text-gray-900">
                        {material?.quantity_available}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Umbral</p>
                      <p className="text-lg font-bold text-gray-900">
                        {alert.alert_threshold}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Estado</p>
                      <p
                        className={`text-lg font-bold ${
                          status?.triggered
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        {status?.triggered ? 'ALERTA' : 'Normal'}
                      </p>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          status?.triggered
                            ? 'bg-red-600'
                            : 'bg-green-600'
                        }`}
                        style={{
                          width: `${Math.min(
                            (material?.quantity_available /
                              alert.alert_threshold) *
                              100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {status?.percentage}% del umbral
                    </p>
                  </div>

                  {alert.alert_message && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                      <p className="text-sm text-blue-900">
                        <strong>Nota:</strong> {alert.alert_message}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
