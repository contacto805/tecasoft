'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ControlVentaProcesoDesechoPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedWeek, setSelectedWeek] = useState({
    start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    end: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  });
  const [availableKg, setAvailableKg] = useState(null);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  // Form state for new sale
  const [newSaleForm, setNewSaleForm] = useState({
    saleType: 'proceso',
    customerName: '',
    buyerName: '',
    kgSold: '',
    pricePerKg: '',
    observations: ''
  });

  // Form state for payment
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'transferencia',
    referenceNumber: '',
    amountReceived: '',
    observations: ''
  });

  // Fetch available kg for selected week
  const fetchAvailableKg = async () => {
    try {
      const res = await fetch(`/api/process-waste-control/available-kg?weekStartDate=${selectedWeek.start}&weekEndDate=${selectedWeek.end}`);
      const data = await res.json();
      setAvailableKg(data);
    } catch (error) {
      console.error('Error fetching available kg:', error);
    }
  };

  // Fetch sales
  const fetchSales = async (status = '') => {
    setLoading(true);
    try {
      let url = '/api/process-waste-control';
      if (status) url += `?status=${status}`;
      const res = await fetch(url);
      const data = await res.json();
      setSales(data);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch payments for a sale
  const fetchPayments = async (saleId) => {
    try {
      const res = await fetch(`/api/process-waste-control/payments?saleId=${saleId}`);
      const data = await res.json();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  // Create new sale
  const handleCreateSale = async () => {
    setLoading(true);
    try {
      const totalAmount = parseFloat(newSaleForm.kgSold) * parseFloat(newSaleForm.pricePerKg);
      const kgAvailable = newSaleForm.saleType === 'proceso' ? availableKg.proceso.available_kg : availableKg.desecho.available_kg;

      if (parseFloat(newSaleForm.kgSold) > kgAvailable) {
        alert('Los kg vendidos exceden los kg disponibles');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/process-waste-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate: selectedWeek.start,
          weekEndDate: selectedWeek.end,
          saleDate: format(new Date(), 'yyyy-MM-dd'),
          saleType: newSaleForm.saleType,
          customerName: newSaleForm.customerName,
          buyerName: newSaleForm.buyerName,
          kgAvailableSource: kgAvailable,
          kgSold: newSaleForm.kgSold,
          pricePerKg: newSaleForm.pricePerKg,
          observations: newSaleForm.observations,
          requestedBy: 'current_user' // TODO: Get from auth
        })
      });

      if (res.ok) {
        alert('Venta registrada. Esperando autorización.');
        setShowNewSaleModal(false);
        setNewSaleForm({
          saleType: 'proceso',
          customerName: '',
          buyerName: '',
          kgSold: '',
          pricePerKg: '',
          observations: ''
        });
        fetchSales('pendiente');
        fetchAvailableKg();
      } else {
        const error = await res.json();
        alert(error.error || 'Error al crear venta');
      }
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Error al crear venta');
    } finally {
      setLoading(false);
    }
  };

  // Approve/Reject sale
  const handleApproveSale = async (saleId, action, reason = '') => {
    setLoading(true);
    try {
      const res = await fetch('/api/process-waste-control', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: saleId,
          action,
          userId: 'current_user_id',
          userName: 'Superadministrador',
          reason
        })
      });

      if (res.ok) {
        alert(action === 'approve' ? 'Venta aprobada' : 'Venta rechazada');
        fetchSales(activeTab === 'pending' ? 'pendiente' : activeTab === 'approved' ? 'aprobado' : '');
        fetchAvailableKg();
      } else {
        const error = await res.json();
        alert(error.error || 'Error al actualizar venta');
      }
    } catch (error) {
      console.error('Error updating sale:', error);
      alert('Error al actualizar venta');
    } finally {
      setLoading(false);
    }
  };

  // Register payment
  const handleRegisterPayment = async () => {
    if (!selectedSale) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/process-waste-control/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: selectedSale.id,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          referenceNumber: paymentForm.referenceNumber,
          amountReceived: paymentForm.amountReceived,
          observations: paymentForm.observations,
          registeredBy: 'current_user' // TODO: Get from auth
        })
      });

      if (res.ok) {
        alert('Pago registrado correctamente');
        setShowPaymentModal(false);
        setPaymentForm({
          paymentDate: format(new Date(), 'yyyy-MM-dd'),
          paymentMethod: 'transferencia',
          referenceNumber: '',
          amountReceived: '',
          observations: ''
        });
        fetchSales('aprobado');
        fetchPayments(selectedSale.id);
      } else {
        const error = await res.json();
        alert(error.error || 'Error al registrar pago');
      }
    } catch (error) {
      console.error('Error registering payment:', error);
      alert('Error al registrar pago');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableKg();
  }, [selectedWeek]);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchSales('pendiente');
    } else if (activeTab === 'approved') {
      fetchSales('aprobado');
    } else {
      fetchSales('');
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <i className="ph-arrow-left text-lg"></i>
              <span className="font-medium text-slate-700">Regresar</span>
            </button>
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Control de Venta Proc/Desecho</h1>
          <p className="text-slate-600">Gestión de ventas de fruta proceso y desecho con autorización</p>
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <i className="ph-lock-key text-yellow-600"></i> <strong>Acceso restringido:</strong> Solo Superadministrador y Encargado de Administración
            </p>
          </div>
        </div>

        {/* Week Selector & Available Kg */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Semana</label>
            <input
              type="week"
              value={`${format(new Date(selectedWeek.start), 'yyyy')}-W${format(new Date(selectedWeek.start), 'II')}`}
              onChange={(e) => {
                const [year, week] = e.target.value.split('-W');
                const firstDayOfYear = new Date(parseInt(year), 0, 1);
                const daysToFirstMonday = (8 - firstDayOfYear.getDay()) % 7;
                const firstMonday = new Date(parseInt(year), 0, 1 + daysToFirstMonday);
                const weekStart = new Date(firstMonday.getTime() + (parseInt(week) - 1) * 7 * 24 * 60 * 60 * 1000);
                const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
                setSelectedWeek({
                  start: format(weekStart, 'yyyy-MM-dd'),
                  end: format(weekEnd, 'yyyy-MM-dd')
                });
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-500 mt-2">
              {format(new Date(selectedWeek.start), "dd 'de' MMMM", { locale: es })} - {format(new Date(selectedWeek.end), "dd 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-package text-3xl opacity-80"></i>
              <span className="text-sm font-medium opacity-90">Kg Proceso Disponibles</span>
            </div>
            <p className="text-4xl font-bold mb-1">{availableKg?.proceso.available_kg.toLocaleString('es-MX') || 0} kg</p>
            <p className="text-sm opacity-80">De {availableKg?.proceso.total_kg.toLocaleString('es-MX') || 0} kg totales</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph-trash text-3xl opacity-80"></i>
              <span className="text-sm font-medium opacity-90">Kg Desecho Disponibles</span>
            </div>
            <p className="text-4xl font-bold mb-1">{availableKg?.desecho.available_kg.toLocaleString('es-MX') || 0} kg</p>
            <p className="text-sm opacity-80">De {availableKg?.desecho.total_kg.toLocaleString('es-MX') || 0} kg totales</p>
          </div>
        </div>

        {/* New Sale Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowNewSaleModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            <i className="ph-plus text-lg"></i>
            Registrar Nueva Venta
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
          {[
            { id: 'pending', label: 'Pendientes de Autorización', color: 'yellow' },
            { id: 'approved', label: 'Aprobadas', color: 'emerald' },
            { id: 'all', label: 'Todas', color: 'slate' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? `bg-${tab.color}-100 text-${tab.color}-700 border-2 border-${tab.color}-300`
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Folio</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Kg Vendidos</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Precio/Kg</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Pago</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-slate-500">
                      No hay ventas registradas
                    </td>
                  </tr>
                ) : (
                  sales.map(sale => (
                    <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{sale.folio}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{format(new Date(sale.sale_date), 'dd/MM/yyyy', { locale: es })}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          sale.sale_type === 'proceso' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {sale.sale_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{sale.customer_name}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{parseFloat(sale.kg_sold).toLocaleString('es-MX')} kg</td>
                      <td className="px-4 py-3 text-sm text-slate-700">${parseFloat(sale.price_per_kg).toLocaleString('es-MX')}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-600">${parseFloat(sale.total_amount).toLocaleString('es-MX')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          sale.status === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                          sale.status === 'aprobado' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {sale.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          sale.payment_status === 'pendiente' ? 'bg-slate-100 text-slate-700' :
                          sale.payment_status === 'parcial' ? 'bg-blue-100 text-blue-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {sale.payment_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {sale.status === 'pendiente' && (
                            <>
                              <button
                                onClick={() => handleApproveSale(sale.id, 'approve')}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700"
                                title="Aprobar"
                              >
                                <i className="ph-check"></i>
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('Motivo de rechazo:');
                                  if (reason) handleApproveSale(sale.id, 'reject', reason);
                                }}
                                className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                                title="Rechazar"
                              >
                                <i className="ph-x"></i>
                              </button>
                            </>
                          )}
                          {sale.status === 'aprobado' && sale.payment_status !== 'pagado' && (
                            <button
                              onClick={() => {
                                setSelectedSale(sale);
                                setPaymentForm({
                                  ...paymentForm,
                                  amountReceived: sale.total_amount
                                });
                                setShowPaymentModal(true);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                              title="Registrar Pago"
                            >
                              <i className="ph-currency-dollar"></i> Pago
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Sale Modal */}
        {showNewSaleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Registrar Nueva Venta</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Venta</label>
                  <select
                    value={newSaleForm.saleType}
                    onChange={(e) => setNewSaleForm({ ...newSaleForm, saleType: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="proceso">Proceso</option>
                    <option value="desecho">Desecho</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Disponibles: {newSaleForm.saleType === 'proceso' ? availableKg?.proceso.available_kg.toLocaleString('es-MX') : availableKg?.desecho.available_kg.toLocaleString('es-MX')} kg
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Cliente</label>
                  <input
                    type="text"
                    value={newSaleForm.customerName}
                    onChange={(e) => setNewSaleForm({ ...newSaleForm, customerName: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Nombre del cliente"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Comprador (opcional)</label>
                  <input
                    type="text"
                    value={newSaleForm.buyerName}
                    onChange={(e) => setNewSaleForm({ ...newSaleForm, buyerName: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Nombre del comprador"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Kg Vendidos</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newSaleForm.kgSold}
                      onChange={(e) => setNewSaleForm({ ...newSaleForm, kgSold: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Precio por Kg</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newSaleForm.pricePerKg}
                      onChange={(e) => setNewSaleForm({ ...newSaleForm, pricePerKg: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {newSaleForm.kgSold && newSaleForm.pricePerKg && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm text-emerald-700">
                      <strong>Importe Total:</strong> ${(parseFloat(newSaleForm.kgSold) * parseFloat(newSaleForm.pricePerKg)).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Observaciones</label>
                  <textarea
                    value={newSaleForm.observations}
                    onChange={(e) => setNewSaleForm({ ...newSaleForm, observations: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 resize-none"
                    rows="3"
                    placeholder="Observaciones adicionales..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewSaleModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateSale}
                  disabled={!newSaleForm.customerName || !newSaleForm.kgSold || !newSaleForm.pricePerKg}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enviar a Autorización
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedSale && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Registrar Pago</h2>
              <p className="text-sm text-slate-600 mb-6">
                Venta: {selectedSale.folio} - Total: <strong className="text-emerald-600">${parseFloat(selectedSale.total_amount).toLocaleString('es-MX')}</strong>
              </p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Fecha de Pago</label>
                    <input
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Método de Pago</label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="cheque">Cheque</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Referencia</label>
                  <input
                    type="text"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Número de referencia, folio, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Monto Recibido</label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.amountReceived}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amountReceived: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Observaciones</label>
                  <textarea
                    value={paymentForm.observations}
                    onChange={(e) => setPaymentForm({ ...paymentForm, observations: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 resize-none"
                    rows="3"
                    placeholder="Observaciones del pago..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedSale(null);
                  }}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegisterPayment}
                  disabled={!paymentForm.amountReceived}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Registrar Pago
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 shadow-2xl flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
              <span className="font-medium text-slate-700">Cargando...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
