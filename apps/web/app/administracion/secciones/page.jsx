'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';

export default function SeccionesMenu() {
  const router = useRouter();
  const [isSuper, setIsSuper] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragged, setDragged] = useState(null);

  const safeFetchSuper = async () => {
    try {
      const res = await fetch('/api/auth/check-super-admin');
      if (res.ok) {
        const d = await res.json();
        setIsSuper(!!d.isSuperAdmin);
        return !!d.isSuperAdmin;
      }
    } catch (e) {}
    return false;
  };

  const loadMenu = async () => {
    try {
      const r = await fetch('/api/menu?includeAll=true');
      const data = await r.json();
      let g = (Array.isArray(data) ? data : []).map(grp => ({
        ...grp,
        modules: (grp.modules || []).filter(m => m && m.id)
      }));
      setGroups(g);
    } catch (e) {
      setGroups([]);
    }
  };

  const ensureFixedGroups = async () => {
    try {
      const current = groups.length ? groups : [];
      const defaults = ['Administración General', 'Módulo de Ventas', 'Módulo de Inventario'];
      const activeCount = current.filter(g => g && g.is_active !== false).length;
      if (activeCount < 3) {
        for (const name of defaults) {
          const exists = current.some(g => (g.group_name || '').trim().toLowerCase() === name.toLowerCase());
          if (!exists) {
            await fetch('/api/menu', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'add-group', groupName: name })
            });
          }
        }
        await loadMenu();
      }
    } catch (_) {}
  };

  useEffect(() => {
    (async () => {
      const ok = await safeFetchSuper();
      if (ok) {
        await loadMenu();
        // ensure fixed 3 tabs groups - creates if absent so division always holds
        setTimeout(() => ensureFixedGroups(), 40);
      }
      setLoading(false);
    })();
  }, []);

  const verifyPin = async () => {
    if (!pin || pin.length !== 4) {
      setPinError('PIN debe tener exactamente 4 dígitos');
      return;
    }
    setVerifying(true);
    setPinError('');
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (data.success) {
        setPinVerified(true);
        setPin('');
      } else {
        setPinError(data.error || 'PIN incorrecto');
      }
    } catch (e) {
      setPinError('No se pudo verificar el PIN');
    } finally {
      setVerifying(false);
    }
  };

  const matchGroup = (g, key) => {
    const gn = (g.group_name || '').trim().toLowerCase();
    const k = key.trim().toLowerCase();
    if (gn === k) return true;
    if (k.includes('admin') && gn.includes('admin')) return true;
    if (k.includes('vent') && gn.includes('vent')) return true;
    if (k.includes('invent') && gn.includes('invent')) return true;
    return false;
  };

  const getModulesFor = (name) => {
    const target = groups.find(g => matchGroup(g, name));
    if (target) return (target.modules || []).filter(m => m.is_active !== false);
    return [];
  };

  const setModulesFor = (name, newModules) => {
    setGroups(prev => prev.map(g => {
      if (matchGroup(g, name)) return { ...g, modules: newModules };
      return g;
    }));
  };

  const editGroupName = async (gname) => {
    const target = groups.find(g => matchGroup(g, gname));
    if (!target) return;
    const newName = prompt('Nuevo nombre para esta pestaña / módulo:', target.group_name);
    if (!newName || newName.trim() === (target.group_name || '')) return;
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: target.id, groupName: newName.trim() })
      });
      if (res.ok) await loadMenu();
    } catch (_) {}
  };

  // Drag handlers
  const handleDragStart = (e, mod, fromGroup) => {
    setDragged({ mod, fromGroup });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, toGroupName) => {
    e.preventDefault();
    if (!dragged) return;
    const { mod, fromGroup } = dragged;
    if (fromGroup === toGroupName) {
      // same column reorder not implemented in this simple version - ok
      setDragged(null);
      return;
    }
    // remove from source
    const fromList = getModulesFor(fromGroup).filter(m => m.id !== mod.id);
    setModulesFor(fromGroup, fromList);

    // add to target at end
    const toList = [...getModulesFor(toGroupName), { ...mod }];
    setModulesFor(toGroupName, toList);
    setDragged(null);
  };

  const handleDragEnd = () => setDragged(null);

  const saveStructure = async () => {
    if (!confirm('Se modificará la estructura de navegación del sistema.\n\n¿Desea continuar?')) {
      return;
    }
    setSaving(true);
    try {
      // Gather assignments from current active groups (supports renamed tabs)
      const assignments = [];
      const divGroups = groups.filter(g => g && g.is_active !== false).slice(0, 3);
      divGroups.forEach(grp => {
        const gn = grp.group_name;
        const list = getModulesFor(gn);
        const target = groups.find(g => matchGroup(g, gn) || g.id === grp.id);
        const gid = target ? target.id : grp.id;
        list.forEach((m, idx) => {
          assignments.push({
            moduleId: m.id,
            targetGroupId: gid,
            moduleOrder: idx + 1
          });
        });
      });
      // Filter valid
      const real = assignments.filter(a => a.targetGroupId);
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-assign', assignments: real })
      });
      if (!res.ok) throw new Error('No se pudo guardar');
      // Also audit the update
      await fetch('/api/admin/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'actualizar-menu-secciones',
          entity_type: 'menu',
          description: 'Reorganización de módulos y pestañas vía Secciones'
        })
      }).catch(()=>{}); 
      alert('Nueva estructura aplicada correctamente.');
      await loadMenu();
      setPinVerified(false); // end edit mode
    } catch (e) {
      alert('Error al guardar la estructura.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen p-10 text-center text-slate-400">Cargando Secciones…</div>;
  }
  if (!isSuper) {
    return (
      <div className="min-h-screen p-8 bg-slate-50">
        <PageHeader title="Secciones" />
        <div className="bg-white border rounded-xl p-8 text-center">
          Solo el Superadministrador puede acceder a Secciones del menú.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-6xl mx-auto px-5 pt-8">
        <PageHeader title="Secciones" />

        {!pinVerified && (
          <div className="bg-white border border-emerald-200 rounded-xl shadow-sm p-6 max-w-md mx-auto mb-8">
            <div className="font-medium text-slate-800 mb-2">🔐 PIN de Seguridad</div>
            <p className="text-sm text-slate-600 mb-3">Ingresa tu PIN para habilitar la edición del menú.</p>
            <div className="flex gap-2">
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                placeholder="••••"
                className="w-24 border text-center font-mono text-xl p-1 rounded" 
              />
              <button onClick={verifyPin} disabled={verifying} className="px-6 py-2 bg-emerald-800 hover:bg-emerald-900 rounded text-white disabled:opacity-60">
                {verifying ? 'Verificando...' : 'Confirmar PIN'}
              </button>
            </div>
            {pinError && <div className="text-red-600 text-sm mt-2">{pinError}</div>}
            <div className="text-xs text-slate-500 mt-2">Este módulo solo es visible y editable por el Superadministrador.</div>
          </div>
        )}

        {pinVerified && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded font-semibold">MODO EDICIÓN ACTIVADO</span>
                <span className="ml-2 text-xs text-slate-500">Renombra con ✏️. Arrastra módulos entre pestañas. Cambios se reflejan de inmediato. </span>
              </div>
              <button onClick={saveStructure} disabled={saving} className="px-5 py-2 rounded bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-60">Guardar Nueva Estructura</button>
            </div>

            {/* Divisiones activas / Pestañas integrado aquí en Secciones del Menú - Pestañas, Módulos y estructura */}
            <div className="bg-white border rounded-xl p-3 mb-4">
              <div className="text-sm font-semibold mb-2 text-emerald-800">Divisiones activas (Pestañas del sistema)</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {groups.filter(g => g && g.is_active !== false).slice(0,3).map((grp, idx) => {
                  const mcount = (grp.modules || []).filter(mm => mm && mm.is_active !== false).length;
                  return (
                    <div key={grp.id || `d-${idx}`} className="border border-emerald-100 bg-emerald-50/40 rounded p-1.5 text-xs">
                      <div className="font-semibold flex items-center justify-between">
                        <span>{grp.group_name || 'Pestaña'}</span>
                        <button onClick={() => editGroupName(grp.group_name)} className="text-xs px-1 rounded hover:bg-emerald-100" title="Editar nombre de pestaña">✏️</button>
                      </div>
                      <div className="text-emerald-700 mt-0.5 text-[10px]">{mcount} módulos asociados</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {groups.filter(g => g && g.is_active !== false).slice(0,3).map((grp) => {
                const gname = grp.group_name || 'División';
                const mods = (grp.modules || []).filter(m => m && m.is_active !== false);
                return (
                  <div 
                    key={grp.id || `g-${gname}`}
                    className="bg-white border rounded-2xl p-3 min-h-[420px] shadow"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, gname)}
                  >
                    <div className="font-semibold text-base mb-2 px-2 py-1 flex items-center justify-between rounded-lg" style={{ backgroundColor: 'var(--mod-tab-bg, #3E2723)', color: 'var(--mod-tab-text, #ffffff)' }}>
                      <div className="text-white flex items-center gap-1">
                        {gname}
                        <button onClick={(e) => { e.stopPropagation(); editGroupName(gname); }} className="text-[10px] px-1 py-0 rounded bg-white/20 hover:bg-white/30" title="Editar nombre">✏️</button>
                      </div>
                      <div className="text-xs font-normal text-white/80">{mods.length} módulos</div>
                    </div>
                    <div className="space-y-1.5">
                      {mods.length === 0 && <div className="p-3 text-xs text-slate-400 italic">Sin módulos (suelta aquí para asignar)</div>}
                      {mods.map((mod, i) => (
                        <div
                          key={mod.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, mod, gname)}
                          onDragEnd={handleDragEnd}
                          className="border border-slate-200 cursor-move bg-slate-50 hover:bg-white active:bg-slate-100 px-3 py-2.5 text-sm rounded-xl flex items-center justify-between gap-2 select-none"
                        >
                          <div className="flex-1 text-slate-700 flex items-center gap-1.5">
                            <i className="ph ph-dots-six-vertical text-lg text-slate-400" />
                            {mod.module_name}
                          </div>
                          <div className="text-xs px-2 py-0.5 text-slate-400 font-mono">{mod.module_route}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-center text-[10px] text-slate-400">Arrastrar y soltar</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 text-xs text-slate-500 px-2">
              La estructura actualizada se refleja automáticamente en toda la aplicación (menu api persistente).<br />
              Los módulos inactivos pueden mostrarse en el listado pero no aparecerán al público hasta activarse de nuevo.
            </div>
          </>
        )}

        {!pinVerified && (
          <button onClick={() => router.push('/administracion')} className="mx-auto block mt-8 px-5 py-2 text-sm underline text-emerald-700">← Volver a Administración</button>
        )}

      </div>
    </div>
  );
}
