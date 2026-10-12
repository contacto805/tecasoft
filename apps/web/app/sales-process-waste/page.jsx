'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useScaleDevice } from '@/hooks/useScaleDevice';
import { useBranding } from '@/hooks/useBranding';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function SalesProcessWastePage() {
  const router = useRouter();
  const { weight, isConnected } = useScaleDevice();
  const { branding } = useBranding();
  const [records, setRecords] = useState([]);
  const [lots, setLots] = useState([]);
  const [originLots, setOriginLots] = useState([]);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [printing, setPrinting] = useState(null);
  
  // Weighing module
  const [showWeighingPanel, setShowWeighingPanel] = useState(false);
  const [weightReadings, setWeightReadings] = useState([]);

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterBuyer, setFilterBuyer] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);



  const [formData, setFormData] = useState({
    lotId: '',
    boxCount: '',
    withPallet: false,
    grossWeight: '',
    netWeight: '',
    unitPrice: '',
    totalPrice: '',
    notes: '',
    paymentStatus: 'pendiente',
    productType: '',
    buyerName: '',
    destination: ''
  });

  // Additional state for auto-fill from Lote de Origen
  const [originType, setOriginType] = useState('');
  const [originKg, setOriginKg] = useState(0);

  useEffect(() => {
    loadRecords();
    loadLots();
    loadOriginLots();
  }, []);

  // Calculate net weight when boxes or weight changes
  useEffect(() => {
    const gw = parseFloat(formData.grossWeight);
    if (gw && !isNaN(gw)) {
      const tarePerBox = 2; // 2 kg per box
      const paletTare = formData.withPallet ? 22 : 0; // 22 kg if with pallet
      const totalBoxes = parseFloat(formData.boxCount) || 0;
      const totalTare = (totalBoxes * tarePerBox) + paletTare;
      const netWeight = (gw - totalTare).toFixed(2);
      
      setFormData(prev => ({
        ...prev,
        netWeight: parseFloat(netWeight) > 0 ? netWeight : '0.00'
      }));
    }
  }, [formData.boxCount, formData.grossWeight, formData.withPallet]);

  // Real-time search
  useEffect(() => {
    const searchRecords = async () => {
      if (!searchTerm && !fromDate && !toDate && !filterBuyer) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (filterBuyer) params.append('buyer', filterBuyer);
      
      try {
        const response = await fetch(`/api/sales-process-waste?${params.toString()}`);
        const data = await response.json();
        // Simple client-side filtering
        let filtered = Array.isArray(data) ? data : [];
        if (searchTerm) {
          filtered = filtered.filter(r => 
            (r.source_batch_number || '').includes(searchTerm) ||
            (r.sales_folio || '').includes(searchTerm) ||
            (r.product_name || '').includes(searchTerm)
          );
        }
        if (filterBuyer) {
          filtered = filtered.filter(r => r.buyer_name === filterBuyer);
        }
        if (fromDate) {
          const fd = new Date(fromDate);
          filtered = filtered.filter(r => {
            const d = r.date ? new Date(r.date) : null;
            return d && !isNaN(d) && d >= fd;
          });
        }
        if (toDate) {
          const td = new Date(toDate);
          filtered = filtered.filter(r => {
            const d = r.date ? new Date(r.date) : null;
            return d && !isNaN(d) && d <= td;
          });
        }
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching records:', error);
      } finally {
        setIsSearching(false);
      }
    };
    
    const timeoutId = setTimeout(searchRecords, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, fromDate, toDate, filterBuyer]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sales-process-waste');
      const data = await response.json();
      console.log('Sales records loaded:', data);
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading records:', error);
      setRecords([]);
      alert('Error al cargar registros de venta');
    } finally {
      setLoading(false);
    }
  };

  const loadLots = async () => {
    try {
      const response = await fetch('/api/lots');
      const data = await response.json();
      console.log('Lots loaded:', data);
      const lotsArray = Array.isArray(data) ? data : [];
      setLots(lotsArray);
    } catch (error) {
      console.error('Error loading lots:', error);
      setLots([]);
      alert('Error al cargar lotes');
    }
  };

  const loadOriginLots = async () => {
    try {
      const response = await fetch('/api/sales-process-waste?origen=true');
      const data = await response.json();
      const arr = Array.isArray(data) ? data : [];
      setOriginLots(arr);
    } catch (error) {
      console.error('Error loading origin lots:', error);
      setOriginLots([]);
    }
  };





  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = editingId ? 'PUT' : 'POST';
      const payload = editingId
        ? { id: editingId, ...formData, productType: originType || formData.productType }
        : { ...formData, productType: originType || formData.productType, buyerName: formData.buyerName, destination: formData.destination };

      console.log('Submitting payload:', payload);

      const response = await fetch('/api/sales-process-waste', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Success response:', result);

        // Consume/remove the origin lot stub so it no longer appears in "Lotes disponibles"
        if (!editingId && selectedOrigin && selectedOrigin.id) {
          try {
            await fetch(`/api/sales-process-waste?id=${selectedOrigin.id}`, { method: 'DELETE' });
          } catch (e) {
            // ignore silent
          }
        }

        loadRecords();
        loadOriginLots();
        setShowForm(false);
        setEditingId(null);
        resetFormData();
        alert(editingId ? 'Registro actualizado' : 'Registro creado exitosamente. Ticket enviado a impresora.');
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        alert(`Error al guardar: ${errorData.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Error saving record:', error);
      alert('Error al guardar el registro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setFormData({
      lotId: record.lot_id || '',
      boxCount: record.boxes || '',
      withPallet: record.with_pallet || false,
      grossWeight: record.gross_weight || '',
      netWeight: record.net_weight || '',
      unitPrice: record.unit_price || '',
      totalPrice: record.total_price || '',
      notes: record.notes || '',
      paymentStatus: record.payment_status || 'pendiente',
      productType: record.product_name || '',
      buyerName: record.buyer_name || '',
      destination: record.destination || ''
    });
    setEditingId(record.id);
    setSelectedOrigin(null);
    setOriginType('');
    setOriginKg(0);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;

    try {
      const response = await fetch(`/api/sales-process-waste?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadRecords();
        alert('Registro eliminado');
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Error al eliminar el registro');
    }
  };

  const handlePrint = async (record) => {
    setPrinting(record.id);
    try {
      // Generate HTML for the ticket
      const html = generateTicketHTML(record);
      
      // Open in new window for printing
      const printWindow = window.open('', '', 'width=800,height=600');
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      };

      // Also send to API for printer integration
      try {
        await fetch('/api/sales-process-waste/print-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId: record.id })
        });
      } catch (err) {
        console.log('Ticket info sent (printer may not be configured)');
      }
    } catch (error) {
      console.error('Error printing:', error);
      alert('Error al imprimir el ticket');
    } finally {
      setPrinting(null);
    }
  };

  const downloadTicketPDF = async (record) => {
    try {
      const ticketHTML = generateTicketHTML(record);
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.innerHTML = ticketHTML;
      document.body.appendChild(container);

      const ticketEl = container.querySelector('.ticket');
      if (!ticketEl) throw new Error('Ticket element not found');

      const canvas = await html2canvas(ticketEl, {
        backgroundColor: '#ffffff',
        scale: 3,
        logging: false,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      const finalH = Math.min(imgHeight, pageHeight - 20);

      pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, finalH);
      pdf.save(`Nota-Venta-${record.sales_folio || ('ID' + record.id)}.pdf`);

      document.body.removeChild(container);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar PDF: ' + (error.message || 'Desconocido'));
    }
  };

  const downloadTicketImage = async (record) => {
    try {
      const ticketHTML = generateTicketHTML(record);
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.innerHTML = ticketHTML;
      document.body.appendChild(container);

      const ticketEl = container.querySelector('.ticket');
      if (!ticketEl) throw new Error('Ticket element not found');

      const canvas = await html2canvas(ticketEl, {
        backgroundColor: '#ffffff',
        scale: 3,
        logging: false,
        useCORS: true
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png', 0.98);
      link.download = `Nota-Venta-${record.sales_folio || ('ID' + record.id)}.png`;
      link.click();

      document.body.removeChild(container);
    } catch (error) {
      console.error('Error downloading PNG:', error);
      alert('Error al descargar PNG: ' + (error.message || 'Desconocido'));
    }
  };

  const generateTicketHTML = (record) => {
    const companyName = (branding?.companyName || branding?.company_name || 'EMPAQUE TECAVO').replace(/</g,'<').replace(/>/g,'>');
    const companyAddr = (branding?.address || 'Carretera a Huerta s/n, Michoacán').replace(/</g,'<');

    const folio = record.sales_folio || ('ID-' + (record.id || '0'));
    const loteNum = record.lot_number || record.source_batch_number || 'S/N';
    const productor = record.producer || '-';
    const tipo = record.product_name || record.productType || 'Venta';
    const fecha = (record.date || record.created_at) ? new Date(record.date || record.created_at).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX');
    const cajas = parseInt(record.boxes) || 0;
    const tieneTarima = !!record.with_pallet;
    const bruto = parseFloat(record.gross_weight || 0).toFixed(2);
    const neto = parseFloat(record.net_weight || 0).toFixed(2);
    const precioKg = parseFloat(record.unit_price || 0).toFixed(2);
    const total = parseFloat(record.total_price || 0).toFixed(2);
    const comprador = (record.buyer_name || '-').replace(/</g,'<');
    const destino = (record.destination || '-').replace(/</g,'<');
    const obs = (record.notes || '').replace(/</g,'<');

    return `
      <div class="ticket" style="width:360px; margin:10px auto; border:3px solid #222; padding:16px; font-family:monospace; background:#fff; color:#000; font-size:12px; line-height:1.35;">
        <div style="text-align:center; border-bottom:2px solid #222; padding-bottom:10px; margin-bottom:12px;">
          <div style="font-size:16px; font-weight:700; letter-spacing:1px;">${companyName}</div>
          <div style="font-size:10px; color:#444;">${companyAddr}</div>
        </div>

        <div style="margin-bottom:9px;">
          <div style="text-align:center; font-weight:800; font-size:13px; letter-spacing:1px; margin-bottom:4px;">NOTA DE VENTA — PROCESO / DESECHO</div>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin:2px 0;">
            <strong>FOLIO VENTA:</strong> <span>${folio}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin:2px 0;">
            <strong>FECHA:</strong> <span>${fecha}</span>
          </div>
        </div>

        <div style="border-top:1px dashed #222; border-bottom:1px dashed #222; padding:8px 0; margin:8px 0;">
          <div style="font-weight:700; font-size:11px; margin-bottom:3px;">LOTE DE ORIGEN</div>
          <div style="display:flex; justify-content:space-between;"><span style="font-weight:700;">Lote:</span><span>${loteNum}</span></div>
          <div style="display:flex; justify-content:space-between;"><span style="font-weight:700;">Productor:</span><span>${productor}</span></div>
        </div>

        <div style="margin:8px 0;">
          <div style="font-weight:700; font-size:11px; border-bottom:1px solid #222; padding-bottom:2px; margin-bottom:4px;">DETALLE DE SALIDA</div>
          <div style="display:flex; justify-content:space-between;"><span>Tipo:</span><span style="font-weight:600;">${tipo}</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Cajas:</span><span>${cajas}</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Tarima:</span><span>${tieneTarima ? 'Sí' : 'No'}</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Peso Bruto:</span><span>${bruto} kg</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Peso Neto:</span><span>${neto} kg</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Comprador:</span><span>${comprador}</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Destino:</span><span>${destino}</span></div>
        </div>

        <div style="margin:10px 0 4px; border-top:2px solid #222; padding-top:6px;">
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Precio/kg:</span><span>$${precioKg}</span></div>
          <div style="display:flex; justify-content:space-between; font-weight:800; font-size:14px; border-top:2px solid #222; margin-top:4px; padding-top:4px;"><span>TOTAL</span><span>$${total}</span></div>
        </div>

        ${obs ? `<div style="margin:8px 0 4px; font-size:11px;"><strong>Observaciones:</strong><div style="margin-top:2px; padding:4px; background:#f9f9f9;">${obs}</div></div>` : ''}

        <div style="margin-top:14px; text-align:center; font-size:9px; border-top:1px solid #222; padding-top:6px; color:#444;">
          Sistema TECAVO — ${new Date().toLocaleString('es-MX')}
        </div>
      </div>
    `;
  };



  const resetFormData = async () => {
    // Reset weight readings
    setWeightReadings([]);
    setShowWeighingPanel(false);
    
    // Reset origin auto-fill
    setSelectedOrigin(null);
    setOriginType('');
    setOriginKg(0);

    // Reset form
    setFormData({
      lotId: '',
      boxCount: '',
      withPallet: false,
      grossWeight: '',
      netWeight: '',
      unitPrice: '',
      totalPrice: '',
      notes: '',
      paymentStatus: 'pendiente',
      productType: '',
      buyerName: '',
      destination: ''
    });
  };

  // Handle weight readings from scale
  useEffect(() => {
    if (weight && isConnected) {
      setWeightReadings(prev => {
        const newReadings = [...prev, weight];
        // Keep only last 20 readings
        if (newReadings.length > 20) {
          newReadings.shift();
        }
        return newReadings;
      });
      // Auto-populate gross weight with latest weight
      if (showWeighingPanel) {
        setFormData(prev => ({ ...prev, grossWeight: weight.toFixed(2) }));
      }
    }
  }, [weight, isConnected, showWeighingPanel]);

  // Get unique buyers for filter
  const uniqueBuyers = Array.isArray(records) ? [...new Set(records.map(r => r.buyer_name).filter(Boolean))] : [];

  // Calculate price automatically based on net weight and unit price
  const calculatePrice = () => {
    if (formData.netWeight && formData.unitPrice) {
      const n = parseFloat(formData.netWeight) || 0;
      const u = parseFloat(formData.unitPrice) || 0;
      return (n * u).toFixed(2);
    }
    return '';
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
              <h1 className="text-2xl font-bold text-slate-900">Venta de Proceso y Desecho</h1>
              <p className="text-sm text-slate-500">Gestión de ventas de productos derivados de la lotificación</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="w-full">
          {/* "Inventario Generado" sidebar removed per request. The interface now uses the full available horizontal space for clearer distribution of filters, form, and sales records list. */}
            {/* Action Buttons */}
            {!showForm && (
              <div className="flex flex-wrap gap-4 mb-8">
                <button
                  onClick={() => { setShowForm(true); setEditingId(null); resetFormData(); }}
                  className="px-6 py-3 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-all shadow-lg flex items-center gap-2"
                >
                  <i className="ph ph-plus"></i>Nuevo Registro
                </button>
              </div>
            )}

        {/* Form Section */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? 'Editar Registro' : 'Nuevo Registro de Venta de Proceso y Desecho'}
              </h2>
              {isConnected && (
                <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold flex items-center gap-2">
                  <i className="ph ph-check-circle"></i>Escala conectada
                </span>
              )}
            </div>

            {/* Weighing Panel - Top of form */}
            {isConnected && (
              <div className="mb-8 bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-xl p-6">
                <button
                  type="button"
                  onClick={() => setShowWeighingPanel(!showWeighingPanel)}
                  className="w-full flex items-center justify-between p-4 bg-white rounded-lg border border-cyan-200 hover:border-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <i className="ph-fill ph-scales text-cyan-600 text-2xl"></i>
                    <div className="text-left">
                      <p className="font-bold text-cyan-900">Panel de Pesada en Tiempo Real</p>
                      <p className="text-sm text-cyan-700">Peso actual: <strong>{weight.toFixed(2)} kg</strong></p>
                    </div>
                  </div>
                  <i className={`ph ph-caret-${showWeighingPanel ? 'up' : 'down'} text-cyan-600 text-2xl`}></i>
                </button>

                {showWeighingPanel && (
                  <div className="mt-4 space-y-4">
                    {/* Current Weight Display */}
                    <div className="bg-white rounded-lg p-6 border border-cyan-200">
                      <p className="text-sm text-cyan-600 font-medium mb-2">PESO ACTUAL DETECTADO</p>
                      <p className="text-5xl font-bold text-cyan-700">{weight.toFixed(2)}</p>
                      <p className="text-sm text-cyan-600 mt-2">kg</p>
                      <p className="text-xs text-cyan-500 mt-3">Última lectura: {new Date().toLocaleTimeString('es-MX')}</p>
                    </div>

                    {/* Statistics */}
                    {weightReadings.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white rounded-lg p-4 border border-cyan-200">
                          <p className="text-xs text-cyan-600 font-medium uppercase">Máximo</p>
                          <p className="text-xl font-bold text-cyan-700">{Math.max(...weightReadings).toFixed(2)} kg</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-cyan-200">
                          <p className="text-xs text-cyan-600 font-medium uppercase">Mínimo</p>
                          <p className="text-xl font-bold text-cyan-700">{Math.min(...weightReadings).toFixed(2)} kg</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-cyan-200">
                          <p className="text-xs text-cyan-600 font-medium uppercase">Promedio</p>
                          <p className="text-xl font-bold text-cyan-700">{(weightReadings.reduce((a,b) => a+b, 0) / weightReadings.length).toFixed(2)} kg</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-cyan-200">
                          <p className="text-xs text-cyan-600 font-medium uppercase">Lecturas</p>
                          <p className="text-xl font-bold text-cyan-700">{weightReadings.length}</p>
                        </div>
                      </div>
                    )}

                    {/* Weight History Chart */}
                    {weightReadings.length > 1 && (
                      <div className="bg-white rounded-lg p-4 border border-cyan-200">
                        <p className="text-xs text-cyan-600 font-medium uppercase mb-3">Historial Visual</p>
                        <svg width="100%" height="100" viewBox="0 0 400 100" className="w-full">
                          {/* Grid */}
                          <line x1="0" y1="90" x2="400" y2="90" stroke="#e0e7ff" strokeWidth="1" />
                          
                          {/* Scale */}
                          {(() => {
                            const min = Math.min(...weightReadings);
                            const max = Math.max(...weightReadings);
                            const range = max - min || 1;
                            const padding = range * 0.1;

                            return (
                              <>
                                {/* Line chart */}
                                <polyline
                                  points={weightReadings.map((w, i) => {
                                    const x = (i / (weightReadings.length - 1 || 1)) * 380 + 10;
                                    const normalizedY = (w - (min - padding)) / (range + padding * 2);
                                    const y = 85 - (normalizedY * 75);
                                    return `${x},${y}`;
                                  }).join(' ')}
                                  fill="none"
                                  stroke="#06b6d4"
                                  strokeWidth="2"
                                />
                                {/* Current point */}
                                {(() => {
                                  const lastWeight = weightReadings[weightReadings.length - 1];
                                  const x = ((weightReadings.length - 1) / (weightReadings.length - 1 || 1)) * 380 + 10;
                                  const normalizedY = (lastWeight - (min - padding)) / (range + padding * 2);
                                  const y = 85 - (normalizedY * 75);
                                  return (
                                    <circle cx={x} cy={y} r="4" fill="#0891b2" />
                                  );
                                })()}
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, processKg: weight.toFixed(2) }));
                        setShowWeighingPanel(false);
                      }}
                      className="w-full px-4 py-3 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <i className="ph ph-check-circle"></i>Usar peso actual: {weight.toFixed(2)} kg
                    </button>
                  </div>
                )}
              </div>
            )}



            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Lote de Origen - Integración automática desde Registro de Lotificación */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-link text-blue-600"></i>
                  Lote de Origen (de Lotificación)
                </h3>
                <p className="text-xs text-blue-600 mb-3">Los registros de Proceso y Desecho se generan automáticamente al guardar lotificación. Se calculan cajas aproximadas dividiendo kg ÷ 22.</p>

                {/* Lista de Lotes de Origen disponibles con selección por tipo y cargas automáticas */}
                {(Array.isArray(originLots) && originLots.length > 0) && (
                  <div className="mb-4">
                    <label className="text-sm font-medium text-blue-800 mb-2 block">Lotes con Proceso/Desecho disponibles (selecciona para autocompletar):</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-52 overflow-auto pr-1">
                      {(Array.isArray(originLots) ? originLots : []).slice(0, 12).map((o) => {
                        const p = parseFloat(o.process_kg || 0) || 0;
                        const d = parseFloat(o.waste_kg || 0) || 0;
                        const lotNum = o.lot_number || '—';
                        const prod = o.producer || '—';
                        const fechaShow = o.lot_date ? new Date(o.lot_date).toLocaleDateString('es-MX') : '';
                        return (
                          <div key={o.id} className="contents">
                            {p > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const kg = p;
                                  const cajasCalc = (kg / 22).toFixed(1);
                                  const brutoCalc = (kg + (parseFloat(cajasCalc) * 2)).toFixed(2);
                                  const newNotes = `Lote de Origen: ${lotNum}
Productor: ${prod}
Fecha de lotificación: ${fechaShow}
Tipo de registro: Proceso
Kg disponibles: ${kg} kg`;
                                  setSelectedOrigin(o);
                                  setOriginType('Proceso');
                                  setOriginKg(kg);
                                  setFormData(prev => ({
                                    ...prev,
                                    lotId: o.lot_id ? String(o.lot_id) : '',
                                    boxCount: cajasCalc,
                                    grossWeight: brutoCalc,
                                    productType: 'Proceso',
                                    notes: newNotes,
                                    netWeight: kg.toFixed(2)
                                  }));
                                }}
                                className={`p-3 text-left rounded-xl border bg-white transition-all ${selectedOrigin && selectedOrigin.id === o.id && originType === 'Proceso' ? 'ring-2 ring-emerald-600 border-emerald-500' : 'border-emerald-200 hover:border-emerald-400'}`}
                              >
                                <div className="text-sm font-semibold text-slate-900">{lotNum} — {prod}</div>
                                <div className="text-[10px] text-slate-500 mb-1">{fechaShow}</div>
                                <div className="text-xs font-medium text-emerald-700">PROCESO: {p.toFixed(1)} kg ≈ {(p / 22).toFixed(1)} cajas</div>
                              </button>
                            )}
                            {d > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const kg = d;
                                  const cajasCalc = (kg / 22).toFixed(1);
                                  const brutoCalc = (kg + (parseFloat(cajasCalc) * 2)).toFixed(2);
                                  const newNotes = `Lote de Origen: ${lotNum}
Productor: ${prod}
Fecha de lotificación: ${fechaShow}
Tipo de registro: Desecho
Kg disponibles: ${kg} kg`;
                                  setSelectedOrigin(o);
                                  setOriginType('Desecho');
                                  setOriginKg(kg);
                                  setFormData(prev => ({
                                    ...prev,
                                    lotId: o.lot_id ? String(o.lot_id) : '',
                                    boxCount: cajasCalc,
                                    grossWeight: brutoCalc,
                                    productType: 'Desecho',
                                    notes: newNotes,
                                    netWeight: kg.toFixed(2)
                                  }));
                                }}
                                className={`p-3 text-left rounded-xl border bg-white transition-all ${selectedOrigin && selectedOrigin.id === o.id && originType === 'Desecho' ? 'ring-2 ring-orange-600 border-orange-500' : 'border-orange-200 hover:border-orange-400'}`}
                              >
                                <div className="text-sm font-semibold text-slate-900">{lotNum} — {prod}</div>
                                <div className="text-[10px] text-slate-500 mb-1">{fechaShow}</div>
                                <div className="text-xs font-medium text-orange-700">DESECHO: {d.toFixed(1)} kg ≈ {(d / 22).toFixed(1)} cajas</div>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {(!Array.isArray(originLots) || originLots.length === 0) && (
                  <div className="text-xs text-blue-600 mb-4 bg-blue-100/60 p-2 rounded">No hay lotes de origen todavía. Se crearán automáticamente al registrar lotificación con kg de Proceso/Desecho.</div>
                )}

                {/* Selección actual - información automática del Lote de Origen */}
                {selectedOrigin && originType && (
                  <div className="mb-4 p-3 bg-white border border-blue-300 rounded-xl text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-blue-900 mb-1">
                      <span className="font-bold">LOTE SELECCIONADO:</span> 
                      <span className="font-semibold">{selectedOrigin.lot_number}</span> — {selectedOrigin.producer}
                    </div>
                    <div className="flex flex-wrap gap-x-4 text-blue-800">
                      <span><strong>Tipo:</strong> {originType}</span>
                      <span><strong>Kg disponibles:</strong> {originKg.toFixed(1)}</span>
                      <span><strong>Cajas:</strong> {formData.boxCount}</span>
                      <span><strong>Peso Bruto:</strong> {formData.grossWeight} kg</span>
                    </div>
                    <button type="button" onClick={() => { 
                      setSelectedOrigin(null); setOriginType(''); setOriginKg(0); 
                      setFormData(prev => ({...prev, productType: '', boxCount: '', grossWeight: '', notes: ''})); 
                    }} className="text-blue-700 hover:underline mt-1 text-[10px]">Limpiar selección de lote</button>
                  </div>
                )}

                {/* Fallback selector directo por lotes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">O selecciona lote manualmente</label>
                  <select
                    value={formData.lotId}
                    onChange={(e) => {
                      setFormData({ ...formData, lotId: e.target.value, productType: '' });
                      setSelectedOrigin(null);
                      setOriginType('');
                      setOriginKg(0);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="">— Selecciona un lote —</option>
                    {lots.map(lot => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lot_number} - {lot.producer} ({lot.fruit_type})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedOrigin && originType && (
                  <div className="mt-2 text-[10px] px-2 bg-blue-100 text-blue-700 rounded">Usando origen automático para el {originType} de este lote ({originKg.toFixed(1)} kg).</div>
                )}
              </div>

              {/* Datos de la Venta */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                <h3 className="font-bold text-emerald-900 mb-6 flex items-center gap-2">
                  <i className="ph-fill ph-user text-emerald-600"></i>
                  Datos de la Venta
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Comprador / Cliente *</label>
                    <input
                      type="text"
                      value={formData.buyerName}
                      onChange={(e) => setFormData({ ...formData, buyerName: e.target.value })}
                      placeholder="Nombre del comprador"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                      required={!editingId}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Destino</label>
                    <input
                      type="text"
                      value={formData.destination}
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      placeholder="Destino de entrega"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Weighing Section */}
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-6">
                <h3 className="font-bold text-cyan-900 mb-6 flex items-center gap-2">
                  <i className="ph-fill ph-scales text-cyan-600"></i>
                  Módulo de Pesada
                </h3>
                
                <div className="space-y-4">
                  {/* Number of Boxes */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Número de Cajas a Pesar *</label>
                    <input
                      type="number"
                      value={formData.boxCount}
                      onChange={(e) => setFormData({ ...formData, boxCount: e.target.value })}
                      placeholder="Ej. 10"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none"
                    />
                    <p className="text-xs text-slate-500">Cada caja se destara por 2 kg automáticamente</p>
                  </div>

                  {/* With Pallet Option */}
                  <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-cyan-200">
                    <input
                      type="checkbox"
                      checked={formData.withPallet}
                      onChange={(e) => setFormData({ ...formData, withPallet: e.target.checked })}
                      className="w-5 h-5 text-cyan-600 rounded focus:ring-2 focus:ring-cyan-500/20"
                    />
                    <label className="text-sm font-medium text-slate-700">
                      ¿Incluye Tarima? (Se destara 22 kg adicionales)
                    </label>
                  </div>

                  {/* Gross Weight from Scale */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Peso Bruto *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.grossWeight}
                        onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                        placeholder="0.00"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none"
                      />
                      {isConnected && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowWeighingPanel(!showWeighingPanel);
                          }}
                          className="px-4 py-2.5 bg-cyan-600 text-white font-medium rounded-xl hover:bg-cyan-700 transition-colors flex items-center gap-2"
                        >
                          <i className="ph-fill ph-scales text-lg"></i>
                          {showWeighingPanel ? 'Cerrar' : 'Báscula'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Se actualiza automáticamente desde la báscula</p>
                  </div>

                  {/* Tare Calculation Summary */}
                  {formData.boxCount && formData.grossWeight && (
                    <div className="p-4 bg-white border-2 border-cyan-300 rounded-lg space-y-2">
                      <div className="text-sm text-slate-700">
                        <p><strong>Destare por Cajas:</strong> {parseFloat(formData.boxCount) || 0} × 2 kg = <strong>{((parseFloat(formData.boxCount) || 0) * 2).toFixed(1)} kg</strong></p>
                        {formData.withPallet && (
                          <p><strong>Destare por Tarima:</strong> 22 kg</p>
                        )}
                        <p className="font-bold text-cyan-700 mt-2">
                          Destare Total: <strong>{(((parseFloat(formData.boxCount) || 0) * 2) + (formData.withPallet ? 22 : 0)).toFixed(1)} kg</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Net Weight (Auto-calculated) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Peso Neto (Calculado Automáticamente)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.netWeight}
                      onChange={(e) => setFormData({ ...formData, netWeight: e.target.value })}
                      placeholder="Se calcula automáticamente"
                      className="w-full px-4 py-2.5 rounded-xl border border-cyan-200 bg-cyan-100/50 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none"
                      readOnly
                    />
                    <p className="text-xs text-cyan-600 font-medium">Peso Bruto - Destare Total = Peso Neto</p>
                  </div>
                </div>
              </div>

              {/* Pricing Information */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <h3 className="font-bold text-amber-900 mb-6 flex items-center gap-2">
                  <i className="ph-fill ph-currency-dollar text-amber-600"></i>
                  Información de Precios
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Precio por Kg *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.unitPrice}
                      onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    />
                    <p className="text-xs text-slate-500">Precio unitario por kg neto</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Precio Total</label>
                    <input
                      type="number"
                      step="0.01"
                      value={calculatePrice() || formData.totalPrice}
                      onChange={(e) => setFormData({ ...formData, totalPrice: e.target.value })}
                      placeholder="Auto-calculado"
                      className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-100/50 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                      readOnly
                    />
                    <p className="text-xs text-amber-600 font-medium">Kg Neto × Precio/Kg</p>
                  </div>
                </div>

                {/* Price Summary */}
                {(formData.netWeight && formData.unitPrice) && (
                  <div className="mt-4 p-4 bg-amber-100 border border-amber-300 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-900">Precio Total Estimado:</span>
                      <span className="text-2xl font-bold text-amber-700">
                        ${calculatePrice()}
                      </span>
                    </div>
                    <div className="text-sm text-amber-700 mt-2">
                      = {formData.netWeight} kg × ${formData.unitPrice}/kg
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Status */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-currency-dollar text-amber-600"></i>
                  Estado de Pago
                </h3>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentStatus: 'pendiente' })}
                    className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      formData.paymentStatus === 'pendiente'
                        ? 'bg-red-100 text-red-700 border-2 border-red-500'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-red-50'
                    }`}
                  >
                    <i className="ph ph-clock text-lg"></i>
                    Pendiente de Pago
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentStatus: 'pagado' })}
                    className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      formData.paymentStatus === 'pagado'
                        ? 'bg-green-100 text-green-700 border-2 border-green-500'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-green-50'
                    }`}
                  >
                    <i className="ph ph-check-circle text-lg"></i>
                    Pagado
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Observaciones</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionales sobre esta venta..."
                  rows="4"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-4 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); resetFormData(); }}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Registro'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
          <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
            <i className="ph-fill ph-magnifying-glass text-brand-600"></i>
            Buscar y Filtrar
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Folio o Lote</label>
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por folio o lote..." 
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Comprador</label>
              <select 
                value={filterBuyer}
                onChange={(e) => setFilterBuyer(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              >
                <option value="">Todos los compradores</option>
                {uniqueBuyers.map(buyer => (
                  <option key={buyer} value={buyer}>{buyer}</option>
                ))}
              </select>
            </div>
          </div>

          {(searchTerm || fromDate || toDate || filterBuyer) && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">
                <strong>{searchResults.length}</strong> resultado(s) encontrado(s)
              </span>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setFromDate('');
                  setToDate('');
                  setFilterBuyer('');
                }}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}
        </div>

        {/* Records List */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
            <i className="ph-fill ph-list-checks text-brand-600"></i>
            Registros de Venta ({((Array.isArray(searchResults) && searchResults.length > 0) ? searchResults : (Array.isArray(records) ? records : [])).length})
          </h2>

          {loading && (!Array.isArray(records) || records.length === 0) ? (
            <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
              <i className="ph ph-spinner text-4xl animate-spin mb-2 block"></i>
              Cargando registros...
            </div>
          ) : ((!Array.isArray(searchResults) || searchResults.length === 0) && (!Array.isArray(records) || records.length === 0)) ? (
            <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
              <i className="ph ph-inbox text-4xl mb-2 block"></i>
              No hay registros de venta
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {((Array.isArray(searchResults) && searchResults.length > 0) ? searchResults : (Array.isArray(records) ? records : [])).map((record) => (
                <div key={record.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Left - Lot & Weighing Info */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase">Lote</p>
                        <p className="text-lg font-bold text-slate-900">{record.lot_number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase">Productor</p>
                        <p className="text-sm text-slate-700">{record.producer}</p>
                      </div>
                      {record.product_name && (record.product_name === 'Proceso' || record.product_name === 'Desecho') && (
                        <div>
                          <p className="text-xs text-slate-500 font-medium uppercase">Tipo</p>
                          <p className={`text-sm font-bold ${record.product_name === 'Proceso' ? 'text-emerald-700' : 'text-orange-700'}`}>{record.product_name}</p>
                        </div>
                      )}
                    </div>

                    {/* Middle - Weighing Details */}
                    <div className="space-y-3">
                      <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                        <p className="text-xs text-cyan-600 font-medium">CAJAS</p>
                        <p className="text-xl font-bold text-cyan-900">{parseInt(record.boxes) || 0}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-600 font-medium">Tarima</p>
                        <p className="font-bold text-slate-700">{record.with_pallet ? 'Sí' : 'No'}</p>
                      </div>
                    </div>

                    {/* Right - Weight Info */}
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-600 font-medium">PESO BRUTO</p>
                        <p className="text-xl font-bold text-blue-900">{(parseFloat(record.gross_weight) || 0).toFixed(2)} kg</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-xs text-green-600 font-medium">PESO NETO</p>
                        <p className="text-xl font-bold text-green-900">{(parseFloat(record.net_weight) || 0).toFixed(2)} kg</p>
                      </div>
                    </div>

                    {/* Far Right - Pricing & Payment Status & Actions */}
                    <div className="space-y-3">
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-xs text-amber-600 font-medium">PRECIO TOTAL</p>
                        <p className="text-2xl font-bold text-amber-700">${(parseFloat(record.total_price) || 0).toFixed(2)}</p>
                        <p className="text-xs text-amber-600 mt-1">${(parseFloat(record.unit_price) || 0).toFixed(2)}/kg</p>
                      </div>
                      <div className={`p-3 rounded-lg border flex items-center justify-between ${
                        record.payment_status === 'pagado' 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div>
                          <p className={`text-xs font-medium ${
                            record.payment_status === 'pagado' 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            ESTADO
                          </p>
                          <p className={`font-bold ${
                            record.payment_status === 'pagado' 
                              ? 'text-green-700' 
                              : 'text-red-700'
                          }`}>
                            {record.payment_status === 'pagado' ? 'Pagado' : 'Pendiente'}
                          </p>
                        </div>
                        <i className={`text-2xl ${
                          record.payment_status === 'pagado' 
                            ? 'ph-fill ph-check-circle text-green-600' 
                            : 'ph ph-clock text-red-600'
                        }`}></i>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePrint(record)}
                            disabled={printing === record.id}
                            title="Imprimir recibo"
                            className="flex-1 px-3 py-2 bg-green-100 text-green-700 font-medium rounded-lg hover:bg-green-200 transition-colors text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            <i className="ph ph-printer"></i> Imprimir
                          </button>
                          <button
                            onClick={() => downloadTicketPDF(record)}
                            title="Descargar como PDF"
                            className="px-3 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors text-sm flex items-center justify-center gap-1"
                          >
                            <i className="ph ph-file-pdf"></i>
                          </button>
                          <button
                            onClick={() => downloadTicketImage(record)}
                            title="Descargar como imagen"
                            className="px-3 py-2 bg-purple-100 text-purple-700 font-medium rounded-lg hover:bg-purple-200 transition-colors text-sm flex items-center justify-center gap-1"
                          >
                            <i className="ph ph-image"></i>
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(record)}
                            className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 transition-colors text-sm flex items-center justify-center gap-1"
                          >
                            <i className="ph ph-pencil"></i>Editar
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors text-sm flex items-center justify-center gap-1"
                          >
                            <i className="ph ph-trash"></i>Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>


                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </main>

    </div>
  );
}
