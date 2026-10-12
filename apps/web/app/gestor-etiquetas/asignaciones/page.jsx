'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function AsignacionesPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    template_type: 'box_label',
    template_id: ''
  });

  const templateTypes = [
    { value: 'box_label', label: 'Etiqueta de Caja' },
    { value: 'pallet_label', label: 'Etiqueta de Pallet' },
    { value: 'production_ticket', label: 'Ticket de Producción' },
    { value: 'shipping_ticket', label: 'Ticket de Embarque' },
    { value: 'thermal_label', label: 'Etiqueta Térmica' },
    { value: 'custom', label: 'Documento Personalizado' }
  ];

  useEffect(() => {
    fetchCustomers();
    fetchTemplates();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates?status=active');
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchAssignments = async (customerId) => {
    try {
      const response = await fetch(`/api/templates/customer-assignments?customerId=${customerId}`);
      const data = await response.json();
      setAssignments(data);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    fetchAssignments(customer.id);
  };

  const assignTemplate = async () => {
    if (!newAssignment.template_id) {
      alert('Por favor selecciona una plantilla');
      return;
    }

    try {
      await fetch('/api/templates/customer-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          template_type: newAssignment.template_type,
          template_id: parseInt(newAssignment.template_id),
          assigned_by: 'Admin'
        })
      });

      setShowAssignModal(false);
      setNewAssignment({ template_type: 'box_label', template_id: '' });
      fetchAssignments(selectedCustomer.id);
    } catch (error) {
      console.error('Error assigning template:', error);
      alert('Error al asignar plantilla');
    }
  };

  const deleteAssignment = async (id) => {
    if (!confirm('¿Eliminar esta asignación?')) return;

    try {
      await fetch(`/api/templates/customer-assignments?id=${id}`, { method: 'DELETE' });
      fetchAssignments(selectedCustomer.id);
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Error al eliminar asignación');
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
              <h1 className="font-bold text-lg text-slate-900">Asignación de Plantillas por Cliente</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-12 gap-6">
            {/* Customers List */}
            <div className="col-span-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="p-4 border-b border-slate-200">
                  <h2 className="font-bold text-slate-900">Clientes</h2>
                </div>
                <div className="divide-y divide-slate-200 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {loading ? (
                    <div className="p-8 text-center">
                      <i className="ph ph-spinner text-3xl animate-spin"></i>
                    </div>
                  ) : customers.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <i className="ph ph-users text-4xl mb-2"></i>
                      <p>No hay clientes</p>
                    </div>
                  ) : (
                    customers.map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                          selectedCustomer?.id === customer.id ? 'bg-brand-50 border-l-4 border-brand-500' : ''
                        }`}
                      >
                        <div className="font-medium text-slate-900">{customer.customer_name}</div>
                        <div className="text-sm text-slate-500">{customer.rfc}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Assignments */}
            <div className="col-span-8">
              {selectedCustomer ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-xl text-slate-900">{selectedCustomer.customer_name}</h2>
                      <p className="text-sm text-slate-500">Plantillas asignadas</p>
                    </div>
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium flex items-center gap-2"
                    >
                      <i className="ph ph-plus"></i>
                      Asignar Plantilla
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {assignments.length === 0 ? (
                      <div className="p-12 text-center text-slate-500">
                        <i className="ph ph-file-dashed text-5xl mb-3"></i>
                        <p>No hay plantillas asignadas a este cliente</p>
                        <button
                          onClick={() => setShowAssignModal(true)}
                          className="mt-4 px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700"
                        >
                          Asignar Primera Plantilla
                        </button>
                      </div>
                    ) : (
                      assignments.map(assignment => (
                        <div key={assignment.id} className="p-6 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <i className="ph ph-tag text-brand-600 text-xl"></i>
                              <h3 className="font-bold text-slate-900">{assignment.template_name}</h3>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                                {templateTypes.find(t => t.value === assignment.template_type)?.label || assignment.template_type}
                              </span>
                              <span className="text-slate-400">
                                {assignment.category_name}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteAssignment(assignment.id)}
                            className="w-9 h-9 rounded-lg hover:bg-red-50 text-red-600 flex items-center justify-center"
                          >
                            <i className="ph ph-trash"></i>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
                  <i className="ph ph-cursor-click text-6xl mb-4"></i>
                  <p className="text-lg">Selecciona un cliente para ver sus plantillas asignadas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Asignar Plantilla</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <i className="ph ph-x text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Cliente</label>
                <div className="px-4 py-3 bg-slate-50 rounded-xl font-medium">
                  {selectedCustomer?.customer_name}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Tipo de Plantilla</label>
                <select
                  value={newAssignment.template_type}
                  onChange={(e) => setNewAssignment({...newAssignment, template_type: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                >
                  {templateTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Plantilla</label>
                <select
                  value={newAssignment.template_id}
                  onChange={(e) => setNewAssignment({...newAssignment, template_id: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                >
                  <option value="">Seleccionar plantilla...</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.template_name} ({template.category_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={assignTemplate}
                className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium"
              >
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
