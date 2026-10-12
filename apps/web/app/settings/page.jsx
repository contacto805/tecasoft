'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

function BrandingSettings() {
  const [branding, setBranding] = useState({
    background_color: '#ffffff',
    primary_color: '#0E4A22',
    secondary_color: '#963821',
    accent_color: '#E0DA62',
    watermark_enabled: false,
    watermark_opacity: 15,
    watermark_position: 'center',
    logo_url: null,
    currency: 'MXN',
    company_name: 'TECAVO SOFT',
    company_address: 'Dirección de empresa',
    sader_registry: 'Registro SADER'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [previewLogo, setPreviewLogo] = useState(null);

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const res = await fetch('/api/branding');
      if (res.ok) {
        const data = await res.json();
        
        // Fetch company info from settings
        let companyName = 'TECAVO SOFT';
        let companyAddress = 'Dirección de empresa';
        let saderRegistry = 'Registro SADER';
        
        try {
          const settingsRes = await fetch('/api/settings');
          if (settingsRes.ok) {
            const settings = await settingsRes.json();
            companyName = settings.company_name || settings['company_name'] || 'TECAVO SOFT';
            companyAddress = settings.company_address || settings['company_address'] || 'Dirección de empresa';
            saderRegistry = settings.sader_registry || settings['sader_registry'] || 'Registro SADER';
          }
        } catch (error) {
          console.warn('Could not fetch company settings:', error);
        }
        
        setBranding({
          ...data,
          company_name: companyName,
          company_address: companyAddress,
          sader_registry: saderRegistry
        });
        if (data.logo_url) {
          setPreviewLogo(data.logo_url);
        }
      }
    } catch (error) {
      console.error('Error fetching branding:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/branding/upload-logo', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setBranding({ ...branding, logo_url: data.logoUrl });
        setPreviewLogo(data.logoUrl);
        alert('✅ Logo subido exitosamente');
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('❌ Error al subir el logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding)
      });

      if (res.ok) {
        // Save company info to settings
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_name: branding.company_name,
              company_address: branding.company_address,
              sader_registry: branding.sader_registry
            })
          });
        } catch (err) {
          console.warn('Could not save company settings:', err);
        }
        
        alert('✅ Configuración de marca guardada exitosamente');
        window.location.reload();
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving branding:', error);
      alert('❌ Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const positions = [
    { value: 'top-left', label: 'Arriba a la Izquierda' },
    { value: 'top-center', label: 'Arriba al Centro' },
    { value: 'top-right', label: 'Arriba a la Derecha' },
    { value: 'center-left', label: 'Centro Izquierda' },
    { value: 'center', label: 'Centro' },
    { value: 'center-right', label: 'Centro Derecha' },
    { value: 'bottom-left', label: 'Abajo a la Izquierda' },
    { value: 'bottom-center', label: 'Abajo al Centro' },
    { value: 'bottom-right', label: 'Abajo a la Derecha' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="ph ph-spinner text-4xl text-slate-400 animate-spin"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i className="ph ph-image text-xl"></i>
            Logo de la Empresa
          </h2>
          <p className="text-sm text-slate-500 mt-1">Sube el logo que aparecerá como marca de agua en el dashboard</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upload Area */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-4">Sube tu Logo</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-brand-500 hover:bg-brand-50/50 transition-all cursor-pointer group">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  disabled={logoUploading}
                  className="hidden"
                  id="logo-upload"
                />
                <label htmlFor="logo-upload" className="cursor-pointer block">
                  {logoUploading ? (
                    <>
                      <i className="ph ph-spinner text-4xl text-brand-600 animate-spin mb-3 block"></i>
                      <p className="text-sm text-slate-600 font-medium">Subiendo...</p>
                    </>
                  ) : (
                    <>
                      <i className="ph ph-cloud-arrow-up text-4xl text-slate-400 group-hover:text-brand-600 mb-3 block transition-colors"></i>
                      <p className="text-sm font-medium text-slate-900 mb-1">Arrastra tu logo aquí o haz click</p>
                      <p className="text-xs text-slate-500">JPG, PNG, SVG o WEBP • Máx 5MB</p>
                    </>
                  )}
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-2">💡 Recomendado: Logo transparente en formato PNG o SVG para mejor visualización</p>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-4">Vista Previa</label>
              <div className="border-2 border-slate-200 rounded-xl p-8 bg-slate-50 flex items-center justify-center min-h-[250px]">
                {previewLogo ? (
                  <div className="text-center">
                    <img
                      src={previewLogo}
                      alt="Logo preview"
                      className="max-w-[150px] max-h-[150px] mx-auto object-contain mb-3"
                      style={{ opacity: (branding.watermark_opacity || 15) / 100 }}
                    />
                    <p className="text-xs text-slate-500">Logo cargado exitosamente</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <i className="ph ph-image text-4xl text-slate-300 mb-3 block"></i>
                    <p className="text-sm text-slate-500">No hay logo cargado aún</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Watermark Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i className="ph ph-water-drop text-xl"></i>
            Configuración de Marca de Agua
          </h2>
          <p className="text-sm text-slate-500 mt-1">Personaliza cómo aparece la marca de agua en el dashboard</p>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {/* Enable Watermark */}
            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <div>
                <h3 className="font-semibold text-slate-900">Mostrar Marca de Agua</h3>
                <p className="text-sm text-slate-500 mt-0.5">Habilita la marca de agua del logo en el dashboard</p>
              </div>
              <button
                onClick={() => setBranding({ ...branding, watermark_enabled: !branding.watermark_enabled })}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  branding.watermark_enabled ? 'bg-brand-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    branding.watermark_enabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {branding.watermark_enabled && (
              <>
                {/* Opacity */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Opacidad: {branding.watermark_opacity}%
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={branding.watermark_opacity || 15}
                    onChange={(e) => setBranding({ ...branding, watermark_opacity: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>Más transparente</span>
                    <span>Más visible</span>
                  </div>
                </div>

                {/* Position */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Posición de la Marca de Agua</label>
                  <select
                    value={branding.watermark_position || 'center'}
                    onChange={(e) => setBranding({ ...branding, watermark_position: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                  >
                    {positions.map(pos => (
                      <option key={pos.value} value={pos.value}>{pos.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Company Information Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i className="ph ph-building text-xl"></i>
            Información de la Empresa
          </h2>
          <p className="text-sm text-slate-500 mt-1">Configura los datos que aparecerán en los tickets de impresión</p>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre de la Empresa</label>
              <input
                type="text"
                value={branding.company_name || ''}
                onChange={(e) => setBranding({ ...branding, company_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                placeholder="Ej: TECAVO SOFT"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Dirección</label>
              <textarea
                value={branding.company_address || ''}
                onChange={(e) => setBranding({ ...branding, company_address: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 resize-none"
                placeholder="Ej: Calle Principal 123, Ciudad"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Registro SADER</label>
              <input
                type="text"
                value={branding.sader_registry || ''}
                onChange={(e) => setBranding({ ...branding, sader_registry: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                placeholder="Ej: SADER-123456"
              />
              <p className="text-xs text-slate-500 mt-2">💡 Este número aparecerá en los tickets de venta</p>
            </div>
          </div>
        </div>
      </div>

      {/* Currency Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i className="ph ph-currency-dollar text-xl"></i>
            Configuración de Moneda
          </h2>
          <p className="text-sm text-slate-500 mt-1">Selecciona la moneda por defecto del sistema</p>
        </div>

        <div className="p-6">
          <div className="max-w-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Moneda del Sistema</label>
            <select
              value={branding.currency || 'MXN'}
              onChange={(e) => setBranding({ ...branding, currency: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 font-semibold"
            >
              <option value="MXN">🇲🇽 Peso Mexicano (MXN) — usa signo $</option>
              <option value="USD">🇺🇸 Dólar Estadounidense (USD) — usa signo $</option>
            </select>
            <p className="text-xs text-slate-500 mt-3">
              💡 Esta moneda se usará en facturas, tickets de venta y reportes de ingresos
            </p>
          </div>
        </div>
      </div>

      {/* Colors Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i className="ph ph-palette text-xl"></i>
            Colores Corporativos
          </h2>
          <p className="text-sm text-slate-500 mt-1">Configura los colores principales de la marca</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Color de Fondo</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.background_color || '#ffffff'}
                  onChange={(e) => setBranding({ ...branding, background_color: e.target.value })}
                  className="w-16 h-10 rounded-lg border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.background_color || '#ffffff'}
                  onChange={(e) => setBranding({ ...branding, background_color: e.target.value })}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Color Primario</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.primary_color || '#0E4A22'}
                  onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                  className="w-16 h-10 rounded-lg border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.primary_color || '#0E4A22'}
                  onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Color Secundario</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.secondary_color || '#963821'}
                  onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                  className="w-16 h-10 rounded-lg border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.secondary_color || '#963821'}
                  onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Color de Acento</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.accent_color || '#E0DA62'}
                  onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                  className="w-16 h-10 rounded-lg border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.accent_color || '#E0DA62'}
                  onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => fetchBranding()}
          className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors flex items-center gap-2"
        >
          <i className="ph ph-arrow-clockwise"></i>
          Restaurar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25 font-medium transition-all flex items-center gap-2"
        >
          {saving ? (
            <>
              <i className="ph ph-spinner animate-spin"></i>
              Guardando...
            </>
          ) : (
            <>
              <i className="ph ph-check"></i>
              Guardar Configuración
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ScaleDevicesSettings({ userId }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDevice, setNewDevice] = useState({
    deviceName: '',
    modelType: 'generic',
    connectionType: 'serial',
    port: 'COM1'
  });

  const scaleModels = [
    { value: 'generic', label: 'Escala Genérica (RS-232)' },
    { value: 'mettler', label: 'Mettler Toledo' },
    { value: 'ohaus', label: 'Ohaus' },
    { value: 'A&D', label: 'A&D Engineering' },
    { value: 'hardy', label: 'Hardy Instruments' },
    { value: 'cas', label: 'CAS' },
    { value: 'ishida', label: 'Ishida' }
  ];

  const connectionTypes = [
    { value: 'serial', label: 'Puerto Serial (RS-232)' },
    { value: 'usb', label: 'Puerto USB' },
    { value: 'ethernet', label: 'Red (Ethernet)' },
    { value: 'bluetooth', label: 'Bluetooth' }
  ];

  useEffect(() => {
    if (userId) {
      fetchDevices();
    }
  }, [userId]);

  const fetchDevices = async () => {
    try {
      const res = await fetch(`/api/scale-devices?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (error) {
      console.error('Error fetching scale devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDevice = async () => {
    if (!newDevice.deviceName || !newDevice.modelType) {
      alert('❌ Por favor completa todos los campos requeridos');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/scale-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...newDevice
        })
      });

      if (res.ok) {
        const device = await res.json();
        setDevices([...devices, device]);
        setShowModal(false);
        setNewDevice({
          deviceName: '',
          modelType: 'generic',
          connectionType: 'serial',
          port: 'COM1'
        });
        alert('✅ Escala registrada exitosamente');
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating device:', error);
      alert('❌ Error al registrar la escala');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleDevice = async (deviceId, isEnabled) => {
    try {
      const res = await fetch(`/api/scale-devices/${deviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !isEnabled })
      });

      if (res.ok) {
        const updated = await res.json();
        setDevices(devices.map(d => d.id === deviceId ? updated : d));
      } else {
        alert('❌ Error al actualizar escala');
      }
    } catch (error) {
      console.error('Error toggling device:', error);
      alert('❌ Error al actualizar escala');
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!confirm('¿Estás seguro que deseas eliminar esta escala?')) {
      return;
    }

    try {
      const res = await fetch(`/api/scale-devices/${deviceId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setDevices(devices.filter(d => d.id !== deviceId));
        alert('✅ Escala eliminada exitosamente');
      } else {
        alert('❌ Error al eliminar escala');
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      alert('❌ Error al eliminar escala');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i className="ph ph-scale text-xl"></i>
            Configuración de Escalas
          </h2>
          <p className="text-sm text-slate-500 mt-1">Conecta y configura escalas externas para sincronización automática de peso</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2"
        >
          <i className="ph ph-plus-circle"></i>
          Agregar Escala
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12">
            <i className="ph ph-spinner animate-spin text-3xl text-slate-400 mb-3"></i>
            <p className="text-slate-500">Cargando escalas...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12">
            <i className="ph ph-scale text-6xl text-slate-300 mb-4"></i>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No hay escalas configuradas</h3>
            <p className="text-slate-500 mb-6">Agrega una escala para habilitar la sincronización automática de peso</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              <i className="ph ph-plus mr-2"></i>
              Agregar Primera Escala
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <div
                key={device.id}
                className="border-2 border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:bg-slate-50 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <i className="ph ph-scale text-lg text-brand-600"></i>
                      {device.device_name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{scaleModels.find(m => m.value === device.model_type)?.label || device.model_type}</p>
                  </div>
                  <button
                    onClick={() => handleToggleDevice(device.id, device.is_enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      device.is_enabled ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                    title={device.is_enabled ? 'Habilitar' : 'Deshabilitar'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        device.is_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Device Details */}
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <i className="ph ph-plugs text-slate-400"></i>
                    <span className="text-xs">
                      {connectionTypes.find(c => c.value === device.connection_type)?.label || device.connection_type}
                    </span>
                  </div>
                  {device.port && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <i className="ph ph-link-break text-slate-400"></i>
                      <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{device.port}</span>
                    </div>
                  )}
                  {device.last_connected && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <i className="ph ph-clock text-slate-400"></i>
                      <span className="text-xs">
                        Última conexión: {new Date(device.last_connected).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  {device.is_enabled ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                      <i className="ph ph-check-circle"></i>
                      Habilitada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                      <i className="ph ph-warning-circle"></i>
                      Deshabilitada
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleDeleteDevice(device.id)}
                    className="flex-1 px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                  >
                    <i className="ph ph-trash"></i>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i className="ph ph-plus-circle text-xl"></i>
                Agregar Nueva Escala
              </h3>
              <p className="text-sm text-slate-500 mt-1">Configura una escala para sincronización automática de peso</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre de la Escala</label>
                <input
                  type="text"
                  value={newDevice.deviceName}
                  onChange={(e) => setNewDevice({ ...newDevice, deviceName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                  placeholder="Ej: Escala Principal"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Modelo de Escala</label>
                <select
                  value={newDevice.modelType}
                  onChange={(e) => setNewDevice({ ...newDevice, modelType: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                >
                  {scaleModels.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Conexión</label>
                <select
                  value={newDevice.connectionType}
                  onChange={(e) => setNewDevice({ ...newDevice, connectionType: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                >
                  {connectionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Puerto de Conexión</label>
                <input
                  type="text"
                  value={newDevice.port}
                  onChange={(e) => setNewDevice({ ...newDevice, port: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 font-mono"
                  placeholder="Ej: COM1, /dev/ttyUSB0"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-semibold mb-1">💡 Información importante:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>La escala debe estar conectada antes de habilitar la sincronización</li>
                  <li>Verifica el puerto correcto en la configuración de tu escala</li>
                  <li>Una vez guardada, podrás habilitarla en el módulo de pesadas</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setNewDevice({
                    deviceName: '',
                    modelType: 'generic',
                    connectionType: 'serial',
                    port: 'COM1'
                  });
                }}
                className="px-5 py-2.5 text-sm bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateDevice}
                disabled={creating}
                className="px-5 py-2.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <i className="ph ph-spinner animate-spin"></i>
                    Guardando...
                  </>
                ) : (
                  <>
                    <i className="ph ph-check"></i>
                    Guardar Escala
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [originalModules, setOriginalModules] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ name: '', email: '', pin: '' });
  const [creating, setCreating] = useState(false);

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
    { name: 'Configuración de Colores', key: 'color-settings' }
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

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
        setOriginalModules(JSON.parse(JSON.stringify(modules)));
        setSelectedModules(modules);
      }
    } catch (error) {
      console.error('Error fetching user modules:', error);
    }
  };

  const toggleModule = (moduleKey) => {
    const existingIndex = selectedModules.findIndex(m => m.module_name === moduleKey);
    
    if (existingIndex >= 0) {
      setSelectedModules(selectedModules.filter(m => m.module_name !== moduleKey));
    } else {
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
        setOriginalModules(JSON.parse(JSON.stringify(selectedModules)));
        alert('✅ Permisos guardados exitosamente');
        fetchUsers();
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
    setSelectedModules(JSON.parse(JSON.stringify(originalModules)));
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    if (!confirm(`¿Estás seguro que deseas eliminar al usuario ${selectedUser.name}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        alert('✅ Usuario eliminado exitosamente');
        setSelectedUser(null);
        setSelectedModules([]);
        setOriginalModules([]);
        fetchUsers();
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('❌ Error al eliminar usuario');
    }
  };

  const handleUpdatePin = async () => {
    if (!selectedUser) return;
    
    const newPin = prompt('Ingresa el nuevo PIN de 4 dígitos:', '');
    
    if (!newPin) return;
    
    if (!/^\d{4}$/.test(newPin)) {
      alert('❌ El PIN debe tener exactamente 4 dígitos numéricos');
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin })
      });

      if (res.ok) {
        alert('✅ PIN actualizado exitosamente');
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating PIN:', error);
      alert('❌ Error al actualizar PIN');
    }
  };

  const handleCreateUser = async () => {
    if (!newUserData.name || !newUserData.email || !newUserData.pin) {
      alert('❌ Todos los campos son requeridos');
      return;
    }

    if (!/^\d{4}$/.test(newUserData.pin)) {
      alert('❌ El PIN debe tener exactamente 4 dígitos numéricos');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(newUserData.email)) {
      alert('❌ El email no es válido');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData)
      });

      if (res.ok) {
        alert('✅ Usuario creado exitosamente');
        setShowNewUserModal(false);
        setNewUserData({ name: '', email: '', pin: '' });
        fetchUsers();
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('❌ Error al crear usuario');
    } finally {
      setCreating(false);
    }
  };

  const hasChanges = JSON.stringify(selectedModules) !== JSON.stringify(originalModules);

  const isModuleEnabled = (moduleKey) => {
    return selectedModules.some(m => m.module_name === moduleKey);
  };

  const getModulePermissions = (moduleKey) => {
    return selectedModules.find(m => m.module_name === moduleKey);
  };

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
              <h1 className="text-xl font-bold text-slate-900">Configuración del Sistema</h1>
              <p className="text-xs text-slate-500">Panel de Super Administrador</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="ph ph-users mr-2"></i>
              Gestión de Usuarios
            </button>
            <button
              onClick={() => setActiveTab('colors')}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'colors'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="ph ph-palette mr-2"></i>
              Configuración de Colores
            </button>
            <button
              onClick={() => setActiveTab('scales')}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'scales'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="ph ph-scale mr-2"></i>
              Configuración de Escalas
            </button>
            <button
              onClick={() => setActiveTab('branding')}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'branding'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="ph ph-image mr-2"></i>
              Marca y Marca de Agua
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {activeTab === 'users' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Users List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <i className="ph ph-users text-lg"></i>
                      Usuarios del Sistema
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Gestiona usuarios y permisos</p>
                  </div>
                  <button
                    onClick={() => setShowNewUserModal(true)}
                    className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                    title="Agregar nuevo usuario"
                  >
                    <i className="ph ph-plus text-lg"></i>
                  </button>
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
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <i className="ph ph-user-gear text-xl"></i>
                          Configuración de {selectedUser.name}
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

                    {/* User Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdatePin}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <i className="ph ph-key"></i>
                        Cambiar PIN
                      </button>
                      <button
                        onClick={handleDeleteUser}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                      >
                        <i className="ph ph-trash"></i>
                        Eliminar Usuario
                      </button>
                    </div>
                  </div>

                  {/* Modules Grid */}
                  <div className="p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Módulos y Permisos</h3>
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
                            Guardar Permisos
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : activeTab === 'colors' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="text-center mb-8">
              <i className="ph ph-palette text-6xl text-brand-600 mb-4"></i>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Configuración de Colores</h2>
              <p className="text-slate-500">Personaliza los colores de cada módulo del sistema</p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => router.push('/color-settings')}
                className="px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2"
              >
                <i className="ph ph-palette"></i>
                Ir a Configuración de Colores
              </button>
            </div>
          </div>
        ) : activeTab === 'branding' ? (
          <BrandingSettings />
        ) : (
          <ScaleDevicesSettings userId={userId} />
        )}
      </main>

      {/* New User Modal */}
      {showNewUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i className="ph ph-user-plus text-xl"></i>
                Crear Nuevo Usuario
              </h3>
              <p className="text-sm text-slate-500 mt-1">Completa los datos del nuevo usuario</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre Completo</label>
                <input
                  type="text"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">PIN (4 dígitos)</label>
                <input
                  type="text"
                  value={newUserData.pin}
                  onChange={(e) => setNewUserData({ ...newUserData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 font-mono text-lg tracking-widest"
                  placeholder="••••"
                  maxLength={4}
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewUserModal(false);
                  setNewUserData({ name: '', email: '', pin: '' });
                }}
                className="px-5 py-2.5 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                disabled={creating}
                className="px-5 py-2.5 text-sm bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <i className="ph ph-spinner animate-spin"></i>
                    Creando...
                  </>
                ) : (
                  <>
                    <i className="ph ph-check"></i>
                    Crear Usuario
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
