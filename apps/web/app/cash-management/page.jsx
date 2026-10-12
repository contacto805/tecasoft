'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBranding } from '@/hooks/useBranding';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function CashManagementPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sales-process-waste');
      const data = await response.json();
      setSales(data || []);
    } catch (error) {
      console.error('Error loading sales:', error);
      alert('Error al cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  // Filter sales based on criteria
  const filteredSales = sales.filter(sale => {
    // Filter by status
    if (filterStatus !== 'todos' && sale.payment_status !== filterStatus) {
      return false;
    }

    // Filter by search term
    if (searchTerm && !sale.lot_number?.includes(searchTerm) && !sale.sales_folio?.includes(searchTerm)) {
      return false;
    }

    // Filter by date range
    const saleDate = new Date(sale.date);
    if (fromDate && saleDate < new Date(fromDate)) {
      return false;
    }
    if (toDate && saleDate > new Date(toDate)) {
      return false;
    }

    return true;
  });

  // Calculate totals
  const totalRevenue = filteredSales.reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
  const paidAmount = filteredSales
    .filter(s => s.payment_status === 'pagado')
    .reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
  const pendingAmount = filteredSales
    .filter(s => s.payment_status === 'pendiente')
    .reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);

  const markAsPaid = async (saleId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'pagado' ? 'pendiente' : 'pagado';
      const sale = sales.find(s => s.id === saleId);
      
      const response = await fetch('/api/sales-process-waste', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: saleId,
          boxCount: sale.boxes,
          withPallet: sale.with_pallet,
          grossWeight: sale.gross_weight,
          netWeight: sale.net_weight,
          unitPrice: sale.unit_price,
          totalPrice: sale.total_price,
          notes: sale.notes,
          paymentStatus: newStatus
        })
      });

      if (response.ok) {
        await loadSales();
        alert(`Venta marcada como ${newStatus === 'pagado' ? 'Pagada' : 'Pendiente'}`);
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Error al actualizar estado de pago');
    }
  };

  const downloadReceiptPDF = async (sale) => {
    try {
      const html = generateReceiptHTML(sale);
      const element = document.createElement('div');
      element.innerHTML = html;
      element.style.display = 'none';
      document.body.appendChild(element);

      const canvas = await html2canvas(element.querySelector('.receipt'), {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Venta-${sale.sales_folio || sale.id}.pdf`);

      document.body.removeChild(element);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar PDF');
    }
  };

  const generateReceiptHTML = (sale) => {
    const companyName = branding?.companyName || 'TECAVO SOFT';
    const date = new Date(sale.date || sale.created_at).toLocaleDateString('es-MX');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Comprobante de Venta</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            margin: 20px;
            color: #000;
          }
          .receipt {
            max-width: 600px;
            margin: 0 auto;
            border: 2px solid #333;
            padding: 30px;
            background: white;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .company-name {
            font-size: 18px;
            font-weight: bold;
            margin: 10px 0;
          }
          .divider {
            border-bottom: 1px dashed #333;
            margin: 15px 0;
          }
          .section {
            margin: 15px 0;
          }
          .section-title {
            font-weight: bold;
            font-size: 13px;
            margin: 10px 0 8px 0;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin: 5px 0;
            line-height: 1.5;
          }
          .label {
            font-weight: bold;
            width: 50%;
          }
          .value {
            text-align: right;
            width: 50%;
          }
          .total-row {
            border-top: 2px solid #333;
            border-bottom: 2px solid #333;
            font-weight: bold;
            padding: 8px 0;
            font-size: 16px;
            margin: 10px 0;
          }
          .payment-status {
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            padding: 8px;
            margin: 10px 0;
            border: 2px solid #333;
          }
          .paid {
            background: #e8f5e9;
            color: #2e7d32;
            border-color: #2e7d32;
          }
          .pending {
            background: #fff3e0;
            color: #e65100;
            border-color: #e65100;
          }
          .footer {
            text-align: center;
            font-size: 11px;
            margin-top: 20px;
            border-top: 2px solid #333;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="company-name">${companyName}</div>
            <div style="font-size: 12px; margin: 5px 0;">Reporte de Contado - Ventas de Proceso y Desecho</div>
          </div>

          <div class="section">
            <div class="section-title">INFORMACIÓN DE VENTA</div>
            <div class="row">
              <span class="label">Folio:</span>
              <span class="value">${sale.sales_folio || 'S/N'}</span>
            </div>
            <div class="row">
              <span class="label">Lote:</span>
              <span class="value">${sale.lot_number || 'S/N'}</span>
            </div>
            <div class="row">
              <span class="label">Fecha:</span>
              <span class="value">${date}</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="section">
            <div class="section-title">DETALLES DE PESO Y PRECIO</div>
            <div class="row">
              <span class="label">Kilogramos Netos:</span>
              <span class="value">${parseFloat(sale.net_weight).toFixed(2)} kg</span>
            </div>
            <div class="row">
              <span class="label">Precio por Kg:</span>
              <span class="value">$${parseFloat(sale.unit_price).toFixed(2)}</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="row total-row">
            <span class="label">TOTAL:</span>
            <span class="value">$${parseFloat(sale.total_price).toFixed(2)}</span>
          </div>

          <div class="payment-status ${sale.payment_status === 'pagado' ? 'paid' : 'pending'}">
            ${sale.payment_status === 'pagado' ? '✓ PAGADO' : '⏱ PENDIENTE DE PAGO'}
          </div>

          ${sale.notes ? `
            <div class="section">
              <div class="section-title">OBSERVACIONES</div>
              <div style="font-size: 12px; line-height: 1.5;">${sale.notes}</div>
            </div>
          ` : ''}

          <div class="footer">
            <p>Sistema TECAVO SOFT</p>
            <p>${new Date().toLocaleString('es-MX')}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <i className="ph ph-arrow-left text-xl text-slate-600"></i>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Módulo de Contado</h1>
              <p className="text-sm text-slate-500">Gestión de pagos de ventas de proceso y desecho</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Revenue */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">INGRESOS TOTALES</p>
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><i className="ph ph-currency-dollar text-xl"></i></span>
            </div>
            <p className="text-3xl font-bold text-slate-900">${totalRevenue.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-500 mt-2">{filteredSales.length} ventas</p>
          </div>

          {/* Paid Amount */}
          <div className="bg-white p-6 rounded-2xl border border-green-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-green-600">✓ PAGADO</p>
              <span className="p-2 bg-green-50 text-green-600 rounded-lg"><i className="ph ph-check-circle text-xl"></i></span>
            </div>
            <p className="text-3xl font-bold text-green-700">${paidAmount.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-green-600 mt-2">{filteredSales.filter(s => s.payment_status === 'pagado').length} ventas cobradas</p>
          </div>

          {/* Pending Amount */}
          <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-red-600">⏱ PENDIENTE</p>
              <span className="p-2 bg-red-50 text-red-600 rounded-lg"><i className="ph ph-clock text-xl"></i></span>
            </div>
            <p className="text-3xl font-bold text-red-700">${pendingAmount.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-red-600 mt-2">{filteredSales.filter(s => s.payment_status === 'pendiente').length} ventas por cobrar</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
          <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
            <i className="ph-fill ph-funnel text-brand-600"></i>
            Filtros
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Estado de Pago</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              >
                <option value="todos">Todos</option>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Buscar Lote/Folio</label>
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Lote o Folio..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Desde</label>
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Hasta</label>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              />
            </div>
          </div>

          {(filterStatus !== 'todos' || searchTerm || fromDate || toDate) && (
            <button
              onClick={() => {
                setFilterStatus('todos');
                setSearchTerm('');
                setFromDate('');
                setToDate('');
              }}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Folio</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Lote</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Kilogramos</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                      <i className="ph ph-spinner text-4xl animate-spin mb-2 block"></i>
                      Cargando...
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                      <i className="ph ph-package text-4xl mb-2 block"></i>
                      No hay ventas para mostrar
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">{sale.sales_folio || sale.id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-700">{sale.lot_number}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-medium text-slate-900">{parseFloat(sale.net_weight).toFixed(2)} kg</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-slate-900">${parseFloat(sale.total_price).toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                          sale.payment_status === 'pagado'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {sale.payment_status === 'pagado' ? '✓ Pagado' : '⏱ Pendiente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-slate-600 text-sm">{new Date(sale.date).toLocaleDateString('es-MX')}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => markAsPaid(sale.id, sale.payment_status)}
                            title={sale.payment_status === 'pagado' ? 'Marcar como pendiente' : 'Marcar como pagado'}
                            className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-1 ${
                              sale.payment_status === 'pagado'
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            <i className={sale.payment_status === 'pagado' ? 'ph ph-clock' : 'ph ph-check-circle'}></i>
                          </button>
                          <button
                            onClick={() => downloadReceiptPDF(sale)}
                            title="Descargar comprobante"
                            className="px-3 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 transition-colors text-sm flex items-center gap-1"
                          >
                            <i className="ph ph-download"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}