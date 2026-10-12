'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function ColorSettingsPage() {
  const router = useRouter();
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const modules = [
    { name: 'dashboard', label: 'Dashboard Principal', icon: 'house' },
    { name: 'fruit-input', label: 'Ingreso de Fruta', icon: 'qr-code' },
    { name: 'inventory', label: 'Inventario', icon: 'thermometer-cold' },
    { name: 'cutting-orders', label: 'Órdenes de Corte', icon: 'clipboard-text' },
    { name: 'box-control', label: 'Control de Cajas', icon: 'stack' },
    { name: 'lotification', label: 'Lotificación', icon: 'tag' },
    { name: 'lotification-registry', label: 'Rendimiento de Lote', icon: 'chart-bar' },
    { name: 'sales-process-waste', label: 'Ventas Proceso/Merma', icon: 'currency-dollar' },
    { name: 'loads', label: 'Embarques', icon: 'truck' },
    { name: 'header', label: 'Encabezado/Navegación', icon: 'navigation-arrow' },
    { name: 'footer', label: 'Pie de Página', icon: 'dots-three' }
  ];

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSchemes();
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

  const fetchSchemes = async () => {
    try {
      const response = await fetch('/api/color-schemes');
      if (response.ok) {
        const data = await response.json().catch(() => []);
        setSchemes(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching schemes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSchemeForModule = (moduleName) => {
    return schemes.find(s => s.module_name === moduleName) || {
      module_name: moduleName,
      primary_color: '#024D32',
      secondary_color: '#9E4633',
      accent_color: '#E8D547',
      text_color: '#0A3020',
      bg_color: '#ffffff',
      border_color: '#E8D547'
    };
  };

  const saveColors = async (moduleName, colors) => {
    setSaving(true);
    try {
      const response = await fetch('/api/color-schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_name: moduleName,
          ...colors
        })
      });

      if (response.ok) {
        await fetchSchemes();
        alert('Colores guardados exitosamente');
      }
    } catch (error) {
      console.error('Error saving colors:', error);
      alert('Error al guardar colores');
    } finally {
      setSaving(false);
    }
  };

  const ColorPicker = ({ module }) => {
    const scheme = getSchemeForModule(module.name);
    const [colors, setColors] = useState({
      primary_color: scheme.primary_color,
      secondary_color: scheme.secondary_color,
      accent_color: scheme.accent_color,
      text_color: scheme.text_color,
      bg_color: scheme.bg_color,
      border_color: scheme.border_color
    });

    // Actualizar el estado local cuando cambien los esquemas globales
    useEffect(() => {
      const updatedScheme = getSchemeForModule(module.name);
      setColors({
        primary_color: updatedScheme.primary_color,
        secondary_color: updatedScheme.secondary_color,
        accent_color: updatedScheme.accent_color,
        text_color: updatedScheme.text_color,
        bg_color: updatedScheme.bg_color,
        border_color: updatedScheme.border_color
      });
    }, [schemes]);

    const handleSave = () => {
      saveColors(module.name, colors);
    };

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100" style={{ 
          backgroundColor: colors.bg_color,
          borderColor: colors.border_color 
        }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{
              backgroundColor: colors.primary_color + '20',
              color: colors.primary_color
            }}>
              <i className={`ph-fill ph-${module.icon}`}></i>
            </div>
            <div>
              <h3 className="font-bold text-lg" style={{ color: colors.text_color }}>{module.label}</h3>
              <p className="text-sm text-slate-500">{module.name}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color Primario</label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={colors.primary_color}
                  onChange={(e) => setColors({...colors, primary_color: e.target.value})}
                  className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <input 
                  type="text" 
                  value={colors.primary_color}
                  onChange={(e) => setColors({...colors, primary_color: e.target.value})}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color Secundario</label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={colors.secondary_color}
                  onChange={(e) => setColors({...colors, secondary_color: e.target.value})}
                  className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <input 
                  type="text" 
                  value={colors.secondary_color}
                  onChange={(e) => setColors({...colors, secondary_color: e.target.value})}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color de Acento</label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={colors.accent_color}
                  onChange={(e) => setColors({...colors, accent_color: e.target.value})}
                  className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <input 
                  type="text" 
                  value={colors.accent_color}
                  onChange={(e) => setColors({...colors, accent_color: e.target.value})}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color de Texto</label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={colors.text_color}
                  onChange={(e) => setColors({...colors, text_color: e.target.value})}
                  className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <input 
                  type="text" 
                  value={colors.text_color}
                  onChange={(e) => setColors({...colors, text_color: e.target.value})}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color de Fondo</label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={colors.bg_color}
                  onChange={(e) => setColors({...colors, bg_color: e.target.value})}
                  className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <input 
                  type="text" 
                  value={colors.bg_color}
                  onChange={(e) => setColors({...colors, bg_color: e.target.value})}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color de Borde</label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={colors.border_color}
                  onChange={(e) => setColors({...colors, border_color: e.target.value})}
                  className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <input 
                  type="text" 
                  value={colors.border_color}
                  onChange={(e) => setColors({...colors, border_color: e.target.value})}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-6 p-4 rounded-xl" style={{ 
            backgroundColor: colors.bg_color,
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: colors.border_color
          }}>
            <p className="text-xs font-semibold uppercase mb-3" style={{ color: colors.text_color + '80' }}>Vista Previa</p>
            <div className="flex gap-3">
              <button className="px-4 py-2 rounded-lg font-medium text-sm text-white" style={{
                backgroundColor: colors.primary_color
              }}>
                Botón Primario
              </button>
              <button className="px-4 py-2 rounded-lg font-medium text-sm" style={{
                backgroundColor: colors.secondary_color + '20',
                color: colors.secondary_color
              }}>
                Botón Secundario
              </button>
              <div className="px-4 py-2 rounded-lg font-medium text-sm" style={{
                backgroundColor: colors.accent_color + '20',
                color: colors.accent_color
              }}>
                Badge de Acento
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <i className="ph ph-check"></i> 
              {saving ? 'Guardando...' : 'Guardar Colores'}
            </button>
            <button 
              onClick={() => setColors({
                primary_color: scheme.primary_color,
                secondary_color: scheme.secondary_color,
                accent_color: scheme.accent_color,
                text_color: scheme.text_color,
                bg_color: scheme.bg_color,
                border_color: scheme.border_color
              })}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium"
            >
              Restaurar
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <i className="ph-fill ph-lock-open text-2xl text-red-600"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso Denegado</h1>
          <p className="text-slate-600 mb-6">Solo el Super Administrador puede acceder al panel de configuración de colores del sistema.</p>
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
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      {/* Header */}
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
              <button className="px-4 py-2 rounded-lg bg-brand-50 text-brand-700 font-medium text-sm transition-colors cursor-default">
                Personalización de Colores
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          
          {/* Page Title */}
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Personalización de Colores</h1>
            <p className="text-slate-500 mt-1">Configure los colores de cada módulo y área del sistema según su preferencia</p>
          </section>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Cargando esquemas de color...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {modules.map(module => (
                <ColorPicker key={module.name} module={module} />
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
