'use client';

import { useEffect, useState } from 'react';
import { Download, Plus, Copy, Check, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function BarcodeGeneratorPage() {
  const [lots, setLots] = useState([]);
  const [barcodes, setBarcodes] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitType, setUnitType] = useState('boxes');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    fetchLots();
    fetchBarcodes();
  }, []);

  const fetchLots = async () => {
    try {
      const res = await fetch('/api/lots');
      const data = await res.json();
      setLots(data || []);
    } catch (error) {
      console.error('Error fetching lots:', error);
    }
  };

  const fetchBarcodes = async () => {
    try {
      const res = await fetch('/api/barcodes/generate');
      const data = await res.json();
      setBarcodes(data || []);
    } catch (error) {
      console.error('Error fetching barcodes:', error);
    }
  };

  const handleGenerateBarcode = async (e) => {
    e.preventDefault();
    if (!selectedLotId) {
      alert('Por favor selecciona un lote');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/barcodes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: parseInt(selectedLotId),
          quantity: parseInt(quantity),
          unit_type: unitType
        })
      });

      if (res.ok) {
        const newBarcode = await res.json();
        setBarcodes([newBarcode, ...barcodes]);
        setSelectedLotId('');
        setQuantity(1);
        alert('Código de barras generado exitosamente');
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al generar código de barras');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadBarcodesAsCSV = () => {
    let csvContent = 'Lote,Código de Barras,Tipo,Cantidad,Unidad,Fecha Generada\n';
    
    barcodes.forEach(bc => {
      const lot = lots.find(l => l.id === bc.lot_id);
      csvContent += `${lot?.lot_number || 'N/A'},${bc.barcode_code},${bc.barcode_type},${bc.quantity},${bc.unit_type},${new Date(bc.generated_date).toLocaleDateString('es-MX')}\n`;
    });

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', `barcodes-${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Generador de Códigos de Barras</h1>
          <p className="text-slate-500 mt-2">Crea códigos de barras únicos para cada lote de inventario</p>
        </div>

        {/* Generate Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
          <form onSubmit={handleGenerateBarcode} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Lot Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Selecciona un Lote
                </label>
                <select
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="">-- Selecciona un lote --</option>
                  {lots.map(lot => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_number} - {lot.producer}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              {/* Unit Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de Unidad
                </label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="boxes">Cajas</option>
                  <option value="pallets">Tarimas</option>
                  <option value="kg">Kilos</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  {loading ? 'Generando...' : 'Generar Código'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Barcodes List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">Códigos Generados ({barcodes.length})</h2>
            <button
              onClick={downloadBarcodesAsCSV}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
              <Download size={18} />
              Descargar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Lote</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Código de Barras</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">QR</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {barcodes.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                      <QrCode size={40} className="mx-auto mb-3 opacity-50" />
                      <p>No hay códigos de barras generados aún</p>
                    </td>
                  </tr>
                ) : (
                  barcodes.map(bc => {
                    const lot = lots.find(l => l.id === bc.lot_id);
                    return (
                      <tr key={bc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-900">{lot?.lot_number || 'N/A'}</span>
                          <p className="text-xs text-slate-500">{lot?.producer}</p>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-sm bg-slate-100 px-3 py-1 rounded font-mono text-slate-900">
                            {bc.barcode_code}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                            {bc.quantity} {bc.unit_type === 'boxes' ? 'cajas' : bc.unit_type === 'pallets' ? 'tarimas' : 'kg'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            <QRCodeCanvas 
                              value={bc.barcode_code} 
                              size={64}
                              level="H"
                              includeMargin={false}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-500">
                            {new Date(bc.generated_date).toLocaleDateString('es-MX')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => copyToClipboard(bc.barcode_code)}
                            className="px-3 py-2 text-slate-600 hover:text-slate-900 transition-colors inline-flex items-center gap-2"
                          >
                            {copied === bc.barcode_code ? (
                              <><Check size={18} /> Copiado</>
                            ) : (
                              <><Copy size={18} /> Copiar</>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
