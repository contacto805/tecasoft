"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function DetalleSolicitudPage({ params }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [request, setRequest] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQuotationForm, setShowQuotationForm] = useState(false);
  const [newQuotation, setNewQuotation] = useState({
    supplierName: '',
    unitPrice: '',
    totalPrice: '',
    deliveryTime: '',
    paymentTerms: '',
    warranty: ''
  });

  useEffect(() => {
    fetchRequest();
    fetchQuotations();
    fetchOrders();
  }, []);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/purchase-requests?id=${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setRequest(data.find(r => r.id === parseInt(resolvedParams.id)));
      }
    } catch (error) {
      console.error('Error fetching request:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotations = async () => {
    try {
      const response = await fetch(`/api/purchase-quotations?requestId=${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setQuotations(data);
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`/api/purchase-orders?requestId=${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleAddQuotation = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/purchase-quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: parseInt(resolvedParams.id),
          ...newQuotation
        })
      });

      if (response.ok) {
        alert('Cotización agregada');
        setShowQuotationForm(false);
        setNewQuotation({
          supplierName: '',
          unitPrice: '',
          totalPrice: '',
          deliveryTime: '',
          paymentTerms: '',
          warranty: ''
        });
        fetchQuotations();
      }
    } catch (error) {
      console.error('Error adding quotation:', error);
    }
  };

  const handleSelectQuotation = async (quotationId) => {
    if (!confirm('¿Seleccionar esta cotización?')) return;

    try {
      const response = await fetch('/api/purchase-quotations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: quotationId,
          requestId: parseInt(resolvedParams.id)
        })
      });

      if (response.ok) {
        alert('Cotización seleccionada');
        fetchQuotations();
        fetchRequest();
      }
    } catch (error) {
      console.error('Error selecting quotation:', error);
    }
  };

  const handleGenerateOrder = async () => {
    const selectedQuotation = quotations.find(q => q.is_selected);
    if (!selectedQuotation) {
      alert('Debe seleccionar una cotización primero');
      return;
    }

    if (!confirm('¿Generar orden de compra?')) return;

    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: parseInt(resolvedParams.id),
          supplierName: selectedQuotation.supplier_name,
          productOrService: request.product_or_service,
          quantity: request.quantity_required || 1,
          unitPrice: selectedQuotation.unit_price || selectedQuotation.total_price,
          paymentTerms: selectedQuotation.payment_terms,
          deliveryDate: request.required_date,
          notes: request.description,
          authorizedBy: 'Admin'
        })
      });

      if (response.ok) {
        const order = await response.json();
        alert(`Orden de compra ${order.folio} generada`);
        fetchOrders();
        fetchRequest();
      }
    } catch (error) {
      console.error('Error generating order:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'borrador': 'bg-gray-100 text-gray-700',
      'enviada': 'bg-blue-100 text-blue-700',
      'en revisión': 'bg-yellow-100 text-yellow-700',
      'solicitando cotización': 'bg-purple-100 text-purple-700',
      'cotización recibida': 'bg-indigo-100 text-indigo-700',
      'pendiente autorización': 'bg-orange-100 text-orange-700',
      'aprobada': 'bg-green-100 text-green-700',
      'rechazada': 'bg-red-100 text-red-700',
      'orden de compra generada': 'bg-teal-100 text-teal-700',
      'material recibido': 'bg-emerald-100 text-emerald-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-gray-500">Solicitud no encontrada</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/ordenes-compra')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            ← Regresar
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{request.folio}</h1>
              <p className="text-gray-600">{request.product_or_service}</p>
            </div>
            <span className={`px-4 py-2 text-sm font-medium rounded-full ${getStatusColor(request.status)}`}>
              {request.status}
            </span>
          </div>
        </div>

        {/* Detalles de la Solicitud */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Detalles de la Solicitud</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-500">Área</div>
              <div className="font-medium text-gray-900">{request.area_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Solicitante</div>
              <div className="font-medium text-gray-900">{request.user_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Fecha de Solicitud</div>
              <div className="font-medium text-gray-900">
                {new Date(request.request_date).toLocaleDateString('es-MX')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Prioridad</div>
              <div className="font-medium text-gray-900">{request.priority}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-500">Descripción</div>
              <div className="font-medium text-gray-900">{request.description || 'N/A'}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-500">Justificación</div>
              <div className="font-medium text-gray-900">{request.justification}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Cantidad Requerida</div>
              <div className="font-medium text-gray-900">
                {request.quantity_required || 'N/A'} {request.unit_of_measure || ''}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Fecha Requerida</div>
              <div className="font-medium text-gray-900">
                {request.required_date ? new Date(request.required_date).toLocaleDateString('es-MX') : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Cotizaciones */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Cotizaciones</h2>
            <button
              onClick={() => setShowQuotationForm(!showQuotationForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              + Agregar Cotización
            </button>
          </div>

          {showQuotationForm && (
            <form onSubmit={handleAddQuotation} className="mb-6 p-4 border border-gray-200 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Proveedor"
                  value={newQuotation.supplierName}
                  onChange={(e) => setNewQuotation({ ...newQuotation, supplierName: e.target.value })}
                  required
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Precio Total"
                  value={newQuotation.totalPrice}
                  onChange={(e) => setNewQuotation({ ...newQuotation, totalPrice: e.target.value })}
                  required
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Tiempo de Entrega"
                  value={newQuotation.deliveryTime}
                  onChange={(e) => setNewQuotation({ ...newQuotation, deliveryTime: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Términos de Pago"
                  value={newQuotation.paymentTerms}
                  onChange={(e) => setNewQuotation({ ...newQuotation, paymentTerms: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuotationForm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {quotations.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No hay cotizaciones registradas</div>
          ) : (
            <div className="space-y-4">
              {quotations.map(q => (
                <div
                  key={q.id}
                  className={`p-4 border rounded-lg ${q.is_selected ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{q.supplier_name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Precio Total: ${parseFloat(q.total_price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-600">Tiempo de Entrega: {q.delivery_time || 'N/A'}</div>
                      <div className="text-sm text-gray-600">Términos de Pago: {q.payment_terms || 'N/A'}</div>
                    </div>
                    {!q.is_selected && (
                      <button
                        onClick={() => handleSelectQuotation(q.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Seleccionar
                      </button>
                    )}
                    {q.is_selected && (
                      <span className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">
                        Seleccionada
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {quotations.some(q => q.is_selected) && request.status !== 'orden de compra generada' && (
            <div className="mt-6">
              <button
                onClick={handleGenerateOrder}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Generar Orden de Compra
              </button>
            </div>
          )}
        </div>

        {/* Órdenes de Compra */}
        {orders.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Órdenes de Compra</h2>
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-gray-900">{order.folio}</div>
                      <div className="text-sm text-gray-600 mt-1">Proveedor: {order.supplier_name}</div>
                      <div className="text-sm text-gray-600">
                        Total: ${parseFloat(order.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {order.currency}
                      </div>
                      <div className="text-sm text-gray-600">
                        Fecha: {new Date(order.order_date).toLocaleDateString('es-MX')}
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm">
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
