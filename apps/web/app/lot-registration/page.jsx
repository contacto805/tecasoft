'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const CALIBERS_CLASE_A = ['SUPER', 'EXTRA', 'PRIMERA', 'MEDIANO', 'TERCERA', 'CUARTA'];
const CALIBERS_CLASE_B = ['SUPER', 'EXTRA', 'PRIMERA', 'MEDIANO', 'TERCERA', 'CUARTA'];
const CALIBERS_OTHER = ['PROCESO', 'DESECHO', 'MERMA'];
const ALL_CALIBERS = [
  { label: 'CLASE A', items: CALIBERS_CLASE_A },
  { label: 'CLASE B', items: CALIBERS_CLASE_B },
  { label: 'OTROS', items: CALIBERS_OTHER }
];
const CLASS_OPTIONS = ['A', 'B', 'C'];
const PALLET_TYPES = [
  { value: '6kg', label: 'Tarima 6kg' },
  { value: '10kg-96', label: 'Tarima 10kg (96 cajas)' },
  { value: '10kg-104', label: 'Tarima 10kg (104 cajas)' }
];

export default function ProductionPage() {
  const router = useRouter();
  // DEPRECATED (BLOQUE 04): Lote Registro completamente desincorporado.
  // Redirección inmediata a Producción (canónica). No se permite captura en rutas legacy.
  // Mantiene entidad lots y folios como eje de trazabilidad.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const lotId = params.get('lotId');
      const target = lotId ? `/production?tab=seleccion&lotId=${lotId}` : '/production?tab=seleccion';
      router.replace(target);
    }
  }, [router]);
  const [availableLots, setAvailableLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [bandPricing, setBandPricing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [palletConfig, setPalletConfig] = useState({
    materials: [],
    selectedMaterials: {}
  });

  const [lotDetails, setLotDetails] = useState({
    lot_id: null,
    total_kg: 0,
    field_box_pallets: 0
  });

  const [selectionTable, setSelectionTable] = useState([]);
  const [selectedPalletType, setSelectedPalletType] = useState('10kg-96');
  const [totalKgProcessed, setTotalKgProcessed] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [processWasteShrinkage, setProcessWasteShrinkage] = useState({
    process_kg: 0,
    waste_kg: 0,
    shrinkage_kg: 0
  });

  const [palletOutput, setPalletOutput] = useState([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const lotsRes = await fetch('/api/lots?status=selection');
      if (lotsRes.ok) {
        const lots = await lotsRes.json();
        setAvailableLots(lots);
      }

      const pricingRes = await fetch('/api/band-pricing');
      if (pricingRes.ok) {
        const pricing = await pricingRes.json();
        setBandPricing(pricing);
      }

      const matRes = await fetch('/api/production/inventory-status');
      if (matRes.ok) {
        const materials = await matRes.json();
        setPalletConfig(prev => ({
          ...prev,
          materials: materials
        }));
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const handleLotSelect = async (lotId) => {
    const lot = availableLots.find(l => l.id === parseInt(lotId));
    if (!lot) return;

    setSelectedLot(lot);
    
    // Try to load the public scale weighing (total_kilos_received)
    let totalKgFromScale = lot.total_kg || 0;
    try {
      const res = await fetch(`/api/fruit-input-weighings?lotId=${lotId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.total_kg_weighed) {
          totalKgFromScale = data.total_kg_weighed;
        }
      }
    } catch (error) {
      console.error('Error loading public scale weighing:', error);
    }

    setLotDetails({
      lot_id: lot.id,
      total_kg: totalKgFromScale,
      field_box_pallets: lot.field_box_pallets || 0
    });
    
    setSelectionTable([]);
    setTotalKgProcessed(0);
    setTotalPrice(0);
  };

  const handleAddCaliberRow = (caliber, classe) => {
    const newRow = {
      id: Date.now(),
      caliber,
      class: classe,
      boxes_10kg: 0,
      boxes_6kg: 0,
      field_box_number: '',
      weighing: 0,
      total_kg: 0,
      percentage: 0,
      band_price: bandPricing?.price_per_kg || 0,
      total_price: 0
    };
    setSelectionTable([...selectionTable, newRow]);
  };

  const handleUpdateRow = (rowId, field, value) => {
    const updatedTable = selectionTable.map(row => {
      if (row.id !== rowId) return row;

      let updated = { ...row };

      if (field === 'class') {
        updated[field] = value;
      } else if (field === 'field_box_number') {
        updated[field] = value;
      } else if (field === 'weighing') {
        updated.total_kg = parseFloat(value) || 0;
        updated.total_price = parseFloat(updated.total_kg) * parseFloat(updated.band_price || 0);
      } else if (field === 'boxes_10kg' || field === 'boxes_6kg') {
        updated[field] = parseInt(value) || 0;
        updated.total_kg = (parseInt(updated.boxes_10kg) * 10) + (parseInt(updated.boxes_6kg) * 6);
        updated.total_price = parseFloat(updated.total_kg) * parseFloat(updated.band_price || 0);
      } else if (field === 'band_price') {
        const numVal = parseFloat(value) || 0;
        updated[field] = numVal;
        updated.total_price = parseFloat(updated.total_kg) * parseFloat(numVal);
      }

      return updated;
    });

    setSelectionTable(updatedTable);

    const totalKg = updatedTable.reduce((sum, row) => sum + (row.total_kg || 0), 0);
    const totalPrc = updatedTable.reduce((sum, row) => sum + (row.total_price || 0), 0);
    setTotalKgProcessed(totalKg);
    setTotalPrice(totalPrc);

    // Calculate percentages
    setSelectionTable(prevTable => {
      const totalKgForPercent = prevTable.reduce((sum, row) => sum + (row.total_kg || 0), 0);
      return prevTable.map(row => ({
        ...row,
        percentage: totalKgForPercent > 0 ? (((row.total_kg || 0) / totalKgForPercent) * 100).toFixed(2) : 0
      }));
    });
  };

  const handleRemoveRow = (rowId) => {
    const updated = selectionTable.filter(row => row.id !== rowId);
    setSelectionTable(updated);

    const newTotalKg = updated.reduce((sum, row) => sum + row.total_kg, 0);
    const newTotalPrice = updated.reduce((sum, row) => sum + row.total_price, 0);
    setTotalKgProcessed(newTotalKg);
    setTotalPrice(newTotalPrice);
  };

  const handleAddPalletOutput = () => {
    if (!selectedLot || selectionTable.length === 0) {
      setError('Selecciona un lote y agrega calibres a la tabla');
      return;
    }

    const newOutput = {
      id: Date.now(),
      pallet_type: selectedPalletType,
      caliber: selectionTable[0]?.caliber || '',
      class: selectionTable[0]?.class || 'A',
      pallet_count: 0,
      packing_date: new Date().toISOString().split('T')[0],
      cold_date: new Date().toISOString().split('T')[0]
    };

    setPalletOutput([...palletOutput, newOutput]);
  };

  const handleUpdatePalletOutput = (outputId, field, value) => {
    setPalletOutput(prevOutput =>
      prevOutput.map(output =>
        output.id === outputId ? { ...output, [field]: value } : output
      )
    );
  };

  const handleRemovePalletOutput = (outputId) => {
    setPalletOutput(prev => prev.filter(o => o.id !== outputId));
  };

  const handlePrintThermalLabels = async () => {
    if (palletOutput.length === 0) {
      setError('Agrega al menos una fila de salida de tarimas');
      return;
    }

    setLoading(true);
    setError('');

    try {
      for (const output of palletOutput) {
        await fetch('/api/production/thermal-labels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            production_batch_id: 1,
            lot_id: selectedLot.id,
            lot_number: selectedLot.lot_number,
            packing_date: output.packing_date,
            cold_date: output.cold_date,
            caliber: output.caliber,
            class_name: output.class,
            total_kg: Math.ceil(totalKgProcessed / palletOutput.length)
          })
        });
      }

      setSuccess('✅ Etiquetas térmicas generadas y listas para imprimir');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error al generar etiquetas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduction = async () => {
    if (!selectedLot || selectionTable.length === 0 || palletOutput.length === 0) {
      setError('Completa todos los campos: lote, calibres y salida de tarimas');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Save to lotification registry
      const lotificationRes = await fetch('/api/lotification-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: selectedLot.id,
          selectionDate: new Date().toISOString().split('T')[0],
          totalKilosReceived: lotDetails.total_kg,
          calibers: selectionTable.map(row => ({
            caliber: row.caliber,
            kilos: row.total_kg,
            price: row.band_price,
            percentage: row.percentage
          })),
          process_kg: processWasteShrinkage.process_kg,
          waste_kg: processWasteShrinkage.waste_kg,
          shrinkage_kg: processWasteShrinkage.shrinkage_kg
        })
      });

      if (!lotificationRes.ok) {
        throw new Error('Error saving lotification registry');
      }

      for (const row of selectionTable) {
        await fetch('/api/production/selection-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            production_batch_id: 1,
            lot_id: selectedLot.id,
            pallet_type: selectedPalletType,
            boxes_per_pallet: selectedPalletType === '6kg' ? 0 : (selectedPalletType === '10kg-96' ? 96 : 104),
            caliber: row.caliber,
            class_name: row.class,
            boxes_10kg: row.boxes_10kg,
            boxes_6kg: row.boxes_6kg,
            total_kg: row.total_kg,
            band_price: row.band_price
          })
        });
      }

      for (const output of palletOutput) {
        await fetch('/api/production/pallet-output', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            production_batch_id: 1,
            lot_id: selectedLot.id,
            pallet_type: output.pallet_type,
            caliber: output.caliber,
            class_name: output.class,
            pallet_count: output.pallet_count,
            total_kg: totalKgProcessed,
            packing_date: output.packing_date,
            cold_date: output.cold_date
          })
        });
      }

      setSuccess('✅ Producción guardada exitosamente');
      setTimeout(() => {
        setSuccess('');
        loadAllData();
        setSelectionTable([]);
        setPalletOutput([]);
        setSelectedLot(null);
        setProcessWasteShrinkage({
          process_kg: 0,
          waste_kg: 0,
          shrinkage_kg: 0
        });
      }, 3000);
    } catch (err) {
      setError('Error al guardar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Early return: never render the legacy editor/form. Pure redirect per spec.
  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50 items-center justify-center">
      <div className="bg-amber-600 text-white text-center text-xs py-1 w-full">MÓDULO «Lote Registro» DESCONTINUADO — Redirigiendo a /production (canónica). Datos históricos preservados.</div>
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Redirigiendo a Producción...</h1>
        <p className="text-slate-600">Usa pestañas: Lotes pendientes • Nueva corrida / Selección • Rendimiento del lote • Tarimas • Historial • Diferencias</p>
        <a href="/production" className="mt-4 inline-block px-4 py-2 bg-brand-600 text-white rounded">Ir ahora a Producción →</a>
      </div>
    </div>
  );
}
