'use client';

import { useEffect, useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';

export default function TemplateEditorPage() {
  const [templates, setTemplates] = useState([]);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    checkSuperAdmin();
    fetchUser();
  }, []);

  useEffect(() => {
    if (userId) fetchTemplates();
  }, [userId]);

  const checkSuperAdmin = async () => {
    try {
      const res = await fetch('/api/auth/check-super-admin');
      const data = await res.json();
      setIsSuperAdmin(data.isSuperAdmin);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/user');
      const data = await res.json();
      setUserId(data.id);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`/api/dashboard-templates?user_id=${userId}`);
      const data = await res.json();
      setTemplates(data || []);
      if (data && data.length > 0 && !currentTemplate) {
        setCurrentTemplate(data[0]);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!currentTemplate.template_name) {
      alert('Por favor ingresa un nombre para la plantilla');
      return;
    }

    setLoading(true);
    try {
      const method = currentTemplate.id ? 'PUT' : 'POST';
      const body = {
        ...currentTemplate,
        user_id: userId
      };

      const res = await fetch('/api/dashboard-templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const saved = await res.json();
        if (currentTemplate.id) {
          setTemplates(templates.map(t => t.id === saved.id ? saved : t));
        } else {
          setTemplates([saved, ...templates]);
        }
        setCurrentTemplate(saved);
        setShowForm(false);
        alert('Plantilla guardada exitosamente');
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar la plantilla');
    } finally {
      setLoading(false);
    }
  };

  const handleNewTemplate = () => {
    setCurrentTemplate({
      template_name: '',
      template_type: 'default',
      header_text: 'Detalles del Lote',
      footer_text: 'Sistema de Trazabilidad Tecavo Fruits',
      show_logo: true,
      show_qr: true,
      show_caliber: true,
      show_weight: true,
      show_producer: true,
      show_date: true,
      show_grade: true,
      background_color: '#ffffff',
      text_color: '#000000',
      accent_color: '#0066cc'
    });
    setShowForm(true);
  };

  const handleSelectTemplate = (template) => {
    setCurrentTemplate(template);
    setShowForm(false);
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-900 mb-2">Acceso Denegado</h1>
          <p className="text-red-700">Solo los administradores pueden acceder a este módulo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="max-w-6xl mx-auto px-4">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Editor de Plantillas de Dashboard Público</h1>
          <p className="text-slate-500 mt-2">Personaliza la apariencia del dashboard público de lotes</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          
          {/* Templates List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-fit">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-900">Plantillas ({templates.length})</h2>
              <button
                onClick={handleNewTemplate}
                className="px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-1"
              >
                <Plus size={16} /> Nueva
              </button>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                    currentTemplate?.id === template.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''
                  }`}
                >
                  <p className="font-medium text-slate-900">{template.template_name}</p>
                  <p className="text-xs text-slate-500 mt-1">{template.template_type}</p>
                  {template.is_active && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded">
                      Activa
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Template Editor */}
          <div className="col-span-2">
            {currentTemplate && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <form onSubmit={handleSaveTemplate} className="space-y-6">
                  
                  {/* Basic Settings */}
                  <div>
                    <h3 className="font-bold text-slate-900 mb-4">Configuración Básica</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Nombre de Plantilla
                        </label>
                        <input
                          type="text"
                          value={currentTemplate.template_name}
                          onChange={(e) => setCurrentTemplate({ ...currentTemplate, template_name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="Ej: Plantilla Premium"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Encabezado
                        </label>
                        <input
                          type="text"
                          value={currentTemplate.header_text}
                          onChange={(e) => setCurrentTemplate({ ...currentTemplate, header_text: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="Ej: Detalles del Lote"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Pie de Página
                        </label>
                        <input
                          type="text"
                          value={currentTemplate.footer_text}
                          onChange={(e) => setCurrentTemplate({ ...currentTemplate, footer_text: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="Ej: Sistema de Trazabilidad"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Color Settings */}
                  <div>
                    <h3 className="font-bold text-slate-900 mb-4">Colores</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Fondo
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={currentTemplate.background_color}
                            onChange={(e) => setCurrentTemplate({ ...currentTemplate, background_color: e.target.value })}
                            className="w-16 h-10 rounded cursor-pointer border border-slate-200"
                          />
                          <input
                            type="text"
                            value={currentTemplate.background_color}
                            onChange={(e) => setCurrentTemplate({ ...currentTemplate, background_color: e.target.value })}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded text-sm font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Texto
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={currentTemplate.text_color}
                            onChange={(e) => setCurrentTemplate({ ...currentTemplate, text_color: e.target.value })}
                            className="w-16 h-10 rounded cursor-pointer border border-slate-200"
                          />
                          <input
                            type="text"
                            value={currentTemplate.text_color}
                            onChange={(e) => setCurrentTemplate({ ...currentTemplate, text_color: e.target.value })}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded text-sm font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Acento
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={currentTemplate.accent_color}
                            onChange={(e) => setCurrentTemplate({ ...currentTemplate, accent_color: e.target.value })}
                            className="w-16 h-10 rounded cursor-pointer border border-slate-200"
                          />
                          <input
                            type="text"
                            value={currentTemplate.accent_color}
                            onChange={(e) => setCurrentTemplate({ ...currentTemplate, accent_color: e.target.value })}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded text-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visibility Settings */}
                  <div>
                    <h3 className="font-bold text-slate-900 mb-4">Elementos a Mostrar</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'show_logo', label: 'Logo' },
                        { key: 'show_qr', label: 'Código QR' },
                        { key: 'show_producer', label: 'Productor' },
                        { key: 'show_caliber', label: 'Calibre' },
                        { key: 'show_weight', label: 'Peso' },
                        { key: 'show_date', label: 'Fecha' },
                        { key: 'show_grade', label: 'Grados' }
                      ].map(item => (
                        <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentTemplate[item.key]}
                            onChange={(e) => setCurrentTemplate({ ...currentTemplate, [item.key]: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-slate-700">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <h3 className="font-bold text-slate-900 mb-4">Vista Previa</h3>
                    <div
                      className="rounded-lg p-6 border-2 overflow-hidden"
                      style={{
                        backgroundColor: currentTemplate.background_color,
                        borderColor: currentTemplate.accent_color,
                        color: currentTemplate.text_color
                      }}
                    >
                      <div style={{ backgroundColor: currentTemplate.accent_color }} className="p-4 rounded text-white text-center mb-4">
                        <p className="font-bold">{currentTemplate.header_text}</p>
                      </div>
                      <div className="space-y-2 mb-4">
                        <p>Contenido del lote aparecerá aquí</p>
                        <p className="text-sm opacity-75">Información del productor, peso, calibre, etc.</p>
                      </div>
                      <div className="text-center text-sm opacity-75 pt-4 border-t" style={{ borderColor: currentTemplate.accent_color }}>
                        {currentTemplate.footer_text}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <Save size={18} />
                      {loading ? 'Guardando...' : 'Guardar Plantilla'}
                    </button>
                    {currentTemplate.id && (
                      <button
                        type="button"
                        className="px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
                      >
                        <Trash2 size={18} />
                        Eliminar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
