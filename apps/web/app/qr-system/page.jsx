'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Plus, Scan, Copy, Check, QrCode, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function QRSystemPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('generate');
  const [lots, setLots] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [boxes, setBoxes] = useState([]);
  
  // Generate Tab
  const [selectedLot, setSelectedLot] = useState('');
  const [qrType, setQrType] = useState('lot');
  const [quantity, setQuantity] = useState(1);
  const [generatedQRs, setGeneratedQRs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  // Scan Tab
  const videoRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    loadLots();
    loadMaterials();
    loadBoxes();
  }, []);

  const loadLots = async () => {
    try {
      const res = await fetch('/api/lots');
      if (res.ok) {
        const data = await res.json();
        setLots(data);
      }
    } catch (error) {
      console.error('Error loading lots:', error);
    }
  };

  const loadMaterials = async () => {
    try {
      const res = await fetch('/api/materials');
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };

  const loadBoxes = async () => {
    try {
      const res = await fetch('/api/box-control');
      if (res.ok) {
        const data = await res.json();
        setBoxes(data);
      }
    } catch (error) {
      console.error('Error loading boxes:', error);
    }
  };

  const generateQR = async () => {
    if (!selectedLot && qrType === 'lot') {
      alert('Selecciona un lote');
      return;
    }

    setLoading(true);
    try {
      const qrValue = qrType === 'lot' 
        ? `LOT-${lots.find(l => l.id == selectedLot)?.lot_number}-${Date.now()}`
        : `${qrType.toUpperCase()}-${Date.now()}`;

      const newQR = {
        id: Date.now(),
        value: qrValue,
        type: qrType,
        quantity: parseInt(quantity),
        generatedAt: new Date().toLocaleString('es-MX'),
        lotNumber: qrType === 'lot' ? lots.find(l => l.id == selectedLot)?.lot_number : null
      };

      setGeneratedQRs([newQR, ...generatedQRs]);
      setQuantity(1);
      alert('Código QR generado exitosamente');
    } catch (error) {
      console.error('Error generating QR:', error);
      alert('Error al generar QR');
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = async (qr, format = 'png') => {
    try {
      const qrElement = document.querySelector(`#qr-${qr.id} canvas`);
      if (!qrElement) return;

      const canvas = qrElement;
      
      if (format === 'png') {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `QR-${qr.value.replace(/\//g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === 'pdf') {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [100, 100]
        });
        pdf.addImage(imgData, 'PNG', 10, 10, 80, 80);
        pdf.save(`QR-${qr.value.replace(/\//g, '-')}.pdf`);
      }
    } catch (error) {
      console.error('Error downloading QR:', error);
      alert('Error al descargar QR. Intenta de nuevo.');
    }
  };

  const copyQRValue = (value) => {
    navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 2000);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('No se puede acceder a la cámara');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  const handleManualScan = (e) => {
    e.preventDefault();
    if (scannedData.trim()) {
      addScannedItem(scannedData.trim());
      setScannedData('');
    }
  };

  const addScannedItem = (data) => {
    const newItem = {
      id: Date.now(),
      qrValue: data,
      scannedAt: new Date().toLocaleString('es-MX'),
      type: identifyQRType(data),
      quantity: 1
    };
    setScannedItems([newItem, ...scannedItems]);
  };

  const identifyQRType = (value) => {
    if (value.startsWith('LOT-')) return 'lote';
    if (value.startsWith('BOX-')) return 'caja';
    if (value.startsWith('MAT-')) return 'material';
    return 'desconocido';
  };

  const removeScannedItem = (id) => {
    setScannedItems(scannedItems.filter(item => item.id !== id));
  };

  const exportScannedItems = () => {
    const csv = [
      ['Tipo', 'Código QR', 'Cantidad', 'Fecha/Hora'],
      ...scannedItems.map(item => [
        item.type,
        item.qrValue,
        item.quantity,
        item.scannedAt
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escaneo-qr-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen pt-20 pb-10 bg-slate-50">
      <header className="fixed top-0 left-0 right-0 w-full z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-brand-700">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center border border-brand-500/20">
                <img src="/logo.svg" alt="Tecavo" className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
            </div>
          </div>
          <button onClick={() => router.push('/')} className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm">
            Volver al Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Sistema de Códigos QR</h1>
          <p className="text-slate-500 mt-2">Genera, escanea y gestiona códigos QR para lotes, cajas e inventarios</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white p-1 rounded-lg border border-slate-200 w-fit">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-6 py-3 font-medium rounded-lg transition-colors ${
              activeTab === 'generate'
                ? 'bg-brand-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <QrCode size={18} className="inline mr-2" />
            Generar QR
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`px-6 py-3 font-medium rounded-lg transition-colors ${
              activeTab === 'scan'
                ? 'bg-brand-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Scan size={18} className="inline mr-2" />
            Escanear QR
          </button>
        </div>

        {/* GENERATE TAB */}
        {activeTab === 'generate' && (
          <div className="space-y-8">
            {/* Generator Form */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Generar Nuevos Códigos QR</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* QR Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">Tipo de Código QR</label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setQrType('lot')}
                      className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                        qrType === 'lot'
                          ? 'border-brand-600 bg-brand-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-semibold text-slate-900">📦 Lotes</p>
                      <p className="text-xs text-slate-500">Para trazabilidad de lotes de fruta</p>
                    </button>
                    <button
                      onClick={() => setQrType('box')}
                      className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                        qrType === 'box'
                          ? 'border-brand-600 bg-brand-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-semibold text-slate-900">📍 Cajas de Campo</p>
                      <p className="text-xs text-slate-500">Para control de cajas en movimiento</p>
                    </button>
                    <button
                      onClick={() => setQrType('material')}
                      className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                        qrType === 'material'
                          ? 'border-brand-600 bg-brand-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-semibold text-slate-900">📦 Materiales</p>
                      <p className="text-xs text-slate-500">Para inventario de empaque</p>
                    </button>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {qrType === 'lot' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Selecciona Lote *</label>
                      <select
                        value={selectedLot}
                        onChange={(e) => setSelectedLot(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      >
                        <option value="">-- Selecciona un lote --</option>
                        {lots.map(lot => (
                          <option key={lot.id} value={lot.id}>
                            {lot.lot_number} - {lot.producer}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Cantidad de QRs</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>

                  <button
                    onClick={generateQR}
                    disabled={loading || (qrType === 'lot' && !selectedLot)}
                    className="w-full px-6 py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={20} />
                    {loading ? 'Generando...' : 'Generar QR'}
                  </button>
                </div>
              </div>
            </div>

            {/* Generated QRs Display */}
            {generatedQRs.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Códigos Generados ({generatedQRs.length})</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {generatedQRs.map(qr => (
                    <div key={qr.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      {/* QR Code */}
                      <div id={`qr-${qr.id}`} className="bg-white p-4 rounded-lg border border-slate-100 mb-4 flex justify-center">
                        <QRCodeCanvas
                          value={qr.value}
                          size={200}
                          level="H"
                          includeMargin={true}
                        />
                      </div>

                      {/* Info */}
                      <div className="space-y-2 mb-4">
                        <p className="text-xs text-slate-500 uppercase font-bold">Tipo: {qr.type}</p>
                        <p className="text-sm font-mono bg-slate-50 p-2 rounded break-all text-slate-700">{qr.value}</p>
                        {qr.lotNumber && (
                          <p className="text-xs text-slate-600"><strong>Lote:</strong> {qr.lotNumber}</p>
                        )}
                        <p className="text-xs text-slate-400">{qr.generatedAt}</p>
                      </div>

                      {/* Actions */}
                      <div className="space-y-2">
                        <button
                          onClick={() => copyQRValue(qr.value)}
                          className="w-full px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                        >
                          {copied === qr.value ? (
                            <><Check size={16} /> Copiado</>
                          ) : (
                            <><Copy size={16} /> Copiar</>
                          )}
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => downloadQR(qr, 'png')}
                            className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <Download size={14} /> PNG
                          </button>
                          <button
                            onClick={() => downloadQR(qr, 'pdf')}
                            className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <Download size={14} /> PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCAN TAB */}
        {activeTab === 'scan' && (
          <div className="space-y-8">
            {/* Scanner Section */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Escanear Códigos QR</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Camera */}
                <div>
                  <div className="bg-slate-900 rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '1' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className={`w-full h-full object-cover ${!cameraActive ? 'hidden' : ''}`}
                    />
                    {!cameraActive && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center text-slate-400">
                          <Scan size={48} className="mx-auto mb-2 opacity-50" />
                          <p>Activa la cámara para escanear</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {!cameraActive ? (
                      <button
                        onClick={startCamera}
                        className="flex-1 px-6 py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Scan size={20} />
                        Activar Cámara
                      </button>
                    ) : (
                      <button
                        onClick={stopCamera}
                        className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                      >
                        Detener
                      </button>
                    )}
                  </div>
                </div>

                {/* Manual Input */}
                <div>
                  <form onSubmit={handleManualScan} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Ingresa el código manualmente</label>
                      <input
                        type="text"
                        value={scannedData}
                        onChange={(e) => setScannedData(e.target.value)}
                        placeholder="Coloca el foco aquí y escanea"
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!scannedData.trim()}
                      className="w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={20} />
                      Agregar al Registro
                    </button>
                  </form>

                  {/* Stats */}
                  <div className="mt-6 space-y-3">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-600 font-medium">TOTAL ESCANEADO</p>
                      <p className="text-2xl font-bold text-blue-900">{scannedItems.length}</p>
                    </div>
                    {scannedItems.length > 0 && (
                      <button
                        onClick={exportScannedItems}
                        className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <Download size={18} />
                        Exportar CSV
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Scanned Items */}
            {scannedItems.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Elementos Escaneados</h2>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Tipo</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Código QR</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-700">Cantidad</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Hora</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-700">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scannedItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                              item.type === 'lote' ? 'bg-blue-100 text-blue-700' :
                              item.type === 'caja' ? 'bg-purple-100 text-purple-700' :
                              item.type === 'material' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.qrValue}</td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => setScannedItems(
                                scannedItems.map(i => i.id === item.id ? {...i, quantity: parseInt(e.target.value)} : i)
                              )}
                              className="w-12 px-2 py-1 border border-slate-300 rounded text-center"
                            />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{item.scannedAt}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => removeScannedItem(item.id)}
                              className="px-3 py-1 text-red-600 hover:bg-red-50 rounded font-medium text-sm"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
