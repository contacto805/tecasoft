'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function FruitInputMobilePage() {
  const router = useRouter();
  
  const [scanStatus, setScanStatus] = useState(false);
  const [scanResults, setScanResults] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [huerto, setHuerto] = useState('');
  const [peso, setPeso] = useState('');
  const [fecha, setFecha] = useState('');
  const [syncStatus, setSyncStatus] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const scanQR = () => {
    setScanStatus(true);
    setIsScanning(true);
    
    setTimeout(() => {
      setScanStatus(false);
      setScanResults(true);
      setIsScanning(false);
      
      setHuerto('Huerto La Loma');
      setPeso('1450');
      setFecha(new Date().toISOString().split('T')[0]);
    }, 2000);
  };

  const syncToSystem = () => {
    setIsSyncing(true);
    
    setTimeout(() => {
      setSyncStatus(true);
      setIsSyncing(false);
      
      setTimeout(() => {
        setSyncStatus(false);
        setHuerto('');
        setPeso('');
        setScanResults(false);
      }, 2000);
    }, 1500);
  };

    return (
      <>
        <div className="min-h-screen flex flex-col font-sans">
          {/* Mobile Header */}
    <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <img src="/logo.svg" alt="Tecavo" className="w-6 h-6" />
                </div>
                <span className="font-bold text-base">Tecavo Mobile</span>
            </div>
            <div className="text-xs bg-white/20 px-3 py-1.5 rounded-full font-medium">
                <i className="ph ph-wifi-high"></i> Conectado
            </div>
        </div>
    </header>

    <main className="flex-1 p-4 space-y-4">
        
        {/* Scan Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-5 border border-white/20">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <i className="ph ph-scan text-xl"></i>
                Escanear Báscula
            </h2>
            
            <div className="scanner-frame mb-4">
                <div className="scanner-line"></div>
                <i className="ph ph-qr-code text-6xl text-white/40"></i>
            </div>
            
            <button onClick={scanQR} disabled={isScanning} className="w-full py-3.5 bg-white text-emerald-700 font-semibold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-50 transition-all disabled:opacity-50">
                {isScanning ? (
                    <>
                        <i className="ph ph-circle-notch animate-spin text-xl"></i>
                        Escaneando...
                    </>
                ) : (
                    <>
                        <i className="ph ph-qr-code text-xl"></i>
                        Escanear Código QR
                    </>
                )}
            </button>
            
            {/* Scanning Status */}
            {scanStatus && (
                <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-center">
                    <i className="ph ph-circle-notch animate-spin text-xl"></i>
                    <p className="text-sm font-medium mt-1">Leyendo datos de báscula...</p>
                </div>
            )}
            
            {/* Scan Results */}
            {scanResults && (
                <div className="mt-4 p-4 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
                    <div className="flex items-center gap-2 text-emerald-300 mb-2">
                        <i className="ph ph-check-circle text-xl"></i>
                        <span className="font-semibold">Código Leído Exitosamente</span>
                    </div>
                    <div className="text-xs text-emerald-200/80">
                        <p>Folio: <span className="font-mono font-bold">#AGU-2024-047</span></p>
                        <p>Báscula ID: <span className="font-mono">BSC-001</span></p>
                    </div>
                </div>
            )}
        </div>

        {/* Form Section */}
        <div className="bg-white rounded-2xl p-5 shadow-xl">
            <h2 className="font-bold text-lg text-slate-900 mb-4">Datos del Ingreso</h2>
            
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Tipo de Fruta</label>
                    <select className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                        <option>🥑 Aguacate Hass</option>
                        <option>🥑 Aguacate Mendez</option>
                    </select>
                </div>
                
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Huerto de Origen</label>
                    <input type="text" value={huerto} onChange={(e) => setHuerto(e.target.value)} placeholder="Ej. Huerto La Loma" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                </div>
                
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Peso Bruto (kg)</label>
                    <input type="number" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-2xl font-bold text-emerald-700" />
                </div>
                
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Fecha de Entrada</label>
                    <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                </div>
            </div>
            
            {/* Sync Status */}
            {syncStatus && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <i className="ph ph-check-circle text-2xl text-emerald-600"></i>
                    <p className="text-sm font-semibold text-emerald-700 mt-1">✓ Sincronizado con Sistema Central</p>
                </div>
            )}
            
            <button onClick={syncToSystem} disabled={isSyncing} className="w-full mt-5 py-3.5 bg-emerald-600 text-white font-semibold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50">
                {isSyncing ? (
                    <>
                        <i className="ph ph-circle-notch animate-spin text-lg"></i>
                        Sincronizando...
                    </>
                ) : (
                    <>
                        <i className="ph ph-cloud-arrow-up text-lg"></i>
                        Sincronizar con Sistema
                    </>
                )}
            </button>
        </div>

        {/* Recent Syncs */}
        <div className="bg-white rounded-2xl p-5 shadow-xl">
            <h2 className="font-bold text-lg text-slate-900 mb-4">Últimas Sincronizaciones</h2>
            
            <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <i className="ph-fill ph-check text-emerald-600"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900">#AGU-2024-046</p>
                        <p className="text-xs text-slate-500">Huerto El Sol • 1,250 kg</p>
                    </div>
                    <span className="text-xs text-slate-400">12:45</span>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <i className="ph-fill ph-check text-emerald-600"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900">#AGU-2024-045</p>
                        <p className="text-xs text-slate-500">Huerto Las Palmas • 980 kg</p>
                    </div>
                    <span className="text-xs text-slate-400">11:20</span>
                </div>
            </div>
        </div>

    </main>

    {/* Bottom Navigation */}
    <nav className="bg-white border-t border-slate-200 px-4 py-3">
        <div className="flex items-center justify-around">
            <button className="flex flex-col items-center gap-1 text-emerald-600">
                <i className="ph-fill ph-scan text-2xl"></i>
                <span className="text-xs font-medium">Escanear</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-slate-400">
                <i className="ph ph-clock-clockwise text-2xl"></i>
                <span className="text-xs font-medium">Historial</span>
            </button>
            <button onClick={() => router.push('/fruit-input')} className="flex flex-col items-center gap-1 text-slate-400">
                <i className="ph ph-desktop text-2xl"></i>
                <span className="text-xs font-medium">Ver PC</span>
            </button>
        </div>
    </nav>
        </div>
      </>
    );
}
