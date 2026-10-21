'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CombustibleEntregaAPK() {
  const router = useRouter();
  const [form, setForm] = useState({
    corredor_nombre: '',
    nombre_entregador: '',
    fecha: new Date().toISOString().slice(0, 10),
    hora: new Date().toTimeString().slice(0, 5),
    monto: '',
    kilometraje: ''
  });
  const [firma, setFirma] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [isSuper, setIsSuper] = useState(false);

  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    checkSuper();
    initCanvas();
  }, []);

  const checkSuper = async () => {
    try {
      const r = await fetch('/api/auth/check-super-admin', { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setIsSuper(!!d.isSuperAdmin);
      }
    } catch {}
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    canvas.width = 520;
    canvas.height = 160;
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDraw = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    drawing.current = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const draw = (e) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const endDraw = () => {
    drawing.current = false;
    const canvas = canvasRef.current;
    setFirma(canvas.toDataURL('image/png'));
  };

  const clearFirma = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFirma('');
  };

  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.corredor_nombre || !form.nombre_entregador || !form.monto || !form.kilometraje) {
      alert('Completa todos los campos obligatorios');
      return;
    }
    if (!firma) {
      alert('Captura la firma del corredor');
      return;
    }
    setEnviando(true);
    setMensaje('');
    try {
      const payload = {
        tipo_registro: 'entrega_dinero',
        corredor_nombre: form.corredor_nombre,
        nombre_entregador: form.nombre_entregador,
        fecha_carga: form.fecha,
        hora_carga: form.hora,
        importe_ticket: parseFloat(form.monto) || 0,
        kilometraje_actual: parseFloat(form.kilometraje) || 0,
        metodo_pago: 'vale',
        estatus: 'pendiente',
        observaciones: `Entrega de dinero/vale - Formato móvil. Entregado por: ${form.nombre_entregador}`,
        firma_corredor: firma,
        creado_por: 'apk-combustible'
      };
      const res = await fetch('/api/combustible/cargas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) {
        setMensaje('Error: ' + data.error);
      } else {
        setMensaje(`✅ Formulario enviado con folio ${data.folio || data.carga?.folio}. Pendiente de aprobación del encargado de combustible.`);
        // reset
        setForm({
          corredor_nombre: '', nombre_entregador: '',
          fecha: new Date().toISOString().slice(0, 10),
          hora: new Date().toTimeString().slice(0, 5),
          monto: '', kilometraje: ''
        });
        clearFirma();
      }
    } catch (e) {
      setMensaje('Error de conexión. Intenta de nuevo.');
    }
    setEnviando(false);
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="max-w-md mx-auto bg-white">
        {/* Header exacto del formato */}
        <div className="bg-emerald-50 border-b p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded bg-white flex items-center justify-center border">
            <span className="text-emerald-700 text-xl">🍐</span>
          </div>
          <div>
            <div className="font-bold text-emerald-800 tracking-wide">TECAVO FRUITS</div>
            <div className="font-extrabold text-xl text-emerald-900 tracking-tight">CONTROL DE COMBUSTIBLE</div>
            <div className="text-[11px] text-emerald-700 -mt-0.5">FORMATO PARA ENTREGA DE DINERO / VALE</div>
          </div>
        </div>

        <div className="p-4 text-[11px] text-slate-500 border-b">
          Llenar a mano y entregar al encargado para su captura en sistema. Este formulario viaja a aprobación.
        </div>

        <div className="p-4 space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1">Nombre del corredor:</label>
            <input value={form.corredor_nombre} onChange={e=>handleChange('corredor_nombre', e.target.value)} className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-lg" placeholder="Nombre completo del corredor" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Nombre de quien entrega dinero / vale:</label>
            <input value={form.nombre_entregador} onChange={e=>handleChange('nombre_entregador', e.target.value)} className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-lg" placeholder="Quien entrega el efectivo o vale" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Fecha:</label>
              <input type="date" value={form.fecha} onChange={e=>handleChange('fecha', e.target.value)} className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-lg" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Hora:</label>
              <input type="time" value={form.hora} onChange={e=>handleChange('hora', e.target.value)} className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-lg" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Monto en dinero entregado / valor del vale: $</label>
            <input type="number" step="0.01" value={form.monto} onChange={e=>handleChange('monto', e.target.value)} className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-2xl font-mono" placeholder="0.00" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Kilometraje al momento de la entrega (km):</label>
            <input type="number" step="0.1" value={form.kilometraje} onChange={e=>handleChange('kilometraje', e.target.value)} className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-2xl font-mono" placeholder="0.0" />
          </div>

          {/* FIRMA */}
          <div className="border-2 border-slate-300 rounded-2xl p-3 bg-emerald-50">
            <div className="font-bold text-center text-emerald-900 mb-2 tracking-wide">FIRMA DEL CORREDOR</div>
            <canvas
              ref={canvasRef}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
              className="bg-white border border-slate-400 rounded-xl w-full touch-none"
              style={{ height: 140 }}
            />
            <div className="flex justify-between mt-2">
              <button onClick={clearFirma} className="text-xs px-3 py-1 border rounded">Borrar firma</button>
              <div className="text-[10px] text-slate-500">Firma de conformidad por la recepción del dinero / vale</div>
            </div>
          </div>

          <button
            onClick={submit}
            disabled={enviando}
            className="w-full py-4 bg-emerald-800 text-white text-lg font-semibold rounded-2xl active:bg-emerald-900 disabled:opacity-60"
          >
            {enviando ? 'ENVIANDO...' : 'ENVIAR FORMULARIO A APROBACIÓN'}
          </button>

          {mensaje && (
            <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-2xl text-emerald-800 text-sm font-medium">
              {mensaje}
            </div>
          )}

          <div className="text-[10px] text-center text-slate-400 pt-2">
            Al aprobar se genera folio independiente y la información pasa al sistema central.
            Solo usuarios autorizados por Superadministrador pueden usar esta app.
          </div>

          <div className="pt-4 flex gap-2">
            <button onClick={() => router.push('/mobile-apps')} className="flex-1 py-2 text-sm border rounded-xl">Volver a Apps</button>
            <button onClick={() => router.push('/')} className="flex-1 py-2 text-sm border rounded-xl">Ir al sistema</button>
          </div>
        </div>

        <div className="p-3 text-center text-[10px] text-slate-400 border-t">
          TECAVO FRUITS • Control de Combustible • Formato de captura móvil • Solo Superadministrador asigna usuarios
        </div>
      </div>
    </div>
  );
}
