'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function LotSelectionPage() {
  const router = useRouter();
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selections, setSelections] = useState([
    { caliber: '', percentage: '', pricePerCaliber: '' }
  ]);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [editingLotId, setEditingLotId] = useState(null);

  // Load lots
  useEffect(() => {
    const loadLots = async () => {
      try {
        const response = await fetch('/api/lot-selection');
        const data = await response.json();
        setLots(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading lots:', error);
        setLots([]);
      } finally {
        setLoading(false);
      }
    };
    loadLots();
  }, []);

  // Load selection data when lot is selected
  useEffect(() => {
    if (selectedLot) {
      loadSelectionData(selectedLot.id);
    }
  }, [selectedLot]);

  const loadSelectionData = async (lotId) => {
    try {
      const response = await fetch(`/api/lot-selection?lotId=${lotId}`);
      const data = await response.json();
      
      if (data.results.length > 0) {
        setSelections(data.results.map(r => ({
          caliber: r.caliber,
          percentage: r.percentage.toString(),
          pricePerCaliber: r.price_per_caliber.toString()
        })));
      } else {
        setSelections([{ caliber: '', percentage: '', pricePerCaliber: '' }]);
      }

      if (data.summary) {
        setPurchasePrice(data.summary.purchase_price.toString());
      }
    } catch (error) {
      console.error('Error loading selection data:', error);
    }
  };

  const handleAddField = () => {
    setSelections([...selections, { caliber: '', percentage: '', pricePerCaliber: '' }]);
  };

  const handleRemoveField = (index) => {
    if (selections.length > 1) {
      setSelections(selections.filter((_, i) => i !== index));
    }
  };

  const handleSelectionChange = (index, field, value) => {
    const newSelections = [...selections];
    newSelections[index][field] = value;
    setSelections(newSelections);
  };

  const calculateTotalPrice = () => {
    return selections.reduce((total, sel) => {
      const percentage = parseFloat(sel.percentage) || 0;
      const price = parseFloat(sel.pricePerCaliber) || 0;
      return total + (percentage / 100) * price;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedLot) {
      alert('Por favor selecciona un lote');
      return;
    }

    if (!purchasePrice) {
      alert('Por favor ingresa el precio de compra');
      return;
    }

    if (selections.some(s => !s.caliber || !s.percentage || !s.pricePerCaliber)) {
      alert('Por favor completa todos los campos de selección');
      return;
    }

    // Verify percentages sum to 100
    const totalPercentage = selections.reduce((sum, s) => sum + (parseFloat(s.percentage) || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert('Los porcentajes deben sumar 100%');
      return;
    }

    setSubmitting(true);
    try {
      const method = editingLotId ? 'PUT' : 'POST';
      const response = await fetch('/api/lot-selection', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: selectedLot.id,
          selections,
          purchasePrice: parseFloat(purchasePrice)
        })
      });

      const data = await response.json();
      setResult({
        totalPrice: data.totalPriceObtained,
        purchasePrice: parseFloat(purchasePrice),
        status: data.incentiveStatus,
        message: data.message
      });
      setEditingLotId(selectedLot.id);
    } catch (error) {
      console.error('Error submitting selection:', error);
      alert('Error al guardar la selección');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPriceObtained = calculateTotalPrice();
  const totalPercentage = selections.reduce((sum, s) => sum + (parseFloat(s.percentage) || 0), 0);

  return (
    <>
      <div className="min-h-screen flex flex-col font-sans">
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
                <button onClick={() => router.push('/fruit-input')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                  Ingreso de Fruta
                </button>
                <button className="px-4 py-2 rounded-lg bg-brand-50 text-brand-700 font-medium text-sm transition-colors cursor-default">
                  Resultado de Selección
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
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Resultado de Selección de Lotes</h1>
                <p className="text-slate-500 mt-1">Registra la segmentación de cada lote por calibres, establece porcentajes y precios para calcular el resultado final.</p>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Lots List Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-24">
                  <h2 className="font-bold text-lg text-slate-900 mb-4">Lotes Disponibles</h2>
                  
                  {loading ? (
                    <div className="text-center py-8 text-slate-500">Cargando lotes...</div>
                  ) : lots.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      <i className="ph ph-inbox text-3xl block mb-2"></i>
                      No hay lotes registrados
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {lots.map((lot) => (
                        <button
                          key={lot.id}
                          onClick={() => setSelectedLot(lot)}
                          className={`w-full p-3 rounded-lg text-left transition-all ${
                            selectedLot?.id === lot.id
                              ? 'bg-brand-50 border border-brand-300 shadow-sm'
                              : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          <div className="font-semibold text-slate-900">{lot.lot_number}</div>
                          <div className="text-xs text-slate-600 mt-1">{lot.producer}</div>
                          <div className="text-xs text-slate-500">{lot.fruit_type}</div>
                          {lot.incentive_status && (
                            <div className={`text-xs font-medium mt-2 px-2 py-1 rounded ${
                              lot.incentive_status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {lot.incentive_status === 'approved' ? '✓ Comisión' : '✗ Sin comisión'}
                            </div>
                          )}
                        </button>
                      ))}
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

                    {/* Selection Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Purchase Price */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="font-bold text-lg text-slate-900 mb-4">Precio de Compra</h2>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Precio de compra por kg</label>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-semibold">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={purchasePrice}
                              onChange={(e) => setPurchasePrice(e.target.value)}
                              placeholder="0.00"
                              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Segmentation Fields */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="font-bold text-lg text-slate-900">Segmentación por Calibre</h2>
                          <button
                            type="button"
                            onClick={handleAddField}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <i className="ph ph-plus"></i>
                            Agregar Calibre
                          </button>
                        </div>

                        <div className="space-y-4">
                          {selections.map((selection, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Calibre</label>
                                <input
                                  type="text"
                                  value={selection.caliber}
                                  onChange={(e) => handleSelectionChange(index, 'caliber', e.target.value)}
                                  placeholder="Ej. Extra, Jumbo"
                                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Porcentaje (%)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={selection.percentage}
                                  onChange={(e) => handleSelectionChange(index, 'percentage', e.target.value)}
                                  placeholder="0.00"
                                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Precio ($/kg)</label>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-600">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={selection.pricePerCaliber}
                                    onChange={(e) => handleSelectionChange(index, 'pricePerCaliber', e.target.value)}
                                    placeholder="0.00"
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                  />
                                </div>
                              </div>

                              <div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveField(index)}
                                  disabled={selections.length === 1}
                                  className={`w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                                    selections.length === 1
                                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                                  }`}
                                >
                                  <i className="ph ph-trash"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Percentage Status */}
                        <div className={`mt-4 p-4 rounded-lg ${
                          Math.abs(totalPercentage - 100) < 0.01
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-red-50 border border-red-200'
                        }`}>
                          <div className="text-sm font-medium">
                            Total porcentaje: <span className={Math.abs(totalPercentage - 100) < 0.01 ? 'text-green-700' : 'text-red-700'}>
                              {totalPercentage.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="font-bold text-lg text-slate-900 mb-6">Resumen de Cálculo</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-xs text-slate-600 uppercase font-semibold">Precio de Compra</div>
                            <div className="text-2xl font-bold text-slate-900 mt-2">${purchasePrice ? parseFloat(purchasePrice).toFixed(2) : '0.00'}</div>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-xs text-slate-600 uppercase font-semibold">Precio Obtenido (Promedio)</div>
                            <div className="text-2xl font-bold text-slate-900 mt-2">${totalPriceObtained.toFixed(2)}</div>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-xs text-slate-600 uppercase font-semibold">Diferencia</div>
                            <div className={`text-2xl font-bold mt-2 ${
                              totalPriceObtained >= parseFloat(purchasePrice || 0)
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}>
                              ${(totalPriceObtained - parseFloat(purchasePrice || 0)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 font-bold transition-colors"
                      >
                        {submitting ? 'Procesando...' : 'Guardar Resultado de Selección'}
                      </button>
                    </form>

                    {/* Result Modal */}
                    {result && (
                      <div className={`p-6 rounded-2xl border-2 shadow-sm ${
                        result.status === 'approved'
                          ? 'bg-green-50 border-green-300'
                          : 'bg-red-50 border-red-300'
                      }`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                            result.status === 'approved'
                              ? 'bg-green-200'
                              : 'bg-red-200'
                          }`}>
                            <i className={`ph-fill text-2xl ${
                              result.status === 'approved'
                                ? 'ph-check-circle text-green-700'
                                : 'ph-x-circle text-red-700'
                            }`}></i>
                          </div>
                          <div className="flex-1">
                            <h3 className={`font-bold text-lg ${
                              result.status === 'approved'
                                ? 'text-green-900'
                                : 'text-red-900'
                            }`}>
                              {result.status === 'approved' ? '✓ COMISIÓN APROBADA' : '✗ SIN COMISIÓN'}
                            </h3>
                            <p className={`text-sm mt-2 ${
                              result.status === 'approved'
                                ? 'text-green-800'
                                : 'text-red-800'
                            }`}>
                              {result.message}
                            </p>
                            <div className="grid grid-cols-3 gap-4 mt-4">
                              <div>
                                <div className="text-xs uppercase font-semibold text-slate-600">Precio Compra</div>
                                <div className="text-lg font-bold text-slate-900">${result.purchasePrice.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase font-semibold text-slate-600">Precio Obtenido</div>
                                <div className="text-lg font-bold text-slate-900">${result.totalPrice.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase font-semibold text-slate-600">Diferencia</div>
                                <div className={`text-lg font-bold ${
                                  result.totalPrice >= result.purchasePrice
                                    ? 'text-green-700'
                                    : 'text-red-700'
                                }`}>
                                  ${(result.totalPrice - result.purchasePrice).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-96 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-center text-slate-500">
                      <i className="ph ph-clipboard-list text-5xl block mb-3"></i>
                      <p className="font-medium">Selecciona un lote para registrar su resultado de selección</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
