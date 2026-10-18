'use client';

import { useState, useEffect } from 'react';
import { Trash2, Edit2, Plus } from 'lucide-react';

export default function PalletConfigurationPage() {
  const [configs, setConfigs] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [gastosList, setGastosList] = useState([]);
  const [measurementUnits, setMeasurementUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [showCostSources, setShowCostSources] = useState(true);
  const [showUnitsSection, setShowUnitsSection] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formData, setFormData] = useState({
    pallet_name: '',
    pallet_type: '',
    boxes_capacity: '',
    total_weight_kg: '',
    description: '',
    destino: '',
    presentacion: '',
    kg_por_caja: 10,
    cajas_por_tarima: 96,
    materials: []
  });

  const [selectedMaterial, setSelectedMaterial] = useState({
    material_id: '',
    quantity_required: '',
    unit: '',
    cost_source_type: 'inventory',
    cost_source_id: '',
    cost_unit: 'unidad'
  });

  const refreshAll = () => {
    loadConfigs();
    loadMaterials();
    loadCostSourcesAndUnits();
    loadLinkedStats();
    // broadcast to dependents
    try { localStorage.setItem('__data_refresh__', Date.now().toString()); localStorage.removeItem('__data_refresh__'); } catch(_) {}
  };

  useEffect(() => {
    const loadAll = () => { refreshAll(); };
    loadAll();

    // sync with other modules on focus and local changes
    const onFocus = () => loadAll();
    const onStorage = (e) => { if (e.key === '__data_refresh__') loadAll(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshKey]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pallet-configurations');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
      }
    } catch (err) {
      setError('Error al cargar configuraciones');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      const res = await fetch('/api/materials');
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch (err) {
      console.error('Error loading materials:', err);
    }
  };

  const loadCostSourcesAndUnits = async () => {
    try {
      const [puRes, gaRes, muRes] = await Promise.all([
        fetch('/api/purchase-orders'),
        fetch('/api/expenses'),
        fetch('/api/measurement-units')
      ]);
      if (puRes.ok) {
        const pu = await puRes.json();
        setPurchases(Array.isArray(pu) ? pu : []);
      }
      if (gaRes.ok) {
        const ga = await gaRes.json();
        setGastosList(Array.isArray(ga) ? ga : []);
      }
      if (muRes.ok) {
        const mu = await muRes.json();
        setMeasurementUnits(Array.isArray(mu) ? mu : []);
      }
    } catch (err) {
      console.error('Error loading cost sources:', err);
    }
  };

  const handleAddMaterial = () => {
    if (selectedMaterial.material_id && selectedMaterial.quantity_required) {
      setFormData({
        ...formData,
        materials: [
          ...formData.materials,
          {
            ...selectedMaterial,
            material_id: parseInt(selectedMaterial.material_id),
            quantity_required: parseFloat(selectedMaterial.quantity_required)
          }
        ]
      });
      setSelectedMaterial({ material_id: '', quantity_required: '', unit: '' });
    }
  };

  const handleRemoveMaterial = (index) => {
    setFormData({
      ...formData,
      materials: formData.materials.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.pallet_name) {
      setError('El nombre de la tarima es requerido');
      return;
    }

    try {
      setLoading(true);
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId
        ? { ...formData, id: editingId }
        : formData;

      const res = await fetch('/api/pallet-configurations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setSuccess(
          editingId
            ? 'Configuración actualizada exitosamente'
            : 'Configuración creada exitosamente'
        );
        setFormData({
          pallet_name: '',
          pallet_type: '',
          boxes_capacity: '',
          total_weight_kg: '',
          description: '',
          materials: []
        });
        setEditingId(null);
        setShowForm(false);
        loadConfigs();
        setRefreshKey(k => k + 1);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Error al guardar configuración');
      }
    } catch (err) {
      setError('Error al guardar configuración');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config) => {
    setEditingId(config.id);
    setFormData({
      pallet_name: config.pallet_name,
      pallet_type: config.pallet_type || '',
      boxes_capacity: config.boxes_capacity || '',
      total_weight_kg: config.total_weight_kg || '',
      description: config.description || '',
      materials: config.materials || []
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta configuración?')) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/pallet-configurations?id=${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setSuccess('Configuración eliminada exitosamente');
        loadConfigs();
        setRefreshKey(k => k + 1);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Error al eliminar configuración');
      }
    } catch (err) {
      setError('Error al eliminar configuración');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMaterialName = (materialId) => {
    const material = materials.find(m => m.id === materialId);
    return material ? material.material_name : 'Material no encontrado';
  };

  const [linkedStats, setLinkedStats] = useState({ materialsUsed: 0, palletsInInventory: 0, fruitBatches: 0 });

  useEffect(() => {
    // Load linkage stats with inventories and production modules
    loadLinkedStats();
  }, [refreshKey]);

  const loadLinkedStats = async () => {
    try {
      const [materialsRes, palletsRes, lotsRes] = await Promise.all([
        fetch('/api/materials'),
        fetch('/api/pallet-output'),
        fetch('/api/lots')
      ]);
      const mats = materialsRes.ok ? await materialsRes.json() : [];
      const pals = palletsRes.ok ? await palletsRes.json() : [];
      const lots = lotsRes.ok ? await lotsRes.json() : [];
      setLinkedStats({
        materialsUsed: mats.length || 0,
        palletsInInventory: Array.isArray(pals) ? pals.reduce((sum, p) => sum + (p.pallet_count || 0), 0) : 0,
        fruitBatches: Array.isArray(lots) ? lots.length : 0
      });
    } catch (_) {}
  };

  const navigateTo = (route) => window.location.href = route;

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-black">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-black">Configuración de Tarimas</h1>
            <p className="text-black mt-2">Configura el material necesario para armar una tarima y enlaza con inventario de materiales, inventario de fruta y todos los módulos correspondientes (producción, lotificación, embarques, cierres, etc.)</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                pallet_name: '',
                pallet_type: '',
                boxes_capacity: '',
                total_weight_kg: '',
                description: '',
                materials: []
              });
              setShowForm(!showForm);
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={20} /> Nueva Configuración
          </button>
        </div>

        {/* Enlaces e Integraciones con el Sistema */}
        <div className="bg-white border border-black rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-black">Enlaces con Módulos del Sistema</h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setShowCostSources(!showCostSources)} className="px-2 py-0.5 border rounded">{showCostSources ? 'Ocultar' : 'Mostrar'} Fuentes Costo</button>
              <button onClick={() => setShowUnitsSection(!showUnitsSection)} className="px-2 py-0.5 border rounded">{showUnitsSection ? 'Ocultar' : 'Mostrar'} Unidades</button>
            </div>
          </div>
          {showCostSources && (<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
            <div className="bg-gray-100 p-3 rounded border border-black">
              <div className="font-bold text-black">Inventario de Materiales</div>
              <div>{linkedStats.materialsUsed} materiales disponibles</div>
              <button onClick={() => navigateTo('/materials')} className="text-black underline mt-1">Ir a Inventario Materiales →</button>
            </div>
            <div className="bg-gray-100 p-3 rounded border border-black">
              <div className="font-bold text-black">Inventario de Tarimas</div>
              <div>{linkedStats.palletsInInventory} tarimas en stock</div>
              <button onClick={() => navigateTo('/inventory')} className="text-black underline mt-1">Ir a Inventario Fruta/Tarimas →</button>
            </div>
            <div className="bg-gray-100 p-3 rounded border border-black">
              <div className="font-bold text-black">Lotes de Fruta / Ingreso</div>
              <div>{linkedStats.fruitBatches} lotes registrados</div>
              <button onClick={() => navigateTo('/fruit-input')} className="text-black underline mt-1">Ir a Ingreso de Fruta →</button>
            </div>
            <div className="bg-gray-100 p-3 rounded border border-black">
              <div className="font-bold text-black">Producción & Salidas</div>
              <div>Config. aplica automáticamente en producción</div>
              <button onClick={() => navigateTo('/production')} className="text-black underline mt-1">Ir a Producción →</button>
            </div>
          </div>
          )}
          <div className="text-xs text-black">Las configuraciones crean deducciones automáticas en materiales al registrar tarimas en lotificación/producción. Los datos se reflejan en cierres semanales e inventario de fruta.</div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-black px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-100 border border-green-400 text-black px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8 border border-black">
            <h2 className="text-xl font-bold text-black mb-4">
              {editingId ? 'Editar Configuración' : 'Nueva Configuración de Tarima'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6 text-black">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Nombre de Tarima *
                  </label>
                  <input
                    type="text"
                    value={formData.pallet_name}
                    onChange={(e) =>
                      setFormData({ ...formData, pallet_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-black rounded-lg text-black"
                    placeholder="ej: Tarima 10kg Centroamérica"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Destino / Presentación
                  </label>
                  <input
                    type="text"
                    value={formData.destino}
                    onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
                    className="w-full px-3 py-2 border border-black rounded-lg text-black"
                    placeholder="Centroamérica / Nacional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Kg netos por caja
                  </label>
                  <input
                    type="number"
                    value={formData.kg_por_caja}
                    onChange={(e) => setFormData({ ...formData, kg_por_caja: parseFloat(e.target.value) || 10 })}
                    className="w-full px-3 py-2 border border-black rounded-lg text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Cajas por tarima
                  </label>
                  <input
                    type="number"
                    value={formData.cajas_por_tarima}
                    onChange={(e) => setFormData({ ...formData, cajas_por_tarima: parseInt(e.target.value) || 96 })}
                    className="w-full px-3 py-2 border border-black rounded-lg text-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-black rounded-lg text-black"
                  rows="2"
                  placeholder="Descripción adicional..."
                />
              </div>

              {/* Materials Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-black mb-4">Materiales Necesarios (Enlazado con Inventario de Materiales)</h3>

                {/* Add Material Form */}
                <div className="bg-gray-100 p-4 rounded-lg mb-4 border border-black">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-black mb-1">
                        Material (desde Inventario)
                      </label>
                      <select
                        value={selectedMaterial.material_id}
                        onChange={(e) => {
                          const material = materials.find(
                            m => m.id === parseInt(e.target.value)
                          );
                          setSelectedMaterial({
                            ...selectedMaterial,
                            material_id: e.target.value,
                            unit: material?.unit || ''
                          });
                        }}
                        className="w-full px-3 py-2 border border-black rounded-lg text-black"
                      >
                        <option value="">Selecciona un material</option>
                        {materials.map(mat => (
                          <option key={mat.id} value={mat.id}>
                            {mat.material_name} ({mat.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-black mb-1">
                        Cantidad Requerida
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedMaterial.quantity_required}
                        onChange={(e) =>
                          setSelectedMaterial({
                            ...selectedMaterial,
                            quantity_required: e.target.value
                          })
                        }
                        className="w-full px-3 py-2 border border-black rounded-lg text-black"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddMaterial}
                        className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                      >
                        Agregar Material
                      </button>
                    </div>
                  </div>
                </div>

                {/* Materials List */}
                {formData.materials.length > 0 ? (
                  <div className="space-y-2">
                    {formData.materials.map((material, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-black"
                      >
                        <div>
                          <p className="font-medium text-black">
                            {getMaterialName(material.material_id)}
                          </p>
                          <p className="text-sm text-black">
                            {material.quantity_required} {material.unit}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(index)}
                          className="text-black hover:text-black"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-black text-center py-4">
                    No hay materiales agregados (configura enlazado al módulo inventario de materiales).
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading
                    ? 'Guardando...'
                    : editingId
                    ? 'Actualizar'
                    : 'Crear Configuración'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="bg-gray-300 text-black px-6 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Configurations List */}
        {loading && !showForm ? (
          <div className="text-center py-8 text-black">Cargando...</div>
        ) : configs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-black border border-black">
            No hay configuraciones de tarimas. Crea la primera para enlazar materiales desde el inventario de materiales.
          </div>
        ) : (
          <div className="grid gap-4">
            {configs.map(config => (
              <div key={config.id} className="bg-white rounded-lg shadow-md p-6 border border-black text-black">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-black">
                      {config.pallet_name}
                    </h3>
                    {config.description && (
                      <p className="text-black text-sm mt-1">{config.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(config)}
                      className="text-black hover:text-black"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="text-black hover:text-black"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm text-black">
                  {config.pallet_type && (
                    <div>
                      <p className="text-black">Tipo</p>
                      <p className="font-semibold">{config.pallet_type}</p>
                    </div>
                  )}
                  {config.boxes_capacity && (
                    <div>
                      <p className="text-black">Capacidad</p>
                      <p className="font-semibold">{config.boxes_capacity} cajas</p>
                    </div>
                  )}
                  {config.total_weight_kg && (
                    <div>
                      <p className="text-black">Peso</p>
                      <p className="font-semibold">{config.total_weight_kg} kg</p>
                    </div>
                  )}
                  <div>
                    <p className="text-black">Materiales</p>
                    <p className="font-semibold">{config.material_count || 0}</p>
                  </div>
                </div>

                {/* Materials Table - Enlace real con inventario */}
                {config.materials && config.materials.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="font-semibold text-sm mb-2 text-black">Materiales Requeridos (Inventario de Materiales):</p>
                    <div className="space-y-1">
                      {config.materials.map(material => (
                        <div
                          key={material.id}
                          className="flex justify-between text-sm text-black bg-gray-50 p-2 rounded border border-black"
                        >
                          <span>{material.material_name} ({material.category || 'general'})</span>
                          <span className="font-medium text-black">
                            {material.quantity_required} {material.unit || material.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 mt-3 border-t text-xs text-black flex gap-4">
                  <button onClick={() => navigateTo('/inventory')} className="underline">Ver en Inventario Materiales / Fruta</button>
                  <button onClick={() => navigateTo('/production')} className="underline">Usar en Producción / Lotes</button>
                  <button onClick={() => navigateTo('/embarques')} className="underline">Aplicar en Embarques</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
