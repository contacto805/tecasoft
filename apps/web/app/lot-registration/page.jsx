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
  // DEPRECATED: Lote Registro ha sido desincorporado del flujo activo.
  // Toda la selección y rendimiento ahora se registra en el módulo Producción (fuente canónica).
  // Redirección HTTP-style a pestaña de selección (con lotId si aplica).
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const lotId = params.get('lotId');
    const target = lotId ? `/production?tab=seleccion&lotId=${lotId}` : '/production?tab=seleccion';
    setTimeout(() => router.replace(target), 800);
  }
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

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      <header className="fixed top-0 left-0 right-0 w-full z-50 glass-panel border-b border-slate-200">
        <div className="bg-amber-600 text-white text-center text-xs py-1">MÓDULO DESCONTINUADO — Usar /production (fuente canónica única de selección y rendimiento). Redirigiendo...</div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-brand-700">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center border border-brand-500/20">
                <img src="/logo.svg" alt="Tecavo" className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
            </div>
            <nav className="hidden lg:flex items-center gap-1">
              <button onClick={() => router.push('/')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                Dashboard
              </button>
              <button onClick={() => router.push('/inventory')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                Inventario
              </button>
              <button onClick={() => router.push('/fruit-input')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                Ingreso de Fruta
              </button>
              <button className="px-4 py-2 rounded-lg bg-brand-50 text-brand-700 font-medium text-sm cursor-default">
                Producción
              </button>
            </nav>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-200"></div>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Producción</h1>
            <p className="text-slate-500 mt-2">Configura materiales de paletas, procesa lotes por calibres y genera etiquetas térmicas</p>
          </section>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 font-medium">
              {success}
            </div>
          )}



          <section className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">🍊 Selección de Lote</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Lote de Origen</label>
                <select
                  value={selectedLot?.id || ''}
                  onChange={(e) => handleLotSelect(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                >
                  <option value="">-- Selecciona lote --</option>
                  {availableLots.map(lot => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_number} - {lot.producer}
                    </option>
                  ))}
                </select>
              </div>

              {selectedLot && (
                <div className="p-4 bg-brand-50 rounded-lg border border-brand-200">
                  <h3 className="font-bold text-brand-900 mb-3">Detalles del Lote</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-brand-700 font-semibold">{selectedLot.total_kg || 0}</p>
                      <p className="text-xs text-brand-600">Total de Kg</p>
                    </div>
                    <div>
                      <p className="text-brand-700 font-semibold">{selectedLot.field_box_pallets || 0}</p>
                      <p className="text-xs text-brand-600">Tarimas Caja Campo</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-brand-600">Productor: <strong>{selectedLot.producer}</strong></p>
                      <p className="text-xs text-brand-600">Huerta: <strong>{selectedLot.orchard_name}</strong></p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {selectedLot && (
            <section className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">📊 Selección por Calibres</h2>
                <div className="flex gap-2">
                  <select
                    value={selectedPalletType}
                    onChange={(e) => setSelectedPalletType(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  >
undefined
                  </select>
                </div>
              </div>

              <div className="mb-6 space-y-4">
                {[
                  { label: 'CLASE A', items: CALIBERS_CLASE_A },
                  { label: 'CLASE B', items: CALIBERS_CLASE_B }
                ].map(group => (
                  <div key={group.label}>
                    <p className="text-xs font-bold text-slate-600 uppercase mb-2">{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map(caliber => (
                        <button
                          key={caliber}
                          onClick={() => handleAddCaliberRow(caliber, group.label === 'CLASE A' ? 'A' : 'B')}
                          className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-brand-100 hover:text-brand-700 transition-colors"
                        >
                          + {caliber}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {selectionTable.length > 0 ? (
                <>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-bold text-slate-700">Calibre</th>
                          <th className="px-4 py-3 text-left font-bold text-slate-700">Clase</th>
                          <th className="px-4 py-3 text-center font-bold text-slate-700">Cajas 10kg</th>
                          <th className="px-4 py-3 text-center font-bold text-slate-700">Cajas 6kg</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-700">Total kg</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-700">%</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-700">Precio/kg</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-700">Total $</th>
                          <th className="px-4 py-3 text-center font-bold text-slate-700">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectionTable.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-900">{row.caliber}</td>
                            <td className="px-4 py-3">
                              <select
                                value={row.class}
                                onChange={(e) => handleUpdateRow(row.id, 'class', e.target.value)}
                                className="px-2 py-1 rounded border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                              >
                                {CLASS_OPTIONS.map((opt, i) => (
                                  <option key={`class-${i}`} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                value={row.boxes_10kg}
                                onChange={(e) => handleUpdateRow(row.id, 'boxes_10kg', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-sm text-center focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                value={row.boxes_6kg}
                                onChange={(e) => handleUpdateRow(row.id, 'boxes_6kg', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-sm text-center focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{row.total_kg}</td>
                            <td className="px-4 py-3 text-right font-semibold text-brand-600">{row.percentage}%</td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.band_price}
                                onChange={(e) => handleUpdateRow(row.id, 'band_price', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-sm text-right focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">${parseFloat(parseFloat(row.total_price) || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleRemoveRow(row.id)}
                                className="text-red-600 hover:text-red-800 font-medium text-sm"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-bold">
                          <td colSpan="4" className="px-4 py-3 text-right">TOTALES:</td>
                          <td className="px-4 py-3 text-right text-slate-900">{totalKgProcessed} kg</td>
                          <td className="px-4 py-3 text-right text-brand-600">100%</td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right text-slate-900">${parseFloat(totalPrice || 0).toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Process, Waste, Shrinkage Section */}
                  <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <label className="text-sm font-semibold text-slate-700 mb-2">Proceso</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={processWasteShrinkage.process_kg}
                          onChange={(e) => setProcessWasteShrinkage(prev => ({
                            ...prev,
                            process_kg: parseFloat(e.target.value) || 0
                          }))}
                          placeholder="kg"
                          className="px-3 py-2 rounded border border-orange-300 text-sm text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm font-semibold text-slate-700 mb-2">Desecho</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={processWasteShrinkage.waste_kg}
                          onChange={(e) => setProcessWasteShrinkage(prev => ({
                            ...prev,
                            waste_kg: parseFloat(e.target.value) || 0
                          }))}
                          placeholder="kg"
                          className="px-3 py-2 rounded border border-orange-300 text-sm text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm font-semibold text-slate-700 mb-2">Merma</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={processWasteShrinkage.shrinkage_kg}
                          onChange={(e) => setProcessWasteShrinkage(prev => ({
                            ...prev,
                            shrinkage_kg: parseFloat(e.target.value) || 0
                          }))}
                          placeholder="kg"
                          className="px-3 py-2 rounded border border-orange-300 text-sm text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>Haz clic en los calibres arriba para agregar filas a la tabla</p>
                </div>
              )}
            </section>
          )}

          {selectedLot && selectionTable.length > 0 && (
            <section className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">📦 Salida de Tarimas & Etiquetas Térmicas</h2>
                <button
                  onClick={handleAddPalletOutput}
                  className="px-4 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 transition-colors"
                >
                  + Agregar Fila
                </button>
              </div>

              {palletOutput.length > 0 ? (
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-slate-700">Tipo Tarima</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-700">Calibre</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700">Clase</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700">Cantidad Tarimas</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-700">Fecha Empaque</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-700">Fecha Frío</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {palletOutput.map(output => (
                        <tr key={output.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <select
                              value={output.pallet_type}
                              onChange={(e) => handleUpdatePalletOutput(output.id, 'pallet_type', e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                            >
                              {PALLET_TYPES.map((type, i) => (
                                <option key={`pallet-output-${i}`} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={output.caliber}
                              onChange={(e) => handleUpdatePalletOutput(output.id, 'caliber', e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                            >
                              {selectionTable.map((row, idx) => (
                                <option key={`caliber-${idx}`} value={row.caliber}>
                                  {row.caliber}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <select
                              value={output.class}
                              onChange={(e) => handleUpdatePalletOutput(output.id, 'class', e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                            >
                              {CLASS_OPTIONS.map((opt, i) => (
                                <option key={`class-pallet-${i}`} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              value={output.pallet_count}
                              onChange={(e) => handleUpdatePalletOutput(output.id, 'pallet_count', parseInt(e.target.value))}
                              className="w-full px-2 py-1 rounded border border-slate-200 text-sm text-center focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={output.packing_date}
                              onChange={(e) => handleUpdatePalletOutput(output.id, 'packing_date', e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={output.cold_date}
                              onChange={(e) => handleUpdatePalletOutput(output.id, 'cold_date', e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleRemovePalletOutput(output.id)}
                              className="text-red-600 hover:text-red-800 font-medium text-sm"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>Haz clic en "Agregar Fila" para especificar salida de tarimas</p>
                </div>
              )}

              {palletOutput.length > 0 && (
                <div className="flex gap-4 pt-6 border-t border-slate-200">
                  <button
                    onClick={handlePrintThermalLabels}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? '⏳ Generando...' : '🖨️ Generar Etiquetas Térmicas'}
                  </button>
                  <button
                    onClick={handleSaveProduction}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? '⏳ Guardando...' : '✅ Guardar Producción'}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          Tecavo Fruits Soft &copy; 2024. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
