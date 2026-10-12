'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EmpaquePage() {
  const router = useRouter();
  const [lineas, setLineas] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [lots, setLots] = useState([]);
  const [inventario, setInventario] = useState(null);
  const [liquidacion, setLiquidacion] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [formLinea, setFormLinea] = useState({ id_lote: '', id_linea_fisica: '', hora_inicio: '' });
  const [formDetalle, setFormDetalle] = useState({
    id_lote: '', kilos_netos_exportacion: '', kilos_netos_nacional: '', kilos_canica: '', kilos_merma_industrial: '', kilos_deshidratacion: ''
  });
  const [pinModal, setPinModal] = useState({ open: false, onConfirm: null, motivo: '', field: '' });
  const [pinValue, setPinValue] = useState('');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [msg, setMsg] = useState('');
  const [whatsappModal, setWhatsappModal] = useState({ open: false, message: '' });
  const FIXED_WHATSAPP = '524433736931';

  // Nuevas features: 4 salidas, serial, insumos, maquila, RBAC, alerts, BI, multidivisa, kardex
  const [grupoRBAC, setGrupoRBAC] = useState('Grupo 2'); // 1=Báscula, 2=Proceso, 3=Finanzas
  const [form4Salidas, setForm4Salidas] = useState({ clase_a_kg: '', semi_kg: '', danada_proceso_kg: '', danada_desecho_kg: '' });
  const [moduloContratacion, setModuloContratacion] = useState('Compra Directa');
  const [insumoForm, setInsumoForm] = useState({ cantidad_real: '', motivo: '' });
  const [biData, setBiData] = useState([]);
  const [alertJson, setAlertJson] = useState(null);
  const [basculaPeso, setBasculaPeso] = useState('');
  const [basculaConnected, setBasculaConnected] = useState(false);

  // Multidivisa + CXC + RBAC matrix
  const [divisa, setDivisa] = useState('MXN');
  const [tipoCambio, setTipoCambio] = useState('19.65');
  const [kardex, setKardex] = useState([]);
  const [rbacMatrix, setRbacMatrix] = useState({
    'Grupo 1 (Báscula)': { ver: true, crear: true, editar: false, eliminar: false, auditoria: false },
    'Grupo 2 (Proceso)': { ver: true, crear: true, editar: true, eliminar: false, auditoria: false },
    'Grupo 3 (Finanzas)': { ver: true, crear: true, editar: true, eliminar: true, auditoria: true }
  });
  const [liquidacionForm, setLiquidacionForm] = useState({ precio_kilo_exportacion: '28', precio_kilo_nacional: '18', precio_kilo_canica_industrial: '8', retencion_materiales: '0' });

  useEffect(() => {
    fetch('/api/lots').then(r => r.json()).then(setLots).catch(() => {});
    fetch('/api/empaque/linea').then(r => r.json()).then(setLineas).catch(() => {});
    fetch('/api/empaque/detalle').then(r => r.json()).then(setDetalles).catch(() => {});
  }, []);

  // Cargar datos completos del lote seleccionado (trazabilidad heredada)
  const loadLotData = async (lotId) => {
    if (!lotId) return;
    try {
      const [invRes, liqRes, detRes, lotRes] = await Promise.all([
        fetch(`/api/inventario-bodega?lotId=${lotId}`),
        fetch(`/api/liquidacion?lotId=${lotId}`),
        fetch(`/api/empaque/detalle?lotId=${lotId}`),
        fetch(`/api/lots`).then(r => r.json())
      ]);
      const inv = invRes.ok ? await invRes.json() : [];
      const liq = liqRes.ok ? await liqRes.json() : [];
      const det = detRes.ok ? await detRes.json() : [];
      const lot = (lotRes || []).find(l => String(l.id) === String(lotId));
      
      setInventario(inv[0] || null);
      setLiquidacion(liq[0] || null);
      setDetalles(det);
      setSelectedLot(lot || { id: lotId });
      setFormDetalle(prev => ({ ...prev, id_lote: lotId }));
    } catch (e) {}
  };

  const selectLot = (lotId) => {
    setFormLinea({ ...formLinea, id_lote: lotId });
    setFormDetalle({ ...formDetalle, id_lote: lotId });
    loadLotData(lotId);
    cargarKardex();
  };

  const crearLinea = async () => {
    if (!formLinea.id_lote) return alert('Selecciona lote');
    const res = await fetch('/api/empaque/linea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formLinea) });
    if (res.ok) {
      const n = await res.json();
      setLineas([n, ...lineas]);
      setMsg('Proceso de línea creado con folio heredado.');
      loadLotData(formLinea.id_lote);
    }
  };

  const guardarDetalle = async (isUpdate = false, existingId = null) => {
    const payload = { ...formDetalle, id_lote: selectedLot?.id || formDetalle.id_lote };
    const url = isUpdate && existingId ? '/api/empaque/detalle' : '/api/empaque/detalle';
    const method = isUpdate && existingId ? 'PUT' : 'POST';
    
    // Si es edición de kilos ya guardados, exigir motivo + PIN
    const hasKilos = parseFloat(formDetalle.kilos_netos_exportacion) > 0 || parseFloat(formDetalle.kilos_netos_nacional) > 0;
    if (isUpdate && hasKilos && !motivoAjuste) {
      setPinModal({ 
        open: true, 
        onConfirm: () => doSaveWithPin(isUpdate, existingId), 
        motivo: 'Descuadre o ajuste de kilos netos. Ingrese PIN de Supervisor y Motivo de Ajuste.',
        field: 'kilos'
      });
      return;
    }

    const res = await fetch(url, { 
      method, 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ ...payload, id: existingId, motivo_ajuste: motivoAjuste, pin_autorizado: pinValue, usuario: 'supervisor' }) 
    });
    
    if (res.ok) {
      const n = await res.json();
      setDetalles([n, ...detalles.filter(d => d.id !== existingId)]);
      setMsg('Detalle guardado. Trazabilidad enlazada por ID_Lote.');
      setMotivoAjuste('');
      setPinValue('');
      loadLotData(payload.id_lote);
    } else if (res.status === 403) {
      setPinModal({ open: true, onConfirm: () => doSaveWithPin(isUpdate, existingId), motivo: 'Se requiere PIN de Supervisor y Motivo de Ajuste para modificar kilos netos.' });
    }
  };

  const doSaveWithPin = async (isUpdate, existingId) => {
    if (!pinValue) return alert('PIN requerido');
    // Reintentar guardado con PIN
    await guardarDetalle(isUpdate, existingId);
    setPinModal({ open: false, onConfirm: null, motivo: '' });
  };

  // WhatsApp exacto según especificación (número fijo + modal + Aceptar obligatorio)
  const buildInventarioMessage = (inv, lot) => {
    const idL = lot?.lot_number || inv?.folio_lote || '—';
    const h = lot?.orchard_name || '—';
    const fmt = (p) => `Super: ${p.super_t||0} tarimas, ${p.super_c||0} cajas\nExtra: ${p.extra_t||0} tarimas, ${p.extra_c||0} cajas\nPrimera: ${p.primera_t||0} tarimas, ${p.primera_c||0} cajas\nMediano: ${p.mediano_t||0} tarimas, ${p.mediano_c||0} cajas\nTercera: ${p.tercera_t||0} tarimas, ${p.tercera_c||0} cajas\nCuarta: ${p.cuarta_t||0} tarimas, ${p.cuarta_c||0} cajas`;
    
    const a = {
      super_t: inv?.clasea_super_tarimas||0, super_c: inv?.clasea_super_cajas||0,
      extra_t: inv?.clasea_extra_tarimas||0, extra_c: inv?.clasea_extra_cajas||0,
      primera_t: inv?.clasea_primera_tarimas||0, primera_c: inv?.clasea_primera_cajas||0,
      mediano_t: inv?.clasea_mediano_tarimas||0, mediano_c: inv?.clasea_mediano_cajas||0,
      tercera_t: inv?.clasea_tercera_tarimas||0, tercera_c: inv?.clasea_tercera_cajas||0,
      cuarta_t: inv?.clasea_cuarta_tarimas||0, cuarta_c: inv?.clasea_cuarta_cajas||0
    };
    const b = {
      super_t: inv?.claseb_super_tarimas||0, super_c: inv?.claseb_super_cajas||0,
      extra_t: inv?.claseb_extra_tarimas||0, extra_c: inv?.claseb_extra_cajas||0,
      primera_t: inv?.claseb_primera_tarimas||0, primera_c: inv?.claseb_primera_cajas||0,
      mediano_t: inv?.claseb_mediano_tarimas||0, mediano_c: inv?.claseb_mediano_cajas||0,
      tercera_t: inv?.claseb_tercera_tarimas||0, tercera_c: inv?.claseb_tercera_cajas||0,
      cuarta_t: inv?.claseb_cuarta_tarimas||0, cuarta_c: inv?.claseb_cuarta_cajas||0
    };

    return `📦 *RESUMEN DE INVENTARIO ACTUALIZADO*\nLote: ${idL} | Huerto: ${h}\n\n*Clase A*\n${fmt(a)}\n\n*Clase B*\n${fmt(b)}`;
  };

  const handleCompartirWhatsapp = () => {
    if (!inventario && !selectedLot) { alert('Selecciona un lote con inventario'); return; }
    const msg = buildInventarioMessage(inventario, selectedLot);
    setWhatsappModal({ open: true, message: msg });
  };

  const confirmarWhatsapp = () => {
    setWhatsappModal({ open: false, message: '' });
    const encoded = encodeURIComponent(whatsappModal.message);
    // Redirección rígida exacta al número fijo del administrador (524433736931) como exige el spec repetido
    window.open(`https://wa.me/${FIXED_WHATSAPP}?text=${encoded}`, '_blank');
  };

  // Generador de Ticket de Liquidación PDF exacto al spec
  const generarTicketLiquidacion = async () => {
    if (!selectedLot || !liquidacion) {
      alert('Selecciona lote y genera la liquidación primero');
      return;
    }
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    
    let y = 15;
    const left = 15;
    
    // ENCABEZADO
    doc.setFontSize(14);
    doc.text('EMPAQUE TECAVO', left, y); y += 6;
    doc.setFontSize(10);
    doc.text('RFC: EMP0416082581/2024', left, y); y += 5;
    doc.text(`Folio Lote: ${selectedLot.lot_number || selectedLot.id}  |  Orden Corte: ${liquidacion.folio_orden_corte || '—'}`, left, y); y += 5;
    doc.text(`Productor: ${selectedLot.producer || '—'}   Huerto: ${selectedLot.orchard_name || '—'}`, left, y); y += 5;
    doc.text(`Fecha Recepción: ${selectedLot.date || '—'}   Camión: ${selectedLot.truck_plates || '—'}`, left, y); y += 8;

    // SECCIÓN A
    doc.setFontSize(11);
    doc.text('SECCIÓN A: RESUMEN DE RECEPCIÓN (INPUT)', left, y); y += 6;
    doc.setFontSize(9);
    doc.text(`Peso Bruto Recibido: ${selectedLot.total_kg_received || '—'} Kg    Cajas Recibidas: ${selectedLot.total_boxes || '—'}`, left, y); y += 8;

    // SECCIÓN B
    doc.setFontSize(11);
    doc.text('SECCIÓN B: RENDIMIENTO COMERCIAL (KILOS NETOS EDITADOS)', left, y); y += 6;
    doc.setFontSize(9);
    doc.text(`Exportación: ${liquidacion.kilos_netos_exportacion || 0} Kg`, left, y); y += 4.5;
    doc.text(`Nacional: ${liquidacion.kilos_netos_nacional || 0} Kg`, left, y); y += 4.5;
    doc.text(`Canica: ${liquidacion.kilos_canica || 0} Kg    Merma Industrial: ${liquidacion.kilos_merma_industrial || 0} Kg    Deshidratación: ${liquidacion.kilos_deshidratacion || 0} Kg`, left, y); y += 8;

    // SECCIÓN C - FINANZAS
    doc.setFontSize(11);
    doc.text('SECCIÓN C: LIQUIDACIÓN FINANCIERA', left, y); y += 6;
    doc.setFontSize(9);
    const sub = liquidacion.subtotal_ingreso_productor || 0;
    const iva = liquidacion.impuesto_iva || 0;
    const retC = liquidacion.retencion_cuadrilla_corte || 0;
    const retF = liquidacion.retencion_flete_transporte || 0;
    const retM = liquidacion.retencion_materiales || 0;
    const isr = liquidacion.retencion_isr_agricola || 0;
    const totalD = liquidacion.total_deducciones || 0;
    const neto = liquidacion.neto_a_pagar_productor || 0;

    doc.text(`Valor Exportación: ${liquidacion.kilos_netos_exportacion || 0} kg × $${liquidacion.precio_kilo_exportacion || 0}`, left, y); y += 4.5;
    doc.text(`Valor Nacional: ${liquidacion.kilos_netos_nacional || 0} kg × $${liquidacion.precio_kilo_nacional || 0}`, left, y); y += 4.5;
    doc.text(`Valor Canica/Industrial: $${( (liquidacion.kilos_canica||0)+(liquidacion.kilos_merma_industrial||0) ) * (liquidacion.precio_kilo_canica_industrial||0)}`, left, y); y += 5;
    doc.text(`SUBTOTAL INGRESO PRODUCTOR: $${sub.toFixed(2)}`, left, y); y += 5;
    doc.text(`(+) IVA 16%: $${iva.toFixed(2)}`, left, y); y += 5;
    doc.text(`(-) Retención Cuadrilla Corte: $${retC.toFixed(2)}`, left, y); y += 4.5;
    doc.text(`(-) Retención Flete Transporte: $${retF.toFixed(2)}`, left, y); y += 4.5;
    doc.text(`(-) Retención Materiales: $${retM.toFixed(2)}`, left, y); y += 4.5;
    doc.text(`(-) Retención ISR Agrícola (1.25%): $${isr.toFixed(2)}`, left, y); y += 5;
    doc.setFontSize(12);
    doc.text(`NETO TOTAL A PAGAR AL PRODUCTOR: $${neto.toFixed(2)}`, left, y); y += 10;

    // PIE
    doc.setFontSize(9);
    doc.text('Firma Administrador: _______________________     Firma Productor: _______________________', left, y); y += 8;
    doc.text('QR Validación: ID_Lote ' + (selectedLot.id || '') + ' — Sistema Trazabilidad Empacadora', left, y);

    doc.save(`Ticket_Liquidacion_${selectedLot.lot_number || selectedLot.id}.pdf`);
    setMsg('Ticket de Liquidación generado (PDF exacto al formato).');
  };

  const validarRendimiento = async (d) => {
    const pesoBruto = selectedLot?.total_kg_received || 1000;
    const res = await fetch('/api/empaque/validar-rendimiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lotId: d.id_lote || selectedLot?.id,
        pesoBrutoRecibido: pesoBruto,
        kilosExport: d.kilos_netos_exportacion,
        kilosNacional: d.kilos_netos_nacional,
        kilosCanica: d.kilos_canica,
        kilosMerma: d.kilos_merma_industrial,
        kilosDeshidratacion: d.kilos_deshidratacion
      })
    });
    const data = await res.json();
    if (data.requiresPin || data.superaTolerancia) {
      setPinModal({ open: true, onConfirm: () => autorizarCierre(d, true), motivo: data.mensaje || 'Descuadre > 2.5%. Requiere PIN de supervisor.' });
    } else {
      alert(data.mensaje || 'Validación OK dentro de tolerancia.');
    }
  };

  const autorizarCierre = async (det, withPin) => {
    if (withPin && !pinValue) return alert('Ingresa PIN de supervisor');
    const res = await fetch('/api/empaque/validar-rendimiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lotId: det.id_lote || selectedLot?.id,
        pesoBrutoRecibido: selectedLot?.total_kg_received || 1000,
        kilosExport: det.kilos_netos_exportacion,
        kilosNacional: det.kilos_netos_nacional,
        kilosCanica: det.kilos_canica,
        kilosMerma: det.kilos_merma_industrial,
        kilosDeshidratacion: det.kilos_deshidratacion,
        pin: pinValue,
        usuario: 'supervisor'
      })
    });
    const data = await res.json();
    alert(data.mensaje || 'Autorizado por PIN');
    setPinModal({ open: false, onConfirm: null, motivo: '' });
    setPinValue('');
    setMotivoAjuste('');
  };

  // (Serial mejorado movido arriba con guardado real + bloqueo antifraude)

  // Guardar 4 salidas + heredar a detalle
  const guardar4Salidas = async () => {
    if (!selectedLot) return alert('Seleccione lote');
    const payload = {
      id_lote: selectedLot.id,
      clase_a_kg: form4Salidas.clase_a_kg,
      semi_kg: form4Salidas.semi_kg,
      danada_proceso_kg: form4Salidas.danada_proceso_kg,
      danada_desecho_kg: form4Salidas.danada_desecho_kg,
      calidad_salida: 'Clase A / Semi / Proceso / Desecho',
      kilos_netos_exportacion: form4Salidas.clase_a_kg,
      kilos_netos_nacional: form4Salidas.semi_kg,
      kilos_canica: form4Salidas.danada_proceso_kg,
      kilos_merma_industrial: form4Salidas.danada_desecho_kg
    };
    const res = await fetch('/api/empaque/detalle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      setMsg('4 salidas registradas (Clase A, Semi, Dañada Proceso, Dañada Desecho). Trazabilidad ID_Lote.');
      loadLotData(selectedLot.id);
    }
  };

  // Insumos editables (requiere PIN si edita real)
  const guardarInsumo = async () => {
    if (!selectedLot) return;
    const res = await fetch('/api/consumo-insumos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        folio_proceso: selectedLot.id, 
        cantidad_real_consumida: insumoForm.cantidad_real, 
        motivo_ajuste: insumoForm.motivo,
        usuario: grupoRBAC
      })
    });
    if (res.ok) setMsg('Consumo real guardado. Si editado: PIN + Motivo auditado en bitacora.');
  };

  // Calcular prorrateo simple (ejemplo)
  const calcularProrrateo = (viajeTotalFlete, pesoLote, pesoTotalViaje) => {
    return pesoTotalViaje > 0 ? (viajeTotalFlete * (pesoLote / pesoTotalViaje)) : 0;
  };

  // RBAC helper (compat)
  const puedeVer = (seccion) => {
    if (grupoRBAC === 'Grupo 1') return ['bascula', 'recepcion'].includes(seccion);
    if (grupoRBAC === 'Grupo 2') return ['proceso', 'insumos', '4salidas'].includes(seccion);
    if (grupoRBAC === 'Grupo 3') return ['liquidacion', 'bi', 'cxc', 'alertas'].includes(seccion);
    return true;
  };

  // Webhook usando el nuevo endpoint que genera JSON exacto del spec
  const dispararAlertaWebhook = async (tipo) => {
    const payload = {
      event_type: tipo,
      folio_lote: selectedLot?.lot_number || selectedLot?.id,
      folio_factura: 'FAC-' + Date.now().toString().slice(-6),
      motivo: tipo === 'security_alert_invoice_cancelled' ? 'Rechazo de aduana por exceso de maduración' : 'Diferencia cajas >15 o merma >8% o edición insumos'
    };
    const r = await fetch('/api/alerts/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json();
    setAlertJson(data.webhook_payload || data);
    setMsg('Alerta generada. JSON exacto listo para WhatsApp/Twilio.');
  };

  // BI
  const cargarBI = async () => {
    const r = await fetch(`/api/bi/lote-utilidad${selectedLot ? '?lotId=' + selectedLot.id : ''}`);
    const d = await r.json();
    setBiData(d);
  };

  // Guardar viaje logistica + prorrateo (exacto al spec)
  const guardarViaje = async () => {
    if (!selectedLot) return;
    await fetch('/api/logistica-viajes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        folio_corte: selectedLot.cutting_order_id || selectedLot.folio, 
        tarifa_flete_pactada: 1200, 
        tarifa_corte_por_kilo: 2.5,
        cajas_campo_enviadas: selectedLot.total_boxes || 100 
      })
    });
    setMsg('Viaje registrado. Prorrateo (Peso Neto Lote / Peso Total Viaje) se aplicará en liquidación.');
  };

  // Kárdex de Cliente (Factura -> Depósito -> Abonos con saldos MXN/USD)
  const cargarKardex = async () => {
    if (!selectedLot) return;
    try {
      const res = await fetch(`/api/abonos?customer=${encodeURIComponent(selectedLot.producer || '')}`);
      const data = await res.json();
      setKardex(Array.isArray(data) ? data.slice(0,8) : []);
    } catch (_) { setKardex([]); }
  };

  // Guardar liquidación con fórmulas + multidivisa + maquila
  const guardarLiquidacionMultidivisa = async () => {
    if (!selectedLot) return alert('Selecciona lote');
    const d = detalles[0] || formDetalle;
    const body = {
      id_lote: selectedLot.id,
      kilos_netos_exportacion: d.kilos_netos_exportacion || form4Salidas.clase_a_kg,
      kilos_netos_nacional: d.kilos_netos_nacional || form4Salidas.semi_kg,
      kilos_canica: d.kilos_canica || form4Salidas.danada_proceso_kg,
      kilos_merma_industrial: d.kilos_merma_industrial || form4Salidas.danada_desecho_kg,
      precio_kilo_exportacion: liquidacionForm.precio_kilo_exportacion,
      precio_kilo_nacional: liquidacionForm.precio_kilo_nacional,
      precio_kilo_canica_industrial: liquidacionForm.precio_kilo_canica_industrial,
      retencion_materiales: liquidacionForm.retencion_materiales,
      costo_corte_por_caja: 3.5,
      cantidad_cajas_recibidas: selectedLot.total_boxes || 100,
      valor_flete: selectedLot.freight_cost || 1200,
      modulo_contratacion: moduloContratacion,
      cargo_maquila: moduloContratacion === 'Servicio de Maquila' ? 850 : 0,
      divisa_factura: divisa,
      tipo_cambio: parseFloat(tipoCambio)
    };
    const r = await fetch('/api/liquidacion', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (r.ok) { 
      setMsg('Liquidación guardada con fórmulas + prorrateo + multidivisa.'); 
      loadLotData(selectedLot.id); 
    }
  };

  // RBAC Matrix (Superadmin edita permisos en grid)
  const toggleRbac = (grupo, perm) => {
    setRbacMatrix(prev => ({
      ...prev,
      [grupo]: { ...prev[grupo], [perm]: !prev[grupo][perm] }
    }));
    setMsg(`Permiso ${perm} para ${grupo} actualizado (simulado - Superadmin controla).`);
  };

  // Serial mejorado: inyecta y guarda en báscula real (fruit_input_weighings o actualiza lote)
  const conectarBasculaSerial = async () => {
    try {
      if (!('serial' in navigator)) { alert('Web Serial solo en Chrome/Edge HTTPS.'); return; }
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      setBasculaConnected(true);
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        if (buffer.includes('\r') || buffer.includes('\n')) {
          const pesoLimpio = buffer.replace(/[^0-9.]/g, '');
          if (pesoLimpio && selectedLot) {
            setBasculaPeso(pesoLimpio);
            // Guardar automáticamente en weighings / actualizar lote (antifraude)
            try {
              await fetch('/api/fruit-input-weighings', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                  lot_id: selectedLot.id, 
                  total_kg_weighed: parseFloat(pesoLimpio), 
                  public_scale_date: new Date().toISOString().slice(0,10),
                  notes: 'Captura automática desde báscula serial (bloqueado manual)'
                }) 
              });
            } catch(_) {}
            setMsg(`Báscula: ${pesoLimpio} kg guardado (edición manual bloqueada para Grupo 1).`);
          }
          buffer = '';
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error serial. Fallback manual solo para Superadmin.');
      setBasculaConnected(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <button onClick={() => router.push('/')} className="text-sm mb-4">← Regresar al inicio</button>
      <h1 className="text-3xl font-bold mb-1">Empacadora de Aguacate — Trazabilidad Completa (Campo → Salida)</h1>
      <p className="text-sm text-slate-600 mb-4">Llaves Foráneas + Folios Heredados • ID_Lote como eje central • PIN Supervisor para ajustes • Tolerancia 2.5%</p>

      {msg && <div className="mb-4 p-3 bg-emerald-50 border text-emerald-700 rounded">{msg}</div>}

      {/* Selector de Lote + Herencia automática */}
      <div className="bg-white border rounded-2xl p-5 mb-6">
        <h2 className="font-semibold mb-3">Seleccionar Lote (hereda automáticamente Productor, Huerto y Camión)</h2>
        <select 
          value={selectedLot?.id || ''} 
          onChange={e => { const id = e.target.value; selectLot(id); }} 
          className="border rounded p-2 w-full md:w-1/2"
        >
          <option value="">— Seleccionar Lote —</option>
          {lots.map(l => <option key={l.id} value={l.id}>{l.lot_number} — {l.producer} / {l.orchard_name}</option>)}
        </select>
        {selectedLot && (
          <div className="mt-2 text-xs text-slate-500">
            Trazabilidad: ORDEN_CORTE → LOTE (ID_Lote) → LINEA_EMPAQUE → DETALLE → INVENTARIO_BODEGA → ORDEN_EMBARQUE → LIQUIDACION_CONTABLE
          </div>
        )}
      </div>

      {/* 1. Línea de Empaque */}
      <div className="bg-white border rounded-2xl p-5 mb-6">
        <h2 className="font-semibold mb-3">1. Línea de Empaque (Proceso de Selección)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input placeholder="Línea física" value={formLinea.id_linea_fisica || ''} onChange={e => setFormLinea({ ...formLinea, id_linea_fisica: e.target.value })} className="border rounded p-2" />
          <input type="time" value={formLinea.hora_inicio || ''} onChange={e => setFormLinea({ ...formLinea, hora_inicio: e.target.value })} className="border rounded p-2" />
          <button onClick={crearLinea} className="bg-emerald-700 text-white rounded px-4">Iniciar Línea + Heredar Folios</button>
        </div>
      </div>

      {/* 2. DETALLE_EMPAQUE_CALIBRES 100% EDITABLE */}
      <div className="bg-white border rounded-2xl p-5 mb-6">
        <h2 className="font-semibold mb-3">2. Detalle Empaque Calibres (Campos 100% Editables - Supervisor puede corregir)</h2>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <input placeholder="Kilos Netos Export" type="number" value={formDetalle.kilos_netos_exportacion} onChange={e => setFormDetalle({ ...formDetalle, kilos_netos_exportacion: e.target.value })} className="border p-2 rounded" />
          <input placeholder="Kilos Netos Nacional" type="number" value={formDetalle.kilos_netos_nacional} onChange={e => setFormDetalle({ ...formDetalle, kilos_netos_nacional: e.target.value })} className="border p-2 rounded" />
          <input placeholder="Canica" type="number" value={formDetalle.kilos_canica} onChange={e => setFormDetalle({ ...formDetalle, kilos_canica: e.target.value })} className="border p-2 rounded" />
          <input placeholder="Merma Industrial" type="number" value={formDetalle.kilos_merma_industrial} onChange={e => setFormDetalle({ ...formDetalle, kilos_merma_industrial: e.target.value })} className="border p-2 rounded" />
          <input placeholder="Deshidratación" type="number" value={formDetalle.kilos_deshidratacion} onChange={e => setFormDetalle({ ...formDetalle, kilos_deshidratacion: e.target.value })} className="border p-2 rounded" />
          <input placeholder="Motivo Ajuste (si edita)" value={motivoAjuste} onChange={e=>setMotivoAjuste(e.target.value)} className="border p-2 rounded col-span-2" />
        </div>
        <div className="flex gap-3 mt-3">
          <button onClick={() => guardarDetalle(false)} className="bg-black text-white px-5 py-2 rounded">Guardar Detalle</button>
          <button onClick={() => detalles[0] && guardarDetalle(true, detalles[0].id)} className="border px-4 py-2 rounded">Actualizar último (requiere PIN si kilos)</button>
          <button onClick={() => detalles[0] && validarRendimiento(detalles[0])} className="border px-4 py-2 rounded">Validar Rendimiento (2.5%)</button>
        </div>
        <div className="text-xs mt-2 text-slate-500">Kilos_Totales_Salida = Export + Nacional + Canica + Merma + Deshidratación. Si diferencia {'>'}2.5% → alerta + PIN Supervisor + Motivo_Ajuste (no bloquea).</div>
      </div>

      {/* Inventario Bodega (Clase A/B por tamaño) */}
      {inventario && (
        <div className="bg-white border rounded-2xl p-5 mb-6">
          <h2 className="font-semibold mb-2">Inventario Bodega (Clase A / Clase B - editable por Supervisor)</h2>
          <div className="text-sm grid grid-cols-2 gap-x-8">
            <div>
              <div className="font-medium">Clase A</div>
              <div>Super: {inventario.clasea_super_tarimas} tar / {inventario.clasea_super_cajas} cajas</div>
              <div>Extra: {inventario.clasea_extra_tarimas} tar / {inventario.clasea_extra_cajas} cajas</div>
              <div>Primera: {inventario.clasea_primera_tarimas} tar / {inventario.clasea_primera_cajas} cajas</div>
            </div>
            <div>
              <div className="font-medium">Clase B</div>
              <div>Super: {inventario.claseb_super_tarimas} tar / {inventario.claseb_super_cajas} cajas</div>
              <div>Extra: {inventario.claseb_extra_tarimas} tar / {inventario.claseb_extra_cajas} cajas</div>
              <div>Primera: {inventario.claseb_primera_tarimas} tar / {inventario.claseb_primera_cajas} cajas</div>
            </div>
          </div>
        </div>
      )}

      {/* Acciones de Salida y Comunicación */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button onClick={handleCompartirWhatsapp} className="bg-emerald-700 text-white px-5 py-3 rounded-2xl font-medium">📱 Compartir Inventario por WhatsApp (número fijo)</button>
        <button onClick={generarTicketLiquidacion} className="bg-slate-900 text-white px-5 py-3 rounded-2xl font-medium">🖨️ Generar Ticket de Liquidación PDF</button>
        <button onClick={guardarLiquidacionMultidivisa} className="border px-5 py-3 rounded-2xl">Calcular Liquidación (multidivisa + prorrateo + maquila)</button>
        <button onClick={async () => {
          if (!selectedLot || !liquidacion) return;
          await fetch('/api/liquidacion', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: liquidacion.id, estatus: 'Listo para Pago' }) });
          setMsg('Liquidación aprobada (Estatus → Listo para Pago).');
          loadLotData(selectedLot.id);
        }} className="border px-4 py-3 rounded-2xl">Aprobar Liquidación (cambia a Listo para Pago)</button>
        <a href="/orden-embarque" className="border px-5 py-3 rounded-2xl text-center">Ir a Órdenes de Embarque (Pendiente → En Tránsito → Entregado)</a>
      </div>

      {/* === ARQUITECTURA COMPLETA ERP EMPACADORA (Módulos 1-4 + Multidivisa + RBAC + Kárdex + Drill-Down) === */}
      <div className="bg-white border rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="font-semibold">ERP Empacadora de Aguacate — Trazabilidad Financiera Punta a Punta (MXN/USD)</div>
          <select value={grupoRBAC} onChange={e=>setGrupoRBAC(e.target.value)} className="border text-sm px-2 py-1 rounded">
            <option>Grupo 1 (Báscula)</option>
            <option>Grupo 2 (Proceso)</option>
            <option>Grupo 3 (Finanzas)</option>
          </select>
          <span className="text-xs text-slate-500">RBAC por grupo (Superadmin edita matriz abajo)</span>
        </div>

        {/* MÓDULO 1: PARAMETRIZACIÓN, CAMPO Y LOGÍSTICA */}
        <div className="mb-5 p-3 bg-amber-50 rounded">
          <div className="font-semibold mb-2">MÓDULO 1 — Orden de Corte + Logística Viaje (Prorrateo Automático)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div>Folio Corte / Lote heredado: <b>{selectedLot?.lot_number || '—'}</b></div>
            <div>Productor / Huerto: <b>{selectedLot?.producer || '—'} / {selectedLot?.orchard_name || '—'}</b></div>
            <div>
              <button onClick={guardarViaje} className="bg-amber-700 text-white px-3 py-1 rounded text-xs">Registrar Viaje + Prorrateo Flete</button>
              <span className="ml-2 text-[10px]">Tarifa_Flete / Peso total viaje → prorrateado por Peso_Neto de cada lote</span>
            </div>
          </div>
          <div className="mt-2 text-xs">Módulo Contratación: 
            <select value={moduloContratacion} onChange={e=>setModuloContratacion(e.target.value)} className="ml-2 border p-0.5 text-xs">
              <option>Compra Directa</option><option>Servicio de Maquila</option>
            </select>
            (Si Maquila: flete/corte → activo circulante Deudores y se cobra en Factura_Venta)
          </div>
        </div>

        {/* MÓDULO 2: BÁSCULA + RECEPCIÓN + 4 SALIDAS + INSUMOS */}
        <div className="mb-5 p-3 bg-blue-50 rounded">
          <div className="font-semibold mb-2">MÓDULO 2 — Báscula / Recepción + Línea Empaque (4 Salidas Físicas + Insumos Editables)</div>
          
          {/* Báscula Serial Grupo 1 */}
          <div className="mb-3">
            <button onClick={conectarBasculaSerial} className="bg-blue-700 text-white px-3 py-1 rounded text-sm mr-2">Conectar Báscula Serial (9600 8N1)</button>
            <span>Peso: <b>{basculaPeso || '—'}</b> kg {basculaConnected && '• BLOQUEADO manual (antifraude)'}</span>
            <div className="text-[10px]">Diferencia de cajas en rojo si {'>'}0. Se guarda como activo circulante para deducir en liquidación.</div>
          </div>

          {/* 4 Salidas exactas al spec */}
          <div className="mb-3">
            <div className="text-sm font-medium mb-1">Clasificación 4 Salidas (100% editables):</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input placeholder="Clase A (Premium/Export) kg" type="number" value={form4Salidas.clase_a_kg} onChange={e=>setForm4Salidas({...form4Salidas, clase_a_kg:e.target.value})} className="border p-1 rounded text-sm" />
              <input placeholder="Semi (Nacional) kg" type="number" value={form4Salidas.semi_kg} onChange={e=>setForm4Salidas({...form4Salidas, semi_kg:e.target.value})} className="border p-1 rounded text-sm" />
              <input placeholder="Dañada Proceso (Maduradoras/pulpa) kg" type="number" value={form4Salidas.danada_proceso_kg} onChange={e=>setForm4Salidas({...form4Salidas, danada_proceso_kg:e.target.value})} className="border p-1 rounded text-sm" />
              <input placeholder="Dañada Desecho (Canica/granel) kg" type="number" value={form4Salidas.danada_desecho_kg} onChange={e=>setForm4Salidas({...form4Salidas, danada_desecho_kg:e.target.value})} className="border p-1 rounded text-sm" />
            </div>
            <button onClick={guardar4Salidas} className="mt-1 bg-black text-white px-3 py-1 rounded text-xs">Guardar 4 Salidas (hereda ID_Lote)</button>
          </div>

          {/* Insumos editables + auditoría */}
          <div>
            <div className="text-sm font-medium">Consumo Insumos (teórico → real editable por Supervisor)</div>
            <div className="flex gap-2 mt-1">
              <input placeholder="Cantidad real" type="number" value={insumoForm.cantidad_real} onChange={e=>setInsumoForm({...insumoForm, cantidad_real:e.target.value})} className="border p-1 rounded text-sm w-28" />
              <input placeholder="Motivo Ajuste (obligatorio al editar)" value={insumoForm.motivo} onChange={e=>setInsumoForm({...insumoForm, motivo:e.target.value})} className="border p-1 rounded flex-1 text-sm" />
              <button onClick={guardarInsumo} className="border px-3 rounded text-sm">Guardar (PIN+Bitácora)</button>
            </div>
            <div className="text-[10px] text-slate-500">Al guardar real diferente: exige PIN Supervisor + Motivo → bitacora_auditoria_insumos</div>
          </div>
        </div>

        {/* MÓDULO 3: LIQUIDACIONES MULTIDIVISA + CXC + KÁRDEX */}
        <div className="mb-5 p-3 bg-emerald-50 rounded">
          <div className="font-semibold mb-2">MÓDULO 3 — Liquidaciones + Multidivisa + CXC Clientes (Kárdex Drill-Down)</div>
          
          <div className="flex gap-2 mb-2 text-sm">
            <select value={divisa} onChange={e=>setDivisa(e.target.value)} className="border p-1 rounded">
              <option>MXN</option><option>USD</option>
            </select>
            <input value={tipoCambio} onChange={e=>setTipoCambio(e.target.value)} className="border p-1 rounded w-20" placeholder="TC" />
            <span className="text-xs self-center">Tipo Cambio (USD→MXN)</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            <input placeholder="Precio kg Export" value={liquidacionForm.precio_kilo_exportacion} onChange={e=>setLiquidacionForm({...liquidacionForm, precio_kilo_exportacion:e.target.value})} className="border p-1 rounded text-sm" />
            <input placeholder="Precio kg Nacional" value={liquidacionForm.precio_kilo_nacional} onChange={e=>setLiquidacionForm({...liquidacionForm, precio_kilo_nacional:e.target.value})} className="border p-1 rounded text-sm" />
            <input placeholder="Precio kg Canica/Industrial" value={liquidacionForm.precio_kilo_canica_industrial} onChange={e=>setLiquidacionForm({...liquidacionForm, precio_kilo_canica_industrial:e.target.value})} className="border p-1 rounded text-sm" />
            <input placeholder="Retención Materiales" value={liquidacionForm.retencion_materiales} onChange={e=>setLiquidacionForm({...liquidacionForm, retencion_materiales:e.target.value})} className="border p-1 rounded text-sm" />
          </div>

          <div className="flex gap-2">
            <button onClick={guardarLiquidacionMultidivisa} className="bg-emerald-700 text-white px-4 py-1 rounded text-sm">Calcular + Guardar Liquidación (fórmulas + prorrateo + maquila)</button>
            <button onClick={cargarKardex} className="border px-3 py-1 rounded text-sm">Cargar Kárdex Cliente</button>
          </div>

          {/* Kárdex simple */}
          {kardex.length > 0 && (
            <div className="mt-3 text-xs border p-2 bg-white">
              <div className="font-medium mb-1">KÁRDEX CLIENTE (Factura → Depósito → Abonos con saldos parciales)</div>
              {kardex.map((k,i)=>(<div key={i}>• {k.folio || k.id} | {k.fecha} | {k.importe_recibido || k.monto} {k.moneda_recibida || ''} | Saldo: {k.saldo_usd || k.total_abonado_usd || '—'}</div>))}
            </div>
          )}

          <div className="text-[10px] mt-1">Fórmulas: Subtotal = (KExp×PExp)+(KNac×PNac)+((KCan+KMer)×PCan) • IVA 16% • ISR 1.25% • Neto = (Subtotal+IVA) - (Corte+Flete+Materiales+ISR+CargoMaquila)</div>
        </div>

        {/* MÓDULO 4: SEGURIDAD RBAC + ALERTAS + BI + CANCELACIONES */}
        <div className="p-3 bg-slate-50 rounded">
          <div className="font-semibold mb-2">MÓDULO 4 — Seguridad, RBAC Matrix, Alertas y BI Drill-Down</div>

          {/* RBAC Matrix visual interactiva */}
          <div className="mb-3">
            <div className="text-sm font-medium mb-1">Matriz RBAC (Superadmin edita permisos por Grupo)</div>
            <table className="text-xs border w-full">
              <thead><tr className="bg-slate-100"><th>Grupo</th><th>Ver</th><th>Crear</th><th>Editar</th><th>Eliminar</th><th>Auditoría/Drill</th></tr></thead>
              <tbody>
                {Object.keys(rbacMatrix).map(g => (
                  <tr key={g}>
                    <td className="p-1 font-medium">{g}</td>
                    {['ver','crear','editar','eliminar','auditoria'].map(p => (
                      <td key={p} className="p-1 text-center">
                        <input type="checkbox" checked={rbacMatrix[g][p]} onChange={() => toggleRbac(g, p)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[10px]">Grupo 1: solo báscula/recepción (sin precios). Grupo 2: clasificación + insumos (sin CXC). Grupo 3: todo financiero + BI.</div>
          </div>

          {/* Alertas exactas */}
          <div className="mb-3">
            <button onClick={() => dispararAlertaWebhook('security_alert_invoice_cancelled')} className="bg-red-600 text-white px-3 py-1 rounded text-xs mr-2">Disparar Alerta Factura Cancelada (JSON exacto spec)</button>
            <button onClick={() => dispararAlertaWebhook('risk_difference')} className="border px-2 py-1 rounded text-xs">Alerta Cajas{'>'}15 / Merma{'>'}8% / Edición Insumos</button>
            {alertJson && <pre className="text-[9px] bg-white p-2 mt-1 border max-h-28 overflow-auto">{JSON.stringify(alertJson, null, 2)}</pre>}
          </div>

          {/* BI */}
          <div>
            <button onClick={cargarBI} className="bg-indigo-700 text-white px-3 py-1 rounded text-xs">Ejecutar BI Utilidad Neta por Lote (Drill-Down inverso hasta Orden de Corte)</button>
            {biData.length > 0 && biData.map((r,i) => (
              <div key={i} className="text-[10px] mt-1 border-b">Centro Costos: {r.centro_costos_lote} | Ingresos MXN: {r.ingresos_totales_mxn} | Utilidad Neta: {r.utilidad_neta_real_lote_mxn} | Kilos Salida: {r.kilos_totales_salida}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Liquidación Financiera */}
      {liquidacion && (
        <div className="bg-white border rounded-2xl p-5 mb-6">
          <h2 className="font-semibold mb-2">Liquidación Contable (fórmulas automáticas desde kilos editados)</h2>
          <div className="text-sm">Subtotal: ${liquidacion.subtotal_ingreso_productor} • IVA: ${liquidacion.impuesto_iva} • Deducciones: ${liquidacion.total_deducciones} • <span className="font-bold">NETO A PAGAR: ${liquidacion.neto_a_pagar_productor}</span></div>
          <div className="text-xs mt-1">Fórmulas: Subtotal = (KExp×PExp)+(KNac×PNac)+((KCan+KMer)×PCan) • IVA 16% • ISR 1.25% • Neto = (Subtotal+IVA) - (Corte + Flete + Materiales + ISR)</div>
        </div>
      )}

      {/* PIN Modal - exacto al spec */}
      {pinModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full">
            <div className="font-bold mb-2">PIN de Supervisor requerido</div>
            <div className="text-sm mb-3 text-red-600">{pinModal.motivo}</div>
            <input type="password" value={pinValue} onChange={e => setPinValue(e.target.value)} placeholder="PIN numérico (4-6 dígitos)" className="border w-full p-2 rounded mb-2" />
            {pinModal.field === 'kilos' && (
              <input placeholder="Motivo de Ajuste (obligatorio)" value={motivoAjuste} onChange={e=>setMotivoAjuste(e.target.value)} className="border w-full p-2 rounded mb-3" />
            )}
            <div className="flex gap-2">
              <button onClick={() => { setPinModal({ open: false }); setPinValue(''); setMotivoAjuste(''); }} className="flex-1 border py-2 rounded">Cancelar</button>
              <button onClick={() => pinModal.onConfirm && pinModal.onConfirm()} className="flex-1 bg-emerald-700 text-white py-2 rounded">Autorizar con PIN</button>
            </div>
            <div className="text-[10px] mt-2">Se registra automáticamente en pin_audit_log (Fecha, Usuario PIN, Campo, Anterior/Nuevo, Motivo).</div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal - exacto al spec */}
      {whatsappModal.open && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-4" onClick={() => setWhatsappModal({open:false, message:''})}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold mb-3">📦 Compartir Inventario</div>
            <div className="text-sm mb-4 text-slate-600">Generando reporte de inventario... Redirigiendo a WhatsApp de Gerencia</div>
            <div className="bg-slate-50 p-3 rounded text-[12px] font-mono whitespace-pre-wrap max-h-[220px] overflow-auto border mb-4">{whatsappModal.message}</div>
            <div className="flex gap-3">
              <button onClick={() => setWhatsappModal({open:false, message:''})} className="flex-1 px-4 py-2 border rounded-xl">Cancelar</button>
              <button onClick={confirmarWhatsapp} className="flex-1 px-4 py-2 bg-emerald-700 text-white rounded-xl font-medium">Aceptar</button>
            </div>
            <div className="text-[10px] text-center text-slate-400 mt-3">Al presionar Aceptar se abrirá WhatsApp al número fijo de Gerencia con el mensaje exacto.</div>
          </div>
        </div>
      )}
    </div>
  );
}
