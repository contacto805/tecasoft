'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PublicDashboardConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('visual');

  useEffect(() => {
    fetchConfig();
    fetchTemplates();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/public-dashboard-config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/public-dashboard-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/public-dashboard-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        alert('Configuración guardada exitosamente');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const applyTemplate = (template) => {
    const templateConfig = typeof template.config === 'string' 
      ? JSON.parse(template.config) 
      : template.config;
    
    setConfig(prev => ({
      ...prev,
      ...templateConfig,
      template_type: template.template_type
    }));
  };

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <i className="ph ph-arrow-left text-xl"></i>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Configuración Dashboard Público</h1>
              <p className="text-sm text-slate-500 mt-0.5">Personaliza la experiencia de trazabilidad QR</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Guardando...
              </>
            ) : (
              <>
                <i className="ph ph-floppy-disk"></i>
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          
          {/* Left Panel - Configuration */}
          <div className="col-span-8">
            
            {/* Tabs */}
            <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1 mb-6">
              {[
                { id: 'visual', label: 'Diseño Visual', icon: 'ph-palette' },
                { id: 'content', label: 'Contenido', icon: 'ph-text-aa' },
                { id: 'sections', label: 'Secciones', icon: 'ph-squares-four' },
                { id: 'images', label: 'Imágenes', icon: 'ph-images' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <i className={`${tab.icon} text-lg`}></i>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Visual Design Tab */}
            {activeTab === 'visual' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Colores Corporativos</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'primary_color', label: 'Color Principal' },
                    { key: 'secondary_color', label: 'Color Secundario' },
                    { key: 'accent_color', label: 'Color de Acento' },
                    { key: 'text_color', label: 'Color de Texto' },
                    { key: 'background_color', label: 'Color de Fondo' },
                    { key: 'card_background_color', label: 'Fondo de Tarjetas' },
                    { key: 'header_background_color', label: 'Fondo de Encabezado' },
                    { key: 'footer_background_color', label: 'Fondo de Pie de Página' }
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {field.label}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={config[field.key] || '#ffffff'}
                          onChange={(e) => updateConfig(field.key, e.target.value)}
                          className="h-10 w-16 rounded-lg border border-slate-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config[field.key] || '#ffffff'}
                          onChange={(e) => updateConfig(field.key, e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Tipografía</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Tamaño de Título
                      </label>
                      <input
                        type="number"
                        value={config.font_size_title || 24}
                        onChange={(e) => updateConfig('font_size_title', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Tamaño de Cuerpo
                      </label>
                      <input
                        type="number"
                        value={config.font_size_body || 14}
                        onChange={(e) => updateConfig('font_size_body', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content Tab */}
            {activeTab === 'content' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Textos Personalizados</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nombre de la Empresa
                    </label>
                    <input
                      type="text"
                      value={config.company_name || ''}
                      onChange={(e) => updateConfig('company_name', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      placeholder="Ej: Tecavo Fruits"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Texto del Encabezado
                    </label>
                    <input
                      type="text"
                      value={config.header_text || ''}
                      onChange={(e) => updateConfig('header_text', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      placeholder="Ej: Trazabilidad Certificada"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Texto del Pie de Página
                    </label>
                    <input
                      type="text"
                      value={config.footer_text || ''}
                      onChange={(e) => updateConfig('footer_text', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      placeholder="Ej: Calidad garantizada desde el origen"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Mensaje Comercial
                    </label>
                    <textarea
                      value={config.commercial_message || ''}
                      onChange={(e) => updateConfig('commercial_message', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      rows="3"
                      placeholder="Ej: Fruta fresca de la más alta calidad, directamente del huerto a su mesa"
                    ></textarea>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Mensaje de Sustentabilidad
                    </label>
                    <textarea
                      value={config.sustainability_message || ''}
                      onChange={(e) => updateConfig('sustainability_message', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      rows="3"
                      placeholder="Ej: Comprometidos con prácticas sustentables y el cuidado del medio ambiente"
                    ></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* Sections Tab */}
            {activeTab === 'sections' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Activar/Desactivar Secciones</h3>
                
                <div className="space-y-3">
                  {[
                    { key: 'show_origin_data', label: 'Datos de Origen', icon: 'ph-map-pin' },
                    { key: 'show_production_data', label: 'Datos de Producción', icon: 'ph-package' },
                    { key: 'show_commercial_data', label: 'Datos Comerciales', icon: 'ph-storefront' },
                    { key: 'show_certifications', label: 'Certificaciones', icon: 'ph-seal-check' },
                    { key: 'show_sustainability', label: 'Sustentabilidad', icon: 'ph-leaf' },
                    { key: 'show_producer', label: 'Mostrar Productor', icon: 'ph-user' },
                    { key: 'show_orchard', label: 'Mostrar Huerta', icon: 'ph-tree' },
                    { key: 'show_location', label: 'Mostrar Ubicación', icon: 'ph-map-trifold' },
                    { key: 'show_coordinates', label: 'Mostrar Coordenadas', icon: 'ph-crosshair' },
                    { key: 'show_harvest_date', label: 'Mostrar Fecha de Corte', icon: 'ph-calendar' },
                    { key: 'show_packing_date', label: 'Mostrar Fecha de Empaque', icon: 'ph-calendar-check' },
                    { key: 'show_variety', label: 'Mostrar Variedad', icon: 'ph-plant' },
                    { key: 'show_caliber', label: 'Mostrar Calibre', icon: 'ph-ruler' },
                    { key: 'show_weight', label: 'Mostrar Peso', icon: 'ph-barbell' },
                    { key: 'show_quality', label: 'Mostrar Calidad', icon: 'ph-star' },
                    { key: 'show_brand', label: 'Mostrar Marca', icon: 'ph-tag' },
                    { key: 'show_company', label: 'Mostrar Empresa Empacadora', icon: 'ph-buildings' },
                    { key: 'show_message', label: 'Mostrar Mensaje Comercial', icon: 'ph-chat-circle' }
                  ].map(field => (
                    <label 
                      key={field.key}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-3 text-sm font-medium text-slate-700">
                        <i className={`${field.icon} text-lg text-emerald-600`}></i>
                        {field.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={config[field.key] !== false}
                        onChange={(e) => updateConfig(field.key, e.target.checked)}
                        className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Images Tab */}
            {activeTab === 'images' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Imágenes Corporativas</h3>
                
                <div className="space-y-4">
                  {[
                    { key: 'logo_url', label: 'Logotipo Principal' },
                    { key: 'secondary_logo_url', label: 'Logotipo Secundario' },
                    { key: 'header_image_url', label: 'Imagen de Encabezado' },
                    { key: 'product_image_url', label: 'Imagen de Producto' },
                    { key: 'orchard_image_url', label: 'Imagen de Huerta' },
                    { key: 'process_image_url', label: 'Imagen de Proceso' }
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={config[field.key] || ''}
                        onChange={(e) => updateConfig(field.key, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        placeholder="URL de la imagen"
                      />
                      {config[field.key] && (
                        <img 
                          src={config[field.key]} 
                          alt={field.label}
                          className="mt-2 h-20 object-contain border border-slate-200 rounded-lg p-2 bg-slate-50"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Templates & Preview */}
          <div className="col-span-4 space-y-6">
            
            {/* Templates */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Plantillas</h3>
              <div className="space-y-2">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      config.template_type === template.template_type
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-semibold text-slate-900">{template.template_name}</p>
                    <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Info */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
                  <i className="ph ph-eye text-white text-xl"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Vista Previa</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Para ver cómo se verá el dashboard público, escanea un código QR de trazabilidad o utiliza el enlace de prueba.
              </p>
              <p className="text-xs text-slate-500 font-mono bg-white p-2 rounded border border-emerald-200">
                /trazabilidad/[token]
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
