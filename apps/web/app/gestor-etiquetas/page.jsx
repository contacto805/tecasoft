'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function GestorEtiquetasPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    template_code: '',
    template_name: '',
    category_id: '',
    template_type: 'thermal_label',
    description: '',
    width_mm: 100,
    height_mm: 50,
    orientation: 'vertical'
  });

  useEffect(() => {
    fetchCategories();
    fetchTemplates();
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/templates/categories');
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('categoryId', selectedCategory);
      
      const response = await fetch(`/api/templates?${params.toString()}`);
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    if (!newTemplate.template_code || !newTemplate.template_name || !newTemplate.category_id) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTemplate,
          created_by: 'Admin'
        })
      });

      if (response.ok) {
        const created = await response.json();
        setShowCreateModal(false);
        setNewTemplate({
          template_code: '',
          template_name: '',
          category_id: '',
          template_type: 'thermal_label',
          description: '',
          width_mm: 100,
          height_mm: 50,
          orientation: 'vertical'
        });
        fetchTemplates();
        // Redirect to editor
        router.push(`/gestor-etiquetas/editor/${created.id}`);
      } else {
        alert('Error al crear la plantilla');
      }
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Error al crear la plantilla');
    }
  };

  const deleteTemplate = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;

    try {
      await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Error al eliminar la plantilla');
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.template_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.template_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      {/* Top Navigation */}
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
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium text-sm"
            >
              <i className="ph ph-house mr-2"></i>
              Inicio
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          
          {/* Header */}
          <section className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <i className="ph ph-tag text-brand-600"></i>
                Gestor de Etiquetas y Formatos
              </h1>
              <p className="text-slate-500 mt-1">Editor profesional como Word / Canva / Zebra Designer / Bartender — Etiquetas térmicas, documentos, tickets de producción y formatos corporativos</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => router.push('/gestor-etiquetas/asignaciones')}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
              >
                <i className="ph ph-users-three"></i>
                Asignar por Cliente
              </button>
              <button 
                onClick={() => router.push('/gestor-etiquetas/impresoras')}
                className="px-6 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 shadow-sm transition-all flex items-center gap-2"
              >
                <i className="ph ph-printer"></i>
                Impresoras
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 shadow-sm transition-all flex items-center gap-2"
              >
                <i className="ph ph-plus-circle"></i>
                Nueva Plantilla
              </button>
            </div>
          </section>

          {/* Filters */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Buscar plantilla</label>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre o código..." 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Categoría</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Templates Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <i className="ph ph-spinner text-4xl animate-spin mb-4"></i>
                <div>Cargando plantillas...</div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <i className="ph ph-file-dashed text-5xl mb-4"></i>
                <div>No se encontraron plantillas</div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-6 py-3 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700"
                >
                  Crear Primera Plantilla
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {filteredTemplates.map((template) => (
                  <div 
                    key={template.id} 
                    className="border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-all bg-white"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center">
                        <i className={`ph ${template.category_icon || 'ph-tag'} text-2xl text-brand-600`}></i>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        template.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {template.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    
                    <h3 className="font-bold text-lg text-slate-900 mb-1">{template.template_name}</h3>
                    <p className="text-sm text-slate-500 mb-2">Código: {template.template_code}</p>
                    <p className="text-xs text-slate-400 mb-4">{template.category_name}</p>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                      <i className="ph ph-ruler"></i>
                      <span>{template.width_mm} x {template.height_mm} mm</span>
                      <span className="mx-1">•</span>
                      <span>v{template.version}</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/gestor-etiquetas/editor/${template.id}`)}
                        className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm flex items-center justify-center gap-1"
                      >
                        <i className="ph ph-pencil"></i>
                        <span>Diseñar</span>
                      </button>
                      <button
                        onClick={() => router.push(`/gestor-etiquetas/preview/${template.id}`)}
                        className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium text-sm flex items-center justify-center gap-1"
                      >
                        <i className="ph ph-eye"></i>
                        <span>Previsualizar</span>
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                      >
                        <i className="ph ph-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">Nueva Plantilla</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <i className="ph ph-x text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Código *</label>
                  <input
                    type="text"
                    value={newTemplate.template_code}
                    onChange={(e) => setNewTemplate({...newTemplate, template_code: e.target.value})}
                    placeholder="Ej. ETQ-001"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nombre *</label>
                  <input
                    type="text"
                    value={newTemplate.template_name}
                    onChange={(e) => setNewTemplate({...newTemplate, template_name: e.target.value})}
                    placeholder="Ej. Etiqueta Pallet Principal"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Categoría *</label>
                <select
                  value={newTemplate.category_id}
                  onChange={(e) => setNewTemplate({...newTemplate, category_id: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                >
                  <option value="">Seleccionar categoría...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Descripción</label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                  placeholder="Descripción de la plantilla..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Ancho (mm)</label>
                  <input
                    type="number"
                    value={newTemplate.width_mm}
                    onChange={(e) => setNewTemplate({...newTemplate, width_mm: parseInt(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Alto (mm)</label>
                  <input
                    type="number"
                    value={newTemplate.height_mm}
                    onChange={(e) => setNewTemplate({...newTemplate, height_mm: parseInt(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Orientación</label>
                  <select
                    value={newTemplate.orientation}
                    onChange={(e) => setNewTemplate({...newTemplate, orientation: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  >
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end sticky bottom-0 bg-white">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={createTemplate}
                className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium"
              >
                Crear y Diseñar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
