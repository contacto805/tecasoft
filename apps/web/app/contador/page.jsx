'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ArrowRight, Info, Users, FileText } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

export default function ContadorDirectAccess() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [lots, setLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);

  // Admin PIN unlock for full view (forces explicit system PIN)
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminUnlockError, setAdminUnlockError] = useState('');
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  // Admin full-view loads only after explicit PIN unlock (no auto-show)
  // This keeps sensitive "Vista completa" hidden from any producer or unauthenticated visitor.

  const loadAllLotsForAdmin = async () => {
    setLoadingLots(true);
    try {
      const res = await fetch('/api/lots');
      const data = await res.json();
      setLots(Array.isArray(data) ? data.slice(0, 100) : []);
    } catch (e) {
      setLots([]);
    } finally {
      setLoadingLots(false);
    }
  };

  // No auto-load: lots are loaded explicitly after a successful admin PIN unlock.

  const handleAccess = () => {
    const code = pin.trim().toUpperCase();
    if (!code) {
      setError('Ingresa el código PIN proporcionado.');
      return;
    }
    if (code.length < 4) {
      setError('El PIN debe tener al menos 4 caracteres.');
      return;
    }
    setError('');
    router.push(`/contador/${code}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAccess();
    }
  };

  // Explicit PIN entry for admins only (the system PIN used in login-simple)
  // Forces admins to enter it in this module to reveal full sensitive list.
  const unlockAdminWithPin = async () => {
    setAdminUnlockError('');
    const email = adminEmail.trim().toLowerCase();
    const pinVal = adminPinInput.trim();

    if (!email || !pinVal) {
      setAdminUnlockError('Ingresa correo electrónico y PIN de 4 dígitos del sistema.');
      return;
    }
    if (!/^\d{4}$/.test(pinVal)) {
      setAdminUnlockError('El PIN debe ser exactamente 4 dígitos.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, pin: pinVal })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'PIN o correo incorrecto. Verifica tus credenciales del sistema.');
      }

      // Store unlocked flag locally — admin full section is now revealed only for admin
      setAdminUnlocked(true);
      setAdminPinInput(''); // security: clear
      setAdminUnlockError('');

      // Load user info (for display inside view)
      try {
        const u = await fetch('/api/auth/user', { credentials: 'include' });
        if (u.ok) setUser(await u.json());
      } catch (_) {}

      // Load full lot list (now unlocked)
      await loadAllLotsForAdmin();
    } catch (e) {
      setAdminUnlockError(e.message || 'No fue posible desbloquear la vista con el PIN.');
    }
  };

  const handleAdminPinKeyDown = (e) => {
    if (e.key === 'Enter') unlockAdminWithPin();
  };

  // Logout out of this admin preview (hide the full list again)
  const lockAdminView = () => {
    setAdminUnlocked(false);
    setLots([]);
    setUser(null);
    setAdminEmail('');
    setAdminPinInput('');
  };

  const openLotForAdmin = async (lot) => {
    // Use POST accountant-link to ensure a code/token exists for this lot then open via contador link
    try {
      const linkRes = await fetch(`/api/lots/${lot.id}/accountant-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferFourDigit: true })
      });
      if (linkRes.ok) {
        const linkData = await linkRes.json();
        const code = linkData.code4 || linkData.pin || linkData.token;
        if (code) {
          router.push(`/contador/${code}`);
          return;
        }
      }
    } catch(_) {}
    // Final fallback to main expedientes
    router.push('/expedientes');
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4">
      <div className="w-full max-w-5xl">

        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-white shadow flex items-center justify-center border border-emerald-200">
            <KeyRound className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Módulo Contador</h1>
          <p className="mt-2 text-slate-600">Acceso directo para usuarios externos</p>
        </div>

        {/* Admin view banner ONLY appears after explicit system PIN entry in this screen */}
        {adminUnlocked && user && (
          <div className="mb-6 bg-emerald-900/5 border-2 border-emerald-700 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex gap-3">
                <div className="p-3 bg-emerald-700 text-white rounded-xl h-fit">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-emerald-800">Vista completa desbloqueada con PIN del sistema</div>
                  <p className="text-sm text-emerald-800">Superadministrador / Encargado de Administración • Sesión de vista activa para todos los expedientes.</p>
                  <p className="mt-1 text-xs text-emerald-700">Correo: {user.name || user.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={lockAdminView}
                  className="px-4 py-2 text-sm border border-emerald-600 text-emerald-700 rounded-xl hover:bg-emerald-50"
                >
                  Bloquear vista admin
                </button>
                <button 
                  onClick={() => router.push('/administracion')}
                  className="px-4 py-2 text-sm bg-emerald-700 text-white rounded-xl hover:bg-emerald-800"
                >
                  Administración
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PIN entry card for external users (always visible - external only lot access) */}
        <div className="max-w-md mx-auto mb-8">
          <div className="bg-white rounded-3xl shadow-xl border border-emerald-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-semibold text-xl text-slate-900">Ingreso por PIN</h2>
                <p className="text-sm text-slate-500">Un PIN único por trámite / lote (acceso solo a ese expediente)</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Código PIN del Trámite
                </label>
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError('');
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ej: A7K2P9"
                  maxLength={10}
                  className="w-full px-5 py-4 border border-slate-300 text-slate-900 rounded-2xl text-2xl font-mono tracking-[4px] uppercase placeholder:tracking-normal placeholder:text-slate-400 placeholder:text-base focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition"
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 flex items-center gap-1.5 bg-red-50 px-3 py-2 rounded-xl border border-red-200">
                  {error}
                </div>
              )}

              <button
                onClick={handleAccess}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition text-white font-semibold rounded-2xl text-lg shadow shadow-emerald-600/30"
              >
                Acceder al Módulo
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 flex gap-3">
              <Info className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                PIN automático generado al registrar el lote de fruta. El PIN da acceso SOLO a la vista de ese lote. Para ver y cargar documentos, use este acceso.
              </div>
            </div>
          </div>
        </div>

        {/* Admin PIN Unlock section (SEPARATE from producer PIN) — only super/admin enters system PIN here.
            Keeps the "Vista completa" safely isolated. Producers never see or access this list. */}
        <div className="max-w-md mx-auto mb-8">
          <div className="bg-white rounded-3xl shadow-xl border border-emerald-700 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-800 text-white rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-semibold text-xl text-slate-900">Acceso Super / Admin</h2>
                <p className="text-sm text-slate-500">Ingresa tus credenciales del sistema (PIN de 4 dígitos) para ver TODOS los expedientes</p>
              </div>
            </div>

            {!adminUnlocked && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Correo electrónico</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => { setAdminEmail(e.target.value); setAdminUnlockError(''); }}
                    onKeyDown={handleAdminPinKeyDown}
                    placeholder="tu@correo.com"
                    className="w-full px-4 py-3 border border-slate-300 text-slate-900 rounded-2xl text-sm placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">PIN del Sistema (4 dígitos)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={adminPinInput}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setAdminPinInput(v);
                      setAdminUnlockError('');
                    }}
                    onKeyDown={handleAdminPinKeyDown}
                    placeholder="1234"
                    maxLength={4}
                    className="w-full px-5 py-3.5 border border-slate-300 text-slate-900 rounded-2xl text-2xl font-mono tracking-[8px] placeholder:tracking-normal placeholder:text-slate-400 text-center focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-300"
                  />
                </div>

                {adminUnlockError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                    {adminUnlockError}
                  </div>
                )}

                <button
                  onClick={unlockAdminWithPin}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-900 hover:bg-black transition text-white font-semibold rounded-2xl"
                >
                  Desbloquear Vista Completa (Super/Admin)
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="text-[10px] text-center text-emerald-700 pt-1">
                  El PIN usado aquí es el mismo con el que ingresas al sistema.
                </div>
              </div>
            )}

            {adminUnlocked && (
              <div className="text-center py-2">
                <div className="text-sm text-emerald-800">
                  ✓ Vista desbloqueada correctamente
                </div>
                <button 
                  onClick={lockAdminView} 
                  className="mt-2 text-xs underline text-emerald-600 hover:text-emerald-900"
                >
                  CERRAR VISTA COMPLETA
                </button>
              </div>
            )}
          </div>
        </div>

        {/* FULL ACCESS SECTION — appears ONLY after explicit PIN entry on this page */}
        {adminUnlocked && (
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 w-full">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-800 text-white rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-semibold text-xl text-slate-900">Vista completa de Módulo Contador (Super/Admin)</h2>
                  <p className="text-sm text-slate-500">Acceso a TODOS los expedientes y documentos. Desbloqueado con PIN del sistema.</p>
                </div>
              </div>
              <button onClick={loadAllLotsForAdmin} className="text-sm px-4 py-2 rounded-xl border hover:bg-slate-50">Actualizar lista</button>
            </div>

            {loadingLots ? (
              <div className="text-center py-10 text-slate-500">Cargando lotes...</div>
            ) : lots.length === 0 ? (
              <div className="text-sm text-center py-8 text-slate-400">No hay lotes registrados aún.</div>
            ) : (
              <div className="overflow-auto border border-slate-100 rounded-2xl max-h-[480px]">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="py-3 px-4 text-left font-semibold">Lote</th>
                      <th className="py-3 px-4 text-left font-semibold">Productor</th>
                      <th className="py-3 px-4 text-left font-semibold">Fecha</th>
                      <th className="py-3 px-4 text-right font-semibold">Precio/kg</th>
                      <th className="py-3 px-4 text-center font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lots.map(l => (
                      <tr key={l.id} className="hover:bg-emerald-50/40">
                        <td className="font-mono px-4 py-3">{l.lot_number}</td>
                        <td className="px-4 py-3">{l.producer || l.broker_name}</td>
                        <td className="px-4 py-3">{l.date ? String(l.date).slice(0,10) : '-'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(l.fruit_price || 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => openLotForAdmin(l)} 
                            className="px-5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                          >
                            Ver expediente completo + documentos
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-3 text-xs text-emerald-700">Puede visualizar cualquier expediente y todos los documentos que hayan subido al sistema desde cualquier vista.</p>
          </div>
        )}

        {!adminUnlocked && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Cada productor accede solo a su información mediante el PIN de su lote.<br/>
            Superadministradores y encargados de administración ingresan su PIN del sistema en la sección superior para abrir la vista completa.
          </p>
        )}
      </div>
    </div>
  );
}
