'use client';

import React, { useState } from 'react';

export default function PortalTransportistas() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const entrar = async () => {
    if (!name.trim() || pin.length !== 6) { setError('Nombre transportista y PIN 6 dígitos'); return; }
    setLoading(true); setError('');
    try {
      const l = await fetch('/api/transporter-portal/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ transporterName: name.trim(), pin }) });
      const lj = await l.json();
      if (!l.ok || !lj.success) { setError(lj.error || 'Acceso denegado'); setLoading(false); return; }
      const d = await fetch('/api/transporter-portal/auth/me');
      const dj = await d.json();
      setData(dj);
    } catch (e) { setError('Error de conexión'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6 pt-8">
          <div className="text-emerald-700 text-xs tracking-[3px] font-semibold">TECAVO FRUITS</div>
          <div className="text-2xl font-semibold tracking-tighter mt-1">Portal Transportistas</div>
          <div className="text-sm text-slate-500 mt-1">Acceso seguro con nombre + PIN</div>
        </div>

        {!data && (
          <div className="bg-white rounded-3xl border p-6">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="NOMBRE TRANSPORTISTA / DRIVER" className="w-full border px-4 py-3 rounded-2xl text-center" />
            <input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="PIN 6 DÍGITOS" className="w-full border px-4 py-3 mt-2 rounded-2xl text-center font-mono tracking-[6px]" maxLength={6} />
            <button onClick={entrar} disabled={loading || !name.trim() || pin.length!==6} className="mt-3 w-full py-3 bg-emerald-800 text-white rounded-2xl font-medium disabled:bg-slate-300">{loading ? 'Verificando...' : 'INGRESAR'}</button>
            {error && <div className="text-red-600 text-xs mt-2 text-center">{error}</div>}
            <div className="text-[10px] text-center text-slate-400 mt-4">Solo tus viajes, fletes y evidencias. Datos por referencia.</div>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border p-5">
              <div className="text-xs text-emerald-700">TRANSPORTISTA</div>
              <div className="text-xl font-semibold">{data.transporter}</div>
            </div>
            <div className="bg-white rounded-3xl border p-5">
              <div className="font-semibold mb-2">Fletes</div>
              {(data.freights||[]).length === 0 && <div className="text-sm text-slate-500">Sin registros.</div>}
              {(data.freights||[]).slice(0,5).map((f,i)=>(<div key={i} className="text-sm border-t py-1">{f.freight_date} • {f.driver_name} • ${f.freight_amount}</div>))}
            </div>
            <div className="bg-white rounded-3xl border p-5">
              <div className="font-semibold mb-2">Viajes / Evidencias</div>
              {(data.viajes||[]).length === 0 && <div className="text-sm text-slate-500">Sin registros.</div>}
              {(data.viajes||[]).slice(0,5).map((v,i)=>(<div key={i} className="text-sm border-t py-1">{v.fecha_salida} • {v.folio} • {v.transportista}</div>))}
            </div>
            <button onClick={()=>{setData(null);setName('');setPin('');}} className="w-full py-2 border rounded-2xl">Salir</button>
            <div className="text-center text-[10px] text-slate-400">Datos conectados por ID a fuentes internas. Sin duplicados.</div>
          </div>
        )}
      </div>
    </div>
  );
}
