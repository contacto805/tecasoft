'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PrinterSettingsPage() {
  const router = useRouter();
  const [printers, setPrinters] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [formData, setFormData] = useState({
    printer_name: '',
    printer_type: 'Térmica 80mm',
    connection_type: 'network',
    ip_address: '',
    port: 9100,
    device_path: '',
    paper_width_mm: 80,
    is_default: false,
    is_active: true
  });

  useEffect(() => {
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/printer-settings');
      if (res.ok) {
        const data = await res.json();
        setPrinters(data);
      }
    } catch (error) {
      console.error('Error fetching printers:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = editingPrinter ? 'PUT' : 'POST';
      const body = editingPrinter ? { ...formData, id: editingPrinter.id } : formData;

      const res = await fetch('/api/printer-settings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        fetchPrinters();
        closeModal();
      }
    } catch (error) {
      console.error('Error saving printer:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta impresora?')) return;

    try {
      const res = await fetch(`/api/printer-settings?id=${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchPrinters();
      }
    } catch (error) {
      console.error('Error deleting printer:', error);
    }
  };

  const openModal = (printer = null) => {
    if (printer) {
      setEditingPrinter(printer);
      setFormData({
        printer_name: printer.printer_name,
        printer_type: printer.printer_type,
        connection_type: printer.connection_type,
        ip_address: printer.ip_address || '',
        port: printer.port || 9100,
        device_path: printer.device_path || '',
        paper_width_mm: printer.paper_width_mm,
        is_default: printer.is_default,
        is_active: printer.is_active
      });
    } else {
      setEditingPrinter(null);
      setFormData({
        printer_name: '',
        printer_type: 'Térmica 80mm',
        connection_type: 'network',
        ip_address: '',
        port: 9100,
        device_path: '',
        paper_width_mm: 80,
        is_default: false,
        is_active: true
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPrinter(null);
  };

  const testPrint = async (printer) => {
    alert(`Enviando prueba de impresión a:\n${printer.printer_name}\n${printer.connection_type === 'network' ? `IP: ${printer.ip_address}:${printer.port}` : `Puerto: ${printer.device_path}`}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <i className="ph ph-arrow-left text-xl text-slate-600"></i>
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Configuración de Impresoras</h1>
              <p className="text-sm text-slate-500">Gestiona impresoras térmicas y de oficina</p>
            </div>
          </div>
          <button 
            onClick={() => openModal()} 
            className="px-4 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors flex items-center gap-2"
          >
            <i className="ph ph-plus-circle"></i>
            Agregar Impresora
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {printers.map(printer => (
            <div key={printer.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${printer.is_default ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-600'}`}>
                    <i className="ph ph-printer text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      {printer.printer_name}
                      {printer.is_default && (
                        <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-xs font-semibold rounded">Predeterminada</span>
                      )}
                    </h3>
                    <p className="text-sm text-slate-500">{printer.printer_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${printer.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {printer.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-3 text-sm">
                  <i className="ph ph-plug text-slate-400"></i>
                  <span className="text-slate-600 font-medium">Conexión:</span>
                  <span className="text-slate-900">{printer.connection_type === 'network' ? 'Red' : 'USB/Serial'}</span>
                </div>
                {printer.connection_type === 'network' ? (
                  <div className="flex items-center gap-3 text-sm">
                    <i className="ph ph-globe text-slate-400"></i>
                    <span className="text-slate-600 font-medium">Dirección:</span>
                    <span className="text-slate-900 font-mono">{printer.ip_address}:{printer.port}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-sm">
                    <i className="ph ph-usb text-slate-400"></i>
                    <span className="text-slate-600 font-medium">Puerto:</span>
                    <span className="text-slate-900 font-mono">{printer.device_path || 'No especificado'}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <i className="ph ph-ruler text-slate-400"></i>
                  <span className="text-slate-600 font-medium">Ancho papel:</span>
                  <span className="text-slate-900">{printer.paper_width_mm}mm</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => testPrint(printer)}
                  className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <i className="ph ph-play"></i>
                  Prueba
                </button>
                <button 
                  onClick={() => openModal(printer)}
                  className="flex-1 px-3 py-2 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <i className="ph ph-pencil"></i>
                  Editar
                </button>
                <button 
                  onClick={() => handleDelete(printer.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <i className="ph ph-trash"></i>
                </button>
              </div>
            </div>
          ))}

          {printers.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ph ph-printer text-3xl text-slate-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No hay impresoras configuradas</h3>
              <p className="text-slate-500 mb-4">Agrega tu primera impresora para comenzar</p>
              <button 
                onClick={() => openModal()}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors inline-flex items-center gap-2"
              >
                <i className="ph ph-plus-circle"></i>
                Agregar Impresora
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingPrinter ? 'Editar Impresora' : 'Nueva Impresora'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <i className="ph ph-x text-xl text-slate-600"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nombre de la Impresora
                </label>
                <input
                  type="text"
                  required
                  value={formData.printer_name}
                  onChange={(e) => setFormData({ ...formData, printer_name: e.target.value })}
                  placeholder="Ej: Impresora Ticket Empaque"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900"
                />
              </div>

              {/* Tipo de Impresora */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tipo de Impresora
                </label>
                <select
                  value={formData.printer_type}
                  onChange={(e) => {
                    const type = e.target.value;
                    setFormData({ 
                      ...formData, 
                      printer_type: type,
                      paper_width_mm: type === 'Térmica 80mm' ? 80 : type === 'Térmica 58mm' ? 58 : 210
                    });
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900"
                >
                  <option value="Térmica 80mm">Térmica 80mm (Tickets)</option>
                  <option value="Térmica 58mm">Térmica 58mm</option>
                  <option value="A4 Láser">A4 Láser</option>
                  <option value="A4 Inyección">A4 Inyección de Tinta</option>
                  <option value="Matricial">Matricial</option>
                </select>
              </div>

              {/* Tipo de Conexión */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tipo de Conexión
                </label>
                <select
                  value={formData.connection_type}
                  onChange={(e) => setFormData({ ...formData, connection_type: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900"
                >
                  <option value="network">Red (IP)</option>
                  <option value="usb">USB</option>
                  <option value="serial">Puerto Serie</option>
                </select>
              </div>

              {/* Configuración por tipo de conexión */}
              {formData.connection_type === 'network' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Dirección IP
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.ip_address}
                      onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                      placeholder="192.168.1.100"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Puerto
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                      placeholder="9100"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Puerto del Dispositivo
                  </label>
                  <input
                    type="text"
                    value={formData.device_path}
                    onChange={(e) => setFormData({ ...formData, device_path: e.target.value })}
                    placeholder={formData.connection_type === 'usb' ? '/dev/usb/lp0 o COM3' : '/dev/ttyS0 o COM1'}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 font-mono"
                  />
                </div>
              )}

              {/* Ancho de Papel */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Ancho de Papel (mm)
                </label>
                <input
                  type="number"
                  required
                  value={formData.paper_width_mm}
                  onChange={(e) => setFormData({ ...formData, paper_width_mm: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900"
                />
              </div>

              {/* Opciones */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">Impresora predeterminada</p>
                    <p className="text-sm text-slate-500">Se usará por defecto para imprimir</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">Impresora activa</p>
                    <p className="text-sm text-slate-500">Disponible para usar</p>
                  </div>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors"
                >
                  {editingPrinter ? 'Guardar Cambios' : 'Agregar Impresora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
