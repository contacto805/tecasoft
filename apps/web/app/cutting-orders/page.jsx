'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useBranding } from '@/hooks/useBranding';

export default function CuttingOrdersPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [completeData, setCompleteData] = useState({
    net_weight: '',
    returned_boxes: '',
    missing_boxes: ''
  });
  
  const [lots, setLots] = useState([]);
  
  const FIXED_PACKING_ADDRESS = 'Km 4.5 carretera Tacámbaro Pátzcuaro, El Testerazo, Tacámbaro, Michoacán. C.P 61654.\ncontacto@tecavofruits.com\nWhatsapp 459 134 45 76';
  
  const [formData, setFormData] = useState({
    cutting_date: '',
    producer_name: '',
    orchard_name: '',
    location: '',
    scale: '',
    meeting_point: '',
    meeting_time: '',
    truck_plates: '',
    truck_type: 'doble',
    freight_cost: '',
    driver_name: '',
    driver_phone: '',
    crew_chief_name: '',
    crew_chief_phone: '',
    contact_name: '',
    contact_phone: '',
    crew_payment_method: 'kilos',
    crew_workers_count: '',
    boxes_count: '',
    lot_id: '',
    orchard_plant_type: '',
    orchard_terrain_type: '',
    orchard_cutting_type: '',
    orchard_specifications: '',
    broker_name: '',
    agreed_commission: '',
    agreed_price_per_kg: '',
    plazo_dias: '',
    tipo_dias: 'habiles',
    entrega_estimada: '',
    show_agreed_price: false
  });

  const [editingId, setEditingId] = useState(null);

  const truckTypes = [
    { value: 'doble', label: 'Doble' },
    { value: 'rabón', label: 'Rabón' },
    { value: 'tortón', label: 'Tortón' }
  ];

  useEffect(() => {
    fetchOrders();
    fetchLots();
  }, []);

  const fetchLots = async () => {
    try {
      const response = await fetch('/api/lots');
      const data = await response.json();
      setLots(data);
    } catch (error) {
      console.error('Error fetching lots:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/cutting-orders');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const editOrder = (order) => {
    setFormData({
      cutting_date: order.cutting_date || '',
      producer_name: order.producer_name || '',
      orchard_name: order.orchard_name || '',
      location: order.location || '',
      scale: order.scale || '',
      meeting_point: order.meeting_point || '',
      meeting_time: order.meeting_time || '',
      truck_plates: order.truck_plates || '',
      truck_type: order.truck_type || 'doble',
      freight_cost: order.freight_cost != null ? order.freight_cost : '',
      driver_name: order.driver_name || '',
      driver_phone: order.driver_phone || '',
      crew_chief_name: order.crew_chief_name || '',
      crew_chief_phone: order.crew_chief_phone || '',
      contact_name: order.contact_name || '',
      contact_phone: order.contact_phone || '',
      crew_payment_method: order.crew_payment_method || 'kilos',
      crew_workers_count: order.crew_workers_count || '',
      boxes_count: order.boxes_count || '',
      lot_id: order.lot_id || '',
      orchard_plant_type: order.orchard_plant_type || '',
      orchard_terrain_type: order.orchard_terrain_type || '',
      orchard_cutting_type: order.orchard_cutting_type || '',
      orchard_specifications: order.orchard_specifications || '',
      broker_name: order.broker_name || '',
      agreed_commission: order.agreed_commission || '',
      agreed_price_per_kg: order.agreed_price_per_kg || '',
      plazo_dias: order.plazo_dias || '',
      tipo_dias: order.tipo_dias || 'habiles',
      entrega_estimada: order.entrega_estimada || '',
      show_agreed_price: !!order.show_agreed_price
    });
    setEditingId(order.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateFolio = () => {
    const timestamp = Date.now().toString().slice(-8);
    return `CORTE-${new Date().getFullYear()}-${timestamp}`;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;
    
    setFormData({
      ...formData,
      [name]: newValue
    });
  };

  const submitOrder = async () => {
    if (!formData.cutting_date || !formData.producer_name || !formData.driver_name || !formData.crew_chief_name || !formData.boxes_count) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    const isEdit = !!editingId;
    const method = isEdit ? 'PUT' : 'POST';
    const payload = isEdit 
      ? { 
          id: editingId, 
          ...formData,
          boxes_count: parseInt(formData.boxes_count),
          crew_workers_count: formData.crew_workers_count ? parseInt(formData.crew_workers_count) : null,
          crew_payment_method: formData.crew_payment_method,
          lot_id: formData.lot_id ? parseInt(formData.lot_id) : null,
          broker_name: formData.broker_name || null,
          agreed_commission: formData.agreed_commission ? parseFloat(formData.agreed_commission) : null,
          agreed_price_per_kg: formData.agreed_price_per_kg ? parseFloat(formData.agreed_price_per_kg) : null,
          show_agreed_price: !!formData.show_agreed_price,
          plazo_dias: formData.plazo_dias ? parseInt(formData.plazo_dias) : 0,
          tipo_dias: formData.tipo_dias,
          entrega_estimada: formData.entrega_estimada || null,
          freight_cost: formData.freight_cost ? parseFloat(formData.freight_cost) : 0
        }
      : {
          folio: generateFolio(),
          ...formData,
          boxes_count: parseInt(formData.boxes_count),
          crew_workers_count: formData.crew_workers_count ? parseInt(formData.crew_workers_count) : null,
          crew_payment_method: formData.crew_payment_method,
          lot_id: formData.lot_id ? parseInt(formData.lot_id) : null,
          packing_house_address: FIXED_PACKING_ADDRESS,
          broker_name: formData.broker_name || null,
          agreed_commission: formData.agreed_commission ? parseFloat(formData.agreed_commission) : null,
          agreed_price_per_kg: formData.agreed_price_per_kg ? parseFloat(formData.agreed_price_per_kg) : null,
          show_agreed_price: !!formData.show_agreed_price,
          plazo_dias: formData.plazo_dias ? parseInt(formData.plazo_dias) : 0,
          tipo_dias: formData.tipo_dias,
          entrega_estimada: formData.entrega_estimada || null,
          freight_cost: formData.freight_cost ? parseFloat(formData.freight_cost) : 0
        };
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/cutting-orders', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        if (!isEdit) {
          setSubmittedOrder(result);
          setShowPrintModal(true);
          // Integración automática: asignar cajas y emitir ticket en Control de Caja
          if (parseInt(formData.boxes_count) > 0) {
            try {
              await fetch('/api/box-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'salida_corte',
                  cutting_order_id: result.id,
                  lot_id: result.lot_id || null,
                  boxes_quantity: parseInt(formData.boxes_count),
                  producer_name: formData.producer_name,
                  orchard_name: formData.orchard_name,
                  crew_chief_name: formData.crew_chief_name,
                  driver_name: formData.driver_name,
                  fletero: formData.driver_name || '',
                  cuadrilla: formData.crew_chief_name || '',
                  responsible_name: formData.driver_name || formData.crew_chief_name || '',
                  responsible_phone: formData.driver_phone || formData.crew_chief_phone || '',
                  date_out: formData.cutting_date
                })
              });
            } catch (e) { /* no bloquear creación */ }
          }
        } else {
          alert('Orden actualizada correctamente');
        }
        setShowForm(false);
        setEditingId(null);
        setFormData({
          cutting_date: '',
          producer_name: '',
          orchard_name: '',
          location: '',
          scale: '',
          meeting_point: '',
          meeting_time: '',
          truck_plates: '',
          truck_type: 'doble',
          freight_cost: '',
          driver_name: '',
          driver_phone: '',
          crew_chief_name: '',
          crew_chief_phone: '',
          contact_name: '',
          contact_phone: '',
          crew_payment_method: 'kilos',
          crew_workers_count: '',
          boxes_count: '',
          lot_id: '',
          orchard_plant_type: '',
          orchard_terrain_type: '',
          orchard_cutting_type: '',
          orchard_specifications: '',
          broker_name: '',
          agreed_commission: '',
          agreed_price_per_kg: '',
          plazo_dias: '',
          tipo_dias: 'habiles',
          entrega_estimada: '',
          show_agreed_price: false
        });
        await fetchOrders();
      }
    } catch (error) {
      console.error('Error saving order:', error);
      alert('Error al ' + (isEdit ? 'actualizar' : 'crear') + ' la orden de corte');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!submittedOrder) return;
    const element = document.getElementById('order-print-content');
    const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    pdf.save(`Orden-Corte-${submittedOrder.folio}.pdf`);
  };

  const downloadJPG = async () => {
    if (!submittedOrder) return;
    const element = document.getElementById('order-print-content');
    const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.download = `Orden-Corte-${submittedOrder.folio}.jpg`;
    link.click();
  };

  const handleSendViaWhatsApp = async () => {
    if (!whatsappPhone.trim()) {
      alert('Por favor ingresa un número de teléfono para enviar por WhatsApp');
      return;
    }

    setWhatsappLoading(true);
    try {
      const element = document.getElementById('order-print-content');
      if (!element) {
        alert('Orden no encontrada');
        return;
      }

      const canvas = await html2canvas(element, { 
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
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
      
      // Send via WhatsApp API
      const response = await fetch('/api/whatsapp/send-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: whatsappPhone,
          folio: submittedOrder.folio,
          type: 'cutting_order'
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(`Error al enviar por WhatsApp: ${result.error}\n\n${result.info || result.details || ''}`);
        return;
      }

      alert(`✅ Orden de Corte enviada a ${whatsappPhone} por WhatsApp`);
      setWhatsappPhone('');
    } catch (error) {
      console.error('Error sending via WhatsApp:', error);
      alert('Error al enviar por WhatsApp. Verifica la configuración en variables de entorno.');
    } finally {
      setWhatsappLoading(false);
    }
  };

  const printOrder = () => {
    const element = document.getElementById('order-print-content');
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write('<html><head><style>body { font-family: Arial; margin: 20px; }</style></head><body>');
    printWindow.document.write(element.innerHTML);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  // Reusable for already-generated orders: reprint, download, resend using the same data (keeps same folio + traceability)
  const printExistingOrder = (order) => {
    setSubmittedOrder(order);
    setShowPrintModal(true);
  };

  const downloadExistingOrder = async (order) => {
    setSubmittedOrder(order);
    setTimeout(async () => {
      const element = document.getElementById('order-print-content');
      if (!element) return alert('No pudo generar el documento');
      const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Orden-Corte-${order.folio}.pdf`);
    }, 120);
  };

  const resendExistingOrder = async (order) => {
    const phone = prompt('Teléfono WhatsApp para reenviar la Orden (misma folio y datos):', '');
    if (!phone) return;
    setSubmittedOrder(order);
    setWhatsappPhone(phone);
    setTimeout(() => {
      handleSendViaWhatsApp();
    }, 150);
  };

  const handleCompleteOrder = async () => {
    if (!completeData.net_weight) {
      alert('El peso neto es requerido');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/cutting-orders/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          net_weight: parseFloat(completeData.net_weight),
          returned_boxes: completeData.returned_boxes ? parseInt(completeData.returned_boxes) : 0,
          missing_boxes: completeData.missing_boxes ? parseInt(completeData.missing_boxes) : 0
        })
      });

      if (response.ok) {
        alert('Orden completada exitosamente');
        setShowCompleteModal(false);
        setCompleteData({ net_weight: '', returned_boxes: '', missing_boxes: '' });
        setSelectedOrder(null);
        await fetchOrders();
      } else {
        const error = await response.json();
        alert('Error: ' + (error.error || 'No se pudo completar la orden'));
      }
    } catch (error) {
      console.error('Error completing order:', error);
      alert('Error al completar la orden');
    } finally {
      setIsLoading(false);
    }
  };

  const openCompleteModal = (order) => {
    setSelectedOrder(order);
    setCompleteData({ 
      net_weight: '', 
      returned_boxes: order.boxes_count || '', 
      missing_boxes: '0' 
    });
    setShowCompleteModal(true);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <main className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-3">
            <button onClick={() => router.push('/')} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              <i className="ph ph-arrow-left"></i>
              <span>Regresar al Dashboard</span>
            </button>
          </div>
          
          {/* SECCIONES DE LA PESTAÑA CORTES */}
          <div className="flex flex-wrap gap-2 mb-4 text-sm">
            <button onClick={() => router.push('/acopios')} className="px-4 py-1.5 rounded-xl border bg-white hover:bg-white/90 font-medium">Acopios</button>
            <button onClick={() => router.push('/cutting-orders')} className="px-4 py-1.5 rounded-xl bg-emerald-700 text-white font-medium">Orden de corte</button>
            <button onClick={() => router.push('/precios-fruta')} className="px-4 py-1.5 rounded-xl border bg-white hover:bg-white/90 font-medium">Precios de fruta</button>
          </div>

          <section className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Órdenes de Corte</h1>
              <p className="text-slate-500 mt-1">Crea y gestiona las órdenes de corte con folio automático. (Sección de la pestaña Cortes)</p>
              <p className="text-[10px] text-emerald-700 mt-0.5">REGLA FASE 03 B02: {'>'}5.000 kg = pago por kg; ≤5.000 kg = por día. Excepciones requieren autorización Superadministrador. Costos corte/flete fuente única (no duplicar en cierre).</p>
            </div>
            <button
              onClick={() => router.push('/mobile-apps')}
              className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
            >
              <i className="ph ph-qr-code text-lg"></i>
              Descargar App Móvil
            </button>
          </section>

          {showForm ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mb-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-bold text-2xl text-slate-900">{editingId ? 'Editar Orden de Corte' : 'Nueva Orden de Corte'}</h2>
                <button onClick={() => { setShowForm(false); setEditingId(null); setFormData({ cutting_date: '', producer_name: '', orchard_name: '', location: '', scale: '', meeting_point: '', meeting_time: '', truck_plates: '', truck_type: 'doble', freight_cost: '', driver_name: '', driver_phone: '', crew_chief_name: '', crew_chief_phone: '', contact_name: '', contact_phone: '', crew_payment_method: 'kilos', crew_workers_count: '', boxes_count: '', lot_id: '', orchard_plant_type: '', orchard_terrain_type: '', orchard_cutting_type: '', orchard_specifications: '', broker_name: '', agreed_commission: '', agreed_price_per_kg: '', plazo_dias: '', tipo_dias: 'habiles', entrega_estimada: '', show_agreed_price: false }); }} className="text-slate-500 hover:text-slate-700">
                  <i className="ph ph-x text-2xl"></i>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Fecha de Corte *</label>
                  <input 
                    type="date" 
                    name="cutting_date"
                    value={formData.cutting_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Plazo (días)</label>
                  <input 
                    type="number" 
                    name="plazo_dias"
                    value={formData.plazo_dias}
                    onChange={handleInputChange}
                    placeholder="Ej. 2"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tipo de días para plazo</label>
                  <select 
                    name="tipo_dias"
                    value={formData.tipo_dias}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  >
                    <option value="habiles">Días hábiles</option>
                    <option value="naturales">Días naturales</option>
                  </select>
                  <p className="text-xs text-slate-500">Usado para el plazo de la orden.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nombre de Productor *</label>
                  <input 
                    type="text" 
                    name="producer_name"
                    value={formData.producer_name}
                    onChange={handleInputChange}
                    placeholder="Ej. Juan García" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nombre de Huerta</label>
                  <input 
                    type="text" 
                    name="orchard_name"
                    value={formData.orchard_name}
                    onChange={handleInputChange}
                    placeholder="Ej. Huerta Los Pinos" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Ubicación</label>
                  <input 
                    type="text" 
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="Ej. Michoacán" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Báscula de Pesada</label>
                  <input 
                    type="text" 
                    name="scale"
                    value={formData.scale}
                    onChange={handleInputChange}
                    placeholder="Ej. Báscula A" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Punto de Reunión</label>
                  <input 
                    type="text" 
                    name="meeting_point"
                    value={formData.meeting_point}
                    onChange={handleInputChange}
                    placeholder="Ej. Centro de Acopio" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Hora de Cita en Punto de Reunión</label>
                  <input 
                    type="time" 
                    name="meeting_time"
                    value={formData.meeting_time}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Placas de Camión</label>
                  <input 
                    type="text" 
                    name="truck_plates"
                    value={formData.truck_plates}
                    onChange={handleInputChange}
                    placeholder="Ej. ABC-1234" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tipo de Camión *</label>
                  <select 
                    name="truck_type"
                    value={formData.truck_type}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  >
                    {truckTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Costo de Flete</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    name="freight_cost"
                    value={formData.freight_cost}
                    onChange={handleInputChange}
                    placeholder="0.00" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                  <p className="text-xs text-slate-500">Se integrará automáticamente al módulo Cuadrillas y Fletes.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nombre del Chofer *</label>
                  <input 
                    type="text" 
                    name="driver_name"
                    value={formData.driver_name}
                    onChange={handleInputChange}
                    placeholder="Ej. Carlos López" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Teléfono del Chofer</label>
                  <input 
                    type="tel" 
                    name="driver_phone"
                    value={formData.driver_phone}
                    onChange={handleInputChange}
                    placeholder="Ej. +52 443 123 4567" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nombre del Jefe de Cuadrilla *</label>
                  <input 
                    type="text" 
                    name="crew_chief_name"
                    value={formData.crew_chief_name}
                    onChange={handleInputChange}
                    placeholder="Ej. Roberto Martínez" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Teléfono del Jefe de Cuadrilla</label>
                  <input 
                    type="tel" 
                    name="crew_chief_phone"
                    value={formData.crew_chief_phone}
                    onChange={handleInputChange}
                    placeholder="Ej. +52 443 987 6543" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nombre de Contacto</label>
                  <input 
                    type="text" 
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleInputChange}
                    placeholder="Ej. María González" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Teléfono de Contacto</label>
                  <input 
                    type="tel" 
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleInputChange}
                    placeholder="Ej. +52 443 555 1234"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Forma de Pago a la Cuadrilla</label>
                  <select 
                    name="crew_payment_method"
                    value={formData.crew_payment_method}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  >
                    <option value="kilos">Kilos</option>
                    <option value="dia">Día</option>
                    <option value="cajas">Cajas</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Número de Cortadores</label>
                  <input 
                    type="number" 
                    name="crew_workers_count"
                    value={formData.crew_workers_count}
                    onChange={handleInputChange}
                    placeholder="Ej. 5" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Cajas a Corte *</label>
                  <input 
                    type="number" 
                    name="boxes_count"
                    value={formData.boxes_count}
                    onChange={handleInputChange}
                    placeholder="0" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tipo de Matas</label>
                  <input 
                    type="text" 
                    name="orchard_plant_type"
                    value={formData.orchard_plant_type}
                    onChange={handleInputChange}
                    placeholder="Ej. Hass, Fuerte, Criollo" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tipo de Terreno</label>
                  <input 
                    type="text" 
                    name="orchard_terrain_type"
                    value={formData.orchard_terrain_type}
                    onChange={handleInputChange}
                    placeholder="Ej. Montañoso, Plano, Mixto" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tipo de Corte</label>
                  <input 
                    type="text" 
                    name="orchard_cutting_type"
                    value={formData.orchard_cutting_type}
                    onChange={handleInputChange}
                    placeholder="Ej. Manual, Con garrocha, Selectivo" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-slate-700">Otras Especificaciones de Huerta</label>
                  <textarea 
                    name="orchard_specifications"
                    value={formData.orchard_specifications}
                    onChange={handleInputChange}
                    placeholder="Ej. Acceso por camino empedrado, requiere camión 4x4, árboles de 10-15 años" 
                    rows="3"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nombre de Corredor</label>
                  <input 
                    type="text" 
                    name="broker_name"
                    value={formData.broker_name}
                    onChange={handleInputChange}
                    placeholder="Ej. José Ramírez" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                  <p className="text-xs text-slate-500">Este dato será visible al descargar</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Comisión Pactada</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="agreed_commission"
                    value={formData.agreed_commission}
                    onChange={handleInputChange}
                    placeholder="Ej. 0.50" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                  <p className="text-xs text-slate-500">Este dato no será visible en las notas impresas</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Precio por kg Pactado</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="agreed_price_per_kg"
                    value={formData.agreed_price_per_kg}
                    onChange={handleInputChange}
                    placeholder="Ej. 45.00" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  />
                  <label className="flex items-center gap-2 text-xs mt-1 cursor-pointer text-slate-600">
                    <input 
                      type="checkbox" 
                      name="show_agreed_price"
                      checked={!!formData.show_agreed_price}
                      onChange={handleInputChange}
                      className="w-3.5 h-3.5 accent-brand-600" 
                    />
                    Mostrar precio pactado al descargar
                  </label>
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-slate-700">Domicilio del Empaque</label>
                  <div className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 whitespace-pre-line">
                    {FIXED_PACKING_ADDRESS}
                  </div>
                  <p className="text-xs text-slate-500">Esta dirección es fija y no se puede modificar</p>
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-slate-700">Lote Asociado (Opcional)</label>
                  <select 
                    name="lot_id"
                    value={formData.lot_id}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                  >
                    <option value="">Sin lote asociado</option>
                    {lots.map(lot => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lot_number} - {lot.producer} - {lot.fruit_type}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Si asocias un lote, al completar la orden se creará automáticamente el registro de ingreso de fruta</p>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 bg-slate-200 text-slate-900 font-medium rounded-xl hover:bg-slate-300 transition-all" 
                >
                  Cancelar
                </button>
                <button 
                  onClick={submitOrder}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  <i className="ph-fill ph-check-circle"></i>
                  {isLoading ? (editingId ? 'Actualizando...' : 'Generando...') : (editingId ? 'Actualizar Orden' : 'Generar Orden')}
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 flex items-center gap-2 mb-8" 
            >
              <i className="ph-fill ph-plus-circle text-lg"></i>
              Nueva Orden de Corte
            </button>
          )}

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
              <i className="ph-fill ph-list text-purple-600"></i>
              Órdenes de Corte ({orders.length})
            </h2>
            
            {orders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                <i className="ph ph-clipboard-text text-4xl mb-2 block"></i>
                <p>No hay órdenes de corte registradas</p>
                <p className="text-sm mt-1">Crea una nueva orden para comenzar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order, idx) => (
                  <div 
                    key={order.folio || order.id || idx}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-brand-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{order.folio}</div>
                        <div className="text-sm text-slate-600 mt-1">
                          Productor: {order.producer_name || 'N/A'} | Chofer: {order.driver_name || 'N/A'}
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          Camión: {order.truck_plates || 'N/A'} ({order.truck_type || 'N/A'}) | Cajas: {order.boxes_count || 0}
                        </div>
                        {order.freight_cost > 0 && (
                          <div className="text-sm text-orange-600 mt-0.5">Costo de Flete: ${parseFloat(order.freight_cost).toLocaleString('es-MX')}</div>
                        )}
                        <div className="text-sm text-slate-600 mt-1">
                          Jefe de Cuadrilla: {order.crew_chief_name || 'N/A'} | Cortadores: {order.crew_workers_count || 'N/A'} | Pago: {order.crew_payment_method ? (order.crew_payment_method === 'kilos' ? 'Kilos' : order.crew_payment_method === 'dia' ? 'Día' : 'Cajas') : 'N/A'}
                        </div>
                        {order.net_weight && (
                          <div className="text-sm text-green-600 mt-1 font-medium">
                            Peso neto: {Number(order.net_weight).toLocaleString('es-MX')} kg
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-2">
                          Creado: {new Date(order.created_at).toLocaleString('es-MX')}
                        </div>
                        {(order.plazo_dias || order.tipo_dias || order.entrega_estimada) && (
                          <div className="text-xs mt-1 bg-white rounded px-2 py-0.5 inline-block border border-slate-200">
                            Plazo: {order.plazo_dias || 0} días — {order.tipo_dias === 'naturales' ? 'Naturales' : 'Hábiles'} 
                            {order.entrega_estimada ? ` | Entrega: ${order.entrega_estimada}` : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {order.status === 'completed' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Completada
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => openCompleteModal(order)}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1"
                            >
                              <i className="ph ph-check-circle"></i>
                              Completar
                            </button>
                            <button
                              onClick={() => editOrder(order)}
                              className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-medium hover:bg-slate-700 flex items-center gap-1"
                            >
                              <i className="ph ph-pencil-simple"></i>
                              Editar
                            </button>
                            <button
                              onClick={() => {
                                router.push(`/box-control?cuttingOrderId=${order.id}&folioCorte=${encodeURIComponent(order.folio || '')}`);
                              }}
                              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                            >
                              📦 Cargar Cajas para Corte
                            </button>
                            <button
                              onClick={() => printExistingOrder(order)}
                              className="px-2 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
                              title="Imprimir orden"
                            >
                              Imprimir
                            </button>
                            <button
                              onClick={() => downloadExistingOrder(order)}
                              className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
                              title="Descargar orden"
                            >
                              Descargar
                            </button>
                            <button
                              onClick={() => resendExistingOrder(order)}
                              className="px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium"
                              title="Enviar nuevamente"
                            >
                              Enviar
                            </button>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pendiente
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {showPrintModal && submittedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-bold text-lg text-slate-900">Orden de Corte Generada</h2>
              <button onClick={() => setShowPrintModal(false)} className="text-slate-500 hover:text-slate-700">
                <i className="ph ph-x text-2xl"></i>
              </button>
            </div>

            <div id="order-print-content" className="p-8 bg-white">
              <div className="border-2 border-slate-400 p-6 rounded-lg relative overflow-hidden">
                {/* Watermark - Tecavo repeated diagonal on black bg */}
                <div 
                  className="absolute inset-0 pointer-events-none" 
                  style={{
                    backgroundImage: `url('https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/tecavo-watermark.jpeg')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    opacity: 0.18,
                    transform: 'rotate(-22deg) scale(1.15)',
                    zIndex: -1
                  }}
                />
                {/* Header with Logo and Company Info */}
                <div className="text-center mb-6 pb-6 border-b-2 border-slate-400">
                  {branding?.logo_url && (
                    <div className="flex justify-center mb-4">
                      <img 
                        src={branding.logo_url} 
                        alt="Logo Empresa" 
                        className="h-24 object-contain border border-slate-200 p-1 rounded"
                        crossOrigin="anonymous"
                      />
                    </div>
                  )}
                  <h1 className="text-2xl font-bold text-slate-900">{branding?.companyName || branding?.company_name || 'TECAVO FRUITS'}</h1>
                  <p className="text-xs text-slate-600 mt-2">RFC: {branding?.rfc || 'TFR230302EU5'}</p>
                  {branding?.address && (
                    <p className="text-xs text-slate-600 mt-1">{branding.address}</p>
                  )}
                  {branding?.saderRegistry && (
                    <p className="text-xs text-slate-600 mt-1">Registro SADER: {branding.saderRegistry}</p>
                  )}
                  <div className="mt-4">
                    <h2 className="text-xl font-bold text-slate-900">ORDEN DE CORTE</h2>
                    <p className="text-sm text-slate-600 mt-1">Folio: <span className="font-bold text-lg">{submittedOrder.folio}</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <p className="font-bold text-slate-700">Fecha de Corte</p>
                    <p className="text-slate-600">{submittedOrder.cutting_date}</p>
                  </div>
                  {(submittedOrder.plazo_dias || submittedOrder.entrega_estimada) && (
                    <div>
                      <p className="font-bold text-slate-700">Plazo / Entrega</p>
                      <p className="text-slate-600">{submittedOrder.plazo_dias || 0} días {submittedOrder.tipo_dias === 'naturales' ? '(Naturales)' : '(Hábiles)'} {submittedOrder.entrega_estimada ? `→ ${submittedOrder.entrega_estimada}` : ''}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-700">Tipo de Camión</p>
                    <p className="text-slate-600 uppercase">{submittedOrder.truck_type}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Costo de Flete</p>
                    <p className="text-slate-600">${parseFloat(submittedOrder.freight_cost || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Productor</p>
                    <p className="text-slate-600">{submittedOrder.producer_name}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Cajas a Corte</p>
                    <p className="text-slate-600">{submittedOrder.boxes_count}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Número de Cortadores</p>
                    <p className="text-slate-600">{submittedOrder.crew_workers_count || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Forma de Pago</p>
                    <p className="text-slate-600">{submittedOrder.crew_payment_method ? (submittedOrder.crew_payment_method === 'kilos' ? 'Kilos' : submittedOrder.crew_payment_method === 'dia' ? 'Día' : 'Cajas') : '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Huerta</p>
                    <p className="text-slate-600">{submittedOrder.orchard_name || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Ubicación</p>
                    <p className="text-slate-600">{submittedOrder.location || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Chofer</p>
                    <p className="text-slate-600">{submittedOrder.driver_name}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Tel. Chofer</p>
                    <p className="text-slate-600">{submittedOrder.driver_phone || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Jefe de Cuadrilla</p>
                    <p className="text-slate-600">{submittedOrder.crew_chief_name}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Tel. Jefe de Cuadrilla</p>
                    <p className="text-slate-600">{submittedOrder.crew_chief_phone || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Contacto</p>
                    <p className="text-slate-600">{submittedOrder.contact_name || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Tel. Contacto</p>
                    <p className="text-slate-600">{submittedOrder.contact_phone || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Placas</p>
                    <p className="text-slate-600">{submittedOrder.truck_plates || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Punto de Reunión</p>
                    <p className="text-slate-600">{submittedOrder.meeting_point || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Hora de Cita</p>
                    <p className="text-slate-600">{submittedOrder.meeting_time || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Báscula</p>
                    <p className="text-slate-600">{submittedOrder.scale || '-'}</p>
                  </div>
                  {submittedOrder.broker_name && (
                    <div>
                      <p className="font-bold text-slate-700">Nombre de Corredor</p>
                      <p className="text-slate-600">{submittedOrder.broker_name}</p>
                    </div>
                  )}
                  {submittedOrder.show_agreed_price && submittedOrder.agreed_price_per_kg != null && (
                    <div>
                      <p className="font-bold text-slate-700">Precio por kg Pactado</p>
                      <p className="text-slate-600">${parseFloat(submittedOrder.agreed_price_per_kg).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {submittedOrder.orchard_plant_type && (
                    <div>
                      <p className="font-bold text-slate-700">Tipo de Matas</p>
                      <p className="text-slate-600">{submittedOrder.orchard_plant_type}</p>
                    </div>
                  )}
                  {submittedOrder.orchard_terrain_type && (
                    <div>
                      <p className="font-bold text-slate-700">Tipo de Terreno</p>
                      <p className="text-slate-600">{submittedOrder.orchard_terrain_type}</p>
                    </div>
                  )}
                  {submittedOrder.orchard_cutting_type && (
                    <div>
                      <p className="font-bold text-slate-700">Tipo de Corte</p>
                      <p className="text-slate-600">{submittedOrder.orchard_cutting_type}</p>
                    </div>
                  )}
                </div>

                {submittedOrder.orchard_specifications && (
                  <div className="mb-6 text-sm">
                    <p className="font-bold text-slate-700 mb-1">Especificaciones de Huerta</p>
                    <p className="text-slate-600 italic">{submittedOrder.orchard_specifications}</p>
                  </div>
                )}

                {submittedOrder.packing_house_address && (
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-300 rounded-lg">
                    <p className="font-bold text-slate-700 mb-1">Domicilio del Empaque</p>
                    <p className="text-slate-600">{submittedOrder.packing_house_address}</p>
                  </div>
                )}

                <div className="bg-red-50 border-2 border-red-300 p-4 rounded-lg mt-6">
                  <p className="font-bold text-red-800 text-center text-sm">
                    ⚠️ AVISO IMPORTANTE
                  </p>
                  <p className="text-red-700 text-sm mt-2 text-center">
                    Por cada caja que falte al retorno se descontará $100.00 tanto al chofer como al jefe de cuadrilla.
                  </p>
                </div>

                {/* Footer with Company Info */}
                <div className="mt-8 pt-6 border-t-2 border-slate-400 text-center text-xs text-slate-600">
                  <p className="font-bold text-slate-900">{branding?.companyName || branding?.company_name || 'TECAVO FRUITS'}</p>
                  <p>RFC: {branding?.rfc || 'TFR230302EU5'}</p>
                  <p className="mt-1 text-slate-500">© {branding?.companyName || 'Tecavo Fruits'}. Todos los derechos reservados.</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 sticky bottom-0">
              {/* WhatsApp Send Section */}
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200 mb-4">
                <input
                  type="tel"
                  placeholder="📱 Teléfono WhatsApp (ej: +52 1234567890)"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm"
                />
                <button
                  onClick={handleSendViaWhatsApp}
                  disabled={whatsappLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {whatsappLoading ? '📤 Enviando...' : '📤 WhatsApp'}
                </button>
              </div>

              <div className="flex gap-3 flex-wrap justify-center">
                <button 
                  onClick={downloadPDF}
                  className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 flex items-center gap-2 transition-all"
                >
                  <i className="ph-fill ph-file-pdf"></i>
                  Descargar PDF
                </button>
                <button 
                  onClick={downloadJPG}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-all"
                >
                  <i className="ph-fill ph-image"></i>
                  Descargar JPG
                </button>
                <button 
                  onClick={printOrder}
                  className="px-4 py-2 bg-slate-600 text-white font-medium rounded-lg hover:bg-slate-700 flex items-center gap-2 transition-all"
                >
                  <i className="ph-fill ph-printer"></i>
                  Imprimir
                </button>
                <button 
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300 flex items-center gap-2 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-slate-900">Completar Orden de Corte</h2>
                <button onClick={() => setShowCompleteModal(false)} className="text-slate-500 hover:text-slate-700">
                  <i className="ph ph-x text-2xl"></i>
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">Folio: {selectedOrder.folio}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Peso Neto Total (kg) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={completeData.net_weight}
                  onChange={(e) => setCompleteData({ ...completeData, net_weight: e.target.value })}
                  placeholder="Ej. 5000.50"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Cajas Retornadas</label>
                <input 
                  type="number"
                  value={completeData.returned_boxes}
                  onChange={(e) => setCompleteData({ ...completeData, returned_boxes: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Cajas Faltantes</label>
                <input 
                  type="number"
                  value={completeData.missing_boxes}
                  onChange={(e) => setCompleteData({ ...completeData, missing_boxes: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" 
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">Al completar esta orden:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  {selectedOrder.lot_id && (
                    <li>Se creará automáticamente el registro de ingreso de fruta</li>
                  )}
                  <li>Se calculará el pago de la cuadrilla según {selectedOrder.crew_payment_method === 'kilos' ? 'kilos cortados' : selectedOrder.crew_payment_method === 'dia' ? 'días trabajados' : 'cajas cortadas'}</li>
                  <li>Se generará un asiento en el cierre semanal</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setShowCompleteModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-900 font-medium rounded-xl hover:bg-slate-300 transition-all" 
              >
                Cancelar
              </button>
              <button 
                onClick={handleCompleteOrder}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2" 
              >
                <i className="ph-fill ph-check-circle"></i>
                {isLoading ? 'Procesando...' : 'Completar Orden'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-6 text-sm text-slate-500 text-center">
          Tecavo Fruits Soft © 2024. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
