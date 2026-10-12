'use client';

import { useState, useEffect } from 'react';
import { DollarSign, User, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function ProducerPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [lots, setLots] = useState([]);
  const [filter, setFilter] = useState('Todos');
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  useEffect(() => {
    fetchPayments();
    fetchLots();
  }, [filter]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const url = filter !== 'Todos'
        ? `/api/producer-payments?status=${filter}`
        : '/api/producer-payments';
      const response = await fetch(url);
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLots = async () => {
    try {
      const response = await fetch('/api/lots');
      const data = await response.json();
      setLots(data);
    } catch (error) {
      console.error('Error fetching lots:', error);
    }
  };

  const generatePaymentsFromLots = async () => {
    if (!confirm('¿Generar pagos pendientes para todos los lotes sin pago asignado?')) return;
    
    try {
      for (const lot of lots) {
        // Verificar si ya existe un pago para este lote
        const existingPayment = payments.find(p => p.lot_id === lot.id);
        
        if (!existingPayment && lot.total_kg_received > 0 && lot.fruit_price > 0) {
          await fetch('/api/producer-payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lotId: lot.id,
              producerName: lot.producer,
              totalKgReceived: lot.total_kg_received,
              fruitPricePerKg: lot.fruit_price,
              scheduledPaymentDate: lot.payment_scheduled_date,
              notes: `Pago automático generado para lote ${lot.lot_number}`
            })
          });
        }
      }
      
      alert('Pagos generados exitosamente');
      fetchPayments();
    } catch (error) {
      console.error('Error generating payments:', error);
      alert('Error al generar pagos');
    }
  };

  const markAsPaid = async (paymentId, actualPaymentDate) => {
    try {
      const response = await fetch('/api/producer-payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: paymentId,
          paymentStatus: 'Pagado',
          actualPaymentDate: actualPaymentDate || new Date().toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        alert('Pago registrado exitosamente');
        setShowPayModal(false);
        setSelectedPayment(null);
        fetchPayments();
      }
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      alert('Error al registrar pago');
    }
  };

  const statusColors = {
    'Pendiente': 'bg-yellow-100 text-yellow-800',
    'Pagado': 'bg-green-100 text-green-800',
    'Cancelado': 'bg-red-100 text-red-800'
  };

  const totalPendiente = payments
    .filter(p => p.payment_status === 'Pendiente')
    .reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);

  const totalPagado = payments
    .filter(p => p.payment_status === 'Pagado')
    .reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);

  // Agrupar por productor
  const paymentsByProducer = payments.reduce((acc, payment) => {
    const producer = payment.producer_name;
    if (!acc[producer]) {
      acc[producer] = {
        totalAmount: 0,
        totalKg: 0,
        pendingAmount: 0,
        paidAmount: 0,
        paymentCount: 0
      };
    }
    
    acc[producer].totalAmount += parseFloat(payment.total_amount || 0);
    acc[producer].totalKg += parseFloat(payment.total_kg_received || 0);
    acc[producer].paymentCount += 1;
    
    if (payment.payment_status === 'Pendiente') {
      acc[producer].pendingAmount += parseFloat(payment.total_amount || 0);
    } else if (payment.payment_status === 'Pagado') {
      acc[producer].paidAmount += parseFloat(payment.total_amount || 0);
    }
    
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando pagos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <User className="w-8 h-8 text-blue-600" />
                Pagos a Productores
              </h1>
              <p className="text-gray-600 mt-1">Gestión de pagos por lote recibido</p>
            </div>
            <button
              onClick={generatePaymentsFromLots}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Generar Pagos Pendientes
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">Pendientes de Pago</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    ${totalPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Pagados</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${totalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Pagos</p>
                  <p className="text-2xl font-bold text-blue-600">{payments.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen por Productor */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Resumen por Productor</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(paymentsByProducer).map(([producer, stats]) => (
              <div key={producer} className="border rounded-lg p-4">
                <h3 className="font-bold text-gray-900 mb-2">{producer}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Kg:</span>
                    <span className="font-medium">{stats.totalKg.toLocaleString('es-MX')} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pendiente:</span>
                    <span className="font-medium text-yellow-600">
                      ${stats.pendingAmount.toLocaleString('es-MX')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pagado:</span>
                    <span className="font-medium text-green-600">
                      ${stats.paidAmount.toLocaleString('es-MX')}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold text-blue-600">
                      ${stats.totalAmount.toLocaleString('es-MX')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-2">
            {['Todos', 'Pendiente', 'Pagado', 'Cancelado'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de Pagos */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lote</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Productor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Huerta</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kg Recibidos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio/Kg</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fecha Programada</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{payment.lot_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{payment.producer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{payment.orchard_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {parseFloat(payment.total_kg_received).toLocaleString('es-MX')} kg
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      ${parseFloat(payment.fruit_price_per_kg).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                      ${parseFloat(payment.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {payment.scheduled_payment_date 
                        ? new Date(payment.scheduled_payment_date).toLocaleDateString('es-MX')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[payment.payment_status]}`}>
                        {payment.payment_status}
                      </span>
                      {payment.actual_payment_date && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(payment.actual_payment_date).toLocaleDateString('es-MX')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {payment.payment_status === 'Pendiente' && (
                        <button
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowPayModal(true);
                          }}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Marcar Pagado
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Marcar como Pagado */}
      {showPayModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Registrar Pago</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Productor:</span>
                <span className="font-medium">{selectedPayment.producer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Lote:</span>
                <span className="font-medium">{selectedPayment.lot_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Monto:</span>
                <span className="font-bold text-green-600">
                  ${parseFloat(selectedPayment.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago</label>
              <input
                type="date"
                id="paymentDate"
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPayModal(false);
                  setSelectedPayment(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const paymentDate = document.getElementById('paymentDate').value;
                  markAsPaid(selectedPayment.id, paymentDate);
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
