'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Printer, Download, Check, ArrowLeft } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatCurrency } from '@/utils/currency';

function BoxControlPageContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('salida');

  const [movements, setMovements] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cuttingOrders, setCuttingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Salida form (ETAPA 1) 
  const [salidaForm, setSalidaForm] = useState({
    cutting_order_id: '', boxes_quantity: '', date_out: new Date().toISOString().split('T')[0], hora: '08:00',
    producer_name: '', orchard_name: '', lote_rancho: '', cuadrilla: '', crew_chief_name: '', fletero: '', camionero: '', responsible_phone: '',
    tipo_salida: 'A Corte', salida_sin_lote: false, destino: ''
  });

  // Recepcion form (ETAPA 2)
  const [recepcionForm, setRecepcionForm] = useState({ folio_salida: '', boxes_sent: '', 
    cajas_con_fruta: '', cajas_vacias: '', cajas_extraviadas: '', cajas_rotas: '', 
    date_received: new Date().toISOString().split('T')[0], responsible_fletero: '', responsible_crew: '' });
  const [recepcionResult, setRecepcionResult] = useState(null);

  // Internal movement
  const [moveForm, setMoveForm] = useState({ movement_id: '', to_state: 'EN PRODUCCION', responsible_name: '', location: '', quantity: '', reason: '' });

  // Damaged / Lost / Repair capture
  const [damagedForm, setDamagedForm] = useState({ date: new Date().toISOString().split('T')[0], responsible_name: '', area: '', quantity: '', damage_type: 'Rota', notes: '' });
  const [repairForm, setRepairForm] = useState({ date_in: new Date().toISOString().split('T')[0], quantity: '', responsible_name: '' });

  // Data for sections
  const [damagedList, setDamagedList] = useState([]);
  const [repairsList, setRepairsList] = useState([]);

  const [settings, setSettings] = useState(null);

  const LOCATIONS = ['ALMACEN','EN CORTE','CUARENTENA','EN PRODUCCION','PROCESO','DESECHO','CUARTO FRIO'];

  const searchParams = useSearchParams();

  useEffect(() => {
    checkSuper();
    fetchAll();
    fetchCuttingOrders();
    fetchSettings();
  }, []);

  // Auto populate form from URL when coming from "Cargar cajas para corte" (vincula por Folio de Corte)
  useEffect(() => {
    const coId = searchParams.get('cuttingOrderId') || searchParams.get('folioCorte');
    if (coId && cuttingOrders.length > 0) {
      const foundById = cuttingOrders.find(o => String(o.id) === String(coId));
      const found = foundById || cuttingOrders.find(o => (o.folio || '').toLowerCase().includes(String(coId).toLowerCase()));
      if (found) {
        selectOrdenParaCarga(String(found.id));
        setActiveTab('salida');
      }
    }
  }, [searchParams, cuttingOrders]);

  async function checkSuper() {
    try {
      const r = await fetch('/api/auth/check-super-admin');
      const d = await r.json();
      setIsSuperAdmin(!!d.isSuperAdmin);
    } catch(e){}
  }

  async function fetchSettings() {
    try {
      const r = await fetch('/api/settings');
      const d = await r.json();
      setSettings(d);
    } catch(e){}
  }

  async function fetchCuttingOrders() {
    try {
      const r = await fetch('/api/cutting-orders');
      const d = await r.json();
      setCuttingOrders(Array.isArray(d) ? d.filter(o => o.status !== 'completed') : []);
    } catch(e){}
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await fetch('/api/box-control?includeSummary=true&includeHistory=true&report=true');
      const data = await res.json();
      setMovements(data.movements || []);
      setInventory(data.summary);
      setResumen(data.resumen || null);

      // fetch extras damaged + repairs for now (direct query via attendance-like but simple fetch from main + filter)
      // Fallback: filter movements for damaged/repair states
      const dmg = (data.movements || []).filter(m => (m.operational_state || '').toUpperCase().includes('DAÑ'));
      const rep = (data.movements || []).filter(m => (m.operational_state || '').toUpperCase().includes('REPAR'));
      setDamagedList(dmg);
      setRepairsList(rep);
    } catch(e) {
      alert('Error cargando Control de Cajas');
    } finally { setLoading(false); }
  }

  // ===================== ETAPA 1: SALIDA A CORTE =====================
  async function cargarSalidaCorte(e) {
    e.preventDefault();
    if (!salidaForm.boxes_quantity) return alert('Indica número de cajas');

    let payload = {
      action: 'salida_corte',
      boxes_quantity: parseInt(salidaForm.boxes_quantity),
      date_out: salidaForm.date_out,
      hora: salidaForm.hora,
      responsible_name: salidaForm.camionero || salidaForm.fletero || salidaForm.crew_chief_name,
      responsible_phone: salidaForm.responsible_phone,
      producer_name: salidaForm.producer_name,
      orchard_name: salidaForm.orchard_name,
      lote_rancho: salidaForm.lote_rancho || salidaForm.orchard_name,
      cuadrilla: salidaForm.cuadrilla || salidaForm.crew_chief_name,
      fletero: salidaForm.fletero,
      camionero: salidaForm.camionero,
      tipo_salida: salidaForm.tipo_salida || 'A Corte',
      salida_sin_lote: !!salidaForm.salida_sin_lote,
      destino: salidaForm.destino || ''
    };

    if (salidaForm.cutting_order_id) {
      const sel = cuttingOrders.find(o => String(o.id) === String(salidaForm.cutting_order_id));
      if (sel) {
        payload.cutting_order_id = sel.id;
        payload.lot_id = sel.lot_id;
        payload.producer_name = sel.producer_name;
        payload.orchard_name = sel.orchard_name;
        payload.fletero = sel.driver_name;
        payload.responsible_phone = sel.driver_phone;
      }
    }

    try {
      const r = await fetch('/api/box-control', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      alert('Salida registrada. Emitiendo ticket SALIDA A CAMPO...');
      await fetchAll();
      // Auto print thermal ticket — pass current context so DESTINO visible in ticket
      if (j.movement) printThermalTicket(j.movement, 'salida', { 
        hora: salidaForm.hora, 
        producer_name: salidaForm.producer_name, 
        orchard_name: salidaForm.orchard_name,
        cuadrilla: salidaForm.cuadrilla,
        salida_sin_lote: !!salidaForm.salida_sin_lote,
        destino: salidaForm.destino || ''
      });
      // reset
      if (j.movement) printControlTicket(j.movement, { sent: parseInt(salidaForm.boxes_quantity), tipo_salida: salidaForm.tipo_salida, lote_rancho: salidaForm.lote_rancho, orchard: salidaForm.orchard_name, cuadrilla: salidaForm.cuadrilla || salidaForm.crew_chief_name, camionero: salidaForm.camionero });
      setSalidaForm({ cutting_order_id:'', boxes_quantity:'', date_out:new Date().toISOString().split('T')[0], hora:'08:00', producer_name:'', orchard_name:'', lote_rancho:'', cuadrilla:'', crew_chief_name:'', fletero:'', camionero:'', responsible_phone:'', tipo_salida:'A Corte', salida_sin_lote: false, destino: '' });
    } catch (err) { alert('Error: ' + err.message); }
  }

  function selectOrdenParaCarga(id) {
    const o = cuttingOrders.find(x => String(x.id) === String(id));
    if (!o) return;
    setSalidaForm({
      ...salidaForm,
      cutting_order_id: id,
      boxes_quantity: String(o.boxes_count || 500),
      producer_name: o.producer_name || '',
      orchard_name: o.orchard_name || '',
      lote_rancho: o.orchard_name || o.lot_number || '',
      cuadrilla: o.crew_chief_name || '',
      crew_chief_name: o.crew_chief_name || '',
      fletero: o.driver_name || '',
      camionero: o.driver_name || '',
      responsible_phone: o.driver_phone || '',
      tipo_salida: 'A Corte',
      salida_sin_lote: false,
      destino: ''
    });
  }

  // ===================== ETAPA 2: RECEPCION =====================
  async function procesarRecepcion(e) {
    e.preventDefault();
    if (!recepcionForm.folio_salida || !recepcionForm.boxes_sent) return alert('Complete folio y cajas que salieron');

    const sent = parseInt(recepcionForm.boxes_sent);
    const conFruta = parseInt(recepcionForm.cajas_con_fruta || 0);
    const vacias = parseInt(recepcionForm.cajas_vacias || 0);
    const extravi = parseInt(recepcionForm.cajas_extraviadas || 0);
    const rotas = parseInt(recepcionForm.cajas_rotas || 0);
    const recibidasTotal = conFruta + vacias + extravi + rotas || parseInt(recepcionForm.boxes_received || 0);

    try {
      const r = await fetch('/api/box-control', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action: 'recepcion',
          folio_salida: recepcionForm.folio_salida,
          boxes_sent: sent,
          boxes_received: recibidasTotal,
          cajas_con_fruta: conFruta,
          cajas_vacias: vacias,
          cajas_extraviadas: extravi,
          cajas_rotas: rotas,
          date_received: recepcionForm.date_received,
          responsible_fletero: recepcionForm.responsible_fletero,
          responsible_crew: recepcionForm.responsible_crew
        })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);

      setRecepcionResult(j);
      await fetchAll();

      // Print tickets + full control ticket
      if (j.reception) printThermalTicket(j.reception, 'recepcion', { sent, received: recibidasTotal, diff: Math.max(0, sent-recibidasTotal), conFruta, vacias, extravi, rotas });
      if (j.extraviadas) printThermalTicket(j.extraviadas, 'extraviadas', { penalty: j.penalty });

      // Print complete control ticket with return data
      if (j.original || j.reception) {
        printControlTicket(j.original || j.reception, { sent, recibidas: recibidasTotal, conFruta, vacias, extravi, rotas, fletero: recepcionForm.responsible_fletero, crew: recepcionForm.responsible_crew });
      }

      setRecepcionForm({ folio_salida:'', boxes_sent:'', cajas_con_fruta:'', cajas_vacias:'', cajas_extraviadas:'', cajas_rotas:'', date_received:new Date().toISOString().split('T')[0], responsible_fletero:'', responsible_crew:'' });
    } catch(err) { alert('Error recepción: '+err.message); }
  }

  // ===================== MOV INTERNOS =====================
  async function registrarMovimientoInterno(e) {
    e.preventDefault();
    if (!moveForm.movement_id || !moveForm.to_state) return;
    try {
      await fetch('/api/box-control', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'movimiento_interno', id: parseInt(moveForm.movement_id), to_state: moveForm.to_state, responsible_name: moveForm.responsible_name, location: moveForm.location, quantity: moveForm.quantity || undefined, reason: moveForm.reason })
      });
      await fetchAll();
      setMoveForm({ movement_id:'', to_state:'EN PRODUCCION', responsible_name:'', location:'', quantity:'', reason:'' });
    } catch(e) { alert('Error al mover'); }
  }

  // ===================== DAÑADAS =====================
  async function registrarDañada(e) {
    e.preventDefault();
    if (!damagedForm.quantity) return;
    try {
      // We create via generic POST -> INCIDENT + a damage movement record
      await fetch('/api/box-control', {
        method:'POST',
        body: JSON.stringify({
          action: 'generic',
          movement_type: 'REGISTRO DAÑO',
          operational_state: 'DAÑADA',
          boxes_quantity: parseInt(damagedForm.quantity),
          responsible_name: damagedForm.responsible_name,
          location: damagedForm.area,
          notes: damagedForm.damage_type + ' | ' + (damagedForm.notes || '')
        })
      });
      // Bonus: Create incident too
      await fetch('/api/box-control/incidents', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ incident_type: 'Daño', severity: 'medium', boxes_expected: damagedForm.quantity, boxes_received: 0, title: 'Caja dañada', description: damagedForm.notes }) }).catch(()=>{});
      await fetchAll();
      setDamagedForm({ date: new Date().toISOString().split('T')[0], responsible_name:'', area:'', quantity:'', damage_type:'Rota', notes:'' });
    } catch(e){ alert('Error registrando daño'); }
  }

  // Repairs
  async function registrarReparacion(e) {
    e.preventDefault();
    if (!repairForm.quantity) return;
    try {
      await fetch('/api/box-control', { method:'POST', body: JSON.stringify({ action:'generic', operational_state:'EN REPARACION', movement_type:'INGRESO REPARACION', boxes_quantity: parseInt(repairForm.quantity), responsible_name: repairForm.responsible_name, notes: 'Ingreso a reparación' }) });
      await fetchAll();
    } catch(e){}
  }

  // ===================== RESUMEN + SYNC =====================
  async function generarResumen() {
    try {
      const res = await fetch('/api/box-control?report=true&includeSummary=true');
      const d = await res.json();
      setResumen(d.resumen || d);
      alert('Resumen actualizado. Los datos se sincronizaron con Inventario de Materiales.');
      await fetchAll();
    } catch(e){ alert('Error al generar resumen'); }
  }

  // ===================== EXPORTS =====================
  function exportResumenExcel() {
    if (!resumen) { alert('Genera el resumen primero'); return; }
    import('xlsx').then(XLSX => {
      const rows = [
        ['RESUMEN CONTROL DE CAJAS - TECAVO FRUITS'],
        ['Fecha', new Date().toLocaleDateString('es-MX')],
        [],
        ['INVENTARIO'],
        ['Totales', resumen.inventario?.cajas_totales || 0],
        ['Almacén', resumen.inventario?.en_almacen || 0],
        ['En Corte', resumen.inventario?.en_corte || 0],
        ['Cuarentena', resumen.inventario?.en_cuarentena || 0],
        ['Producción', resumen.inventario?.en_produccion || 0],
        ['Proceso', resumen.inventario?.en_proceso || 0],
        ['Desecho', resumen.inventario?.en_desecho || 0],
        ['Cuarto Frío', resumen.inventario?.en_cuarto_frio || 0],
        ['Perdidas', resumen.inventario?.perdidas || 0],
        ['Dañadas', resumen.inventario?.danadas || 0],
        ['En Reparación', resumen.inventario?.en_reparacion || 0],
        [],
        ['VALORIZACION'],
        ['Perdidas x $100', resumen.valorizacion?.perdidas_valor || 0],
        ['Daño valor', resumen.valorizacion?.danadas_valor || 0],
        ['TOTAL PERDIDAS', resumen.valorizacion?.total_perdidas || 0]
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Resumen Cajas');
      XLSX.writeFile(wb, `Resumen_Cajas_${new Date().toISOString().slice(0,10)}.xlsx`);
    }).catch(()=> alert('No se pudo exportar'));
  }

  // ===================== TICKET CONTROL DE CAJA - FORMATO OFICIAL TECAVO =====================
  const TECAVO_HEADER = `
    <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:6px">
      <div style="font-weight:800;font-size:15px;letter-spacing:1px">TECAVO FRUITS</div>
      <div style="font-size:9px;color:#333">"Del campo con amor"</div>
      <div style="font-size:8px;margin:2px 0;line-height:1.15">
        Km 4.5 Carretera Tacámbaro–Pátzcuaro<br/>
        El Testerazo, Tacámbaro, Michoacán C.P. 61654<br/>
        contacto@tecavofruits.com • www.tecavofruits.com<br/>
        Tel. 459 134 45 76
      </div>
    </div>`;

  function generateTicketHTML(mov, tipo = 'salida', extra = {}) {
    const fecha = new Date().toLocaleDateString('es-MX');
    const horaStr = (extra.hora || new Date().toLocaleTimeString('es-MX').slice(0,5));
    const penaltyUnit = 100;

    let inner = '';
    if (tipo === 'salida') {
      const isAcopio = (extra.tipo_salida || '').toLowerCase().includes('acopio');
      inner = `
        ${TECAVO_HEADER}
        <div style="font-size:11px;line-height:1.32">
          <div style="text-align:center;font-weight:700;font-size:13px;margin:4px 0">CONTROL DE CAJAS DE CAMPO</div>
          <div style="background:#f4f4f4;padding:3px;border:1px solid #000">Sección: SALIDA</div>
          <div>FOLIO: <b>${mov.folio}</b> &nbsp;&nbsp; FECHA: ${fecha} &nbsp;&nbsp; HORA: ${horaStr}</div>
          <div>TIPO DE SALIDA: <b>${extra.tipo_salida || (mov.notes?.includes('ACOPIO')?'Acopio':'A Corte')}</b> &nbsp; ☐ A Corte &nbsp; ☐ Acopio</div>
          <div>LOTE / RANCHO: ${extra.lote_rancho || extra.orchard_name || mov.notes || '-'}</div>
          <div>CAMIONERO: ${extra.camionero || mov.responsible_name || '-'}</div>
          <div>CUADRILLA: ${extra.cuadrilla || '-'}</div>
          <div style="margin:5px 0;font-size:12px">NÚMERO DE CAJAS QUE SALEN: <b>${mov.boxes_quantity}</b></div>
          <div style="font-size:9px;margin-top:12px">Entregó:&nbsp; ________________ Firma ________________</div>
        </div>`;
    } else if (tipo === 'recepcion') {
      const diff = extra.diff || 0;
      inner = `${TECAVO_HEADER}
        <div style="font-size:11px;line-height:1.28">
          <div style="text-align:center;font-weight:700;font-size:13px">CONTROL DE CAJAS DE CAMPO</div>
          <div>FOLIO ORIGEN: <b>${mov.folio}</b> &nbsp; FECHA: ${fecha} &nbsp; HORA: ${horaStr}</div>
          <div style="padding:2px 0;background:#f8f8f8;border:1px solid #000">Sección: REGRESO</div>
          <div>Cajas con fruta: <b>${extra.conFruta||extra.received||0}</b> &nbsp; Cajas vacías: <b>${extra.vacias||0}</b></div>
          <div>Cajas extraviadas / rotas: <b>${(extra.extravi||0)+(extra.rotas||0)}</b></div>
          <div>TOTAL DESC. PRÓXIMO PAGO: <b style="color:#900">$${Math.round((diff || (extra.extravi||0)+(extra.rotas||0)) * penaltyUnit).toLocaleString('es-MX')}</b></div>
          <div style="margin:4px 0;border-top:1px dashed #000;padding-top:3px;font-size:9px">FLETERO: ${extra.fletero||''} &nbsp; ENC. CUADRILLA: ${extra.crew||''}</div>
          <div style="font-size:9px">Recibió: ________________ Firma ________________</div>
        </div>`;
    } else if (tipo === 'extraviadas') {
      inner = `${TECAVO_HEADER}
        <div style="font-size:11px;line-height:1.28;border:2px solid #900;padding:4px">
          <div style="text-align:center;font-weight:700;color:#900">CAJAS EXTRAVIADAS / ROTAS</div>
          <div>FOLIO: <b>${mov.folio}</b></div>
          <div>CANTIDAD: <b>${mov.boxes_quantity}</b> &nbsp; CARGO: <b>$${Math.round((mov.penalty_amount || mov.boxes_quantity*penaltyUnit)).toLocaleString('es-MX')}</b></div>
          <div>FECHA: ${fecha}</div>
          <div>Próximo pago: descuento automático</div>
        </div>`;
    } else {
      inner = `<div><b>${mov.folio}</b> ${mov.operational_state} ${mov.boxes_quantity} cajas</div>`;
    }

    return `<html><head><style>
      body{font-family:monospace;font-size:10px;margin:4px;padding:8px;background:#fff;width:210mm}
      @media print{@page{size:A4;margin:8mm}}
    </style></head><body>${inner}<div style="margin-top:10px;text-align:center;font-size:9px;font-style:italic">"Del campo con amor"</div></body></html>`;
  }

  function printThermalTicket(mov, tipo = 'salida', extra = {}) {
    const html = generateTicketHTML(mov, tipo, extra);
    const win = window.open('', '', 'width=700,height=780');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch(e){} }, 240);
  }

  // ===================== TICKET COMPLETO CON TRACEBILIDAD (SALIDA + REGRESO) =====================
  function printControlTicket(mov, extra = {}) {
    const fecha = new Date().toLocaleDateString('es-MX');
    const horaStr = new Date().toLocaleTimeString('es-MX').slice(0,5);
    const penaltyUnit = 100;

    const salidaCajas = extra.sent || mov.boxes_quantity || 0;
    const tipoSal = extra.tipo_salida || 'A Corte';
    const retornadas = (extra.conFruta || 0) + (extra.vacias || 0);
    const perdidas = (extra.extravi || 0) + (extra.rotas || 0);
    const descuento = Math.round(perdidas * penaltyUnit);

    const html = `
      <html><head><style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 12mm; width:210mm; }
        .header { text-align:center; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .sec { border: 1px solid #000; padding: 5px; margin: 8px 0; }
        .row { margin: 2px 0; }
        .sig { margin-top: 24px; display: flex; justify-content: space-between; }
        .sigbox { width: 30%; text-align:center; border-top:1px solid #000; padding-top:3px; font-size:10px; }
        .footer { margin-top:16px; text-align:center; font-style:italic; font-size:10px; }
        table { width:100%; font-size:10px }
      </style></head><body>
        <div class="header">
          <div style="font-size:18px;font-weight:900">TECAVO FRUITS</div>
          <div style="font-size:10px">"Del campo con amor"</div>
          <div style="font-size:9px;margin-top:2px">
            Km 4.5 Carretera Tacámbaro–Pátzcuaro, El Testerazo, Tacámbaro, Michoacán C.P. 61654<br/>
            contacto@tecavofruits.com • www.tecavofruits.com • Tel. 459 134 45 76
          </div>
        </div>

        <div style="text-align:center;font-weight:bold;font-size:14px;margin:4px 0">CONTROL DE CAJAS DE CAMPO</div>

        <div class="row"><b>FOLIO:</b> ${mov.folio} &nbsp;&nbsp; <b>FECHA:</b> ${fecha} &nbsp;&nbsp; <b>HORA:</b> ${horaStr}</div>

        <div class="sec">
          <strong>Sección: Salida</strong><br/>
          Tipo de salida: ☐ A Corte &nbsp;&nbsp; ☐ Acopio &nbsp;&nbsp; <b>${tipoSal}</b><br/>
          Lote / Rancho: <b>${extra.lote_rancho || extra.orchard || ''}</b><br/>
          Camionero: <b>${extra.camionero || mov.responsible_name || ''}</b><br/>
          Cuadrilla: <b>${extra.cuadrilla || ''}</b><br/>
          Número de cajas que salen: <b>${salidaCajas}</b>
        </div>

        <div class="sec">
          <strong>Sección: Regreso</strong><br/>
          Cajas con fruta: <b>${extra.conFruta||0}</b><br/>
          Cajas vacías: <b>${extra.vacias||0}</b><br/>
          Cajas extraviadas / rotas: <b>${extra.extravi||0}</b> / <b>${extra.rotas||0}</b>  (Total perdidas/trazabilidad: ${perdidas})<br/>
          <b>Total descuento próximo pago ($): $${descuento}</b>
        </div>

        <div class="sec">
          <strong>Sección: Inventario y Control</strong><br/>
          • Total inventario de cajas: <b>${salidaCajas}</b><br/>
          • Total extraviadas: <b>${extra.extravi||0}</b> &nbsp; Total rotas: <b>${extra.rotas||0}</b><br/>
          Observaciones:<br/>
          <div style="min-height:38px;border:1px dashed #999;margin-top:4px"></div>
        </div>

        <div class="sig">
          <div class="sigbox">Entregó<br/><br/><br/>Nombre y firma</div>
          <div class="sigbox">Recibió<br/><br/><br/>Nombre y firma</div>
          <div class="sigbox">Supervisó<br/><br/><br/>Nombre y firma</div>
        </div>

        <div class="footer">"Del campo con amor"</div>
      </body></html>`;

    const win = window.open('', '', 'width=820,height=720');
    win.document.write(html);
    win.document.close();
    setTimeout(()=>{ try{ win.print(); }catch(_){} }, 260);
  }

  // ===================== RENDER =====================
  return (
    <div className="min-h-screen pt-16 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="flex items-center justify-between mb-4 pt-4">
          <div>
            <h1 className="text-3xl font-bold">Control de Cajas</h1>
            <p className="text-slate-500 text-sm">Trazabilidad completa • Integrado con Orden de Corte • Nómina • Inventarios</p>
          </div>
          <button onClick={generarResumen} className="px-4 py-2.5 bg-black text-white rounded-xl flex items-center gap-2 hover:bg-slate-800 text-sm font-medium">
            <Check size={16}/> GENERAR RESUMEN ACTUAL DE CAJAS
          </button>
        </div>

        {/* Permanent info banner */}
        <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs">
          ⚠️ Cada caja extraviada = $100 MXN. Todos los movimientos son PERMANENTES. Solo ajustes autorizados. Tickets reimprimibles siempre.
        </div>

        {/* Top stats / quick inventory */}
        {resumen && resumen.inventario && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6 text-xs">
            {Object.entries(resumen.inventario).map(([k,v]) => (
              <div key={k} className="rounded-lg bg-white border p-2.5"><div className="font-mono uppercase tracking-wider text-[10px] text-slate-500">{k.replace(/_/g,' ')}</div><div className="text-xl font-semibold tabular-nums">{v}</div></div>
            ))}
          </div>
        )}

        {/* TABS */}
        <div className="flex flex-wrap gap-1 mb-4 border-b">
          {['salida','recepcion','trazabilidad','danos','resumen','ajustes'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 text-sm rounded-t-lg font-medium ${activeTab===t ? 'bg-white border-x border-t' : 'text-slate-500 hover:text-slate-800'}`}>
              {t === 'salida' && 'ETAPA 1 • SALIDA A CORTE'}
              {t === 'recepcion' && 'ETAPA 2 • RECEPCIÓN'}
              {t === 'trazabilidad' && 'TABLERO TRAZABILIDAD'}
              {t === 'danos' && 'DAÑADAS • PERDIDAS • REPARACIÓN'}
              {t === 'resumen' && 'RESUMEN + VALORIZACIÓN'}
              {t === 'ajustes' && 'MOVIMIENTOS INTERNOS / AJUSTES'}
            </button>
          ))}
        </div>

        {/* ETAPA 1 - SALIDA */}
        {activeTab === 'salida' && (
          <div className="bg-white border rounded-2xl p-6">
                <div className="text-xl font-bold mb-3">Salida de Cajas para Lote / Orden</div>
            <form onSubmit={cargarSalidaCorte} className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <label className="text-xs uppercase text-slate-500">Seleccionar Lote</label>
                <select onChange={(e)=>selectOrdenParaCarga(e.target.value)} className="w-full border rounded-lg p-2 mt-1 text-sm">
                  <option value="">-- Seleccionar Lote / Orden de Corte --</option>
                  {cuttingOrders.map(o => <option value={o.id} key={o.id}>{o.folio} • {o.producer_name} • {o.boxes_count} cajas • {o.driver_name || 'sin camionero'}</option>)}
                </select>

                {/* Sección Salida: Tipo según formato oficial */}
                <div className="mt-3">
                  <label className="text-xs uppercase text-slate-500 block mb-1">Tipo de salida</label>
                  <div className="flex gap-4 text-sm">
                    {['A Corte', 'Acopio'].map(t => (
                      <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="tipo_salida" checked={salidaForm.tipo_salida === t} onChange={() => setSalidaForm({...salidaForm, tipo_salida: t})} /> {t}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Recuadro de selección: Salida de cajas sin lote */}
                <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!salidaForm.salida_sin_lote}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSalidaForm({
                        ...salidaForm,
                        salida_sin_lote: checked,
                        cutting_order_id: checked ? '' : salidaForm.cutting_order_id
                      });
                    }}
                  />
                  <span>Salida de cajas sin lote</span>
                </label>

                {salidaForm.salida_sin_lote && (
                  <div className="mt-2">
                    <label className="text-xs uppercase text-slate-500">Destino</label>
                    <input
                      className="border rounded w-full p-2 text-sm mt-0.5"
                      placeholder="Ej: Acopio, Venta directa, Traslado..."
                      value={salidaForm.destino || ''}
                      onChange={(e) => setSalidaForm({ ...salidaForm, destino: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs uppercase text-slate-500">Lote / Rancho</label>
                <input className="border rounded w-full p-2 text-sm" value={salidaForm.lote_rancho || salidaForm.orchard_name} onChange={e=>setSalidaForm({...salidaForm, lote_rancho:e.target.value, orchard_name:e.target.value})} />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-500">Productor</label>
                <input className="border rounded w-full p-2 text-sm" value={salidaForm.producer_name} onChange={e=>setSalidaForm({...salidaForm,producer_name:e.target.value})} />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-500">Cajas Enviadas *</label>
                <input required type="number" className="border rounded w-full p-2 text-sm" value={salidaForm.boxes_quantity} onChange={e=>setSalidaForm({...salidaForm,boxes_quantity:e.target.value})} />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-500">Camionero</label>
                <input className="border rounded w-full p-2 text-sm" value={salidaForm.camionero} onChange={e=>setSalidaForm({...salidaForm,camionero:e.target.value})} />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-500">Fletero</label>
                <input className="border rounded w-full p-2 text-sm" value={salidaForm.fletero} onChange={e=>setSalidaForm({...salidaForm,fletero:e.target.value})} />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-500">Encargado Cuadrilla</label>
                <input className="border rounded w-full p-2 text-sm" value={salidaForm.crew_chief_name} onChange={e=>setSalidaForm({...salidaForm,crew_chief_name:e.target.value})} />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-500">Cuadrilla / Grupo</label>
                <input className="border rounded w-full p-2 text-sm" value={salidaForm.cuadrilla} onChange={e=>setSalidaForm({...salidaForm,cuadrilla:e.target.value})} />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-500">Fecha / Hora salida</label>
                <div className="flex gap-2">
                  <input type="date" className="border rounded p-2 text-sm flex-1" value={salidaForm.date_out} onChange={e=>setSalidaForm({...salidaForm,date_out:e.target.value})} />
                  <input type="time" className="border rounded p-2 text-sm w-[110px]" value={salidaForm.hora} onChange={e=>setSalidaForm({...salidaForm,hora:e.target.value})} />
                </div>
              </div>
              <div className="md:col-span-3 flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-brand-600 text-white py-2.5 rounded-xl">Registrar Salida + Generar Ticket Térmico</button>
                <button type="button" onClick={() => setSalidaForm({...salidaForm})} className="px-4 border rounded-xl">Limpiar</button>
              </div>
            </form>
          </div>
        )}

        {/* ETAPA 2 RECEPCION - CALCULO Y TICKETS */}
        {activeTab === 'recepcion' && (
          <div className="bg-white border rounded-2xl p-6">
            <div className="text-xl font-bold mb-2">Recepción de Cajas - Validación y Penalizaciones</div>
            <form onSubmit={procesarRecepcion} className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs uppercase">Folio de Salida (ticket original)</label>
                <input required className="border p-2 w-full rounded" value={recepcionForm.folio_salida} onChange={e=>setRecepcionForm({...recepcionForm,folio_salida:e.target.value})} placeholder="SAL-CORTE-..." />
              </div>
              <input placeholder="Cajas que salieron" type="number" className="border p-2 rounded text-sm" value={recepcionForm.boxes_sent} onChange={e=>setRecepcionForm({...recepcionForm,boxes_sent:e.target.value})} />
              <div className="md:col-span-3 border p-3 rounded text-sm">
                <div className="font-medium mb-2">Sección Regreso</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input placeholder="Cajas con fruta" type="number" className="border p-2 rounded" value={recepcionForm.cajas_con_fruta} onChange={e=>setRecepcionForm({...recepcionForm,cajas_con_fruta:e.target.value})} />
                  <input placeholder="Cajas vacías" type="number" className="border p-2 rounded" value={recepcionForm.cajas_vacias} onChange={e=>setRecepcionForm({...recepcionForm,cajas_vacias:e.target.value})} />
                  <input placeholder="Cajas extraviadas" type="number" className="border p-2 rounded" value={recepcionForm.cajas_extraviadas} onChange={e=>setRecepcionForm({...recepcionForm,cajas_extraviadas:e.target.value})} />
                  <input placeholder="Cajas rotas" type="number" className="border p-2 rounded" value={recepcionForm.cajas_rotas} onChange={e=>setRecepcionForm({...recepcionForm,cajas_rotas:e.target.value})} />
                </div>
              </div>
              <div><label className="text-xs uppercase">Fecha recepción</label><input type="date" className="border p-2 w-full rounded text-sm" value={recepcionForm.date_received} onChange={e=>setRecepcionForm({...recepcionForm,date_received:e.target.value})} /></div>
              <input placeholder="Camionero / Fletero responsable" className="border p-2 rounded text-sm" value={recepcionForm.responsible_fletero} onChange={e=>setRecepcionForm({...recepcionForm,responsible_fletero:e.target.value})} />
              <input placeholder="Enc. Cuadrilla responsable" className="border p-2 rounded text-sm" value={recepcionForm.responsible_crew} onChange={e=>setRecepcionForm({...recepcionForm,responsible_crew:e.target.value})} />
              <div className="md:col-span-3">
                <button className="w-full bg-emerald-700 text-white py-3 rounded-xl">REGISTRAR REGRESO • Calcular descuento • Generar Tickets completos de trazabilidad</button>
              </div>
            </form>

            {recepcionResult && (
              <div className="mt-4 p-4 border rounded-xl bg-emerald-50 text-sm">
                Recepción procesada. Total descuento próximo pago calculado según extraviadas/rotas. Cargos enviados a Nómina.
              </div>
            )}
          </div>
        )}

        {/* TRAZABILIDAD GENERAL */}
        {activeTab === 'trazabilidad' && (
          <div>
            <div className="bg-white rounded-2xl border mb-4 p-6">
              <div className="font-medium mb-3">Existencias por Ubicación (tiempo real)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {LOCATIONS.map(loc => {
                  const cnt = movements.reduce((a,b)=>((b.operational_state||'').toUpperCase().includes(loc.replace(' ','')) ? a+(b.boxes_quantity||0):a),0);
                  return <div key={loc} className="p-3 border rounded">{loc}: <span className="font-mono font-bold">{cnt}</span> cajas</div>;
                })}
              </div>
            </div>
            <div className="bg-white p-4 border rounded-2xl">
              <div className="font-semibold mb-2">Historial Reciente (últimos movimientos reconocidos)</div>
              <div className="text-xs space-y-2 max-h-[420px] overflow-auto pr-2">
                {(movements || []).slice(0,40).map(m => (
                  <div key={m.id} className="border-l-2 pl-2 py-1 hover:bg-slate-50">
                    <b>{m.folio}</b> [{m.operational_state}] {m.boxes_quantity}c • {m.responsible_name || '—'} 
                    <button onClick={()=>printThermalTicket(m, 'salida')} className="ml-2 text-[10px] px-2 py-px bg-slate-200 hover:bg-slate-300 rounded">Reimprimir</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DAÑADAS PERDIDAS REPARACIONES */}
        {activeTab === 'danos' && (
          <>
            <div className="bg-white p-5 rounded-2xl border mb-4">
              <div className="font-bold">Registrar Cajas Dañadas</div>
              <form onSubmit={registrarDañada} className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2 text-sm">
                <input placeholder="Cantidad" type="number" required value={damagedForm.quantity} onChange={e=>setDamagedForm({...damagedForm,quantity:e.target.value})} className="border rounded p-2" />
                <select value={damagedForm.damage_type} onChange={e=>setDamagedForm({...damagedForm,damage_type:e.target.value})} className="border rounded p-2">
                  {['Rota','Quebrada','Deformada','Inservible','Otra'].map(d=><option key={d}>{d}</option>)}
                  </select>
                <input placeholder="Responsable" value={damagedForm.responsible_name} onChange={e=>setDamagedForm({...damagedForm,responsible_name:e.target.value})} className="border rounded p-2" />
                <input placeholder="Área" value={damagedForm.area} onChange={e=>setDamagedForm({...damagedForm,area:e.target.value})} className="border rounded p-2" />
                <button className="bg-red-600 text-white px-4 py-1.5 rounded-xl">Registrar Daño</button>
              </form>
            </div>

            <div className="bg-white p-5 rounded-2xl border mb-4">
              <div className="font-bold mb-2">Cajas en Reparación</div>
              <form onSubmit={registrarReparacion} className="flex gap-2 items-end text-sm">
                <input type="number" placeholder="Cantidad" required value={repairForm.quantity} onChange={e=>setRepairForm({...repairForm,quantity:e.target.value})} className="p-2 border rounded w-28" />
                <input placeholder="Responsable reparación" value={repairForm.responsible_name} onChange={e=>setRepairForm({...repairForm,responsible_name:e.target.value})} className="p-2 border rounded flex-1" />
                <button className="px-4 py-2 bg-amber-600 text-white rounded-xl">Registrar Reparación</button>
              </form>
            </div>

            <div className="bg-white rounded-2xl p-5 border"><div className="font-medium mb-2">Listado Daños y Reparaciones del sistema</div>
              <div className="text-xs">Daños registrados: {damagedList.length}. Reparaciones: {repairsList.length}</div>
            </div>
          </>
        )}

        {/* RESUMEN COMPLETO */}
        {activeTab === 'resumen' && (
          <div className="bg-white border rounded-2xl p-7">
            <div className="font-semibold text-xl mb-3">RESUMEN GENERAL DE CAJAS — {new Date().toLocaleDateString('es-MX')}</div>
            <button onClick={generarResumen} className="px-5 py-2 mb-4 border bg-black text-white rounded-xl text-sm">Actualizar resumen completo + Sincronizar Materiales</button>

            {resumen && resumen.inventario && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-6">
                {Object.entries(resumen.inventario).map(([k,v]) => (
                  <div key={k} className="p-2 border rounded bg-white"><span className="uppercase text-[10px] text-slate-500 block">{k.replace(/_/g,' ')}</span><span className="font-bold tabular-nums text-xl">{v}</span></div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <div className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Movimientos recientes (Reimprimir ticket trazabilidad)</div>
              <div className="space-y-1">
                {movements.slice(0,9).map((m,i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-2 border rounded text-xs">
                    <span><b>{m.folio}</b> — {m.operational_state} — {m.boxes_quantity} cajas</span>
                    <button onClick={() => printControlTicket(m)} className="px-2 py-0.5 bg-black text-white rounded">Ticket Trazabilidad Completo</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AJUSTES TAB PLACEHOLDER for completeness */}
        {activeTab === 'ajustes' && (
          <div className="bg-white border rounded-2xl p-6">
            <div className="font-semibold mb-2">Movimientos internos y ajustes</div>
            <p className="text-sm text-slate-600">Usa Trazabilidad o la recepción para registraciones. Ajustes autorizados vía panel administrativo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BoxControlPage() {
  return (
    <Suspense fallback={null}>
      <BoxControlPageContent />
    </Suspense>
  );
}
