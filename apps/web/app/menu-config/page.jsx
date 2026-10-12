'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MenuConfigPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingModule, setEditingModule] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleRoute, setNewModuleRoute] = useState('');
  const [newModuleIcon, setNewModuleIcon] = useState('ph-package');
  const [selectedGroupForModule, setSelectedGroupForModule] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const ICON_OPTIONS = [
    'ph-house', 'ph-package', 'ph-qr-code', 'ph-handshake', 'ph-tag', 'ph-stack',
    'ph-clipboard-text', 'ph-cube', 'ph-chart-bar', 'ph-truck', 'ph-printer',
    'ph-currency-dollar', 'ph-coins', 'ph-file-text', 'ph-receipt',
    'ph-warning-circle', 'ph-image', 'ph-layout', 'ph-gear', 'ph-settings'
  ];

  useEffect(() => {
    loadEverything();
  }, []);

  const loadEverything = async () => {
    setLoading(true);
    try {
      // Get current logged user (does not auto eject session)
      const userRes = await fetch('/api/auth/user', { credentials: 'include' });
      let currentUser = null;
      if (userRes.ok) {
        currentUser = await userRes.json();
        setUser(currentUser);
      } else {
        // Session not recognized here. But DO NOT destroy session — show friendly state and allow going back.
        setUser(null);
      }

      // Super admin flag (read only view always)
      let superFlag = false;
      if (currentUser) {
        try {
          const adminRes = await fetch('/api/auth/check-super-admin', { credentials: 'include' });
          if (adminRes.ok) {
            const adminData = await adminRes.json();
            superFlag = !!adminData.isSuperAdmin;
          }
        } catch (_) {}
      }
      setIsSuperAdmin(superFlag);

      // Always try to load the FULL menu structure for visibility (includes hidden ones)
      // The API is designed to be safe for this page
      const menuRes = await fetch('/api/menu?includeAll=true', { credentials: 'include' });
      if (menuRes.ok) {
        const data = await menuRes.json();
        setGroups(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Menu config load error (non-fatal):', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenu = async () => {
    // kept for backward edit calls — reloads structure
    try {
      const response = await fetch('/api/menu?includeAll=true', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setGroups(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error refetching menu:', error);
    }
  };


  const showMessage = (msg, isError = false) => {
    setMessage(msg);
    if (!isError) {
      setTimeout(() => setMessage(''), 2800);
    }
  };

  // ---------- ADD / EDIT ACTIONS (only for super admins) ----------
  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    if (!newGroupName.trim()) {
      showMessage('El nombre del grupo es requerido', true);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'add-group',
          groupName: newGroupName,
          groupOrder: groups.length
        })
      });
      if (response.ok) {
        setNewGroupName('');
        showMessage('Grupo agregado exitosamente');
        fetchMenu();
      } else {
        const err = await response.json().catch(() => ({}));
        showMessage(err.error || 'Error al agregar grupo', true);
      }
    } catch (error) {
      showMessage('Error al agregar grupo', true);
    } finally { setSaving(false); }
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin || !editingGroup) return;
    if (!editingGroup.group_name?.trim()) {
      showMessage('El nombre del grupo es requerido', true);
      return;
    }
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-group',
          groupId: editingGroup.id,
          groupName: editingGroup.group_name
        })
      });
      if (res.ok) {
        setEditingGroup(null);
        showMessage('Grupo actualizado');
        fetchMenu();
      } else {
        showMessage('Error al actualizar grupo', true);
      }
    } catch (e) {
      showMessage('Error al actualizar grupo', true);
    }
  };

  const handleToggleGroup = async (groupId, currentActive) => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'toggle-group', groupId, isActive: !currentActive })
      });
      if (res.ok) {
        showMessage(currentActive ? 'Grupo desactivado (se oculta en el menú)' : 'Grupo activado');
        fetchMenu();
      }
    } catch {}
  };

  const handleMoveGroup = async (groupId, direction) => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'move-group', groupId, direction })
      });
      if (res.ok) {
        fetchMenu(); // re-renders with correct order
      }
    } catch (e) { console.log('move-group err'); }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!isSuperAdmin) return;
    if (!confirm('¿Deseas desactivar este grupo y todos sus módulos? (reversible)')) return;
    try {
      const res = await fetch('/api/menu', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ groupId })
      });
      if (res.ok) {
        showMessage('Grupo desactivado');
        fetchMenu();
      }
    } catch (e) { showMessage('Error desactivando grupo', true); }
  };

  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    if (!newModuleName.trim() || !newModuleRoute.trim() || !selectedGroupForModule) {
      showMessage('Todos los campos son requeridos', true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'add-module',
          groupId: selectedGroupForModule,
          moduleName: newModuleName,
          moduleRoute: newModuleRoute,
          moduleIcon: newModuleIcon
        })
      });
      if (res.ok) {
        setNewModuleName('');
        setNewModuleRoute('');
        setNewModuleIcon('ph-package');
        setSelectedGroupForModule(null);
        showMessage('Módulo agregado exitosamente');
        fetchMenu();
      } else {
        const err = await res.json().catch(() => ({}));
        showMessage(err.error || 'Error al agregar módulo', true);
      }
    } catch (error) {
      showMessage('Error al agregar módulo', true);
    } finally { setSaving(false); }
  };

  const handleUpdateModule = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin || !editingModule) return;
    if (!editingModule.module_name?.trim()) {
      showMessage('Nombre del módulo requerido', true);
      return;
    }
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-module',
          moduleId: editingModule.id,
          moduleName: editingModule.module_name,
          moduleRoute: editingModule.module_route,
          moduleIcon: editingModule.module_icon
        })
      });
      if (res.ok) {
        setEditingModule(null);
        showMessage('Módulo actualizado');
        fetchMenu();
      } else {
        showMessage('Error al actualizar módulo', true);
      }
    } catch (e) { showMessage('Error al actualizar módulo', true); }
  };

  const handleToggleModule = async (moduleId, currentActive) => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'toggle-module', moduleId, isActive: !currentActive })
      });
      if (res.ok) {
        showMessage(currentActive ? 'Módulo ocultado' : 'Módulo activado');
        fetchMenu();
      }
    } catch (e) {}
  };

  const handleMoveModule = async (moduleId, direction) => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'move-module', moduleId, direction })
      });
      if (res.ok) fetchMenu();
    } catch (e) {}
  };

  const handleDeleteModule = async (moduleId) => {
    if (!isSuperAdmin) return;
    if (!confirm('¿Deseas desactivar este módulo?')) return;
    try {
      const res = await fetch('/api/menu', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ moduleId })
      });
      if (res.ok) {
        showMessage('Módulo desactivado');
        fetchMenu();
      }
    } catch (e) { showMessage('Error', true); }
  };

  // NEW: super intuitive dynamic assignment to credential types - one click toggle
  const handleToggleCredential = async (groupId, cred, currentlyHas) => {
    if (!isSuperAdmin) return;
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    let nv = g.applies_to || 'both';
    if (cred === 'campo') {
      if (currentlyHas) {
        nv = (nv === 'both') ? 'operaciones' : (nv === 'campo' ? 'both' : 'both');
      } else {
        nv = (nv === 'operaciones') ? 'both' : 'campo';
      }
    } else {
      if (currentlyHas) {
        nv = (nv === 'both') ? 'campo' : (nv === 'operaciones' ? 'both' : 'both');
      } else {
        nv = (nv === 'campo') ? 'both' : 'operaciones';
      }
    }
    try {
      await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'update-group', groupId, appliesTo: nv })
      });
      fetchMenu();
    } catch (e) {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando configuración del menú...</p>
        </div>
      </div>
    );
  }

  // The golden rule for this module (bug fix):
  // Never do router.push('/login') or destroy session state from here.
  // Global layout already gates unauthenticated users.
  // Non-super admins (and even failed super flag) can now ENTER the page safely
  // and see current live structure in read-only mode. Editing stays locked.

  const canEdit = !!isSuperAdmin;


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top fixed nav bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition">
              <i className="ph ph-arrow-left"></i>
              <span className="text-sm font-medium">Regresar al Dashboard</span>
            </button>
            <div className="h-5 w-px bg-slate-200 mx-1"></div>
              <div>
              <span className="font-semibold text-slate-900">Configurar Menú</span>
              {canEdit ? (
                <span className="ml-2 px-2 py-0.5 text-[10px] tracking-wide bg-brand-100 text-brand-700 rounded">SUPER ADMIN</span>
              ) : (
                <span className="ml-2 px-2 py-0.5 text-[10px] tracking-wide bg-amber-100 text-amber-700 rounded">SOLO LECTURA</span>
              )}
            </div>
          </div>
          <button onClick={() => router.push('/')} className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
            ← Salir
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Configuración del Menú Principal</h1>
          <p className="mt-1 text-slate-600">
            Asignación: marca grupos para credenciales de Campo, Operaciones, Administrador y Superadministrador. Superadministrador tiene acceso total. Embarques heredado en Operaciones. Cambios instantáneos. 
          </p>
          <div className="mt-2 inline-flex items-center gap-2 text-xs px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">Campo → grupos con "Campo" activado | Operaciones → grupos con "Operaciones" activado</div>
          {!canEdit && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
              <i className="ph ph-info"></i>
              <span>Modo de solo lectura. Solo el Super Administrador puede modificar la estructura. Tu sesión permanece activa.</span>
            </div>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl border text-sm font-medium ${
            message.toLowerCase().includes('error') || message.includes('requerido')
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>{message}</div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Forms (right column on xl) */}
          <div className="xl:col-span-4 space-y-6">
            {/* Create Group */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4 text-slate-900"><i className="ph ph-folder-plus"></i> Nuevo Grupo de Módulos</h3>
              <form onSubmit={handleAddGroup} className="space-y-3">
                <input type="text" value={newGroupName} disabled={!isSuperAdmin} onChange={e => setNewGroupName(e.target.value)} placeholder="Nombre del grupo (ej. Ventas y Pagos)" className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-brand-500" />
                <button type="submit" disabled={saving || !isSuperAdmin} className="w-full py-2 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 disabled:opacity-60">Agregar Grupo</button>
                <p className="text-xs text-slate-500 pt-0.5">Los grupos pueden contener varios módulos relacionados.</p>
              </form>
            </div>

            {/* Create Module */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4 text-slate-900"><i className="ph ph-plus-circle"></i> Nuevo Módulo</h3>
              <form onSubmit={handleAddModule} className="space-y-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Grupo</label>
                  <select value={selectedGroupForModule || ''} onChange={e => setSelectedGroupForModule(Number(e.target.value))} disabled={!isSuperAdmin} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                    <option value="">— Seleccionar grupo —</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
                  </select>
                </div>
                <input type="text" value={newModuleName} disabled={!isSuperAdmin} onChange={e => setNewModuleName(e.target.value)} placeholder="Nombre del módulo (Ej. Embarques)" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                <input type="text" value={newModuleRoute} disabled={!isSuperAdmin} onChange={e => setNewModuleRoute(e.target.value)} placeholder="Ruta: /embarques" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                <select value={newModuleIcon} disabled={!isSuperAdmin} onChange={e => setNewModuleIcon(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                  {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <button type="submit" disabled={saving || !isSuperAdmin} className="w-full py-2 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 disabled:opacity-60">Agregar Módulo al Grupo</button>
              </form>
            </div>

            <div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-600 leading-relaxed border border-slate-200">
              <strong>Importante:</strong> Desactivar un grupo o módulo lo oculta para todos los usuarios. Los módulos son accesibles vía URL directamente pero no aparecerán en el menú de navegación.
            </div>
          </div>

          {/* Live structure */}
          <div className="xl:col-span-8">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {groups.length === 0 ? (
                <div className="p-10 text-center text-slate-500">No se encontró estructura de menú. Agrega el primer grupo.</div>
              ) : groups.map((group, groupIdx) => {
                const isGroupActive = !!group.is_active;
                return (
                  <div key={group.id} className={`border-b last:border-b-0 ${!isGroupActive ? 'opacity-70' : ''}`}>
                    <div className="px-5 py-3 bg-slate-50 border-b flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <button onClick={() => handleMoveGroup(group.id, 'up')} disabled={!isSuperAdmin || groupIdx === 0} className="text-xs px-2 py-1 border rounded disabled:opacity-30"><i className="ph ph-arrow-up"></i></button>
                        <button onClick={() => handleMoveGroup(group.id, 'down')} disabled={!isSuperAdmin || groupIdx === groups.length-1} className="text-xs px-2 py-1 border rounded disabled:opacity-30"><i className="ph ph-arrow-down"></i></button>
                        <span className="font-semibold text-slate-900">{group.group_name}</span>
                        {!isGroupActive && <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 rounded">OCULTO</span>}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* INTUITIVE DYNAMIC ASSIGNMENT TO CREDENTIAL TYPES */}
                        <div className="flex items-center bg-white rounded-full border border-slate-200 text-[11px]">
                          <button
                            onClick={() => handleToggleCredential(group.id, 'campo', (group.applies_to || 'both') === 'campo' || (group.applies_to || 'both') === 'both')}
                            disabled={!isSuperAdmin}
                            className={`px-3 py-0.5 rounded-l-full ${(group.applies_to || 'both') === 'campo' || (group.applies_to || 'both') === 'both' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'} transition`}>
                            Campo
                          </button>
                          <button
                            onClick={() => handleToggleCredential(group.id, 'operaciones', (group.applies_to || 'both') === 'operaciones' || (group.applies_to || 'both') === 'both')}
                            disabled={!isSuperAdmin}
                            className={`px-3 py-0.5 rounded-r-full ${(group.applies_to || 'both') === 'operaciones' || (group.applies_to || 'both') === 'both' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'} transition`}>
                            Operaciones
                          </button>
                        </div>

                        <button onClick={() => handleToggleGroup(group.id, isGroupActive)} disabled={!isSuperAdmin} className={`text-xs px-3 py-1 rounded-full border ${isGroupActive ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                          {isGroupActive ? 'Ocultar grupo' : 'Mostrar grupo'}
                        </button>
                        <button onClick={() => setEditingGroup(group)} disabled={!isSuperAdmin} className="p-1.5 text-slate-500 hover:bg-white rounded transition"><i className="ph ph-pencil-simple"></i></button>
                        <button onClick={() => handleDeleteGroup(group.id)} disabled={!isSuperAdmin} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"><i className="ph ph-trash-simple"></i></button>
                      </div>
                    </div>

                    {/* Editable name inline */}
                    {editingGroup?.id === group.id && (
                      <div className="px-5 py-3 bg-white border-b flex gap-2 items-center">
                        <input value={editingGroup.group_name} onChange={e => setEditingGroup({...editingGroup, group_name: e.target.value})} className="flex-1 border rounded px-3 py-1" />
                        <button onClick={handleUpdateGroup} className="bg-emerald-600 text-white px-4 rounded py-1 text-sm">Guardar</button>
                        <button onClick={() => setEditingGroup(null)} className="border px-4 text-sm rounded py-1">Cancelar</button>
                      </div>
                    )}

                    {/* Modules inside */}
                    <div className="divide-y">
                      {(group.modules || []).length > 0 ? (group.modules || []).map((mod, modIdx) => {
                        const activeMod = mod.is_active;
                        return (
                          <div key={mod.id} className={`px-5 py-3 flex items-center gap-3 ${!activeMod ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                            <div className="flex-1 flex items-center gap-3">
                              <i className={`ph ${mod.module_icon || 'ph-package'} text-xl w-6 text-brand-600`}></i>
                              <div>
                                <div className="font-medium text-slate-800">{mod.module_name} {!activeMod && <span className="ml-1 text-xs font-normal px-1.5 py-px bg-red-100 text-red-700 rounded">oculto</span>}</div>
                                <div className="text-xs text-slate-500">{mod.module_route}</div>
                              </div>
                            </div>

                            <div className="flex gap-1 pr-1">
                              <button onClick={() => handleMoveModule(mod.id, 'up')} disabled={!isSuperAdmin || modIdx === 0} className="px-2 py-1 rounded text-xs border hover:bg-white disabled:opacity-40"><i className="ph ph-arrow-up"></i></button>
                              <button onClick={() => handleMoveModule(mod.id, 'down')} disabled={!isSuperAdmin || modIdx === (group.modules || []).length - 1} className="px-2 py-1 rounded text-xs border hover:bg-white disabled:opacity-40"><i className="ph ph-arrow-down"></i></button>

                              <button onClick={() => handleToggleModule(mod.id, activeMod)} disabled={!isSuperAdmin} className={`text-xs px-2.5 py-1 rounded border ${activeMod ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                                {activeMod ? 'Ocultar' : 'Mostrar'}
                              </button>

                              <button onClick={() => setEditingModule(mod)} disabled={!isSuperAdmin} className="px-2 py-1 text-xs border rounded hover:bg-white"><i className="ph ph-pencil"></i></button>
                              <button onClick={() => handleDeleteModule(mod.id)} disabled={!isSuperAdmin} className="px-2 py-1 text-xs border text-red-600 hover:bg-red-50 rounded"><i className="ph ph-x"></i></button>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="p-4 text-xs text-slate-400 px-5">Este grupo no tiene módulos todavía.</div>
                      )}
                    </div>

                    {/* Module edit inline form */}
                    {editingModule && editingModule.group_id === group.id && ( // a hacky relation (groupId is not in old state, so we just show when editing)
                      <div className="px-5 py-3 bg-white border-t">
                        <div className="text-xs text-slate-600 mb-1 font-medium">Editar módulo</div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input value={editingModule.module_name} onChange={e => setEditingModule({...editingModule, module_name: e.target.value})} className="flex-1 border rounded px-3 py-1 text-sm" />
                          <input value={editingModule.module_route} onChange={e => setEditingModule({...editingModule, module_route: e.target.value})} className="flex-1 border rounded px-3 py-1 text-sm" />
                          <select value={editingModule.module_icon} onChange={e => setEditingModule({...editingModule, module_icon: e.target.value})} className="border rounded px-3 py-1 text-sm">
                            {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic.replace('ph-','')}</option>)}
                          </select>
                          <button onClick={handleUpdateModule} className="px-4 py-1 bg-brand-600 text-white rounded text-sm">Guardar</button>
                          <button onClick={() => setEditingModule(null)} className="px-3 py-1 border rounded text-sm">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-500 mt-2 pl-1">Arriba y abajo cambian inmediatamente la posición en la navegación. Los cambios afectan a toda la plataforma.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
