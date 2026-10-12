'use client';

import React, { useState, useEffect } from 'react';
import { useBranding } from '@/hooks/useBranding';
import ExchangeRateWidget from '@/components/exchange-rate-widget';

export default function CustomersPage() {
  const { branding } = useBranding();
  const primaryColor = branding?.primary_color || '#0E4A22';
  const secondaryColor = branding?.secondary_color || '#963821';
  const textColor = branding?.text_color || '#111827';
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalCustomer, setPortalCustomer] = useState(null);
  const [portalStatus, setPortalStatus] = useState(null);
  const [portalPin, setPortalPin] = useState(''); // shown only once after generate
  const [portalLoading, setPortalLoading] = useState(false);

  // Estados del formulario de cliente
  const [formData, setFormData] = useState({
    customerName: '',
    rfc: '',
    address: '',
    phone: '',
    email: '',
    destination: '',
    preferredCaliber: '',
    notes: ''
  });

  useEffect(() => {
    fetchCustomers();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';
      const body = editingCustomer ? { ...formData, id: editingCustomer.id } : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        fetchCustomers();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerName: customer.customer_name || '',
      rfc: customer.rfc || '',
      address: customer.address || '',
      phone: customer.phone || '',
      email: customer.email || '',
      destination: customer.destination || '',
      preferredCaliber: customer.preferred_caliber || '',
      notes: customer.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
    try {
      await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      rfc: '',
      address: '',
      phone: '',
      email: '',
      destination: '',
      preferredCaliber: '',
      notes: ''
    });
    setEditingCustomer(null);
    setShowForm(false);
  };

  const openAccountModal = (customer) => {
    setSelectedCustomer(customer);
    setShowAccountModal(true);
  };

  const openPortalAccess = async (customer) => {
    setPortalCustomer(customer);
    setPortalPin('');
    setShowPortalModal(true);
    setPortalLoading(true);
    try {
      const res = await fetch(`/api/client-portal/admin/access?customerId=${customer.id}`);
      const data = await res.json();
      setPortalStatus(data);
    } catch (e) {
      setPortalStatus({ enabled: false, hasAccess: false });
    } finally {
      setPortalLoading(false);
    }
  };

  const generatePortalPin = async () => {
    if (!portalCustomer) return;
    setPortalLoading(true);
    try {
      const res = await fetch('/api/client-portal/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: portalCustomer.id, action: 'generate-pin' })
      });
      const data = await res.json();
      if (data.pin) setPortalPin(data.pin);
      // refresh status
      const st = await fetch(`/api/client-portal/admin/access?customerId=${portalCustomer.id}`).then(r => r.json());
      setPortalStatus(st);
    } catch (e) {}
    setPortalLoading(false);
  };

  const resetPortalPin = async () => {
    if (!portalCustomer) return;
    if (!confirm('¿Restablecer el PIN? El anterior dejará de funcionar.')) return;
    setPortalLoading(true);
    try {
      const res = await fetch('/api/client-portal/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: portalCustomer.id, action: 'reset-pin' })
      });
      const data = await res.json();
      if (data.pin) setPortalPin(data.pin);
      const st = await fetch(`/api/client-portal/admin/access?customerId=${portalCustomer.id}`).then(r => r.json());
      setPortalStatus(st);
    } catch (e) {}
    setPortalLoading(false);
  };

  const togglePortal = async (enabled) => {
    if (!portalCustomer) return;
    setPortalLoading(true);
    try {
      await fetch('/api/client-portal/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: portalCustomer.id, action: 'toggle', enabled })
      });
      const st = await fetch(`/api/client-portal/admin/access?customerId=${portalCustomer.id}`).then(r => r.json());
      setPortalStatus(st);
    } catch (e) {}
    setPortalLoading(false);
  };

  const closePortalModal = () => {
    setShowPortalModal(false);
    setPortalCustomer(null);
    setPortalStatus(null);
    setPortalPin('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: secondaryColor }}>
        <div className="text-2xl font-bold" style={{ color: primaryColor }}>Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: secondaryColor }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold" style={{ color: primaryColor }}>
            Gestión de Clientes
          </h1>
          <ExchangeRateWidget />
        </div>

        {/* Botón Agregar Cliente */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 rounded-lg font-semibold text-white transition-all"
            style={{ backgroundColor: primaryColor }}
          >
            {showForm ? 'Cancelar' : '+ Agregar Cliente'}
          </button>
        </div>

        {/* Formulario */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-6" style={{ color: primaryColor }}>
              {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  RFC
                </label>
                <input
                  type="text"
                  value={formData.rfc}
                  onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Destino Principal
                </label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Calibre Preferido
                </label>
                <input
                  type="text"
                  value={formData.preferredCaliber}
                  onChange={(e) => setFormData({ ...formData, preferredCaliber: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div className="md:col-span-2 flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-lg font-semibold text-white transition-all"
                  style={{ backgroundColor: primaryColor }}
                >
                  {editingCustomer ? 'Actualizar' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 rounded-lg font-semibold bg-gray-400 text-white"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Clientes */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: primaryColor }}>
                <tr>
                  <th className="px-6 py-4 text-left text-white font-semibold">Cliente</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">RFC</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Teléfono</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Email</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Destino</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Calibre Pref.</th>
                  <th className="px-6 py-4 text-center text-white font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, index) => (
                  <tr
                    key={customer.id}
                    className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                  >
                    <td className="px-6 py-4 font-semibold" style={{ color: textColor }}>
                      {customer.customer_name}
                    </td>
                    <td className="px-6 py-4" style={{ color: textColor }}>
                      {customer.rfc || '-'}
                    </td>
                    <td className="px-6 py-4" style={{ color: textColor }}>
                      {customer.phone || '-'}
                    </td>
                    <td className="px-6 py-4" style={{ color: textColor }}>
                      {customer.email || '-'}
                    </td>
                    <td className="px-6 py-4" style={{ color: textColor }}>
                      {customer.destination || '-'}
                    </td>
                    <td className="px-6 py-4" style={{ color: textColor }}>
                      {customer.preferred_caliber || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openAccountModal(customer)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all"
                        >
                          Expediente
                        </button>
                        <button
                          onClick={() => { window.location.href = `/cartera?cliente=${customer.id}`; }}
                          className="px-3 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800"
                        >
                          Estado de Cuenta
                        </button>
                        <button
                          onClick={() => openPortalAccess(customer)}
                          className="px-3 py-2 bg-indigo-700 text-white rounded-lg text-sm font-semibold hover:bg-indigo-800"
                        >
                          Portal Cliente
                        </button>
                        <button
                          onClick={() => handleEdit(customer)}
                          className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition-all"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                      No hay clientes registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Expediente del Cliente */}
      {showAccountModal && selectedCustomer && (
        <CustomerAccountModal
          customer={selectedCustomer}
          onClose={() => {
            setShowAccountModal(false);
            setSelectedCustomer(null);
          }}
          primaryColor={primaryColor}
          textColor={textColor}
        />
      )}

      {/* Modal Acceso Portal de Clientes */}
      {showPortalModal && portalCustomer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <div>
                <div className="font-bold text-lg" style={{ color: primaryColor }}>Acceso al Portal de Clientes</div>
                <div className="text-sm text-slate-600">{portalCustomer.customer_name} • {portalCustomer.client_number}</div>
              </div>
              <button onClick={closePortalModal} className="text-2xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              {portalLoading && <div className="text-sm text-slate-500">Cargando...</div>}

              {portalStatus && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100">ESTADO</span>
                    <span className={`text-sm font-semibold ${portalStatus.enabled ? 'text-emerald-700' : 'text-red-600'}`}>
                      {portalStatus.enabled ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                    {portalStatus.lastLogin && <span className="text-xs text-slate-500">Último acceso: {new Date(portalStatus.lastLogin).toLocaleDateString('es-MX')}</span>}
                  </div>

                  {!portalStatus.hasAccess && (
                    <button onClick={generatePortalPin} disabled={portalLoading} className="px-4 py-2 bg-indigo-700 text-white rounded text-sm">Generar PIN de Acceso</button>
                  )}

                  {portalStatus.hasAccess && (
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={generatePortalPin} disabled={portalLoading} className="px-3 py-1.5 bg-emerald-700 text-white text-xs rounded">Generar Nuevo PIN</button>
                      <button onClick={resetPortalPin} disabled={portalLoading} className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded">Restablecer PIN</button>
                      <button onClick={() => togglePortal(!portalStatus.enabled)} disabled={portalLoading} className="px-3 py-1.5 border text-xs rounded">
                        {portalStatus.enabled ? 'Desactivar' : 'Activar'} Acceso
                      </button>
                    </div>
                  )}
                </div>
              )}

              {portalPin && (
                <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl">
                  <div className="text-emerald-800 text-xs font-semibold mb-1">PIN GENERADO (MOSTRAR SOLO UNA VEZ)</div>
                  <div className="font-mono text-3xl tracking-[4px] font-bold text-emerald-900">{portalPin}</div>
                  <div className="text-[10px] text-emerald-700 mt-1">Número de cliente: {portalCustomer.client_number} • Entrega este PIN al cliente de forma segura.</div>
                </div>
              )}

              <div className="text-xs text-slate-500">El cliente ingresará con Número de Cliente + PIN en /portal-cliente. El PIN se almacena de forma segura (hash) y nunca se muestra nuevamente.</div>
            </div>

            <div className="p-4 border-t flex justify-end">
              <button onClick={closePortalModal} className="px-4 py-2 text-sm border rounded">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerAccountModal({ customer, onClose, primaryColor, textColor }) {
  const [transactions, setTransactions] = useState([]);
  const [balanceUSD, setBalanceUSD] = useState(0);
  const [balanceMXN, setBalanceMXN] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(17.5);

  // Real integrated data from canonical sources (viajes, notas, abonos) - fixes duplication and sync
  const [integratedData, setIntegratedData] = useState(null);
  const [loadingIntegrated, setLoadingIntegrated] = useState(true);

  const [formData, setFormData] = useState({
    tripType: 'carga',
    tripDate: new Date().toISOString().split('T')[0],
    description: '',
    amountUSD: 0,
    amountMXN: 0,
    transactionType: 'charge',
    exchangeRate: 17.5,
    notes: ''
  });

  useEffect(() => {
    if (!customer?.id) return;
    fetchExchangeRate();
    fetchTransactions();
    fetchIntegratedData();
  }, [customer?.id]);

  const fetchExchangeRate = async () => {
    try {
      const response = await fetch('/api/exchange-rate');
      const data = await response.json();
      if (data.rate) {
        setExchangeRate(data.rate);
        setFormData(prev => ({ ...prev, exchangeRate: data.rate }));
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`/api/customer-accounts?customerId=${customer.id}&summary=true`);
      const data = await response.json();
      setTransactions(data.transactions || []);
      setBalanceUSD(data.balanceUSD || 0);
      setBalanceMXN(data.balanceMXN || 0);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchIntegratedData = async () => {
    if (!customer?.id) return;
    setLoadingIntegrated(true);
    try {
      const response = await fetch(`/api/cartera/estado-cuenta?customerId=${customer.id}`);
      const data = await response.json();
      setIntegratedData(data);
    } catch (error) {
      console.error('Error fetching integrated expediente data:', error);
      setIntegratedData(null);
    } finally {
      setLoadingIntegrated(false);
    }
  };

  // Legacy handlers removed - expediente now uses canonical cartera data (viajes/notas/abonos) to prevent duplication and ensure real-time sync.
  // Transactions registered elsewhere will appear automatically here.

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold" style={{ color: primaryColor }}>
            Expediente de {customer.customer_name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Resumen de Saldo - Prioriza datos canónicos integrados (viajes/notas/abonos) para sincronización correcta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-2">Saldo USD (Cartera Real)</h3>
              <p className="text-3xl font-bold text-green-600">
                ${(integratedData?.resumen?.saldo_pendiente_usd || balanceUSD || 0).toFixed(2)} USD
              </p>
              <div className="text-xs text-green-700 mt-1">Fuente: notas + abonos + viajes</div>
            </div>
            <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Saldo MXN (Legacy)</h3>
              <p className="text-3xl font-bold text-blue-600">
                ${balanceMXN.toFixed(2)} MXN
              </p>
              <div className="text-xs text-blue-700 mt-1">Compatibilidad</div>
            </div>
          </div>

          {/* Sección de control - solo lectura desde fuentes canónicas para evitar duplicidad */}
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">Los movimientos se registran en Viajes, Notas y Abonos (Cartera). Este expediente se actualiza automáticamente en tiempo real.</div>
            <button
              onClick={() => { fetchTransactions(); fetchIntegratedData(); }}
              className="px-4 py-2 text-sm rounded border"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              Actualizar datos
            </button>
          </div>

          {/* HISTORIAL REAL DEL EXPEDIENTE - Fuente canónica: viajes + notas + abonos + legacy compat (sin duplicar) */}
          <div className="bg-white rounded-lg border-2" style={{ borderColor: primaryColor }}>
            <h3 className="text-xl font-bold p-4 border-b flex items-center justify-between" style={{ color: primaryColor }}>
              Estado de Cuenta en Tiempo Real (Cartera)
              {loadingIntegrated && <span className="text-xs text-emerald-600 ml-2">Actualizando...</span>}
            </h3>

            {/* Resumen real desde API canónica */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b bg-emerald-50">
              <div>
                <div className="text-xs text-emerald-700">Total Vendido</div>
                <div className="text-xl font-bold text-emerald-900">${(integratedData?.resumen?.total_cargo_usd || 0).toFixed(2)} USD</div>
              </div>
              <div>
                <div className="text-xs text-emerald-700">Total Pagado</div>
                <div className="text-xl font-bold text-emerald-900">${(integratedData?.resumen?.total_abono_usd || 0).toFixed(2)} USD</div>
              </div>
              <div>
                <div className="text-xs text-emerald-700">Saldo Pendiente</div>
                <div className={`text-xl font-bold ${(integratedData?.resumen?.saldo_pendiente_usd || 0) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  ${(integratedData?.resumen?.saldo_pendiente_usd || 0).toFixed(2)} USD
                </div>
                <div className="text-[10px] text-emerald-600">Viajes: {integratedData?.resumen?.total_viajes || 0} • Abonos: {integratedData?.resumen?.total_abonos || 0}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Folio / Concepto</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Cargo USD</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Abono USD</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {(integratedData?.movimientos || []).length > 0 ? (
                    (integratedData?.movimientos || []).map((m, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-4 py-3 text-sm">{m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX') : '-'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs border bg-white">{m.tipo || 'Mov'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-semibold">{m.folio || m.description || '-'}</div>
                          <div className="text-[10px] text-gray-500">{m.destino || m.estatus || ''}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">
                          {(m.cargo || 0) > 0 ? `+$${(m.cargo || 0).toFixed(2)}` : ''}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">
                          {(m.abono || 0) > 0 ? `+$${(m.abono || 0).toFixed(2)}` : ''}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold">
                          ${(m.saldo_running || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        {loadingIntegrated ? 'Cargando expediente desde Cartera...' : 'No hay movimientos registrados en el sistema para este cliente.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 text-xs text-emerald-700 border-t bg-emerald-50">
              Datos sincronizados en tiempo real desde Viajes, Notas, Abonos y Aplicaciones. El legacy (customer_accounts) se incluye solo para compatibilidad histórica.
            </div>
          </div>

          <div className="mt-4 text-xs text-center text-slate-500">
            Expediente sincronizado • Ver trazabilidad completa en el módulo de Cartera.
            <a href={`/cartera?cliente=${customer.id}`} className="ml-2 underline" style={{color: primaryColor}}>Abrir Cartera →</a>
          </div>
        </div>
      </div>
    </div>
  );
}


