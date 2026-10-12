'use client';

import { useState, useEffect } from 'react';

export default function ScaleSettingsPage() {
  const [user, setUser] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [devices, setDevices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    device_name: '',
    model_type: '',
    port: '',
    baud_rate: 9600,
    connection_type: 'USB'
  });

  // Check if user is super admin
  useEffect(() => {
    const checkUserPermissions = async () => {
      try {
        const userResponse = await fetch('/api/auth/user', {
          credentials: 'include',
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData);
          
          if (userData.email === 'demo@appgen.com') {
            setIsSuperAdmin(true);
            loadDevices(userData.id);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking user permissions:', error);
        setLoading(false);
      }
    };
    
    checkUserPermissions();
  }, []);

  const loadDevices = async (userId) => {
    try {
      const response = await fetch(`/api/scale-devices?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
      alert('Error al cargar los dispositivos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();

    if (!formData.device_name) {
      alert('El nombre del dispositivo es requerido');
      return;
    }

    try {
      const response = await fetch('/api/scale-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          device_name: formData.device_name,
          model_type: formData.model_type,
          port: formData.port,
          baud_rate: parseInt(formData.baud_rate),
          connection_type: formData.connection_type
        })
      });

      if (response.ok) {
        const newDevice = await response.json();
        setDevices([...devices, newDevice]);
        setFormData({
          device_name: '',
          model_type: '',
          port: '',
          baud_rate: 9600,
          connection_type: 'USB'
        });
        setShowForm(false);
        alert('Dispositivo agregado exitosamente');
      } else {
        alert('Error al agregar el dispositivo');
      }
    } catch (error) {
      console.error('Error adding device:', error);
      alert('Error de conexión');
    }
  };

  const handleToggleDevice = async (deviceId, currentStatus) => {
    try {
      const response = await fetch('/api/scale-devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deviceId,
          is_enabled: !currentStatus
        })
      });

      if (response.ok) {
        const updated = await response.json();
        // Update local state to reflect single enabled device
        const newDevices = devices.map(d => ({
          ...d,
          is_enabled: d.id === deviceId ? !currentStatus : false
        }));
        setDevices(newDevices);
        alert('Dispositivo actualizado exitosamente');
      }
    } catch (error) {
      console.error('Error toggling device:', error);
      alert('Error al actualizar el dispositivo');
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este dispositivo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/scale-devices?id=${deviceId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setDevices(devices.filter(d => d.id !== deviceId));
        alert('Dispositivo eliminado exitosamente');
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      alert('Error al eliminar el dispositivo');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <i className="ph-fill ph-spinner text-4xl text-green-600"></i>
          </div>
          <p className="text-slate-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-red-500">
            <i className="ph-fill ph-warning-circle text-6xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso Denegado</h1>
          <p className="text-slate-600">Solo el Super Administrador puede acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center border border-blue-500/20">
              <i className="ph-fill ph-plugs text-blue-600"></i>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Configuración de Básculas USB</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Info Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
            <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <i className="ph ph-info text-blue-600"></i>
              ¿Cómo conectar básculas USB?
            </h2>
            <ul className="text-sm text-slate-700 space-y-2">
              <li>
                <strong>Paso 1:</strong> Conecta la báscula a un puerto USB en tu computadora
              </li>
              <li>
                <strong>Paso 2:</strong> Haz clic en "Agregar Nueva Báscula" para registrarla en el sistema
              </li>
              <li>
                <strong>Paso 3:</strong> Selecciona el dispositivo USB que aparecerá en el navegador (requiere navegador moderno como Chrome, Edge o Safari)
              </li>
              <li>
                <strong>Paso 4:</strong> Activa la báscula marcando "Usar esta báscula" para que se sincronice con el módulo de Ingreso de Fruta
              </li>
              <li>
                <strong>Nota:</strong> Solo una báscula puede estar activa a la vez. Las básculas compatibles son aquellas que envían datos vía USB Serial
              </li>
            </ul>
          </div>

          {/* Add Device Button */}
          <div className="mb-8">
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
              >
                <i className="ph ph-plus-circle text-lg"></i>
                Agregar Nueva Báscula
              </button>
            )}
          </div>

          {/* Add Device Form */}
          {showForm && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
              <h2 className="font-bold text-lg text-slate-900 mb-6">Nueva Báscula USB</h2>
              
              <form onSubmit={handleAddDevice} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Nombre del Dispositivo *</label>
                    <input
                      type="text"
                      value={formData.device_name}
                      onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                      placeholder="Ej. Báscula Entrada Fruta"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Modelo de Báscula</label>
                    <input
                      type="text"
                      value={formData.model_type}
                      onChange={(e) => setFormData({ ...formData, model_type: e.target.value })}
                      placeholder="Ej. Ohaus Defender 3000"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Puerto Serial</label>
                    <input
                      type="text"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      placeholder="Ej. COM3 (Windows) o /dev/ttyUSB0 (Linux)"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Velocidad Transmisión (Baud Rate)</label>
                    <select
                      value={formData.baud_rate}
                      onChange={(e) => setFormData({ ...formData, baud_rate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    >
                      <option value={9600}>9600 (más común)</option>
                      <option value={4800}>4800</option>
                      <option value={19200}>19200</option>
                      <option value={38400}>38400</option>
                      <option value={57600}>57600</option>
                      <option value={115200}>115200</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Tipo de Conexión</label>
                    <select
                      value={formData.connection_type}
                      onChange={(e) => setFormData({ ...formData, connection_type: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    >
                      <option value="USB">USB</option>
                      <option value="Serial RS-232">Serial RS-232</option>
                      <option value="Bluetooth">Bluetooth</option>
                      <option value="Network">Red (Ethernet)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2"
                  >
                    <i className="ph ph-check-circle text-lg"></i>
                    Guardar Dispositivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-3 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Devices List */}
          {devices.length > 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                <i className="ph-fill ph-list text-blue-600"></i>
                Básculas Registradas ({devices.length})
              </h2>

              <div className="space-y-4">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      device.is_enabled
                        ? 'bg-green-50 border-green-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                          <i className="ph-fill ph-plugs text-blue-600"></i>
                          {device.device_name}
                          {device.is_enabled && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <i className="ph ph-check-circle mr-1"></i>
                              Activa
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-slate-600 mt-1">
                          {device.model_type && (
                            <>
                              <strong>Modelo:</strong> {device.model_type}
                              <br />
                            </>
                          )}
                          <strong>Tipo de Conexión:</strong> {device.connection_type}
                          <br />
                          {device.port && (
                            <>
                              <strong>Puerto:</strong> {device.port}
                              <br />
                            </>
                          )}
                          <strong>Velocidad:</strong> {device.baud_rate} baud
                          {device.last_connected && (
                            <>
                              <br />
                              <strong>Última Conexión:</strong> {new Date(device.last_connected).toLocaleString('es-MX')}
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleDevice(device.id, device.is_enabled)}
                          className={`px-4 py-2 font-medium rounded-xl transition-all flex items-center gap-2 ${
                            device.is_enabled
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          <i className={`ph ${device.is_enabled ? 'ph-x-circle' : 'ph-check-circle'}`}></i>
                          {device.is_enabled ? 'Desactivar' : 'Usar Esta Báscula'}
                        </button>
                        <button
                          onClick={() => handleDeleteDevice(device.id)}
                          className="px-4 py-2 bg-red-100 text-red-700 font-medium rounded-xl hover:bg-red-200 transition-all flex items-center gap-2"
                        >
                          <i className="ph ph-trash"></i>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="mb-4 text-slate-400">
                <i className="ph-fill ph-plugs text-5xl"></i>
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">No hay básculas registradas</h3>
              <p className="text-slate-600 mb-6">Haz clic en "Agregar Nueva Báscula" para registrar tu primer dispositivo</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-2"
              >
                <i className="ph ph-plus-circle text-lg"></i>
                Agregar Nueva Báscula
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
