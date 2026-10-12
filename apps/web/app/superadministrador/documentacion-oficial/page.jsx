'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OfficialDocumentationPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [variables, setVariables] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    loadTemplates();
    loadVariables();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/document-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadVariables = async () => {
    try {
      const response = await fetch('/api/document-variables');
      if (response.ok) {
        const data = await response.json();
        setVariables(data);
      }
    } catch (error) {
      console.error('Error loading variables:', error);
    }
  };

  const loadVersions = async (templateId) => {
    try {
      const response = await fetch(`/api/document-templates/${templateId}/versions`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
        setShowVersionsModal(true);
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  };

  const handleCreateTemplate = async (formData) => {
    setLoading(true);
    try {
      const response = await fetch('/api/document-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error creando plantilla');
      }

      alert('✓ Plantilla creada exitosamente');
      setShowCreateModal(false);
      loadTemplates();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('¿Eliminar esta plantilla? Esta acción no se puede deshacer.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/document-templates/${templateId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error eliminando plantilla');
      }

      alert('✓ Plantilla eliminada exitosamente');
      loadTemplates();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const documentTypes = [
    { id: 'orden_corte', name: 'Orden de Corte' },
    { id: 'recepcion_fruta', name: 'Recepción de Fruta' },
    { id: 'ticket_bascula', name: 'Ticket de Báscula' },
    { id: 'reporte_ingreso', name: 'Reporte de Ingreso' },
    { id: 'reporte_produccion', name: 'Reporte de Producción' },
    { id: 'reporte_seleccion', name: 'Reporte de Selección' },
    { id: 'reporte_rendimiento', name: 'Reporte de Rendimiento por Lote' },
    { id: 'reporte_inventario', name: 'Reporte de Inventario' },
    { id: 'reporte_almacen', name: 'Reporte de Almacén' },
    { id: 'mapa_almacen', name: 'Reporte Visual de Mapa de Almacén' },
    { id: 'mapa_carga', name: 'Reporte Visual de Mapa de Carga' },
    { id: 'trailer_box', name: 'Reporte Visual de Caja de Tráiler' },
    { id: 'piso_produccion', name: 'Reporte Visual de Piso de Producción' },
    { id: 'nota_venta', name: 'Nota de Venta' },
    { id: 'carga', name: 'Carga' },
    { id: 'remision', name: 'Remisión' },
    { id: 'salida_proceso', name: 'Salida de Proceso' },
    { id: 'salida_desecho', name: 'Salida de Desecho' },
    { id: 'salida_merma', name: 'Salida de Merma' },
    { id: 'requisicion', name: 'Requisición' },
    { id: 'gasto', name: 'Gasto' },
    { id: 'comprobante_gasto', name: 'Comprobante de Gasto' },
    { id: 'nomina_semanal', name: 'Nómina Semanal' },
    { id: 'prestamo_trabajador', name: 'Préstamo o Adelanto de Trabajador' },
    { id: 'abono_prestamo', name: 'Abono o Descuento de Préstamo' },
    { id: 'cierre_semanal', name: 'Cierre Semanal' },
    { id: 'utilidad_perdida_lote', name: 'Reporte de Utilidad o Pérdida por Lote' },
    { id: 'costos_operativos', name: 'Reporte de Costos Operativos' },
    { id: 'dashboard_qr_publico', name: 'Dashboard QR Público' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => router.push('/superadministrador')}
            className="flex items-center gap-2 text-purple-700 font-bold text-lg"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center border border-purple-500/20">
              📄
            </div>
            Documentación Oficial
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setShowVariablesModal(true)}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200"
            >
              📋 Variables Dinámicas
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700"
            >
              ➕ Nueva Plantilla
            </button>
          </div>
        </div>
      </header>

      <main className="pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Gestión de Documentos Oficiales</h1>
            <p className="text-slate-500 mt-1">Administra plantillas, diseños y configuraciones de todos los documentos del sistema</p>
          </section>

          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-xl border-2 border-yellow-300 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🔒</span>
              <div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">Módulo Exclusivo de Superadministrador</h3>
                <p className="text-sm text-slate-700 mb-3">Este módulo es privado y solo accesible para usuarios con privilegios de Superadministrador.</p>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>✓ Configura logotipos, colores, fuentes y distribución de documentos</li>
                  <li>✓ Edita plantillas con variables dinámicas</li>
                  <li>✓ Controla el versionado y restaura versiones anteriores</li>
                  <li>✓ Todos los documentos del sistema dependen de estas configuraciones</li>
                </ul>
              </div>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No hay plantillas creadas</h3>
              <p className="text-slate-500 mb-6">Crea tu primera plantilla de documento haciendo clic en "Nueva Plantilla"</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700"
              >
                ➕ Crear Primera Plantilla
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map(template => (
                <div key={template.id} className="bg-white p-6 rounded-xl border-2 border-slate-200 hover:border-purple-300 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-slate-900">{template.template_name}</h3>
                      <p className="text-sm text-slate-600 mt-1">{template.document_type}</p>
                      {template.description && (
                        <p className="text-xs text-slate-500 mt-2">{template.description}</p>
                      )}
                    </div>
                    {template.is_default && (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                        DEFAULT
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-4 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: template.primary_color || '#024D32' }}></div>
                      <span>Color primario: {template.primary_color || '#024D32'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📐 {template.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} ({template.page_size || 'A4'})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🖋️ {template.font_family || 'Arial'} ({template.font_size_title || 18}pt / {template.font_size_body || 12}pt)</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedTemplate(template);
                        // Aquí abrirías el editor de plantilla
                      }}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => loadVersions(template.id)}
                      className="px-3 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200"
                      title="Ver historial de versiones"
                    >
                      🕒
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      disabled={loading}
                      className="px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 disabled:opacity-50"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Variables Modal */}
      {showVariablesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowVariablesModal(false)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <h2 className="text-2xl font-bold">Variables Dinámicas Disponibles</h2>
              <p className="text-purple-100 mt-1">Usa estas variables en tus plantillas con la sintaxis {`{{variable_code}}`}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {['empresa', 'documento', 'lote', 'produccion', 'venta'].map(category => {
                  const categoryVars = variables.filter(v => v.variable_category === category);
                  if (categoryVars.length === 0) return null;

                  return (
                    <div key={category}>
                      <h3 className="font-bold text-lg text-slate-900 mb-3 capitalize">{category}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {categoryVars.map(variable => (
                          <div key={variable.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex items-start justify-between mb-1">
                              <code className="text-sm font-mono text-purple-600">{`{{${variable.variable_code}}}`}</code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`{{${variable.variable_code}}}`);
                                  alert('Copiado al portapapeles');
                                }}
                                className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200"
                              >
                                Copiar
                              </button>
                            </div>
                            <p className="text-xs font-medium text-slate-900">{variable.variable_name}</p>
                            <p className="text-xs text-slate-500 mt-1">{variable.description}</p>
                            <p className="text-xs text-slate-400 mt-1">Ejemplo: {variable.example_value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowVariablesModal(false)}
                className="w-full px-4 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTemplate}
          documentTypes={documentTypes}
          loading={loading}
        />
      )}

      {/* Versions Modal */}
      {showVersionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowVersionsModal(false)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <h2 className="text-2xl font-bold">Historial de Versiones</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {versions.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No hay versiones anteriores</p>
              ) : (
                <div className="space-y-4">
                  {versions.map(version => (
                    <div key={version.id} className="p-4 border-2 border-slate-200 rounded-xl hover:border-blue-300">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-slate-900">Versión {version.version_number}</h4>
                          <p className="text-sm text-slate-600">{version.change_description || 'Sin descripción'}</p>
                        </div>
                        <span className="text-xs text-slate-500">{new Date(version.changed_at).toLocaleString('es-MX')}</span>
                      </div>
                      <p className="text-xs text-slate-500">Modificado por: {version.changed_by || 'Sistema'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200">
              <button
                onClick={() => setShowVersionsModal(false)}
                className="w-full px-4 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTemplateModal({ onClose, onCreate, documentTypes, loading }) {
  const [formData, setFormData] = useState({
    template_code: '',
    template_name: '',
    document_type: '',
    description: '',
    logo_url: '',
    primary_color: '#024D32',
    secondary_color: '#9E4633',
    accent_color: '#E8D547',
    font_family: 'Arial',
    font_size_title: 18,
    font_size_body: 12,
    font_size_small: 10,
    page_size: 'A4',
    orientation: 'portrait',
    is_default: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <h2 className="text-2xl font-bold">Nueva Plantilla de Documento</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Código de Plantilla *</label>
              <input
                type="text"
                value={formData.template_code}
                onChange={(e) => setFormData({ ...formData, template_code: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="ej: OC_2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de Plantilla *</label>
              <input
                type="text"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="ej: Orden de Corte 2024"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Documento *</label>
              <select
                value={formData.document_type}
                onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Seleccionar tipo</option>
                {documentTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="2"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Descripción de la plantilla..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color Primario</label>
              <input
                type="color"
                value={formData.primary_color}
                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color Secundario</label>
              <input
                type="color"
                value={formData.secondary_color}
                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color de Acento</label>
              <input
                type="color"
                value={formData.accent_color}
                onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fuente</label>
              <select
                value={formData.font_family}
                onChange={(e) => setFormData({ ...formData, font_family: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tamaño de Hoja</label>
              <select
                value={formData.page_size}
                onChange={(e) => setFormData({ ...formData, page_size: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="A4">A4</option>
                <option value="Letter">Carta (Letter)</option>
                <option value="Legal">Legal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Orientación</label>
              <select
                value={formData.orientation}
                onChange={(e) => setFormData({ ...formData, orientation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="portrait">Vertical</option>
                <option value="landscape">Horizontal</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                />
                <span className="text-sm font-medium text-slate-700">Establecer como plantilla predeterminada</span>
              </label>
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-100 border border-slate-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Creando...' : '✓ Crear Plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}
