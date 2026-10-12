'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [originalModules, setOriginalModules] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Available modules in the system
  const availableModules = [
    { name: 'Inventario', key: 'inventory' },
    { name: 'Ingreso de Fruta', key: 'fruit-input' },
    { name: 'Corredores', key: 'brokers' },
    { name: 'Registro de Lotificación', key: 'lot-registration' },
    { name: 'Órdenes de Corte', key: 'cutting-orders' },
    { name: 'Embarques', key: 'loads' },
    { name: 'Control de Cajas', key: 'box-control' },
    { name: 'Rendimiento de Lote', key: 'lotification-registry' },
    { name: 'Venta de Proceso y Desecho', key: 'sales-process-waste' },
    { name: 'Impresoras', key: 'printer-settings' },
    { name: 'Facturación', key: 'invoices' },
    { name: 'Configuración de Colores', key: 'color-settings' },
    { name: 'Prueba API Móvil', key: 'test-mobile-sync' }
  ];

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin]);

  const checkSuperAdmin = async () => {
    try {
      const res = await fetch('/api/auth/check-super-admin');
      if (res.ok) {
        const data = await res.json();
        setIsSuperAdmin(data.isSuperAdmin);
        if (!data.isSuperAdmin) {
          setAccessDenied(true);
          setLoading(false);
        }
      } else {
        setAccessDenied(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking super admin:', error);
      setAccessDenied(true);
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/user-permissions');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    
    // Fetch user's current module permissions
    try {
      const res = await fetch(`/api/admin/users/${user.id}/modules`);
      if (res.ok) {
        const permissions = await res.json();
        const modules = permissions.map(p => ({
          module_name: p.module_name,
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete
        }));
        setOriginalModules(JSON.parse(JSON.stringify(modules))); // Deep copy
        setSelectedModules(modules);
      }
    } catch (error) {
      console.error('Error fetching user modules:', error);
    }
  };

  const toggleModule = (moduleKey) => {
    const existingIndex = selectedModules.findIndex(m => m.module_name === moduleKey);
    
    if (existingIndex >= 0) {
      // Remove module
      setSelectedModules(selectedModules.filter(m => m.module_name !== moduleKey));
    } else {
      // Add module with default permissions
      setSelectedModules([
        ...selectedModules,
        {
          module_name: moduleKey,
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false
        }
      ]);
    }
  };

  const togglePermission = (moduleKey, permission) => {
    setSelectedModules(selectedModules.map(m => {
      if (m.module_name === moduleKey) {
        return { ...m, [permission]: !m[permission] };
      }
      return m;
    }));
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: selectedModules })
      });

      if (res.ok) {
        const data = await res.json();
        setOriginalModules(JSON.parse(JSON.stringify(selectedModules))); // Update original
        alert('✅ Permisos guardados exitosamente');
        fetchUsers(); // Refresh users list
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving modules:', error);
      alert('❌ Error al guardar permisos');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Restore original modules
    setSelectedModules(JSON.parse(JSON.stringify(originalModules)));
  };

  const hasChanges = JSON.stringify(selectedModules) !== JSON.stringify(originalModules);

  const isModuleEnabled = (moduleKey) => {
    return selectedModules.some(m => m.module_name === moduleKey);
  };

  const getModulePermissions = (moduleKey) => {
    return selectedModules.find(m => m.module_name === moduleKey);
  };

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <i className="ph-fill ph-lock-open text-2xl text-red-600"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso Denegado</h1>
          <p className="text-slate-600 mb-6">Solo el Super Administrador puede acceder al panel de configuración de usuarios y colores del sistema.</p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <i className="ph ph-arrow-left text-xl"></i>
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Administración de Usuarios</h1>
              <p className="text-xs text-slate-500">Asignar módulos y permisos por usuario</p>
            </div>
          </div>
            {isSuperAdmin && (
            <>
              <button
                onClick={() => router.push('/color-settings')}
                className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
              >
                <i className="ph ph-palette"></i>
                Configurar Colores
              </button>
              <button
                onClick={() => router.push('/admin/dashboard-public-qr')}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors rounded-lg flex items-center gap-2"
              >
                📷 Dashboard público QR
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Users List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <i className="ph ph-users text-lg"></i>
                  Usuarios del Sistema
                </h2>
                <p className="text-xs text-slate-500 mt-1">Selecciona un usuario para gestionar permisos</p>
              </div>
              
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-slate-400">
                    <i className="ph ph-spinner text-2xl animate-spin mb-2"></i>
                    <p className="text-sm">Cargando usuarios...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <i className="ph ph-users text-4xl mb-2"></i>
                    <p className="text-sm">No hay usuarios registrados</p>
                  </div>
                ) : (
                  users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                        selectedUser?.id === user.id ? 'bg-brand-50 border-l-4 border-brand-500' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
                          {user.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{user.name || 'Sin nombre'}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {user.permissions?.length || 0} módulos asignados
                          </p>
                        </div>
                        {selectedUser?.id === user.id && (
                          <i className="ph-fill ph-check-circle text-brand-600 text-lg"></i>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Module Assignment */}
          <div className="lg:col-span-2">
            {!selectedUser ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                <i className="ph ph-hand-pointing text-6xl text-slate-300 mb-4"></i>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Selecciona un usuario</h3>
                <p className="text-sm text-slate-500">Elige un usuario de la lista para asignar módulos y permisos</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <i className="ph ph-user-gear text-xl"></i>
                        Asignar Módulos a {selectedUser.name}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">{selectedUser.email}</p>
                    </div>
                    {hasChanges && (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full flex items-center gap-1">
                        <i className="ph ph-warning-circle"></i>
                        Cambios sin guardar
                      </span>
                    )}
                  </div>
                </div>

                {/* Modules Grid */}
                <div className="p-6">
                  <div className="space-y-3">
                    {availableModules.map((module) => {
                      const enabled = isModuleEnabled(module.key);
                      const perms = getModulePermissions(module.key);

                      return (
                        <div
                          key={module.key}
                          className={`border-2 rounded-xl p-4 transition-all ${
                            enabled
                              ? 'border-brand-200 bg-brand-50/50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleModule(module.key)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  enabled ? 'bg-brand-600' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    enabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                              <div>
                                <h3 className="text-sm font-semibold text-slate-900">{module.name}</h3>
                                <p className="text-xs text-slate-500">/{module.key}</p>
                              </div>
                            </div>
                            {enabled && (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                                Activo
                              </span>
                            )}
                          </div>

                          {/* Permission Checkboxes */}
                          {enabled && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-brand-100">
                              <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/50 p-2 rounded-lg transition-colors">
                                <input
                                  type="checkbox"
                                  checked={perms?.can_view || false}
                                  onChange={() => togglePermission(module.key, 'can_view')}
                                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                                />
                                <span className="text-slate-700 font-medium">Ver</span>
                              </label>
                              <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/50 p-2 rounded-lg transition-colors">
                                <input
                                  type="checkbox"
                                  checked={perms?.can_create || false}
                                  onChange={() => togglePermission(module.key, 'can_create')}
                                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                                />
                                <span className="text-slate-700 font-medium">Crear</span>
                              </label>
                              <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/50 p-2 rounded-lg transition-colors">
                                <input
                                  type="checkbox"
                                  checked={perms?.can_edit || false}
                                  onChange={() => togglePermission(module.key, 'can_edit')}
                                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                                />
                                <span className="text-slate-700 font-medium">Editar</span>
                              </label>
                              <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/50 p-2 rounded-lg transition-colors">
                                <input
                                  type="checkbox"
                                  checked={perms?.can_delete || false}
                                  onChange={() => togglePermission(module.key, 'can_delete')}
                                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                                />
                                <span className="text-slate-700 font-medium">Eliminar</span>
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
                  <p className="text-sm text-slate-600">
                    <strong>{selectedModules.length}</strong> módulos seleccionados de {availableModules.length}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      disabled={!hasChanges}
                      className="px-5 py-2.5 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <i className="ph ph-x"></i>
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !hasChanges}
                      className="px-5 py-2.5 text-sm bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <i className="ph ph-spinner animate-spin"></i>
                          Guardando...
                        </>
                      ) : (
                        <>
                          <i className="ph ph-check"></i>
                          Guardar Cambios
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
