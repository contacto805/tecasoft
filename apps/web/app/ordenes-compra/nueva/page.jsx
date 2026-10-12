"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NuevaSolicitudPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [catalogs, setCatalogs] = useState({ areas: [], categories: [], suppliers: [] });
  const [formData, setFormData] = useState({
    areaId: '',
    areaName: '',
    userName: '',
    supervisorName: '',
    purchaseType: '',
    categoryId: '',
    categoryName: '',
    productOrService: '',
    description: '',
    unitOfMeasure: '',
    quantityRequired: '',
    quantityMinimum: '',
    quantitySuggested: '',
    priority: 'media',
    justification: '',
    requiredDate: ''
  });

  useEffect(() => {
    fetchCatalogs();
    
    // Obtener usuario actual si está disponible
    const currentUser = sessionStorage.getItem('userName') || localStorage.getItem('userName');
    if (currentUser) {
      setFormData(prev => ({ ...prev, userName: currentUser }));
    }
  }, []);

  const fetchCatalogs = async () => {
    try {
      const response = await fetch('/api/purchase-catalogs');
      if (response.ok) {
        const data = await response.json();
        setCatalogs(data);
      }
    } catch (error) {
      console.error('Error fetching catalogs:', error);
    }
  };

  const handleAreaChange = (e) => {
    const areaId = e.target.value;
    const area = catalogs.areas.find(a => a.id === parseInt(areaId));
    setFormData({
      ...formData,
      areaId,
      areaName: area?.area_name || ''
    });
  };

  const handleCategoryChange = (e) => {
    const categoryId = e.target.value;
    const category = catalogs.categories.find(c => c.id === parseInt(categoryId));
    setFormData({
      ...formData,
      categoryId,
      categoryName: category?.category_name || '',
      purchaseType: category?.category_type || ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.areaId || !formData.userName || !formData.productOrService || !formData.justification) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/purchase-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Solicitud ${result.folio} creada exitosamente`);
        router.push('/ordenes-compra');
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Error al crear la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/ordenes-compra')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            ← Regresar
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Nueva Solicitud de Compra</h1>
          <p className="text-gray-600">Complete el formulario para generar una requisición</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8">
          {/* Información General */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Información General</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Área Solicitante <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.areaId}
                  onChange={handleAreaChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccione un área</option>
                  {catalogs.areas.map(area => (
                    <option key={area.id} value={area.id}>{area.area_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Usuario Solicitante <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supervisor Responsable</label>
                <input
                  type="text"
                  value={formData.supervisorName}
                  onChange={(e) => setFormData({ ...formData, supervisorName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                <select
                  value={formData.categoryId}
                  onChange={handleCategoryChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccione una categoría</option>
                  {catalogs.categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.category_name} ({cat.category_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Información del Material */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Información del Material/Servicio</h2>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Producto o Servicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.productOrService}
                  onChange={(e) => setFormData({ ...formData, productOrService: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Cajas de cartón 40x30x20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción Detallada</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Especificaciones técnicas, características, etc."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unidad de Medida</label>
                  <input
                    type="text"
                    value={formData.unitOfMeasure}
                    onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: piezas, kg, litros"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad Requerida</label>
                  <input
                    type="number"
                    value={formData.quantityRequired}
                    onChange={(e) => setFormData({ ...formData, quantityRequired: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad Mínima</label>
                  <input
                    type="number"
                    value={formData.quantityMinimum}
                    onChange={(e) => setFormData({ ...formData, quantityMinimum: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad Sugerida</label>
                  <input
                    type="number"
                    value={formData.quantitySuggested}
                    onChange={(e) => setFormData({ ...formData, quantitySuggested: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Prioridad y Justificación */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Prioridad y Justificación</h2>
            <div className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridad <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Requerida</label>
                  <input
                    type="date"
                    value={formData.requiredDate}
                    onChange={(e) => setFormData({ ...formData, requiredDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Justificación <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Motivo de la compra, riesgo por no adquirirla, beneficio esperado"
                />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/ordenes-compra')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-400"
            >
              {loading ? 'Creando...' : 'Crear Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
