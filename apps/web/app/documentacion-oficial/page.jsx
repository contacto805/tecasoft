'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OfficialDocumentation() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [versions, setVersions] = useState([]);

  const [formData, setFormData] = useState({
    template_name: '',
    description: '',
    document_type: '',
    category: '',
    logo_url: '',
    primary_color: '#024D32',
    secondary_color: '#9E4633',
    accent_color: '#E8D547',
    font_family: 'Inter, sans-serif',
    font_size_title: 24,
    font_size_body: 12,
    font_size_small: 10,
    page_size: 'letter',
    orientation: 'portrait',
    margin_top: 20,
    margin_right: 20,
    margin_bottom: 20,
    margin_left: 20,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/official-documentation/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Error cargando plantillas');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (template) => {
    setSelectedTemplate(template);
    setFormData({
      template_name: template.template_name || '',
      description: template.description || '',
      document_type: template.document_type || '',
      category: template.category || '',
      logo_url: template.logo_url || '',
      primary_color: template.primary_color || '#024D32',
      secondary_color: template.secondary_color || '#9E4633',
      accent_color: template.accent_color || '#E8D547',
      font_family: template.font_family || 'Inter, sans-serif',
      font_size_title: template.font_size_title || 24,
      font_size_body: template.font_size_body || 12,
      font_size_small: template.font_size_small || 10,
      page_size: template.page_size || 'letter',
      orientation: template.orientation || 'portrait',
      margin_top: template.margin_top || 20,
      margin_right: template.margin_right || 20,
      margin_bottom: template.margin_bottom || 20,
      margin_left: template.margin_left || 20,
    });
    setShowEditor(true);
  };

  const handleSaveTemplate = async () => {
    if (!formData.template_name) {
      setError('El nombre de la plantilla es requerido');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const url = selectedTemplate 
        ? '/api/official-documentation/templates' 
        : '/api/official-documentation/templates';
      const method = selectedTemplate ? 'PUT' : 'POST';
      const payload = selectedTemplate 
        ? { id: selectedTemplate.id, ...formData, changed_by: 'superadmin' } 
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar plantilla');
      }

      setSuccess(selectedTemplate ? 'Plantilla actualizada exitosamente' : 'Plantilla creada exitosamente');
      setShowEditor(false);
      loadTemplates();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Error al guardar plantilla');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: 'operacional', label: 'Operacional' },
    { value: 'visual', label: 'Visual / Mapas' },
    { value: 'administrativo', label: 'Administrativo' },
    { value: 'financiero', label: 'Financiero' },
    { value: 'trazabilidad', label: 'Trazabilidad' },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button onClick={() => router.push('/')} className="flex items-center gap-2 text-brand-700 hover:text-brand-800">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center border border-brand-500/20">
                <span className="text-xl">📄</span>
              </div>
              <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">🔒 Módulo de Superadministrador</span>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Page Title */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white text-2xl">
                📋
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Documentación Oficial</h1>
                <p className="text-slate-500 mt-1">Editor central de plantillas y documentos del sistema</p>
              </div>
            </div>
          </section>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-start gap-2">
              <span className="text-lg">✓</span>
              <span>{success}</span>
            </div>
          )}

          {/* Template Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-400 transition-all p-6 cursor-pointer"
                onClick={() => handleEditTemplate(template)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{template.template_name}</h3>
                    <p className="text-sm text-slate-500">{template.description || 'Sin descripción'}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${template.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {template.is_active ? 'Activo' : 'Inactivo'}
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Categoría:</span>
                    <span className="font-medium text-slate-700">{template.category || 'Sin categoría'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Tipo:</span>
                    <span className="font-medium text-slate-700">{template.document_type || 'General'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs mt-3">
                    <div className="w-6 h-6 rounded border border-slate-200" style={{ backgroundColor: template.primary_color }}></div>
                    <div className="w-6 h-6 rounded border border-slate-200" style={{ backgroundColor: template.secondary_color }}></div>
                    <div className="w-6 h-6 rounded border border-slate-200" style={{ backgroundColor: template.accent_color }}></div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 text-sm">
                    ✏️ Editar
                  </button>
                  <button className="px-3 py-2 bg-slate-50 text-slate-700 font-medium rounded-lg hover:bg-slate-100 text-sm">
                    📋 Duplicar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {templates.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No hay plantillas configuradas</h3>
              <p className="text-slate-500">Las plantillas se crearán automáticamente al generar documentos</p>
            </div>
          )}
        </div>
      </main>

      {/* Template Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white flex items-center justify-between sticky top-0 z-10">
              <div>
                <h2 className="text-2xl font-bold">✏️ Editor de Plantilla</h2>
                <p className="text-blue-100 mt-1">Configura logotipo, colores, tamaños y distribución</p>
              </div>
              <button onClick={() => setShowEditor(false)} className="text-white hover:bg-blue-800 rounded-lg p-2">✕</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Información General</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Plantilla *</label>
                    <input
                      type="text"
                      value={formData.template_name}
                      onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ej. Orden de Corte"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Seleccionar categoría</option>
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    placeholder="Descripción breve de la plantilla"
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Colores Corporativos</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Color Primario</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Color Secundario</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.secondary_color}
                        onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                        className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.secondary_color}
                        onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Color de Acento</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.accent_color}
                        onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                        className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.accent_color}
                        onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Tipografía</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fuente</label>
                    <select
                      value={formData.font_family}
                      onChange={(e) => setFormData({ ...formData, font_family: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="Inter, sans-serif">Inter</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Helvetica, sans-serif">Helvetica</option>
                      <option value="Times New Roman, serif">Times New Roman</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Título (pt)</label>
                    <input
                      type="number"
                      value={formData.font_size_title}
                      onChange={(e) => setFormData({ ...formData, font_size_title: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cuerpo (pt)</label>
                    <input
                      type="number"
                      value={formData.font_size_body}
                      onChange={(e) => setFormData({ ...formData, font_size_body: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Page Setup */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Configuración de Página</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tamaño de Página</label>
                    <select
                      value={formData.page_size}
                      onChange={(e) => setFormData({ ...formData, page_size: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="letter">Carta (Letter)</option>
                      <option value="legal">Legal</option>
                      <option value="a4">A4</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Orientación</label>
                    <select
                      value={formData.orientation}
                      onChange={(e) => setFormData({ ...formData, orientation: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="portrait">Vertical (Portrait)</option>
                      <option value="landscape">Horizontal (Landscape)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Márgenes (mm)</label>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Superior</label>
                      <input
                        type="number"
                        value={formData.margin_top}
                        onChange={(e) => setFormData({ ...formData, margin_top: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Derecho</label>
                      <input
                        type="number"
                        value={formData.margin_right}
                        onChange={(e) => setFormData({ ...formData, margin_right: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Inferior</label>
                      <input
                        type="number"
                        value={formData.margin_bottom}
                        onChange={(e) => setFormData({ ...formData, margin_bottom: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Izquierdo</label>
                      <input
                        type="number"
                        value={formData.margin_left}
                        onChange={(e) => setFormData({ ...formData, margin_left: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex gap-3 justify-end sticky bottom-0">
              <button
                onClick={() => setShowEditor(false)}
                className="px-6 py-2 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-100 border border-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300"
              >
                {loading ? '⏳ Guardando...' : '✓ Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
