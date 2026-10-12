'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function ImpresorasPage() {
  const router = useRouter();
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [formData, setFormData] = useState({
    printer_name: '',
    printer_type: 'Zebra',
    connection_type: 'network',
    ip_address: '',
    port: 9100,
    device_path: '',
    paper_width_mm: 100,
    area_assigned: 'produccion',
    is_default: false
  });

  useEffect(() => {
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/templates/printers');
      const data = await response.json();
      setPrinters(data);
    } catch (error) {
      console.error('Error fetching printers:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPrinter(null);
    setFormData({
      printer_name: '',
      printer_type: 'Zebra',
      connection_type: 'network',
      ip_address: '',
      port: 9100,
      device_path: '',
      paper_width_mm: 100,
      area_assigned: 'produccion',
      is_default: false
    });
    setShowModal(true);
  };

  const openEditModal = (printer) => {
    setEditingPrinter(printer);
    setFormData({
      printer_name: printer.printer_name,
      printer_type: printer.printer_type,
      connection_type: printer.connection_type,
      ip_address: printer.ip_address || '',
      port: printer.port || 9100,
      device_path: printer.device_path || '',
      paper_width_mm: printer.paper_width_mm,
      area_assigned: printer.area_assigned,
      is_default: printer.is_default
    });
    setShowModal(true);
  };

  const savePrinter = async () => {
    if (!formData.printer_name) {
      alert('Por favor ingresa el nombre de la impresora');
      return;
    }

    try {
      const method = editingPrinter ? 'PUT' : 'POST';
      const body = editingPrinter ? { ...formData, id: editingPrinter.id } : formData;

      await fetch('/api/templates/printers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      setShowModal(false);
      fetchPrinters();
    } catch (error) {
      console.error('Error saving printer:', error);
      alert('Error al guardar impresora');
    }
  };

  const deletePrinter = async (id) => {
    if (!confirm('¿Eliminar esta impresora?')) return;

    try {
      await fetch(`/api/templates/printers?id=${id}`, { method: 'DELETE' });
      fetchPrinters();
    } catch (error) {
      console.error('Error deleting printer:', error);
      alert('Error al eliminar impresora');
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      <header className="fixed top-0 left-0 right-0 w-full z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/gestor-etiquetas')}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
            >
              <i className="ph ph-arrow-left text-xl"></i>
            </button>
            <div>
              <h1 className="font-bold text-lg text-slate-900">Gestión de Impresoras</h1>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium flex items-center gap-2"
          >
            <i className="ph ph-plus"></i>
            Nueva Impresora
          </button>
        </div>
      </header>

      <main className="flex-1 pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <i className="ph ph-spinner text-4xl animate-spin mb-4"></i>
                <div>Cargando impresoras...</div>
              </div>
            ) : printers.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <i className="ph ph-printer text-5xl mb-4"></i>
                <p>No hay impresoras configuradas</p>
                <button
                  onClick={openCreateModal}
                  className="mt-4 px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700"
                >
                  Agregar Primera Impresora
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Impresora</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Tipo</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Conexión</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Dirección</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Área</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Estado</th>
                      <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printers.map(printer => (
                      <tr key={printer.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                              <i className="ph ph-printer text-purple-600 text-xl"></i>
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{printer.printer_name}</div>
                              {printer.is_default && (
                                <span className="text-xs text-brand-600 font-medium">Por defecto</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{printer.printer_type}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {printer.connection_type === 'network' ? 'Red' : printer.connection_type === 'usb' ? 'USB' : 'Bluetooth'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {printer.connection_type === 'network' 
                            ? `${printer.ip_address}:${printer.port}`
                            : printer.device_path || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 capitalize">{printer.area_assigned}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            printer.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {printer.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(printer)}
                              className="w-8 h-8 rounded-lg hover:bg-brand-50 text-brand-600 flex items-center justify-center"
                            >
                              <i className="ph ph-pencil"></i>
                            </button>
                            <button
                              onClick={() => deletePrinter(printer.id)}
                              className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-600 flex items-center justify-center"
                            >
                              <i className="ph ph-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">
                {editingPrinter ? 'Editar Impresora' : 'Nueva Impresora'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <i className="ph ph-x text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nombre *</label>
                  <input
                    type="text"
                    value={formData.printer_name}
                    onChange={(e) => setFormData({...formData, printer_name: e.target.value})}
                    placeholder="Ej. Zebra Producción 1"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tipo</label>
                  <select
                    value={formData.printer_type}
                    onChange={(e) => setFormData({...formData, printer_type: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  >
                    <option value="Zebra">Zebra</option>
                    <option value="TSC">TSC</option>
                    <option value="Brother">Brother</option>
                    <option value="Epson">Epson</option>
                    <option value="HP">HP</option>
                    <option value="Generic">Genérica</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Tipo de Conexión</label>
                <select
                  value={formData.connection_type}
                  onChange={(e) => setFormData({...formData, connection_type: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                >
                  <option value="network">Red (TCP/IP)</option>
                  <option value="usb">USB</option>
                  <option value="bluetooth">Bluetooth</option>
                </select>
              </div>

              {formData.connection_type === 'network' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Dirección IP</label>
                    <input
                      type="text"
                      value={formData.ip_address}
                      onChange={(e) => setFormData({...formData, ip_address: e.target.value})}
                      placeholder="192.168.1.100"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Puerto</label>
                    <input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({...formData, port: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {formData.connection_type === 'usb' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Ruta del Dispositivo</label>
                  <input
                    type="text"
                    value={formData.device_path}
                    onChange={(e) => setFormData({...formData, device_path: e.target.value})}
                    placeholder="/dev/usb/lp0"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Ancho de Papel (mm)</label>
                  <input
                    type="number"
                    value={formData.paper_width_mm}
                    onChange={(e) => setFormData({...formData, paper_width_mm: parseInt(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Área Asignada</label>
                  <select
                    value={formData.area_assigned}
                    onChange={(e) => setFormData({...formData, area_assigned: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  >
                    <option value="produccion">Producción</option>
                    <option value="embarques">Embarques</option>
                    <option value="facturacion">Facturación</option>
                    <option value="administracion">Administración</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-2 focus:ring-brand-500/20"
                />
                <label htmlFor="is_default" className="text-sm font-medium text-slate-700">
                  Establecer como impresora predeterminada
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end sticky bottom-0 bg-white">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={savePrinter}
                className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium"
              >
                {editingPrinter ? 'Guardar Cambios' : 'Crear Impresora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
