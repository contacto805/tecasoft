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
    commercialName: '',
    contactName: '',
    rfc: '',
    address: '',
    deliveryAddress: '',
    phone: '',
    email: '',
    destination: '',
    preferredCaliber: '',
    notes: '',
    commercialStatus: 'Activo',
    paymentTermsDays: 30,
    creditLimitUsd: 0,
    defaultCurrency: 'USD',
    fiscalRfc: '',
    fiscalRazonSocial: '',
    fiscalCodigoPostal: '',
    fiscalRegimenFiscal: '',
    fiscalUsoCfdi: 'G03',
    fiscalMetodoPago: 'PUE',
    fiscalFormaPago: '03',
    fiscalEmailFacturacion: ''
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
      } else {
        const err = await response.json().catch(()=>({}));
        alert(err.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerName: customer.customer_name || '',
      commercialName: customer.commercial_name || '',
      contactName: customer.contact_name || '',
      rfc: customer.rfc || '',
      address: customer.address || '',
      deliveryAddress: customer.delivery_address || '',
      phone: customer.phone || '',
      email: customer.email || '',
      destination: customer.destination || '',
      preferredCaliber: customer.preferred_caliber || '',
      notes: customer.notes || '',
      commercialStatus: customer.commercial_status || 'Activo',
      paymentTermsDays: customer.payment_terms_days || 30,
      creditLimitUsd: customer.credit_limit_usd || 0,
      defaultCurrency: customer.default_currency || 'USD',
      fiscalRfc: customer.fiscal_rfc || customer.rfc || '',
      fiscalRazonSocial: customer.fiscal_razon_social || customer.commercial_name || '',
      fiscalCodigoPostal: customer.fiscal_codigo_postal || '',
      fiscalRegimenFiscal: customer.fiscal_regimen_fiscal || '',
      fiscalUsoCfdi: customer.fiscal_uso_cfdi || 'G03',
      fiscalMetodoPago: customer.fiscal_metodo_pago || 'PUE',
      fiscalFormaPago: customer.fiscal_forma_pago || '03',
      fiscalEmailFacturacion: customer.fiscal_email_facturacion || customer.email || ''
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
      commercialName: '',
      contactName: '',
      rfc: '',
      address: '',
      deliveryAddress: '',
      phone: '',
      email: '',
      destination: '',
      preferredCaliber: '',
      notes: '',
      commercialStatus: 'Activo',
      paymentTermsDays: 30,
      creditLimitUsd: 0,
      defaultCurrency: 'USD',
      fiscalRfc: '',
      fiscalRazonSocial: '',
      fiscalCodigoPostal: '',
      fiscalRegimenFiscal: '',
      fiscalUsoCfdi: 'G03',
      fiscalMetodoPago: 'PUE',
      fiscalFormaPago: '03',
      fiscalEmailFacturacion: ''
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
                  Nombre Comercial
                </label>
                <input
                  type="text"
                  value={formData.commercialName}
                  onChange={(e) => setFormData({ ...formData, commercialName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Contacto Autorizado
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
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
                  Dirección Fiscal
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Dirección de Entrega
                </label>
                <input
                  type="text"
                  value={formData.deliveryAddress}
                  onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
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

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Estatus Comercial
                </label>
                <select value={formData.commercialStatus} onChange={(e) => setFormData({ ...formData, commercialStatus: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" style={{ borderColor: primaryColor }}>
                  <option value="Activo">Activo</option>
                  <option value="Suspendido">Suspendido</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Plazo de Pago (días)
                </label>
                <input type="number" value={formData.paymentTermsDays} onChange={(e) => setFormData({ ...formData, paymentTermsDays: parseInt(e.target.value)||0 })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" style={{ borderColor: primaryColor }} />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Límite de Crédito (USD)
                </label>
                <input type="number" step="0.01" value={formData.creditLimitUsd} onChange={(e) => setFormData({ ...formData, creditLimitUsd: parseFloat(e.target.value)||0 })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" style={{ borderColor: primaryColor }} />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Moneda Predeterminada
                </label>
                <select value={formData.defaultCurrency} onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" style={{ borderColor: primaryColor }}>
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2" style={{ color: textColor }}>
                  Notas / Observaciones Administrativas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: primaryColor }}
                />
              </div>

              <div className="md:col-span-2 border-t pt-3 mt-2">
                <div className="text-sm font-semibold mb-2" style={{ color: textColor }}>Datos Fiscales (para CFDI)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input placeholder="RFC Fiscal" value={formData.fiscalRfc} onChange={(e)=>setFormData({...formData,fiscalRfc:e.target.value})} className="px-3 py-1.5 border rounded text-sm" />
                  <input placeholder="Razón Social Fiscal" value={formData.fiscalRazonSocial} onChange={(e)=>setFormData({...formData,fiscalRazonSocial:e.target.value})} className="px-3 py-1.5 border rounded text-sm" />
                  <input placeholder="Código Postal" value={formData.fiscalCodigoPostal} onChange={(e)=>setFormData({...formData,fiscalCodigoPostal:e.target.value})} className="px-3 py-1.5 border rounded text-sm" />
                  <input placeholder="Régimen Fiscal" value={formData.fiscalRegimenFiscal} onChange={(e)=>setFormData({...formData,fiscalRegimenFiscal:e.target.value})} className="px-3 py-1.5 border rounded text-sm" />
                </div>
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
                  <th className="px-6 py-4 text-left text-white font-semibold">Núm. Cliente</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Cliente / Comercial</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">RFC / Contacto</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Destino</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Estatus / Crédito</th>
                  <th className="px-6 py-4 text-center text-white font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, index) => (
                  <tr
                    key={customer.id}
                    className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                  >
                    <td className="px-6 py-4 font-mono text-xs" style={{ color: textColor }}>
                      {customer.client_number || '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold" style={{ color: textColor }}>
                      <div>{customer.customer_name}</div>
                      <div className="text-xs text-slate-500">{customer.commercial_name || ''}</div>
                    </td>
                    <td className="px-6 py-4 text-xs" style={{ color: textColor }}>
                      <div>{customer.rfc || customer.fiscal_rfc || '-'}</div>
                      <div>{customer.contact_name || customer.phone || ''}</div>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: textColor }}>
                      {customer.destination || '-'}
                    </td>
                    <td className="px-6 py-4 text-xs" style={{ color: textColor }}>
                      <div>{customer.commercial_status || 'Activo'}</div>
                      <div>Límite: ${(parseFloat(customer.credit_limit_usd)||0).toFixed(0)} {customer.default_currency||'USD'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2 flex-wrap">
                        <button
                          onClick={() => openAccountModal(customer)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700"
                        >
                          Abrir Expediente
                        </button>
                        <button
                          onClick={() => { window.location.href = `/cartera?cliente=${customer.id}`; }}
                          className="px-2 py-1 bg-emerald-700 text-white rounded text-xs font-semibold hover:bg-emerald-800"
                        >
                          Cartera
                        </button>
                        <button
                          onClick={() => openPortalAccess(customer)}
                          className="px-2 py-1 bg-indigo-700 text-white rounded text-xs font-semibold hover:bg-indigo-800"
                        >
                          Portal
                        </button>
                        <button
                          onClick={() => handleEdit(customer)}
                          className="px-2 py-1 bg-yellow-500 text-white rounded text-xs font-semibold hover:bg-yellow-600"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
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
  const [integratedData, setIntegratedData] = useState(null);
  const [loadingIntegrated, setLoadingIntegrated] = useState(true);
  const [activeSection, setActiveSection] = useState('general');
  const [portalStatus, setPortalStatus] = useState(null);

  useEffect(() => {
    if (!customer?.id) return;
    fetchIntegratedData();
    fetchPortalStatus();
  }, [customer?.id]);

  const fetchIntegratedData = async () => {
    if (!customer?.id) return;
    setLoadingIntegrated(true);
    try {
      const response = await fetch(`/api/cartera/estado-cuenta?customerId=${customer.id}`);
      const data = await response.json();
      setIntegratedData(data);
    } catch (error) {
      setIntegratedData(null);
    } finally {
      setLoadingIntegrated(false);
    }
  };

  const fetchPortalStatus = async () => {
    try {
      const res = await fetch(`/api/client-portal/admin/access?customerId=${customer.id}`);
      const data = await res.json();
      setPortalStatus(data);
    } catch { setPortalStatus({ enabled: false, hasAccess: false }); }
  };

  const openSection = (sec) => setActiveSection(sec);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <div className="text-xs text-slate-500">EXPEDIENTE ÚNICO • CATÁLOGO MAESTRO</div>
            <h2 className="text-2xl font-bold" style={{ color: primaryColor }}>
              {customer.customer_name} <span className="font-mono text-base text-emerald-700">({customer.client_number})</span>
            </h2>
          </div>
          <button onClick={onClose} className="text-3xl leading-none">×</button>
        </div>

        {/* Navegación de secciones del expediente */}
        <div className="flex flex-wrap gap-1 border-b bg-gray-50 px-4 py-2 text-sm">
          {[
            { key: 'general', label: 'INFORMACIÓN GENERAL' },
            { key: 'viajes', label: 'VIAJES' },
            { key: 'facturas', label: 'FACTURAS' },
            { key: 'depositos', label: 'DEPÓSITOS' },
            { key: 'cuenta', label: 'CUENTA CORRIENTE' },
            { key: 'estado', label: 'ESTADO DE CUENTA' },
            { key: 'portal', label: 'ACCESO AL PORTAL' },
            { key: 'docs', label: 'DOCUMENTOS' },
            { key: 'historial', label: 'HISTORIAL' }
          ].map(s => (
            <button key={s.key} onClick={() => openSection(s.key)} className={`px-3 py-1 rounded ${activeSection===s.key ? 'bg-white border font-semibold' : 'text-slate-600 hover:bg-white'}`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* INFORMACIÓN GENERAL */}
          {activeSection === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border p-4 rounded">
                  <div className="text-xs text-slate-500">NÚMERO DE CLIENTE</div>
                  <div className="font-mono text-xl">{customer.client_number || '—'}</div>
                </div>
                <div className="border p-4 rounded">
                  <div className="text-xs text-slate-500">NOMBRE COMERCIAL</div>
                  <div className="font-semibold">{customer.commercial_name || customer.customer_name}</div>
                </div>
                <div className="border p-4 rounded">
                  <div className="text-xs text-slate-500">ESTATUS COMERCIAL</div>
                  <div className="font-semibold">{customer.commercial_status || 'Activo'}</div>
                  <div className="text-xs mt-1">Plazo: {customer.payment_terms_days || 30} días • Límite: ${(parseFloat(customer.credit_limit_usd)||0).toFixed(0)} {customer.default_currency || 'USD'}</div>
                </div>
              </div>

              <div className="border p-4 rounded bg-slate-50 text-sm">
                <div className="font-semibold mb-2">Datos de Contacto y Fiscales</div>
                <div>Contacto: {customer.contact_name || '—'} • Tel: {customer.phone || '—'} • Email: {customer.email || '—'}</div>
                <div>Destino: {customer.destination || '—'} • Dirección entrega: {customer.delivery_address || customer.address || '—'}</div>
                <div>RFC Fiscal: {customer.fiscal_rfc || customer.rfc || '—'} • Razón: {customer.fiscal_razon_social || '—'}</div>
                <div className="mt-2 text-[10px] text-slate-500">Editar datos generales desde el botón Editar en la lista. Cambios se reflejan en todo el sistema.</div>
              </div>

              <div className="text-xs text-slate-500">Este es el expediente único del cliente maestro. Todas las operaciones (cargas, viajes, notas, abonos, CFDI) referencian customers.id.</div>
            </div>
          )}

          {/* VIAJES */}
          {activeSection === 'viajes' && (
            <div>
              <div className="flex justify-between mb-3">
                <div className="font-semibold">Viajes / Cargas del Cliente</div>
                <a href={`/cartera?cliente=${customer.id}`} className="text-xs underline" style={{color:primaryColor}}>Ver en Cartera →</a>
              </div>
              <ViajesList customerId={customer.id} primaryColor={primaryColor} />
              <div className="mt-2 text-[10px] text-slate-500">Fuente: viajes (vinculados por load_history_id) + load_history. Una misma carga genera un solo viaje comercial.</div>
            </div>
          )}

          {/* FACTURAS */}
          {activeSection === 'facturas' && (
            <div>
              <div className="font-semibold mb-2">Facturas / CFDI</div>
              <div className="text-sm">Las facturas (cfdi_facturas, notas) se gestionan desde Cartera y Facturación. Se vinculan por customer_id.</div>
              <a href={`/cartera?cliente=${customer.id}`} className="text-xs underline block mt-2">Ir a Cartera para ver facturas →</a>
            </div>
          )}

          {/* DEPÓSITOS */}
          {activeSection === 'depositos' && (
            <div>
              <div className="font-semibold mb-2">Depósitos / Abonos</div>
              <div className="text-sm">Abonos registrados en la tabla abonos con customer_id. Se aplican vía abono_aplicaciones.</div>
              <div className="mt-1 text-xs">Total abonos: ${(integratedData?.resumen?.total_abono_usd || 0).toFixed(2)} USD</div>
            </div>
          )}

          {/* CUENTA CORRIENTE / ESTADO */}
          {(activeSection === 'cuenta' || activeSection === 'estado') && (
            <div className="bg-white border rounded">
              <div className="p-3 border-b font-semibold flex justify-between">
                {activeSection === 'cuenta' ? 'Cuenta Corriente' : 'Estado de Cuenta'} (Fuente canónica: notas + abonos)
                <button onClick={fetchIntegratedData} className="text-xs px-2 border rounded">Actualizar</button>
              </div>
              <div className="p-3 grid grid-cols-3 gap-3 text-sm">
                <div>Total Cargos: <b>${(integratedData?.resumen?.total_cargo_usd||0).toFixed(2)}</b></div>
                <div>Total Abonos: <b>${(integratedData?.resumen?.total_abono_usd||0).toFixed(2)}</b></div>
                <div className="font-bold">Saldo Pendiente: ${(integratedData?.resumen?.saldo_pendiente_usd || 0).toFixed(2)} USD</div>
              </div>
              <div className="overflow-auto max-h-60 text-xs border-t">
                <table className="w-full">
                  <thead><tr className="bg-gray-100"><th className="p-2 text-left">Fecha</th><th>Tipo</th><th>Folio</th><th className="text-right">Cargo</th><th className="text-right">Abono</th><th className="text-right">Saldo</th></tr></thead>
                  <tbody>
                    {(integratedData?.movimientos || []).slice(0,20).map((m,i)=>(
                      <tr key={i} className="border-t"><td className="p-1">{m.fecha}</td><td>{m.tipo}</td><td>{m.folio}</td><td className="text-right text-red-600">{m.cargo?`+${m.cargo}`:''}</td><td className="text-right text-green-600">{m.abono?`+${m.abono}`:''}</td><td className="text-right">{m.saldo_acumulado}</td></tr>
                    ))}
                    {!(integratedData?.movimientos||[]).length && <tr><td colSpan="6" className="p-3 text-center text-gray-500">{loadingIntegrated?'Cargando...':'Sin movimientos'}</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="p-2 text-[10px] text-emerald-600 border-t">No se duplican registros. Cargos desde notas.importe_original_usd. Abonos desde abonos.equivalente_usd.</div>
            </div>
          )}

          {/* ACCESO AL PORTAL */}
          {activeSection === 'portal' && (
            <div className="space-y-3">
              <div className="font-semibold">Acceso al Portal de Clientes</div>
              <div>Estado: <span className={portalStatus?.enabled ? 'text-emerald-700' : 'text-red-600'}>{portalStatus?.enabled ? 'ACTIVO' : 'INACTIVO / SIN CONFIGURAR'}</span></div>
              {portalStatus?.lastLogin && <div>Último acceso: {new Date(portalStatus.lastLogin).toLocaleString('es-MX')}</div>}
              <div className="text-xs">Usa el botón "Portal Cliente" en la lista principal para generar / resetear PIN y activar (solo Superadministrador). El cliente usa Número + PIN en /portal-cliente.</div>
              <div className="text-xs text-slate-500">No se crean credenciales al abrir el expediente. Sesiones aisladas por token (seguridad etapa 1).</div>
            </div>
          )}

          {/* DOCUMENTOS / HISTORIAL */}
          {(activeSection === 'docs' || activeSection === 'historial') && (
            <div className="text-sm">
              Documentos y bitácora de actividad del cliente se consultan en los módulos correspondientes (Cartera, Facturación, Auditoría).
              <div className="mt-2 text-xs">Historial de cambios del catálogo se registra en system_audit_log.</div>
              <a href="/admin-general" className="text-xs underline">Ver Administración General →</a>
            </div>
          )}

          <div className="mt-6 text-[10px] text-center text-slate-400 border-t pt-3">
            Expediente maestro de clientes • Un solo catálogo (customers.id) compartido por todo TECAVO SOFT. Datos históricos intactos.
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cerrar</button>
          <a href={`/cartera?cliente=${customer.id}`} className="px-4 py-2 bg-emerald-700 text-white rounded text-sm">Abrir Cartera Completa</a>
        </div>
      </div>
    </div>
  );
}

function ViajesList({ customerId, primaryColor }) {
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    (async () => {
      try {
        const res = await fetch(`/api/viajes?customerId=${customerId}`);
        const data = await res.json();
        setViajes(Array.isArray(data) ? data : []);
      } catch (_) {
        setViajes([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId]);

  if (loading) return <div className="text-xs text-slate-500">Cargando viajes...</div>;

  if (!viajes.length) {
    return <div className="text-sm text-slate-500 border p-3 rounded">Sin viajes registrados para este cliente. Confirma cargas en Embarques para vincular automáticamente.</div>;
  }

  return (
    <div className="border rounded overflow-auto max-h-72 text-sm">
      <table className="w-full text-xs">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Folio</th>
            <th className="p-2 text-left">Fecha</th>
            <th className="p-2 text-left">Destino</th>
            <th className="p-2 text-right">Cajas / Kg</th>
            <th className="p-2 text-right">Valor USD</th>
            <th className="p-2 text-left">Transporte</th>
            <th className="p-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {viajes.map((v, i) => (
            <tr key={i} className="border-t">
              <td className="p-2 font-mono">{v.folio || v.load_id || '-'}</td>
              <td className="p-2">{v.fecha_salida || v.trip_date || '-'}</td>
              <td className="p-2">{v.destino || '-'}</td>
              <td className="p-2 text-right">{v.numero_cajas || 0} / {(parseFloat(v.peso) || parseFloat(v.total_kg) || 0).toFixed(0)} kg</td>
              <td className="p-2 text-right font-semibold">{(parseFloat(v.valor_usd) || parseFloat(v.price_per_trip) || 0).toFixed(2)}</td>
              <td className="p-2">{v.transportista || v.driver_name || '-'}</td>
              <td className="p-2"><span className="text-emerald-700">{v.estatus || v.status || 'Confirmado'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


