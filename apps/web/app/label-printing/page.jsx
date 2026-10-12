'use client';

import { useEffect, useState, useRef } from 'react';
import { Printer, Plus, Settings, Edit2, Trash2, Eye, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function LabelPrintingPage() {
  const [lots, setLots] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const printRef = useRef();

  useEffect(() => {
    fetchLots();
    fetchCustomers();
    fetchTemplates();
    fetchPrinters();
  }, []);

  const fetchLots = async () => {
    try {
      const res = await fetch('/api/lots');
      const data = await res.json();
      setLots(data || []);
    } catch (error) {
      console.error('Error fetching lots:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/label-templates');
      const data = await res.json();
      setTemplates(data || []);
      const defaultTemplate = data.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/templates/printers');
      const data = await res.json();
      setPrinters(data || []);
      if (data.length && !selectedPrinter) setSelectedPrinter(data.find(p => p.is_default) || data[0]);
    } catch (error) {}
  };

  const handlePreview = async () => {
    if (!selectedLot || !selectedTemplate) {
      alert('Selecciona un lote y una plantilla');
      return;
    }

    try {
      const res = await fetch('/api/labels/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: selectedLot.id,
          template_id: selectedTemplate.id,
          quantity
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewData(data.labelData);
        setShowPreview(true);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al generar vista previa');
    }
  };

  const handlePrint = async () => {
    if (!previewData) {
      alert('Genera una vista previa primero');
      return;
    }
    // Log with printer for direct record without external app
    try {
      if (selectedPrinter && selectedLot) {
        await fetch('/api/labels/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lot_id: selectedLot.id, template_id: selectedTemplate?.id, quantity, printer_id: selectedPrinter?.id })
        });
      }
    } catch (e) {}
    window.print();
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      const url = editingTemplate 
        ? '/api/label-templates'
        : '/api/label-templates';
      
      const method = editingTemplate ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplate ? { ...templateData, id: editingTemplate.id } : templateData)
      });

      if (res.ok) {
        alert(editingTemplate ? 'Plantilla actualizada' : 'Plantilla creada');
        setShowTemplateEditor(false);
        setEditingTemplate(null);
        fetchTemplates();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar plantilla');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;

    try {
      const res = await fetch(`/api/label-templates?id=${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        alert('Plantilla eliminada');
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar plantilla');
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Impresión de Etiquetas</h1>
          <p className="text-slate-500 mt-2">Genera e imprime etiquetas personalizadas para cada cliente</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Lot Selection */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4">Seleccionar Lote</h3>
              <select
                value={selectedLot?.id || ''}
                onChange={(e) => {
                  const lot = lots.find(l => l.id === parseInt(e.target.value));
                  setSelectedLot(lot);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Selecciona un lote --</option>
                {lots.map(lot => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lot_number} - {lot.producer}
                  </option>
                ))}
              </select>

              {selectedLot && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm space-y-1">
                  <p><span className="font-semibold">Productor:</span> {selectedLot.producer}</p>
                  <p><span className="font-semibold">Huerta:</span> {selectedLot.orchard_name || selectedLot.origin}</p>
                  <p><span className="font-semibold">Cliente:</span> {selectedLot.client_name || selectedLot.destination || 'N/A'}</p>
                  <p><span className="font-semibold">Fecha:</span> {new Date(selectedLot.date).toLocaleDateString('es-MX')}</p>
                </div>
              )}
            </div>

            {/* Template Selection */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-900">Plantilla</h3>
                <button
                  onClick={() => {
                    setEditingTemplate(null);
                    setShowTemplateEditor(true);
                  }}
                  className="px-3 py-1 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-1"
                >
                  <Plus size={16} />
                  Nueva
                </button>
              </div>

              <select
                value={selectedTemplate?.id || ''}
                onChange={(e) => {
                  const template = templates.find(t => t.id === parseInt(e.target.value));
                  setSelectedTemplate(template);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Selecciona plantilla --</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.template_name} ({template.label_width_mm}x{template.label_height_mm}mm)
                  </option>
                ))}
              </select>

              {selectedTemplate && (
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingTemplate(selectedTemplate);
                        setShowTemplateEditor(true);
                      }}
                      className="flex-1 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <Edit2 size={16} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                      className="flex-1 px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4">Cantidad</h3>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* PC Printers Integrated */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-900">Impresora PC</h3>
                <a href="/gestor-etiquetas/impresoras" className="text-xs text-blue-700">Configurar</a>
              </div>
              <select
                value={selectedPrinter?.id || ''}
                onChange={e => setSelectedPrinter(printers.find(p => String(p.id) === e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Sistema por defecto</option>
                {printers.map(p => <option key={p.id} value={p.id}>{p.printer_name} — {p.printer_type}</option>)}
              </select>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handlePreview}
                disabled={!selectedLot || !selectedTemplate}
                className="w-full px-4 py-3 bg-slate-600 text-white font-medium rounded-lg hover:bg-slate-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
              >
                <Eye size={20} />
                Vista Previa
              </button>
              
              <button
                onClick={handlePrint}
                disabled={!previewData}
                className="w-full px-4 py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={20} />
                Imprimir en {selectedPrinter ? selectedPrinter.printer_name : 'impresora'}
              </button>
            </div>

          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Eye size={20} />
                Vista Previa de Etiqueta
              </h3>

              {!showPreview || !previewData ? (
                <div className="flex items-center justify-center h-96 border-2 border-dashed border-slate-200 rounded-lg">
                  <div className="text-center text-slate-400">
                    <Printer size={48} className="mx-auto mb-3 opacity-50" />
                    <p>Selecciona un lote y plantilla para ver la vista previa</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div 
                    ref={printRef}
                    className="print-label border border-slate-300 bg-white shadow-lg"
                    style={{
                      width: `${selectedTemplate.label_width_mm}mm`,
                      height: `${selectedTemplate.label_height_mm}mm`,
                      padding: '8mm',
                      backgroundColor: selectedTemplate.background_color,
                      color: selectedTemplate.text_color,
                      borderColor: selectedTemplate.border_color,
                      borderWidth: '2px',
                      position: 'relative'
                    }}
                  >
                    <LabelContent 
                      data={previewData} 
                      template={selectedTemplate} 
                    />
                  </div>
                  
                  <p className="mt-4 text-sm text-slate-500">
                    Medida: {selectedTemplate.label_width_mm}mm × {selectedTemplate.label_height_mm}mm
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Template Editor Modal */}
        {showTemplateEditor && (
          <TemplateEditorModal
            template={editingTemplate}
            customers={customers}
            onSave={handleSaveTemplate}
            onClose={() => {
              setShowTemplateEditor(false);
              setEditingTemplate(null);
            }}
          />
        )}

      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-label, .print-label * {
            visibility: visible;
          }
          .print-label {
            position: absolute;
            left: 0;
            top: 0;
            page-break-after: always;
          }
          @page {
            margin: 0;
            size: ${selectedTemplate ? `${selectedTemplate.label_width_mm}mm ${selectedTemplate.label_height_mm}mm` : 'auto'};
          }
        }
      `}</style>
    </div>
  );
}

// Label Content Component
function LabelContent({ data, template }) {
  const generateBarcode = (text) => {
    // Simple barcode representation (in real app, use barcode library)
    return `*${text}*`;
  };

  return (
    <div className="h-full flex flex-col justify-between">
      
      {/* Header */}
      <div className="text-center border-b-2 pb-2" style={{ borderColor: template.border_color }}>
        {template.show_logo && data.company_logo && (
          <img 
            src={data.company_logo} 
            alt="Logo" 
            style={{ 
              height: `${template.logo_size}px`,
              margin: '0 auto 4px'
            }}
          />
        )}
        {template.show_company_name && (
          <div style={{ fontSize: `${template.font_size_title}px` }} className="font-bold">
            {data.company_name}
          </div>
        )}
        {template.header_text && (
          <div style={{ fontSize: `${template.font_size_small}px` }} className="mt-1">
            {template.header_text}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 py-3 space-y-2">
        {template.show_customer_name && data.customer_name && (
          <div style={{ fontSize: `${template.font_size_body}px` }} className="font-semibold">
            Cliente: {data.customer_name}
          </div>
        )}
        
        {template.show_lot_number && (
          <div style={{ fontSize: `${template.font_size_body}px` }} className="font-bold">
            Lote: {data.lot_number}
          </div>
        )}
        
        {template.show_producer && (
          <div style={{ fontSize: `${template.font_size_small}px` }}>
            Productor: {data.producer}
          </div>
        )}
        
        {template.show_orchard && (
          <div style={{ fontSize: `${template.font_size_small}px` }}>
            Huerta: {data.orchard}
          </div>
        )}

        {template.show_weight && (
          <div style={{ fontSize: `${template.font_size_body}px` }} className="font-semibold">
            Peso: {data.total_kg} kg
          </div>
        )}

        {template.show_packing_date && (
          <div style={{ fontSize: `${template.font_size_small}px` }}>
            Fecha: {new Date(data.date).toLocaleDateString('es-MX')}
          </div>
        )}

        {/* Image insertion live */}
        {formData.image_url || data.custom_image || template.image_url ? (
          <div style={{ marginTop: 6 }}>
            <img src={formData.image_url || data.custom_image || template.image_url} style={{ maxHeight: 42, maxWidth: '100%', objectFit: 'contain' }} />
          </div>
        ) : null}

        {/* Calibers */}
        {template.show_caliber && data.inventory_details && data.inventory_details.length > 0 && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: template.border_color }}>
            {data.inventory_details.map((inv, i) => (
              <div key={i} style={{ fontSize: `${template.font_size_small}px` }} className="flex justify-between">
                <span>{inv.caliber} {template.show_class ? `- ${inv.class_name}` : ''}</span>
                <span className="font-semibold">{inv.total_kg} kg</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-2 pt-2 flex items-end justify-between" style={{ borderColor: template.border_color }}>
        <div className="flex-1">
          {template.show_barcode && (
            <div style={{ fontSize: `${template.font_size_small}px` }} className="font-mono text-center">
              {generateBarcode(data.lot_number)}
            </div>
          )}
          {template.footer_text && (
            <div style={{ fontSize: `${template.font_size_small - 1}px` }} className="text-center mt-1">
              {template.footer_text}
            </div>
          )}
        </div>
        
        {template.show_qr && (
          <div className="ml-2">
            <QRCodeCanvas 
              value={`LOT:${data.lot_number}`}
              size={template.logo_size || 40}
              level="M"
              includeMargin={false}
            />
          </div>
        )}
      </div>

    </div>
  );
}

// Template Editor Modal
function TemplateEditorModal({ template, customers, onSave, onClose }) {
  const [formData, setFormData] = useState(template || {
    template_name: '',
    customer_id: null,
    label_width_mm: 100,
    label_height_mm: 150,
    show_logo: true,
    show_company_name: true,
    show_customer_name: true,
    show_lot_number: true,
    show_producer: true,
    show_orchard: true,
    show_caliber: true,
    show_class: true,
    show_weight: true,
    show_boxes: false,
    show_packing_date: true,
    show_barcode: true,
    show_qr: true,
    logo_size: 40,
    font_size_title: 16,
    font_size_body: 12,
    font_size_small: 8,
    background_color: '#FFFFFF',
    text_color: '#000000',
    border_color: '#2D5016',
    header_text: 'AGUACATE HASS',
    footer_text: 'Producto de México',
    is_default: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">
            {template ? 'Editar Plantilla' : 'Nueva Plantilla'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nombre de Plantilla
              </label>
              <input
                type="text"
                required
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Cliente (opcional)
              </label>
              <select
                value={formData.customer_id || ''}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Plantilla general --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.customer_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Dimensiones</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ancho (mm)
                </label>
                <input
                  type="number"
                  min="50"
                  max="300"
                  value={formData.label_width_mm}
                  onChange={(e) => setFormData({ ...formData, label_width_mm: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Alto (mm)
                </label>
                <input
                  type="number"
                  min="50"
                  max="300"
                  value={formData.label_height_mm}
                  onChange={(e) => setFormData({ ...formData, label_height_mm: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Fields to Show */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Campos a Mostrar</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'show_logo', label: 'Logo' },
                { key: 'show_company_name', label: 'Nombre Empresa' },
                { key: 'show_customer_name', label: 'Nombre Cliente' },
                { key: 'show_lot_number', label: 'Número de Lote' },
                { key: 'show_producer', label: 'Productor' },
                { key: 'show_orchard', label: 'Huerta' },
                { key: 'show_caliber', label: 'Calibre' },
                { key: 'show_class', label: 'Clase' },
                { key: 'show_weight', label: 'Peso' },
                { key: 'show_boxes', label: 'Cajas' },
                { key: 'show_packing_date', label: 'Fecha Empaque' },
                { key: 'show_barcode', label: 'Código de Barras' },
                { key: 'show_qr', label: 'Código QR' }
              ].map(field => (
                <label key={field.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData[field.key]}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
                    className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                  />
                  <span className="text-sm text-slate-700">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Font Sizes */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Tamaños de Fuente</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Logo (px)</label>
                <input
                  type="number"
                  min="20"
                  max="100"
                  value={formData.logo_size}
                  onChange={(e) => setFormData({ ...formData, logo_size: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Título (px)</label>
                <input
                  type="number"
                  min="8"
                  max="32"
                  value={formData.font_size_title}
                  onChange={(e) => setFormData({ ...formData, font_size_title: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cuerpo (px)</label>
                <input
                  type="number"
                  min="8"
                  max="24"
                  value={formData.font_size_body}
                  onChange={(e) => setFormData({ ...formData, font_size_body: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Pequeño (px)</label>
                <input
                  type="number"
                  min="6"
                  max="16"
                  value={formData.font_size_small}
                  onChange={(e) => setFormData({ ...formData, font_size_small: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Colors */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Colores</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fondo</label>
                <input
                  type="color"
                  value={formData.background_color}
                  onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                  className="w-full h-10 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Texto</label>
                <input
                  type="color"
                  value={formData.text_color}
                  onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                  className="w-full h-10 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Borde</label>
                <input
                  type="color"
                  value={formData.border_color}
                  onChange={(e) => setFormData({ ...formData, border_color: e.target.value })}
                  className="w-full h-10 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Texto Encabezado</label>
              <input
                type="text"
                value={formData.header_text}
                onChange={(e) => setFormData({ ...formData, header_text: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Texto Pie</label>
              <input
                type="text"
                value={formData.footer_text}
                onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Image insertion - direct edit */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Insertar Imagen (URL) en etiqueta</label>
            <input
              type="text"
              value={formData.image_url || ''}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              placeholder="https://.../imagen.png o logo"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="text-xs text-slate-500 mt-0.5">Aparecerá en la Etiqueta (logo, foto referencia, marca).</div>
          </div>

          {/* Default */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
              />
              <span className="text-sm font-medium text-slate-700">Plantilla por defecto</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              {template ? 'Actualizar' : 'Crear'} Plantilla
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
