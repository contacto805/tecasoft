'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';

import { useCalibers } from '@/hooks/useCalibers';
import { useBranding } from '@/hooks/useBranding';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { drawCompanyHeader, prependCompanyHeaderToExcelRows } from '@/lib/company-header';

function LotificationRegistryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { calibers10kg, qualityOptions, loading: calibersLoading } = useCalibers();
  const { branding } = useBranding();
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectionDate, setSelectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalKilosReceived, setTotalKilosReceived] = useState('');
  
  // Kilos and prices per caliber
  const [caliberData, setCaliberData] = useState({});
  const [selectedQuality, setSelectedQuality] = useState('Calidad A');
  
  // Process and waste kilos (when quality is Proceso or Desecho)
  const [processKilos, setProcessKilos] = useState('');
  const [wasteKilos, setWasteKilos] = useState('');

  // Clase B y Desecho adicionales para el requerimiento
  const [claseBKilos, setClaseBKilos] = useState('');
  const [desechoCapturado, setDesechoCapturado] = useState('');

  // FULL Class B classifications (parallel to A)
  const claseBLabels = ['Super B', 'Extra B', 'Primera B', 'Mediano B', 'Tercera B'];
  const [caliberDataB, setCaliberDataB] = useState({});

  // Plantilla Excel y Logo para módulo de carga
  const [plantillaFile, setPlantillaFile] = useState(null);
  // Use branding global logo (empacadora). Local upload will override preview only for this session if needed
  const logoUrl = branding?.logo_url || branding?.logoUrl || '';
  const [customLogoPreview, setCustomLogoPreview] = useState(''); // optional override for local carga logotipo

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuper, setIsSuper] = useState(false);
  const [lastLotCount, setLastLotCount] = useState(0);
  const [newLotsAdded, setNewLotsAdded] = useState(false);

  // Historial de lotes 
  const [historyRecords, setHistoryRecords] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState(null);

  // === PROYECCIÓN ACOPIO VS LOTIFICACIÓN (trazabilidad) ===
  const [acopioProjection, setAcopioProjection] = useState(null);
  const [comparison, setComparison] = useState(null);

  // Initialize caliber data when calibers10kg is loaded
  useEffect(() => {
    if (calibers10kg.length > 0) {
      const aData = calibers10kg.reduce((acc, caliber) => ({
        ...acc,
        [caliber]: { kilos: '', price: '' }
      }), {});
      setCaliberData(aData);
    }
  }, [calibers10kg]);

  // Init Clase B separate (static labels)
  useEffect(() => {
    if (claseBLabels.length > 0 && Object.keys(caliberDataB).length === 0) {
      const bData = claseBLabels.reduce((acc, label) => ({
        ...acc,
        [label]: { kilos: '', price: '' }
      }), {});
      setCaliberDataB(bData);
    }
  }, [claseBLabels.length]);

  // Load lots
  const loadLots = async (showRefreshing = false) => {
    console.log('🔄 Cargando lotes...');
    if (showRefreshing) setRefreshing(true);
    try {
      const response = await fetch('/api/lots');
      const data = await response.json();
      const lotsArray = Array.isArray(data) ? data : [];
      console.log('📦 Lotes cargados:', lotsArray.length);
      
      // Check if new lots were added
      if (lastLotCount > 0 && lotsArray.length > lastLotCount) {
        const newCount = lotsArray.length - lastLotCount;
        console.log(`✨ ${newCount} nuevo(s) lote(s) detectado(s)`);
        setNewLotsAdded(true);
        setTimeout(() => setNewLotsAdded(false), 5000); // Hide notification after 5 seconds
      }
      
      setLots(lotsArray);
      setLastLotCount(lotsArray.length);
    } catch (error) {
      console.error('Error loading lots:', error);
      setLots([]);
    } finally {
      setLoading(false);
      if (showRefreshing) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  // Load historial
  const loadHistory = async () => {
    try {
      const res = await fetch('/api/historial-lotes');
      const arr = await res.json();
      setHistoryRecords(Array.isArray(arr) ? arr : []);
    } catch (_) {
      setHistoryRecords([]);
    }
  };



  // Cargar lotes inicialmente
  useEffect(() => {
    loadLots();
    loadHistory();
    fetch('/api/auth/user').then(r=>r.json()).then(u => setIsSuper(!!u?.is_super_admin || (u?.admin_role||'').toLowerCase().includes('super'))).catch(()=>setIsSuper(false));
  }, []);

  // Auto-select lot when coming from Venta Process sidebar link
  useEffect(() => {
    const lotIdParam = searchParams?.get('lotId') || searchParams?.get('selectLot');
    if (lotIdParam && lots.length > 0 && !selectedLot) {
      const found = lots.find(l => String(l.id) === String(lotIdParam));
      if (found) {
        setSelectedLot(found);
      }
    }
  }, [searchParams, lots]);

  // NOTA: El auto-refresh, visibility change y sincronización se manejan por useSync hook

  // Load existing lotification data when lot is selected
  useEffect(() => {
    if (selectedLot) {
      loadLotificationData(selectedLot.id);
      loadAcopioProjection(selectedLot.id, selectedLot.cutting_order_id);
    }
  }, [selectedLot]);

  const loadLotificationData = async (lotId) => {
    try {
      const response = await fetch(`/api/lotification-registry?lotId=${lotId}`);
      const data = await response.json();
      
      if (data) {
        // data may be array (consolidated) or single; take first or consolidate
        const rec = Array.isArray(data) ? data[0] : data;
        if (rec) {
          setSelectionDate(rec.selection_date?.split('T')[0] || new Date().toISOString().split('T')[0]);
          setTotalKilosReceived(rec.total_kilos_received?.toString() || '');
          if (rec.calidad) setSelectedQuality(rec.calidad);
          if (rec.clase_b_kg) setClaseBKilos(rec.clase_b_kg.toString());
          if (rec.desecho_capturado) setDesechoCapturado(rec.desecho_capturado.toString());
          if (rec.proceso_kg != null) setProcessKilos(rec.proceso_kg.toString());
          if (rec.calibers) {
            const newCaliberData = { ...caliberData };
            const newCaliberDataB = { ...caliberDataB };
            rec.calibers.forEach(c => {
              if (newCaliberData[c.caliber]) newCaliberData[c.caliber] = { kilos: c.kilos?.toString() || '', price: c.price?.toString() || '' };
              else if (newCaliberDataB[c.caliber]) newCaliberDataB[c.caliber] = { kilos: c.kilos?.toString() || '', price: c.price?.toString() || '' };
            });
            setCaliberData(newCaliberData);
            setCaliberDataB(newCaliberDataB);
          }
        }
      }
    } catch (error) {
      console.error('Error loading lotification data:', error);
    }
  };

  // Carga proyección confirmada desde acopio/calculadora + visita (usando relaciones, no nombres)
  async function loadAcopioProjection(lotId, coId) {
    setAcopioProjection(null);
    setComparison(null);
    try {
      // 1. Intentar por cutting order
      let visitId = null;
      if (coId) {
        const coRes = await fetch(`/api/cutting-orders?folio=${coId}`).then(r=>r.json()).catch(()=>[]);
        const co = Array.isArray(coRes)?coRes[0]:coRes;
        if (co && co.visit_id) visitId = co.visit_id;
      }
      // 2. Fallback: buscar lot y su cutting
      if (!visitId) {
        const lotRes = await fetch(`/api/lots`).then(r=>r.json()).catch(()=>[]);
        const lot = (lotRes||[]).find(l=>String(l.id)===String(lotId));
        if (lot && lot.cutting_order_id) {
          const co2 = await fetch(`/api/cutting-orders?folio=${lot.cutting_order_id}`).then(r=>r.json()).catch(()=>null);
          const c = Array.isArray(co2)?co2[0]:co2;
          if (c && c.visit_id) visitId = c.visit_id;
        }
      }
      if (!visitId) {
        setAcopioProjection({ message: 'Sin proyección registrada (visita no vinculada)' });
        return;
      }
      // Cargar calculator confirmed
      const calcRes = await fetch(`/api/acopios/calculator?visitId=${visitId}`);
      const evals = await calcRes.json();
      const confirmed = (Array.isArray(evals) ? evals : []).find(e=>e.is_confirmed) || (Array.isArray(evals)?evals[0]:null);
      if (confirmed) {
        setAcopioProjection(confirmed);
        // Build comparison after lotification data loads (deferred to render)
      } else {
        setAcopioProjection({ message: 'Sin proyección confirmada para esta visita' });
      }
    } catch (e) {
      setAcopioProjection({ message: 'Sin proyección registrada' });
    }
  }

  const handleCaliberChange = (caliber, field, value) => {
    setCaliberData(prev => ({
      ...prev,
      [caliber]: {
        ...prev[caliber],
        [field]: value
      }
    }));
  };

  const handleCaliberChangeB = (label, field, value) => {
    setCaliberDataB(prev => ({
      ...prev,
      [label]: {
        ...prev[label],
        [field]: value
      }
    }));
  };

  // Calculate total kilos from all calibers
  const calculateTotalKilos = () => {
    if (!Array.isArray(calibers10kg) || !calibers10kg.length) return 0;
    return calibers10kg.reduce((total, caliber) => {
      const kilos = parseFloat(caliberData && caliberData[caliber]?.kilos) || 0;
      return total + kilos;
    }, 0);
  };

  // Calculate percentage for each caliber
  const calculatePercentage = (caliber) => {
    const kilos = parseFloat(caliberData[caliber]?.kilos) || 0;
    const totalAll = calculateTotalKilos() + calculateTotalKilosB();
    if (totalAll === 0) return 0;
    return (kilos / totalAll) * 100;
  };

  // Calculate weighted average price per lot
  const calculateRealPricePerLot = () => {
    const totalKilos = calculateTotalKilos();
    if (totalKilos === 0) return 0;

    return calibers10kg.reduce((totalPrice, caliber) => {
      const kilos = parseFloat(caliberData[caliber].kilos) || 0;
      const price = parseFloat(caliberData[caliber].price) || 0;
      const percentage = (kilos / totalKilos);
      return totalPrice + (percentage * price);
    }, 0);
  };

  // Clase B dedicated calcs (same as class A)
  const calculateTotalKilosB = () => {
    return claseBLabels.reduce((total, label) => {
      const k = parseFloat(caliberDataB[label]?.kilos) || 0;
      return total + k;
    }, 0);
  };

  const calculatePercentageB = (label) => {
    const k = parseFloat(caliberDataB[label]?.kilos) || 0;
    const tot = calculateTotalKilos() + calculateTotalKilosB();
    if (tot === 0) return 0;
    return (k / tot) * 100;
  };

  const calculateRealPriceB = () => {
    const t = calculateTotalKilosB();
    if (t === 0) return 0;
    return claseBLabels.reduce((sum, lbl) => {
      const kg = parseFloat(caliberDataB[lbl]?.kilos) || 0;
      const pr = parseFloat(caliberDataB[lbl]?.price) || 0;
      return sum + ((kg / t) * pr);
    }, 0);
  };

  // CALCS BEFORE ALL CONSUMERS (handleSubmit, JSX, returns) to fix TDZ/client exception
  const totalKilosA = calculateTotalKilos();
  const totalKilosB = calculateTotalKilosB();
  const totalKilos = totalKilosA + totalKilosB;
  const realPrice = calculateRealPricePerLot();
  const realPriceB = calculateRealPriceB();
  const totalReceived = parseFloat(totalKilosReceived) || 0;
  const variance = totalReceived - totalKilos;
  const variancePercentage = totalReceived > 0 ? (variance / totalReceived) * 100 : 0;

  const isProcessOrWaste = selectedQuality === 'Proceso' || selectedQuality === 'Desecho';
  const isClaseB = selectedQuality === 'Clase B';

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
    }
    setError('');
    
    // Validación 1: Lote seleccionado
    if (!selectedLot) {
      const errorMsg = 'Por favor selecciona un lote de la lista';
      setError(errorMsg);
      alert('❌ ' + errorMsg);
      return;
    }

    // Validación 2: Total de kilos recibidos
    if (!totalKilosReceived || parseFloat(totalKilosReceived) <= 0) {
      const errorMsg = 'Por favor ingresa el total de kilos recibidos en empaque (debe ser mayor a 0)';
      setError(errorMsg);
      alert('❌ ' + errorMsg);
      return;
    }

    let calibers = [];
    let totalKilos = 0;

    if (isProcessOrWaste) {
      // For Process/Waste: validate process or waste kilos
      const processKg = parseFloat(processKilos) || 0;
      const wasteKg = parseFloat(desechoCapturado) || 0;
      totalKilos = processKg + wasteKg;
      
      if (totalKilos === 0) {
        const errorMsg = `Por favor ingresa los kilos de ${selectedQuality.toLowerCase()}`;
        setError(errorMsg);
        alert('❌ ' + errorMsg);
        return;
      }
    } else if (isClaseB) {
      // Clase B: use dedicated kilos
      const cb = parseFloat(claseBKilos) || 0;
      const d = parseFloat(desechoCapturado) || 0;
      totalKilos = cb + d;
      if (totalKilos === 0) {
        const errorMsg = 'Por favor ingresa kilos de Clase B o desecho';
        setError(errorMsg);
        alert('❌ ' + errorMsg);
        return;
      }
    } else {
      // For other qualities: validate calibers — include BOTH Class A and Class B
      const aKilos = calculateTotalKilos();
      const bKilos = calculateTotalKilosB();
      totalKilos = aKilos + bKilos;
      if (totalKilos === 0) {
        const errorMsg = 'Por favor ingresa al menos un calibre con kilos (Clase A o Clase B)';
        setError(errorMsg);
        alert('❌ ' + errorMsg);
        return;
      }

      // Prepare caliber data for submission: A + full B classifications
      calibers = [
        ...calibers10kg
          .filter(c => parseFloat(caliberData[c]?.kilos) > 0)
          .map(c => ({
            caliber: c,
            kilos: parseFloat(caliberData[c].kilos),
            price: parseFloat(caliberData[c].price) || 0,
            percentage: calculatePercentage(c)
          })),
        ...claseBLabels
          .filter(lb => parseFloat(caliberDataB[lb]?.kilos) > 0)
          .map(lb => ({
            caliber: lb,
            kilos: parseFloat(caliberDataB[lb].kilos),
            price: parseFloat(caliberDataB[lb].price) || 0,
            percentage: calculatePercentageB(lb)
          }))
      ];
    }

    setSubmitting(true);
    try {
      const totalReceivedKg = parseFloat(totalKilosReceived) || 0;
      const shrinkageKg = totalReceivedKg - totalKilos;

      const response = await fetch('/api/lotification-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: selectedLot.id,
          selectionDate,
          totalKilosReceived: totalReceivedKg,
          calibers,
          qualityType: selectedQuality,
          processKg: parseFloat(processKilos) || 0,
          wasteKg: parseFloat(desechoCapturado) || 0,
          shrinkageKilos: shrinkageKg,
          claseBKilos: parseFloat(claseBKilos) || 0,
          desechoCapturado: parseFloat(desechoCapturado) || 0,
          procesoKg: parseFloat(processKilos) || 0
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        alert(`✅ Registro de lotificación guardado exitosamente

Lote: ${selectedLot.lot_number}
Total: ${totalKilos.toFixed(2)} kg
Clase A: ${totalKilosA.toFixed(2)} kg | Clase B: ${totalKilosB.toFixed(2)} kg
Proceso: ${parseFloat(processKilos)||0} kg | Desecho: ${parseFloat(desechoCapturado)||0} kg`);

        // AUTO CREATE HISTORY ENTRY (historial de lotes)
        const clasesMap = {};
        calibers.forEach(c => { clasesMap[c.caliber] = parseFloat(c.kilos); });
        fetch('/api/historial-lotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lotId: selectedLot.id,
            lotNumber: selectedLot.lot_number,
            fecha: selectionDate,
            productor: selectedLot.producer,
            producto: selectedLot.fruit_type,
            totalKg: totalKilos,
            clasificaciones: clasesMap,
            totalClaseA: totalKilosA,
            totalClaseB: totalKilosB,
            usuario: 'Operador',
            calidad: selectedQuality,
            procesoKg: parseFloat(processKilos) || 0,
            desechoKg: parseFloat(desechoCapturado) || 0,
            totalRecibidos: totalReceived,
            mermaKg: variance,
            precioReal: (isProcessOrWaste || isClaseB) ? 0 : realPrice
          })
        }).catch(() => {});

        // AUTO CREATE INVENTORY RECORDS for Venta de Proceso y Desecho
        const pKg = parseFloat(processKilos) || 0;
        const dKg = parseFloat(desechoCapturado) || 0;
        const lotNum = selectedLot.lot_number;
        const lotID = selectedLot.id;
        const invDate = selectionDate;

        if (pKg > 0) {
          fetch('/api/sales-process-waste', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lotId: lotID,
              lotNumber: lotNum,
              productName: 'Proceso',
              kg: pKg,
              date: invDate,
              notes: 'Generado automáticamente desde Registro de Lotificación'
            })
          }).catch(() => {});
        }
        if (dKg > 0) {
          fetch('/api/sales-process-waste', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lotId: lotID,
              lotNumber: lotNum,
              productName: 'Desecho',
              kg: dKg,
              date: invDate,
              notes: 'Generado automáticamente desde Registro de Lotificación'
            })
          }).catch(() => {});
        }

        // Reset both A and B form
        setCaliberData(calibers10kg.reduce((acc, caliber) => ({
          ...acc,
          [caliber]: { kilos: '', price: '' }
        }), {}));
        setCaliberDataB(claseBLabels.reduce((acc, lb) => ({
          ...acc,
          [lb]: { kilos: '', price: '' }
        }), {}));
        setTotalKilosReceived('');
        setProcessKilos('');
        setWasteKilos('');
        setClaseBKilos('');
        setDesechoCapturado('');
        setSelectedQuality('Calidad A');
        setSelectedLot(null);
        setError('');
      } else {
        const errorMsg = data.error || 'Error al guardar el registro';
        setError(errorMsg);
        alert('❌ Error: ' + errorMsg);
      }
    } catch (error) {
      const errorMsg = 'Error de conexión: ' + error.message;
      setError(errorMsg);
      alert('❌ ' + errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrado del historial (búsqueda por nombre/productor/lote)
  const filteredHistory = historyRecords.filter((rec) => {
    if (!historySearch.trim()) return true;
    const t = historySearch.toLowerCase().trim();
    return (
      (rec.lot_number || '').toLowerCase().includes(t) ||
      (rec.productor || '').toLowerCase().includes(t) ||
      (rec.producto || '').toLowerCase().includes(t) ||
      (rec.calidad || '').toLowerCase().includes(t)
    );
  });

  // Handlers para módulo de carga: Cargar Plantilla (Excel diseño) e imprimir sobre ella + Cargar Logotipo
  const handleCargarPlantilla = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      alert('Carga un archivo Excel (.xlsx) con el diseño de la plantilla');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      setPlantillaFile({ name: file.name, workbook: wb });
      alert(`✅ Plantilla "${file.name}" cargada con éxito.\nLos datos ingresados se superpondrán al imprimir/exportar.`);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImprimirSobrePlantilla = () => {
    if (!selectedLot) {
      alert('Selecciona un lote primero');
      return;
    }
    try {
      if (plantillaFile && plantillaFile.workbook) {
        const wb = plantillaFile.workbook;
        const wsName = wb.SheetNames[0];
        let ws = wb.Sheets[wsName];
        // Superponer datos del registro + empacadora header en area visible
        const empHeader = prependCompanyHeaderToExcelRows(branding, 'REGISTRO LOTIFICACIÓN');
        const overlayData = [
          ...empHeader,
          ['REGISTRO LOTIFICACIÓN - SOBRE PLANTILLA'],
          ['Lote', selectedLot.lot_number, 'Productor', selectedLot.producer],
          ['Fecha', selectionDate],
          ['Total Kilos Recibidos', totalReceived],
          ['Calidad', selectedQuality],
          ['Proceso (kg)', parseFloat(processKilos) || 0],
          ['Desecho Capturado (kg)', parseFloat(desechoCapturado) || 0],
          ['Total por Calibre', totalKilos, 'Precio Real $/kg', realPrice.toFixed(2)]
        ];
        XLSX.utils.sheet_add_aoa(ws, overlayData, { origin: 'A30' });
        const newWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWb, ws, wsName);
        XLSX.writeFile(newWb, `lotificacion_${selectedLot.lot_number}_sobre_${plantillaFile.name}`);
        alert('✅ Datos impresos/evidenciados sobre la plantilla Excel exportada');
      } else {
        // fallback generar PDF básico
        handleGenerarImpresionConLogo();
      }
    } catch (err) {
      alert('Error generando sobre plantilla: ' + err.message);
    }
  };

  const handleCargarLogotipo = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (json.url || json.fileUrl) {
        const url = json.url || json.fileUrl;
        setCustomLogoPreview(url);  // local session override
        alert('✅ Logotipo cargado. Se aplicará en este documento.');
      } else {
        const reader = new FileReader();
        reader.onload = ev => setCustomLogoPreview(ev.target.result);
        reader.readAsDataURL(file);
        alert('Logotipo cargado localmente (sesión).');
      }
    } catch (err) {
      const reader = new FileReader();
      reader.onload = ev => setCustomLogoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerarImpresionConLogo = () => {
    if (!selectedLot) {
      alert('Selecciona un lote para imprimir');
      return;
    }
    const doc = new jsPDF();
    const effectiveLogo = customLogoPreview || logoUrl;
    // Use the standardized header (logo + general empacadora data)
    let y = drawCompanyHeader(doc, { ...branding, logo_url: effectiveLogo, logoUrl: effectiveLogo }, 30);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('REGISTRO DE LOTIFICACIÓN', 15, y); y += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Lote: ${selectedLot.lot_number}  |  Productor: ${selectedLot.producer}`, 15, y); y+=8;
    doc.text(`Calidad: ${selectedQuality}   Fecha: ${selectionDate}`, 15, y); y+=8;
    doc.text(`Total Kg Recibidos: ${totalReceived.toFixed(2)} kg`, 15, y); y+=8;
    doc.text(`Proceso: ${parseFloat(processKilos)||0} kg`, 15, y); y+=7;
    doc.text(`Desecho Capturado: ${parseFloat(desechoCapturado)||0} kg`, 15, y); y+=7;
    doc.text(`Merma: ${variance.toFixed(2)} kg  (${variancePercentage.toFixed(1)}%)`, 15, y); y +=9;

    doc.setFont('helvetica', 'bold');
    doc.text('Detalles:', 15, y); y += 7;
    doc.setFont('helvetica', 'normal');
    calibers10kg.forEach(c => {
      const k = parseFloat(caliberData[c]?.kilos)||0;
      if (k > 0) { doc.text(`• ${c}: ${k} kg`, 18, y); y += 6; }
    });
    doc.save(`registro_lotificacion_${selectedLot.lot_number}.pdf`);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-brand-700">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center border border-brand-500/20">
                <img src="/logo.svg" alt="Tecavo Fruits Soft" className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
            </div>
            
            <nav className="hidden lg:flex items-center gap-1">
              <button onClick={() => router.push('/')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                Dashboard Principal
              </button>
              <button className="px-4 py-2 rounded-lg bg-brand-50 text-brand-700 font-medium text-sm transition-colors cursor-default">
                Registro de Lotificación
              </button>
              <button onClick={() => router.push('/inventory')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                Inventario
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          
          <section className="mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Registro de Lotificación</h1>
              <p className="text-slate-500 mt-1">Registra los kilos por calibre, asigna precios y calcula automáticamente porcentajes y precio real del lote.</p>
            </div>
          </section>

          {/* New Lots Notification */}
          {newLotsAdded && (
            <div className="mb-6 bg-green-50 border-2 border-green-300 rounded-xl p-4 flex items-center gap-3 animate-pulse">
              <i className="ph ph-check-circle text-green-600 text-2xl"></i>
              <div className="flex-1">
                <h4 className="font-bold text-green-900">Nuevos lotes detectados</h4>
                <p className="text-green-700 text-sm">La lista de lotes se ha actualizado automáticamente</p>
              </div>
              <button
                onClick={() => setNewLotsAdded(false)}
                className="p-1 rounded-lg hover:bg-green-100 text-green-700"
              >
                <i className="ph ph-x text-xl"></i>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Lots List Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-24">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-bold text-lg text-slate-900">Lotes Disponibles</h2>
                    <button
                      onClick={() => loadLots(true)}
                      disabled={refreshing}
                      className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50"
                      title="Refrescar lista de lotes"
                    >
                      <i className={`ph ph-arrows-clockwise text-xl ${refreshing ? 'animate-spin' : ''}`}></i>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <i className="ph ph-lightning text-green-600"></i>
                    Actualización automática cada 30 seg
                  </p>
                </div>
                
                {loading ? (
                  <div className="text-center py-8 text-slate-500">Cargando lotes...</div>
                ) : lots.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    <i className="ph ph-inbox text-3xl block mb-2"></i>
                    No hay lotes registrados
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {lots
                      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
                      .map((lot) => {
                        const isNew = lot.created_at && (new Date() - new Date(lot.created_at)) < 60000; // Less than 1 minute old
                        return (
                          <button
                            key={lot.id}
                            onClick={() => setSelectedLot(lot)}
                            className={`w-full p-3 rounded-lg text-left transition-all relative ${
                              selectedLot?.id === lot.id
                                ? 'bg-brand-50 border border-brand-300 shadow-sm'
                                : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {isNew && (
                              <span className="absolute -top-1 -right-1 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full shadow-sm">
                                NUEVO
                              </span>
                            )}
                            <div className="font-semibold text-slate-900">{lot.lot_number}</div>
                            <div className="text-xs text-slate-600 mt-1">{lot.producer}</div>
                            <div className="text-xs text-slate-500">{lot.fruit_type}</div>
                            {lot.orchard_name && (
                              <div className="text-xs text-slate-500 mt-0.5">
                                <i className="ph ph-tree text-xs"></i> {lot.orchard_name}
                              </div>
                            )}
                            <div className="text-xs text-slate-400 mt-1">
                              {new Date(lot.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Form Area */}
            <div className="lg:col-span-3 space-y-6">
              {selectedLot ? (
                <>
                  {/* Lot Details Card */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h2 className="font-bold text-lg text-slate-900 mb-4">Información del Lote</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold">Número de Lote</div>
                        <div className="text-lg font-bold text-slate-900">{selectedLot.lot_number}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold">Productor</div>
                        <div className="text-lg font-bold text-slate-900">{selectedLot.producer}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold">Tipo de Fruta</div>
                        <div className="text-lg font-bold text-slate-900">{selectedLot.fruit_type}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold">Fecha</div>
                        <div className="text-lg font-bold text-slate-900">{new Date(selectedLot.date).toLocaleDateString('es-MX')}</div>
                      </div>
                    </div>
                  </div>

                  {/* PROYECCIÓN ACOPIO VS RESULTADO LOTIFICACIÓN (punto 6 del requerimiento) */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg mb-3">Proyección de acopio vs. resultado de lotificación</h3>
                    {!acopioProjection ? (
                      <div className="text-sm text-slate-500">Cargando proyección o sin proyección registrada para este lote.</div>
                    ) : acopioProjection.message ? (
                      <div className="text-sm text-amber-600">{acopioProjection.message}</div>
                    ) : (
                      <div>
                        <div className="text-xs mb-2">Kg estimados corte (proy.): <b>{acopioProjection.est_kg_cut}</b> | Base: {acopioProjection.calculation_base}</div>
                        <table className="w-full text-xs border">
                          <thead><tr className="bg-slate-50"><th>Calibre/Calidad</th><th>% Proy.</th><th>% Real</th><th>Dif. pts</th><th>Kg Reales</th><th>Kg Esperados</th><th>Dif. kg</th></tr></thead>
                          <tbody>
                            {(acopioProjection.categories || []).map((c,idx) => {
                              // compute real from current lotification totals (use current form values as proxy for received)
                              const realKg = parseFloat(c.projected_kg) || 0; // placeholder; real computation uses lotification_calibers sum
                              const received = parseFloat(totalKilosReceived) || 1;
                              const projPct = parseFloat(c.projected_percent)||0;
                              const realPct = received ? ((realKg / received) * 100) : 0;
                              const diffPts = parseFloat((realPct - projPct).toFixed(1));
                              const expKg = received * projPct / 100;
                              const diffKg = parseFloat((realKg - expKg).toFixed(1));
                              return <tr key={idx} className="border-t"><td>{c.name}</td><td>{projPct.toFixed(1)}%</td><td>{realPct.toFixed(1)}%</td><td className={diffPts<0?'text-red-600':'text-emerald-600'}>{diffPts}</td><td>{realKg.toFixed(1)}</td><td>{expKg.toFixed(1)}</td><td>{diffKg}</td></tr>;
                            })}
                          </tbody>
                        </table>
                        <div className="text-[10px] mt-2 text-slate-500">Incluye Proceso/Desecho/Merma. Parcial mientras lotificación abierta. Usa kg recibidos reales del ingreso.</div>
                      </div>
                    )}
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Date and Total Kilos */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h2 className="font-bold text-lg text-slate-900 mb-4">Datos Generales</h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Fecha de Selección</label>
                          <input
                            type="date"
                            value={selectionDate}
                            onChange={(e) => setSelectionDate(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Total de Kilos Recibidos en Empaque</label>
                          <input
                            type="number"
                            step="0.01"
                            value={totalKilosReceived}
                            onChange={(e) => setTotalKilosReceived(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Seleccionar Calidad</label>
                          <div className="flex gap-2 flex-wrap mb-2">
                            {['Calidad A','Calidad B','Proceso','Desecho'].map(q => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => setSelectedQuality(q)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedQuality === q ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'}`}
                              >
                                {q}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setSelectedQuality('Clase B')}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedQuality === 'Clase B' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-700'}`}
                            >
                              Clase B (histórico)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Calibers Grid or Process/Waste Input */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      {/* Botón Clase B destacado + sección Desecho */}
                      {isClaseB && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="text-sm font-semibold text-amber-800 mb-1">MATERIAL CLASE B</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-slate-700">Kilos Clase B</label>
                              <input
                                type="number"
                                step="0.01"
                                value={claseBKilos}
                                onChange={(e) => setClaseBKilos(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-2.5 rounded-xl border border-amber-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Desecho generado</label>
                              <input
                                type="number"
                                step="0.01"
                                value={desechoCapturado}
                                onChange={(e) => setDesechoCapturado(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-2.5 rounded-xl border border-amber-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {isProcessOrWaste ? (
                        <>
                          <h2 className="font-bold text-lg text-slate-900 mb-6">Kilos de {selectedQuality}</h2>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Kilos de Proceso</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={processKilos}
                                  onChange={(e) => setProcessKilos(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                />
                                <p className="text-xs text-slate-500">Kilos sin clasificar por calibre</p>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Kilos de Desecho</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={desechoCapturado}
                                  onChange={(e) => setDesechoCapturado(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                />
                                <p className="text-xs text-slate-500">Kilos rechazados o dañados</p>
                              </div>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="text-sm font-semibold text-blue-900">Total ingresado: {((parseFloat(processKilos) || 0) + (parseFloat(desechoCapturado) || 0)).toFixed(2)} kg</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* ===== CLASIFICACIONES CLASE A (existing) ===== */}
                          <div className="mb-5">
                            <h2 className="font-bold text-lg text-emerald-900 mb-3">Clasificaciones Clase A</h2>
                            <div className="space-y-3">
                              <div className="grid grid-cols-4 gap-4 pb-1 border-b border-emerald-200 text-xs font-semibold text-emerald-700 uppercase">
                                <div>Calibre</div><div>Kilos</div><div>Precio ($/kg)</div><div>%</div>
                              </div>
                              {calibers10kg.map((caliber) => (
                                <div key={caliber} className="grid grid-cols-4 gap-4 items-center p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                                  <div className="font-medium text-slate-900">{caliber}</div>
                                  <input type="number" step="0.01" value={caliberData[caliber]?.kilos || ''} onChange={(e) => handleCaliberChange(caliber, 'kilos', e.target.value)} placeholder="0" className="px-2 py-1.5 rounded border border-emerald-300 text-sm" />
                                  <div className="flex items-center gap-1"><span className="text-xs text-emerald-700">$</span><input type="number" step="0.01" value={caliberData[caliber]?.price || ''} onChange={(e) => handleCaliberChange(caliber, 'price', e.target.value)} placeholder="0" className="flex-1 px-2 py-1.5 rounded border border-emerald-300 text-sm" disabled={!isSuper} title={!isSuper ? 'Solo Superadministrador edita precios' : ''} /></div>
                                  <div className="font-semibold text-emerald-700">{calculatePercentage(caliber).toFixed(1)}%</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* ===== CLASIFICACIONES CLASE B (NEW full replica) ===== */}
                          <div>
                            <h2 className="font-bold text-lg text-amber-900 mb-3">Clasificaciones Clase B</h2>
                            <div className="space-y-3">
                              <div className="grid grid-cols-4 gap-4 pb-1 border-b border-amber-300 text-xs font-semibold text-amber-700 uppercase">
                                <div>Calibre</div><div>Kilos</div><div>Precio ($/kg)</div><div>%</div>
                              </div>
                              {claseBLabels.map((label) => (
                                <div key={label} className="grid grid-cols-4 gap-4 items-center p-2 bg-amber-50 rounded-lg border border-amber-300">
                                  <div className="font-medium text-slate-900">{label}</div>
                                  <input type="number" step="0.01" value={caliberDataB[label]?.kilos || ''} onChange={(e) => handleCaliberChangeB(label, 'kilos', e.target.value)} placeholder="0" className="px-2 py-1.5 rounded border border-amber-400 text-sm" />
                                  <div className="flex items-center gap-1"><span className="text-xs text-amber-700">$</span><input type="number" step="0.01" value={caliberDataB[label]?.price || ''} onChange={(e) => handleCaliberChangeB(label, 'price', e.target.value)} placeholder="0" className="flex-1 px-2 py-1.5 rounded border border-amber-400 text-sm" /></div>
                                  <div className="font-semibold text-amber-700">{calculatePercentageB(label).toFixed(1)}%</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-1 text-xs text-amber-600">Los valores de Clase B se registran con las mismas reglas de negocio que la Clase A.</div>
                          </div>
                        </>
                      )}

                      {/* Proceso y Desecho - campos de captura, siempre disponibles */}
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-800 mb-3">Proceso y Desecho</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Kilos de Proceso</label>
                            <input
                              type="number"
                              step="0.01"
                              value={processKilos}
                              onChange={(e) => setProcessKilos(e.target.value)}
                              placeholder="0.00"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                            <p className="text-xs text-slate-500">Kilos enviados a proceso (misma captura que en calidad Proceso)</p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Kilos de Desecho</label>
                            <input
                              type="number"
                              step="0.01"
                              value={desechoCapturado}
                              onChange={(e) => setDesechoCapturado(e.target.value)}
                              placeholder="0.00"
                              className="w-full px-4 py-2.5 rounded-xl border border-red-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-400 outline-none"
                            />
                            <p className="text-xs text-slate-500">Este valor se guarda independientemente de la merma calculada (misma validación que otros campos)</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h2 className="font-bold text-lg text-slate-900 mb-6">Resumen de Cálculos</h2>
                      {isProcessOrWaste ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="text-xs text-blue-600 uppercase font-semibold">Kilos de {selectedQuality}</div>
                              <div className="text-2xl font-bold text-blue-900 mt-2">{totalKilos.toFixed(2)} kg</div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="text-xs text-slate-600 uppercase font-semibold">Total Kilos Recibidos</div>
                              <div className="text-2xl font-bold text-slate-900 mt-2">{totalReceived.toFixed(2)} kg</div>
                            </div>
                            <div className={`p-4 rounded-lg border ${variance < 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                              <div className={`text-xs uppercase font-semibold ${variance < 0 ? 'text-red-600' : 'text-amber-600'}`}>Merma Calculada</div>
                              <div className={`text-2xl font-bold mt-2 ${variance < 0 ? 'text-red-900' : 'text-amber-900'}`}>
                                {variance.toFixed(2)} kg
                              </div>
                              <div className="text-xs mt-1 text-slate-600">({variancePercentage.toFixed(2)}%)</div>
                            </div>
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="text-xs uppercase font-semibold text-blue-700">Proceso</div>
                              <div className="text-2xl font-bold text-blue-900 mt-1">{(parseFloat(processKilos)||0).toFixed(2)} kg</div>
                            </div>
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                              <div className="text-xs uppercase font-semibold text-red-700">Desecho</div>
                              <div className="text-2xl font-bold text-red-900 mt-1">{(parseFloat(desechoCapturado)||0).toFixed(2)} kg</div>
                            </div>
                          </div>
                          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-sm text-green-700"><strong>Nota:</strong> La merma es la diferencia entre los kilos recibidos y los kilos de {selectedQuality.toLowerCase()} registrados. También se registra el desecho generado.</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="text-xs text-blue-600 uppercase font-semibold">Total Kilos por Calibre</div>
                              <div className="text-2xl font-bold text-blue-900 mt-2">{totalKilos.toFixed(2)} kg</div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="text-xs text-slate-600 uppercase font-semibold">Total Kilos Recibidos</div>
                              <div className="text-2xl font-bold text-slate-900 mt-2">{totalReceived.toFixed(2)} kg</div>
                            </div>
                            <div className={`p-4 rounded-lg border ${
                              Math.abs(variance) < 0.01
                                ? 'bg-green-50 border-green-200'
                                : 'bg-amber-50 border-amber-200'
                            }`}>
                              <div className={`text-xs uppercase font-semibold ${
                                Math.abs(variance) < 0.01 ? 'text-green-600' : 'text-amber-600'
                              }`}>Merma</div>
                              <div className={`text-2xl font-bold mt-2 ${
                                Math.abs(variance) < 0.01 ? 'text-green-900' : 'text-amber-900'
                              }`}>
                                {variance > 0 ? '+' : ''}{variance.toFixed(2)} kg
                              </div>
                              <div className="text-xs mt-1 text-slate-600">({variancePercentage.toFixed(2)}%)</div>
                            </div>
                            <div className="p-4 bg-brand-50 rounded-lg border border-brand-200">
                              <div className="text-xs text-brand-600 uppercase font-semibold">Precio Real por Lote</div>
                              <div className="text-2xl font-bold text-brand-900 mt-2">${realPrice.toFixed(2)}/kg</div>
                              <div className="text-xs mt-1 text-slate-600">(Promedio ponderado)</div>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="text-xs uppercase font-semibold text-blue-700">Proceso</div>
                              <div className="text-2xl font-bold mt-2 text-blue-900">{(parseFloat(processKilos)||0).toFixed(2)} kg</div>
                            </div>
                            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                              <div className="text-xs uppercase font-semibold text-red-700">Desecho</div>
                              <div className="text-2xl font-bold mt-2 text-red-900">{(parseFloat(desechoCapturado)||0).toFixed(2)} kg</div>
                            </div>
                          </div>

                          {/* Detailed breakdown */}
                          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <h3 className="font-semibold text-sm text-slate-700 mb-3">Desglose por Calibre</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                              {calibers10kg.filter(caliber => parseFloat(caliberData[caliber]?.kilos) > 0).map(caliber => {
                                const kilos = parseFloat(caliberData[caliber].kilos) || 0;
                                const price = parseFloat(caliberData[caliber].price) || 0;
                                const percentage = calculatePercentage(caliber);
                                const contribution = (percentage / 100) * price;
                                
                                return (
                                  <div key={caliber} className="p-2 bg-white rounded border border-slate-200">
                                    <div className="font-semibold text-slate-900">{caliber}</div>
                                    <div className="text-slate-600 mt-1">{kilos.toFixed(2)} kg</div>
                                    <div className="text-brand-700 font-medium">{percentage.toFixed(1)}% × ${price.toFixed(2)}</div>
                                    <div className="text-slate-500">= ${contribution.toFixed(2)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                        <i className="ph ph-warning-circle text-red-600 text-2xl flex-shrink-0 mt-0.5"></i>
                        <div>
                          <h4 className="font-bold text-red-900 mb-1">Error de validación</h4>
                          <p className="text-red-700 text-sm">{error}</p>
                        </div>
                      </div>
                    )}

                    {/* Historial de Lotes (trazabilidad automática mejorada) */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                      <button 
                        type="button"
                        onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
                        className="w-full flex items-center justify-between text-left font-semibold text-slate-900 mb-1"
                      >
                        <span>📜 Historial de Lotes (trazabilidad automática)</span>
                        <span>{showHistory ? '−' : '+'}</span>
                      </button>
                      {showHistory && (
                        <div className="mt-3">
                          {/* Campo de búsqueda por nombre (productor / lote / producto) */}
                          <div className="flex items-center gap-2 mb-3">
                            <input
                              type="text"
                              value={historySearch}
                              onChange={(e) => setHistorySearch(e.target.value)}
                              placeholder="Buscar por nombre de productor, producto o lote..."
                              className="flex-1 px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            {historySearch && (
                              <button
                                type="button"
                                onClick={() => setHistorySearch('')}
                                className="text-xs px-3 py-2 bg-slate-200 rounded-xl hover:bg-slate-300"
                              >
                                Limpiar
                              </button>
                            )}
                          </div>

                          <div className="max-h-72 overflow-auto text-sm">
                            {filteredHistory.length === 0 && (
                              <div className="py-3 text-slate-500">
                                {historyRecords.length === 0 
                                  ? 'Aún no hay registros en historial. Al guardar un registro se agrega automáticamente.' 
                                  : 'No hay lotes que coincidan con la búsqueda.'}
                              </div>
                            )}
                            {filteredHistory.map((h, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedHistoryDetail(h)}
                                className="w-full text-left p-3 mb-2 bg-slate-50 hover:bg-slate-100 active:bg-brand-50 rounded border border-slate-200 transition cursor-pointer"
                              >
                                <div className="font-semibold text-slate-900 flex items-center justify-between text-sm">
                                  <span>{h.lot_number} • {h.productor}</span>
                                  <span className="text-xs text-slate-500">{h.fecha ? new Date(h.fecha).toLocaleDateString('es-MX') : ''}</span>
                                </div>
                                <div className="text-xs mt-1 text-slate-700">
                                  Total: <b>{parseFloat(h.total_kg || 0).toFixed(1)}</b> kg
                                  {(h.proceso_kg > 0 || h.desecho_kg > 0) && (
                                    <> • Proceso: <b>{parseFloat(h.proceso_kg||0).toFixed(1)}</b> kg • Desecho: <b>{parseFloat(h.desecho_kg||0).toFixed(1)}</b> kg</>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">Calidad: {h.calidad || '—'} • Usuario: {h.usuario || 'Operador'} • Clic para ver detalle completo</div>
                              </button>
                            ))}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">Se muestran todos los registros de lotificación. Haz clic en uno para ver toda la información registrada.</div>
                        </div>
                      )}
                    </div>

                    {/* MODAL DE DETALLE COMPLETO DEL HISTORIAL (Trazabilidad) */}
                    {selectedHistoryDetail && (
                      <div 
                        className="fixed inset-0 z-[70] flex items-start md:items-center justify-center bg-black/50 p-4"
                        onClick={() => setSelectedHistoryDetail(null)}
                      >
                        <div 
                          className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[94vh] mt-10 md:mt-0 flex flex-col"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Header */}
                          <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
                            <div>
                              <div className="text-xs tracking-widest opacity-75">TRAZABILIDAD - HISTORIAL DE LOTE</div>
                              <div className="text-xl font-bold">Lote {selectedHistoryDetail.lot_number}</div>
                            </div>
                            <button 
                              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
                              onClick={() => setSelectedHistoryDetail(null)}
                            >
                              Cerrar
                            </button>
                          </div>

                          <div className="p-6 overflow-y-auto text-sm space-y-6 flex-1">
                            {/* Info básica */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                              <div>
                                <div className="text-xs uppercase text-slate-500">Fecha de Registro</div>
                                <div className="font-semibold">{selectedHistoryDetail.fecha ? new Date(selectedHistoryDetail.fecha).toLocaleDateString('es-MX', { year:'numeric', month: 'short', day:'numeric' }) : '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase text-slate-500">Productor / Proveedor</div>
                                <div className="font-semibold">{selectedHistoryDetail.productor || '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase text-slate-500">Producto</div>
                                <div className="font-semibold">{selectedHistoryDetail.producto || '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase text-slate-500">Calidad</div>
                                <div className="font-semibold">{selectedHistoryDetail.calidad || '—'}</div>
                              </div>
                            </div>

                            {/* Totales */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                <div className="text-xs text-blue-700 font-medium">Total Kg Recibidos</div>
                                <div className="text-3xl font-bold text-blue-900 mt-1">{parseFloat(selectedHistoryDetail.total_kilos_recibidos || selectedHistoryDetail.total_kg || 0).toFixed(2)} kg</div>
                              </div>
                              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <div className="text-xs text-emerald-700 font-medium">Total Clasificado</div>
                                <div className="text-3xl font-bold text-emerald-900 mt-1">{parseFloat(selectedHistoryDetail.total_kg || 0).toFixed(2)} kg</div>
                              </div>
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <div className="text-xs text-amber-700 font-medium">Merma</div>
                                <div className="text-3xl font-bold text-amber-900 mt-1">{parseFloat(selectedHistoryDetail.merma_kg || 0).toFixed(2)} kg</div>
                              </div>
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                <div className="text-xs text-slate-600 font-medium">Precio Real por Lote</div>
                                <div className="text-3xl font-bold text-slate-800 mt-1">${parseFloat(selectedHistoryDetail.precio_real || 0).toFixed(2)}</div>
                              </div>
                            </div>

                            {/* Proceso y Desecho */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="p-4 rounded-xl border bg-blue-50 border-blue-200">
                                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Proceso</div>
                                <div className="mt-1 text-2xl font-semibold text-blue-900">{parseFloat(selectedHistoryDetail.proceso_kg || 0).toFixed(2)} kg</div>
                              </div>
                              <div className="p-4 rounded-xl border bg-red-50 border-red-200">
                                <div className="text-xs font-semibold text-red-700 uppercase tracking-wide">Desecho</div>
                                <div className="mt-1 text-2xl font-semibold text-red-900">{parseFloat(selectedHistoryDetail.desecho_kg || 0).toFixed(2)} kg</div>
                              </div>
                            </div>

                            {/* Clasificaciones */}
                            <div>
                              <div className="font-bold text-slate-800 mb-2">Clasificaciones registradas</div>
                              {selectedHistoryDetail.clasificaciones && Object.keys(selectedHistoryDetail.clasificaciones).length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                  {Object.entries(selectedHistoryDetail.clasificaciones).map(([cal, kg]) => (
                                    <div key={cal} className="flex justify-between px-3 py-1.5 rounded border bg-white">
                                      <span className="font-medium">{cal}</span>
                                      <span className="font-semibold text-emerald-700">{parseFloat(kg).toFixed(2)} kg</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-slate-500 text-sm bg-slate-50 p-3 rounded border">Sin desglose por calibre capturado.</div>
                              )}
                              <div className="text-xs mt-2 text-slate-500">Clase A registrada: {parseFloat(selectedHistoryDetail.total_kg_clase_a || 0).toFixed(1)} kg — Clase B: {parseFloat(selectedHistoryDetail.total_kg_clase_b || 0).toFixed(1)} kg</div>
                            </div>

                            {/* Resumen completo */}
                            <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl">
                              <div className="font-semibold mb-1">Resumen de Cálculos (al momento de registro)</div>
                              <div className="text-xs space-y-1 text-slate-700">
                                <div>• Total recibido: {parseFloat(selectedHistoryDetail.total_kilos_recibidos || 0).toFixed(2)} kg</div>
                                <div>• Registro de proceso: {parseFloat(selectedHistoryDetail.proceso_kg || 0).toFixed(2)} kg</div>
                                <div>• Registro de desecho: {parseFloat(selectedHistoryDetail.desecho_kg || 0).toFixed(2)} kg</div>
                                <div>• Merma: {parseFloat(selectedHistoryDetail.merma_kg || 0).toFixed(2)} kg</div>
                                {parseFloat(selectedHistoryDetail.precio_real) > 0 && <div>• Precio ponderado: ${parseFloat(selectedHistoryDetail.precio_real).toFixed(2)} / kg</div>}
                              </div>
                            </div>

                            <div className="border-t pt-3 text-xs text-slate-500">
                              Registrado por: <span className="font-medium text-slate-700">{selectedHistoryDetail.usuario || 'Operador'}</span> — Estatus: <span className="font-medium">{selectedHistoryDetail.estatus || 'Registrado'}</span>
                            </div>
                          </div>

                          <div className="p-5 border-t flex gap-3 justify-end bg-slate-50 flex-shrink-0">
                            <button 
                              onClick={() => setSelectedHistoryDetail(null)} 
                              className="px-6 py-2 rounded-xl bg-slate-800 text-white text-sm hover:bg-black"
                            >
                              Cerrar consulta
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-4">
                      {/* Module de Carga - BOTONES REQUERIDOS */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-200">
                        <div className="font-bold text-sm text-slate-900 mb-3">MÓDULO DE CARGA: Plantilla & Logotipo</div>
                        <div className="flex flex-wrap gap-3">
                          {/* Cargar Plantilla Excel con diseño */}
                          <label className="flex-1 cursor-pointer px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 border border-emerald-700">
                            📥 Cargar Plantilla (Excel con diseño)
                            <input type="file" accept=".xlsx" className="hidden" onChange={handleCargarPlantilla} />
                          </label>

                          {/* Imprimir sobre la plantilla */}
                          <button
                            type="button"
                            onClick={handleImprimirSobrePlantilla}
                            className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all"
                          >
                            🖨️ Imprimir datos sobre Plantilla cargada
                          </button>

                          {/* Cargar Logotipo */}
                          <label className="flex-1 cursor-pointer px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 border border-indigo-700">
                            🏷️ Cargar Logotipo
                            <input type="file" accept="image/*" className="hidden" onChange={handleCargarLogotipo} />
                          </label>

                          {/* Imprimir con logo */}
                          <button
                            type="button"
                            onClick={handleGenerarImpresionConLogo}
                            className="flex-1 px-4 py-3 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all"
                          >
                            🖨 Imprimir con Logotipo
                          </button>
                        </div>
                        {plantillaFile && <div className="mt-1 text-xs text-emerald-600">Plantilla activa: {plantillaFile.name}</div>}
                        {(customLogoPreview || logoUrl) && <div className="mt-1"><img src={customLogoPreview || logoUrl} alt="Logo" className="h-8 inline" /> Logotipo empacadora activo (en todos los tickets / documentos)</div>}
                      </div>

                      {/* Calculate Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const total = calculateTotalKilos();
                          const price = calculateRealPricePerLot();
                          alert(`📊 Cálculo actualizado:

Total Kilos: ${total.toFixed(2)} kg
Precio Real: ${price.toFixed(2)}/kg`);
                        }}
                        className="w-full px-6 py-3 bg-slate-600 text-white rounded-xl hover:bg-slate-700 font-semibold text-base shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <i className="ph ph-calculator text-xl"></i>
                        Calcular Totales
                      </button>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full px-8 py-5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl hover:from-brand-700 hover:to-brand-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-500 font-bold text-xl shadow-xl shadow-brand-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border-2 border-brand-800/20"
                      >
                        {submitting ? (
                          <>
                            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Guardando Registro...</span>
                          </>
                        ) : (
                          <>
                            <i className="ph ph-floppy-disk-back text-3xl"></i>
                            <span>GUARDAR REGISTRO DE LOTIFICACIÓN</span>
                          </>
                        )}
                      </button>
                      
                      {submitting && (
                        <div className="text-center text-sm text-slate-500 animate-pulse">
                          <i className="ph ph-hourglass"></i> Procesando datos, por favor espera...
                        </div>
                      )}

                      {/* Cancel/Reset Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('¿Deseas limpiar todos los campos del formulario?')) {
                            setCaliberData(calibers10kg.reduce((acc, caliber) => ({
                              ...acc,
                              [caliber]: { kilos: '', price: '' }
                            }), {}));
                            setTotalKilosReceived('');
                            setProcessKilos('');
                            setWasteKilos('');
                            setClaseBKilos('');
                            setDesechoCapturado('');
                            setPlantillaFile(null);
                            setSelectedLot(null);
                          }
                        }}
                        disabled={submitting}
                        className="w-full px-6 py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base transition-all flex items-center justify-center gap-2"
                      >
                        <i className="ph ph-x-circle text-lg"></i>
                        Limpiar Formulario
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <i className="ph ph-arrow-left text-5xl text-slate-300 block mb-4"></i>
                  <p className="text-slate-500 text-lg">Selecciona un lote para comenzar el registro de lotificación</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LotificationRegistryPage() {
  return (
    <Suspense fallback={null}>
      <LotificationRegistryPageContent />
    </Suspense>
  );
}
