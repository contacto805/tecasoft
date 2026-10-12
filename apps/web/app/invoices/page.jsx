'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [formData, setFormData] = useState({
    invoice_number: '',
    customer_name: '',
    customer_rfc: '',
    customer_address: '',
    invoice_date: new Date().toISOString().split('T')[0],
    notes: '',
    items: []
  });
  const [newItem, setNewItem] = useState({
    product_name: '',
    quantity: '',
    unit_price: ''
  });

  useEffect(() => {
    fetchInvoices();
    fetchPrinters();
    fetchNextNumber();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/printer-settings');
      if (res.ok) {
        const data = await res.json();
        setPrinters(data.filter(p => p.is_active));
      }
    } catch (error) {
      console.error('Error fetching printers:', error);
    }
  };

  const fetchNextNumber = async () => {
    try {
      const res = await fetch('/api/invoices/next-number');
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, invoice_number: data.nextNumber }));
      }
    } catch (error) {
      console.error('Error fetching next number:', error);
    }
  };

  const addItem = () => {
    if (!newItem.product_name || !newItem.quantity || !newItem.unit_price) {
      alert('Por favor completa todos los campos del artículo');
      return;
    }

    const quantity = parseFloat(newItem.quantity);
    const unitPrice = parseFloat(newItem.unit_price);

    // Validación de números
    if (isNaN(quantity) || quantity <= 0) {
      alert('La cantidad debe ser un número mayor a 0');
      return;
    }

    if (isNaN(unitPrice) || unitPrice <= 0) {
      alert('El precio unitario debe ser un número mayor a 0');
      return;
    }

    const subtotal = quantity * unitPrice;

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product_name: newItem.product_name,
          quantity,
          unit_price: unitPrice,
          subtotal
        }
      ]
    });

    setNewItem({ product_name: '', quantity: '', unit_price: '' });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      const itemSubtotal = parseFloat(item.subtotal) || 0;
      return sum + itemSubtotal;
    }, 0);
    const tax = subtotal * 0.16; // 16% IVA
    const total = subtotal + tax;
    
    return { 
      subtotal: Math.round(subtotal * 100) / 100, 
      tax: Math.round(tax * 100) / 100, 
      total: Math.round(total * 100) / 100 
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación de campos obligatorios
    if (!formData.invoice_number || !formData.invoice_number.trim()) {
      alert('El número de factura es obligatorio');
      return;
    }

    if (!formData.customer_name || !formData.customer_name.trim()) {
      alert('El nombre del cliente es obligatorio');
      return;
    }

    if (!formData.invoice_date) {
      alert('La fecha de factura es obligatoria');
      return;
    }

    if (formData.items.length === 0) {
      alert('Agrega al menos un artículo a la factura');
      return;
    }

    const totals = calculateTotals();

    // Validación de totales
    if (totals.subtotal <= 0) {
      alert('El subtotal debe ser mayor a 0');
      return;
    }

    try {
      const method = editingInvoice ? 'PUT' : 'POST';
      const body = editingInvoice
        ? { ...formData, ...totals, id: editingInvoice.id }
        : { ...formData, ...totals };

      const res = await fetch('/api/invoices', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        alert(editingInvoice ? 'Factura actualizada correctamente' : 'Factura creada correctamente');
        fetchInvoices();
        closeModal();
        if (!editingInvoice) {
          fetchNextNumber();
        }
      } else {
        const error = await res.json();
        alert('Error al guardar la factura: ' + (error.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error al guardar la factura: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta factura?')) return;

    try {
      const res = await fetch(`/api/invoices?id=${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchInvoices();
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const openModal = async (invoice = null) => {
    if (invoice) {
      // Load full invoice with items
      const res = await fetch(`/api/invoices?id=${invoice.id}`);
      if (res.ok) {
        const fullInvoice = await res.json();
        setEditingInvoice(fullInvoice);
        setFormData({
          invoice_number: fullInvoice.invoice_number,
          customer_name: fullInvoice.customer_name,
          customer_rfc: fullInvoice.customer_rfc || '',
          customer_address: fullInvoice.customer_address || '',
          invoice_date: fullInvoice.invoice_date.split('T')[0],
          notes: fullInvoice.notes || '',
          items: fullInvoice.items || []
        });
      }
    } else {
      setEditingInvoice(null);
      fetchNextNumber();
      setFormData({
        invoice_number: '',
        customer_name: '',
        customer_rfc: '',
        customer_address: '',
        invoice_date: new Date().toISOString().split('T')[0],
        notes: '',
        items: []
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingInvoice(null);
    setNewItem({ product_name: '', quantity: '', unit_price: '' });
  };

  const printInvoice = async (invoice) => {
    const defaultPrinter = printers.find(p => p.is_default);
    
    if (!defaultPrinter) {
      alert('No hay impresora predeterminada configurada. Por favor configura una impresora en el módulo de Configuración de Impresoras.');
      return;
    }

    // Load full invoice with items
    const res = await fetch(`/api/invoices?id=${invoice.id}`);
    if (!res.ok) return;
    
    const fullInvoice = await res.json();

    // Generate thermal receipt format (80mm)
    const width = defaultPrinter.paper_width_mm === 80 ? 48 : 32; // characters per line
    const line = '='.repeat(width);
    const spaceLine = '-'.repeat(width);

    let receipt = '\n';
    receipt += centerText('TECAVO SOFT', width) + '\n';
    receipt += centerText('FACTURA DE VENTA', width) + '\n';
    receipt += line + '\n\n';
    
    receipt += `No. Factura: ${fullInvoice.invoice_number}\n`;
    receipt += `Fecha: ${new Date(fullInvoice.invoice_date).toLocaleDateString('es-MX')}\n`;
    receipt += spaceLine + '\n\n';
    
    receipt += 'CLIENTE:\n';
    receipt += `${fullInvoice.customer_name}\n`;
    if (fullInvoice.customer_rfc) {
      receipt += `RFC: ${fullInvoice.customer_rfc}\n`;
    }
    if (fullInvoice.customer_address) {
      receipt += wrapText(fullInvoice.customer_address, width) + '\n';
    }
    receipt += spaceLine + '\n\n';
    
    receipt += 'ARTÍCULOS:\n';
    receipt += spaceLine + '\n';
    
    fullInvoice.items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const sub = parseFloat(item.subtotal) || 0;
      receipt += wrapText(item.product_name, width) + '\n';
      receipt += `  ${qty} x $${price.toFixed(2)}`;
      receipt += ' '.repeat(Math.max(0, width - 10 - qty.toString().length - price.toFixed(2).length - sub.toFixed(2).length));
      receipt += `$${sub.toFixed(2)}\n`;
    });
    
    receipt += spaceLine + '\n';
    receipt += alignText('SUBTOTAL:', `$${(parseFloat(fullInvoice.subtotal) || 0).toFixed(2)}`, width) + '\n';
    receipt += alignText('IVA (16%):', `$${(parseFloat(fullInvoice.tax) || 0).toFixed(2)}`, width) + '\n';
    receipt += line + '\n';
    receipt += alignText('TOTAL:', `$${(parseFloat(fullInvoice.total) || 0).toFixed(2)}`, width, true) + '\n';
    receipt += line + '\n\n';
    
    if (fullInvoice.notes) {
      receipt += 'NOTAS:\n';
      receipt += wrapText(fullInvoice.notes, width) + '\n';
      receipt += spaceLine + '\n\n';
    }
    
    receipt += centerText('¡Gracias por su compra!', width) + '\n';
    receipt += centerText('www.tecavosoft.com', width) + '\n\n\n';

    // Show print preview
    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Factura ${fullInvoice.invoice_number}</title>
          <style>
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px;
              line-height: 1.4;
              padding: 20px;
              max-width: ${defaultPrinter.paper_width_mm}mm;
              margin: 0 auto;
            }
            pre { 
              white-space: pre-wrap; 
              word-wrap: break-word;
              margin: 0;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <pre>${receipt}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Helper functions for thermal printing
  const centerText = (text, width) => {
    const padding = Math.floor((width - text.length) / 2);
    return ' '.repeat(Math.max(0, padding)) + text;
  };

  const alignText = (left, right, width, bold = false) => {
    const spaces = width - left.length - right.length;
    const line = left + ' '.repeat(Math.max(0, spaces)) + right;
    return bold ? line.toUpperCase() : line;
  };

  const wrapText = (text, width) => {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + word).length <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
  };

  const totals = calculateTotals();

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
              <h1 className="text-lg font-bold text-slate-900">Facturación</h1>
              <p className="text-sm text-slate-500">Gestión de facturas de venta</p>
            </div>
          </div>
          <button
            onClick={() => openModal()}
            className="px-4 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors flex items-center gap-2"
          >
            <i className="ph ph-plus-circle"></i>
            Nueva Factura
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">No. Factura</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Artículos</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Total</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-slate-900">{invoice.invoice_number}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{invoice.customer_name}</p>
                        {invoice.customer_rfc && (
                          <p className="text-sm text-slate-500">RFC: {invoice.customer_rfc}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(invoice.invoice_date).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {invoice.item_count} artículo{invoice.item_count !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-slate-900">${(parseFloat(invoice.total) || 0).toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => printInvoice(invoice)}
                          className="p-2 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors"
                          title="Imprimir"
                        >
                          <i className="ph ph-printer text-lg"></i>
                        </button>
                        <button
                          onClick={() => openModal(invoice)}
                          className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                          title="Editar"
                        >
                          <i className="ph ph-pencil text-lg"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                          title="Eliminar"
                        >
                          <i className="ph ph-trash text-lg"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {invoices.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ph ph-file-text text-3xl text-slate-400"></i>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No hay facturas registradas</h3>
                <p className="text-slate-500 mb-4">Crea tu primera factura para comenzar</p>
                <button
                  onClick={() => openModal()}
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors inline-flex items-center gap-2"
                >
                  <i className="ph ph-plus-circle"></i>
                  Nueva Factura
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingInvoice ? 'Editar Factura' : 'Nueva Factura'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <i className="ph ph-x text-xl text-slate-600"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Invoice Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    No. Factura
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900"
                  />
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Información del Cliente</h3>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nombre / Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      RFC
                    </label>
                    <input
                      type="text"
                      value={formData.customer_rfc}
                      onChange={(e) => setFormData({ ...formData, customer_rfc: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 uppercase"
                      maxLength={13}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={formData.customer_address}
                      onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Artículos</h3>

                {/* Add Item Form */}
                <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-5">
                      <input
                        type="text"
                        placeholder="Nombre del producto"
                        value={newItem.product_name}
                        onChange={(e) => setNewItem({ ...newItem, product_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Cantidad"
                        step="0.01"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="Precio unitario"
                        step="0.01"
                        value={newItem.unit_price}
                        onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={addItem}
                        className="w-full px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                {formData.items.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Producto</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Cantidad</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Precio Unit.</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Subtotal</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {formData.items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-slate-900">{item.product_name}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-600">${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">${parseFloat(item.subtotal || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <i className="ph ph-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Totals */}
              {formData.items.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>IVA (16%):</span>
                    <span className="font-semibold">${totals.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total:</span>
                    <span>${totals.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900"
                  placeholder="Condiciones de pago, observaciones, etc."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors"
                >
                  {editingInvoice ? 'Actualizar Factura' : 'Crear Factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
