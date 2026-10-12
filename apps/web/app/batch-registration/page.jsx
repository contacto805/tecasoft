'use client';

import { useState, useEffect, useRef } from 'react';
import { Package, Printer, Settings, Plus, Edit2, Trash2, Eye, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function BatchRegistrationPage() {
  const [activeTab, setActiveTab] = useState('registration'); // 'registration' or 'templates'
  const [batches, setBatches] = useState([]);
  const [lots, setLots] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showLabelPrint, setShowLabelPrint] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [labelQuantity, setLabelQuantity] = useState(1);
  const [previewData, setPreviewData] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const printRef = useRef();

  // Form state
  const [formData, setFormData] = useState({
    lot_id: '',
    producer_name: '',
    broker_name: '',
    lot_date: '',
    lot_number: '',
    caliber: '',
    class_name: 'A',
    pallets_complete: 0,
    boxes_96: 0,
    boxes_156: 0,
    total_kg: 0,
    band_price: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchesRes, lotsRes, customersRes, templatesRes] = await Promise.all([
        fetch('/api/batch-bands'),
        fetch('/api/lots'),
        fetch('/api/customers'),
        fetch('/api/label-templates')
      ]);

      const [batchesData, lotsData, customersData, templatesData] = await Promise.all([
        batchesRes.json(),
        lotsRes.json(),
        customersRes.json(),
        templatesRes.json()
      ]);

      setBatches(Array.isArray(batchesData) ? batchesData : []);
      setLots(Array.isArray(lotsData) ? lotsData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);

      // Auto-select default template
      const defaultTemplate = templatesData.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLotChange = (lotId) => {
    const lot = lots.find(l => l.id === parseInt(lotId));
    if (lot) {
      setFormData({
        ...formData,
        lot_id: lotId,
        producer_name: lot.producer || '',
        lot_date: lot.date ? lot.date.split('T')[0] : '',
        lot_number: lot.lot_number || '',
        broker_name: lot.broker_name || ''
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/batch-bands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const newBatch = await res.json();
        alert('Lote registrado exitosamente');
        fetchData();
        setFormData({
          lot_id: '',
          producer_name: '',
          broker_name: '',
          lot_date: '',
          lot_number: '',
          caliber: '',
          class_name: 'A',
          pallets_complete: 0,
          boxes_96: 0,
          boxes_156: 0,
          total_kg: 0,
          band_price: '',
          notes: ''
        });
        
        // Show label printing option for newly created batch
        setSelectedBatch(newBatch);
        setShowLabelPrint(true);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al registrar el lote');
    }
  };

  const handlePrintLabels = async (batch) => {
    if (!selectedTemplate) {
      alert('Selecciona una plantilla primero');
      return;
    }

    try {
      const res = await fetch('/api/labels/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: batch.lot_id,
          template_id: selectedTemplate.id,
          quantity: labelQuantity
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewData(data.labelData);
        setTimeout(() => {
          window.print();
        }, 100);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al imprimir etiquetas');
    }
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      const url = '/api/label-templates';
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
        fetchData();
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
        fetchData();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar plantilla');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="text-slate-600 mt-4">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-10 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-8 h-8 text-brand-600" />
            <h1 className="text-3xl font-bold text-slate-900">Registro de Lotes en Banda</h1>
          </div>
          <p className="text-slate-500">Registra lotes, asigna datos de producción e imprime etiquetas en el flujo de trabajo</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 mb-6">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('registration')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'registration'
                  ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Package className="w-5 h-5 inline mr-2" />
              Registro de Lotes
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'templates'
                  ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Settings className="w-5 h-5 inline mr-2" />
              Plantillas de Etiquetas
            </button>
          </div>

          {/* Registration Tab */}
          {activeTab === 'registration' && (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                
                {/* Registration Form */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Package size={20} />
                    Nuevo Registro de Lote
                  </h3>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Lote</label>
                      <select
                        value={formData.lot_id}
                        onChange={(e) => handleLotChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                      >
                        <option value="">-- Selecciona un lote --</option>
                        {lots.map(lot => (
                          <option key={lot.id} value={lot.id}>
                            {lot.lot_number} - {lot.producer}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Calibre</label>
                        <input
                          type="text"
                          value={formData.caliber}
                          onChange={(e) => setFormData({...formData, caliber: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Clase</label>
                        <select
                          value={formData.class_name}
                          onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Palets</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.pallets_complete}
                          onChange={(e) => setFormData({...formData, pallets_complete: parseInt(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Cajas 96</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.boxes_96}
                          onChange={(e) => setFormData({...formData, boxes_96: parseInt(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Cajas 156</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.boxes_156}
                          onChange={(e) => setFormData({...formData, boxes_156: parseInt(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Total KG</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.total_kg}
                          onChange={(e) => setFormData({...formData, total_kg: parseFloat(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Precio Banda</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.band_price}
                          onChange={(e) => setFormData({...formData, band_price: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Notas</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full px-4 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors"
                    >
                      Registrar Lote
                    </button>
                  </form>
                </div>

                {/* Recent Batches */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Lotes Recientes</h3>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {batches.slice(0, 10).map(batch => (
                      <BatchCard
                        key={batch.id}
                        batch={batch}
                        templates={templates}
                        selectedTemplate={selectedTemplate}
                        onSelectTemplate={setSelectedTemplate}
                        onPrintLabels={handlePrintLabels}
                      />
                    ))}
                    {batches.length === 0 && (
                      <p className="text-center text-slate-500 py-8">No hay lotes registrados</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-900 text-lg">Plantillas de Etiquetas</h3>
                <button
                  onClick={() => {
                    setEditingTemplate(null);
                    setShowTemplateEditor(true);
                  }}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2"
                >
                  <Plus size={20} />
                  Nueva Plantilla
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="bg-white border border-slate-200 rounded-lg p-4 hover:border-brand-300 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-slate-900">{template.template_name}</h4>
                        <p className="text-sm text-slate-500">
                          {template.label_width_mm}mm × {template.label_height_mm}mm
                        </p>
                      </div>
                      {template.is_default && (
                        <span className="px-2 py-1 bg-brand-100 text-brand-700 text-xs rounded-full font-semibold">
                          Por defecto
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingTemplate(template);
                          setShowTemplateEditor(true);
                        }}
                        className="flex-1 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <Edit2 size={16} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="flex-1 px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <Trash2 size={16} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}

                {templates.length === 0 && (
                  <div className="col-span-full text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <Settings className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No hay plantillas creadas</p>
                    <button
                      onClick={() => {
                        setEditingTemplate(null);
                        setShowTemplateEditor(true);
                      }}
                      className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                    >
                      Crear Primera Plantilla
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
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

        {/* Hidden Print Area */}
        {previewData && selectedTemplate && (
          <div className="hidden print:block">
            <div 
              ref={printRef}
              className="print-label"
              style={{
                width: `${selectedTemplate.label_width_mm}mm`,
                height: `${selectedTemplate.label_height_mm}mm`,
                padding: '8mm',
                backgroundColor: selectedTemplate.background_color,
                color: selectedTemplate.text_color,
                borderColor: selectedTemplate.border_color,
                borderWidth: '2px',
                borderStyle: 'solid'
              }}
            >
              <LabelContent data={previewData} template={selectedTemplate} />
            </div>
          </div>
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

// Batch Card Component with Print Button
function BatchCard({ batch, templates, selectedTemplate, onSelectTemplate, onPrintLabels }) {
  const [expanded, setExpanded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 hover:border-brand-300 transition-all">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-bold text-slate-900">{batch.lot_number}</h4>
          <p className="text-sm text-slate-500">{batch.producer_name}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-slate-100 rounded"
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      <div className="text-sm text-slate-600 space-y-1">
        <p><span className="font-semibold">Calibre:</span> {batch.caliber || 'N/A'}</p>
        <p><span className="font-semibold">Clase:</span> {batch.class_name}</p>
        <p><span className="font-semibold">Total:</span> {batch.total_kg} kg</p>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Plantilla</label>
            <select
              value={selectedTemplate?.id || ''}
              onChange={(e) => {
                const template = templates.find(t => t.id === parseInt(e.target.value));
                onSelectTemplate(template);
              }}
              className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">-- Seleccionar --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.template_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Cantidad</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <button
            onClick={() => onPrintLabels(batch)}
            disabled={!selectedTemplate}
            className="w-full px-3 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
          >
            <Printer size={18} />
            Imprimir Etiquetas
          </button>
        </div>
      )}
    </div>
  );
}

// Label Content Component (same as before)
function LabelContent({ data, template }) {
  const generateBarcode = (text) => {
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

// Template Editor Modal (same as before, condensed for space)
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Ancho (mm)</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Alto (mm)</label>
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
