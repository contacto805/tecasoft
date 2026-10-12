'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportesAutomaticosPage() {
  const router = useRouter();
  const [driveConfig, setDriveConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    rootFolderId: ''
  });
  
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchDriveConfig();
  }, []);

  const fetchDriveConfig = async () => {
    try {
      const res = await fetch('/api/google-drive-config');
      if (res.ok) {
        const data = await res.json();
        setDriveConfig(data);
      }
    } catch (error) {
      console.error('Error fetching drive config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!formData.clientId || !formData.clientSecret || !formData.refreshToken) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }
    
    setSaving(true);
    try {
      const res = await fetch('/api/google-drive-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await res.json();
      
      if (res.ok) {
        alert('Configuración guardada exitosamente');
        setFormData({
          clientId: '',
          clientSecret: '',
          refreshToken: '',
          rootFolderId: ''
        });
        await fetchDriveConfig();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!confirm('¿Estás seguro de eliminar la configuración de Google Drive?')) return;
    
    try {
      const res = await fetch('/api/google-drive-config', { method: 'DELETE' });
      if (res.ok) {
        alert('Configuración eliminada');
        await fetchDriveConfig();
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      alert('Error al eliminar configuración');
    }
  };

  const handleGenerateTestReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch('/api/reports/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload-to-drive',
          date: testDate
        })
      });
      
      const result = await res.json();
      
      if (result.success) {
        alert(`Reporte generado y subido exitosamente:\n${result.fileName}\nCarpeta: ${result.folderPath}`);
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar reporte');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const res = await fetch(`/api/reports/daily?date=${testDate}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-diario-${testDate}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error al descargar reporte');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Error al descargar reporte');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="text-lg text-slate-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
            >
              ← Volver
            </button>
            <h1 className="text-3xl font-bold text-slate-800">Reportes Automáticos</h1>
            <p className="text-slate-600 mt-2">
              Configura la generación y subida automática de reportes diarios a Google Drive
            </p>
          </div>
        </div>

        {/* Estado de Configuración */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Estado de Configuración</h2>
          
          {driveConfig && driveConfig.configured ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Google Drive configurado correctamente</span>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Client ID:</span>
                  <span className="text-slate-800">{driveConfig.hasClientId ? '✓ Configurado' : '✗ Falta'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Client Secret:</span>
                  <span className="text-slate-800">{driveConfig.hasClientSecret ? '✓ Configurado' : '✗ Falta'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Refresh Token:</span>
                  <span className="text-slate-800">{driveConfig.hasRefreshToken ? '✓ Configurado' : '✗ Falta'}</span>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4 text-sm">
                <p className="text-blue-800 font-medium mb-2">📁 Organización de Archivos</p>
                <p className="text-blue-700">
                  Los reportes se organizarán automáticamente en carpetas por año y mes:<br/>
                  <span className="font-mono text-xs">Reportes Diarios / 2025 / enero / Reporte-Diario-2025-01-15.xlsx</span>
                </p>
              </div>
              
              <button
                onClick={handleDeleteConfig}
                className="mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                Eliminar Configuración
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-amber-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">Google Drive no está configurado</span>
            </div>
          )}
        </div>

        {/* Configuración de Google Drive */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Configurar Google Drive</h2>
          
          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-sm">
            <p className="text-blue-800 font-medium mb-2">📖 Instrucciones:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Ve a <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline">Google Cloud Console</a></li>
              <li>Crea un proyecto nuevo o selecciona uno existente</li>
              <li>Habilita la API de Google Drive</li>
              <li>Crea credenciales OAuth 2.0 (Client ID y Client Secret)</li>
              <li>Genera un Refresh Token usando <a href="https://developers.google.com/oauthplayground" target="_blank" className="underline">OAuth Playground</a></li>
              <li>Pega las credenciales aquí abajo</li>
            </ol>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Client ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                placeholder="123456789-abc.apps.googleusercontent.com"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Client Secret <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.clientSecret}
                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                placeholder="GOCSPX-..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Refresh Token <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.refreshToken}
                onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value })}
                placeholder="1//..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                ID de Carpeta Raíz (opcional)
              </label>
              <input
                type="text"
                value={formData.rootFolderId}
                onChange={(e) => setFormData({ ...formData, rootFolderId: e.target.value })}
                placeholder="Si está vacío, se creará automáticamente"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                ID de la carpeta donde se guardarán los reportes. Si no se especifica, se creará una carpeta "Reportes Diarios - Tecavo"
              </p>
            </div>
            
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </div>

        {/* Prueba de Reporte */}
        {driveConfig && driveConfig.configured && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Generar Reporte de Prueba</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fecha del Reporte
                </label>
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleDownloadReport}
                  className="py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                >
                  📥 Descargar Reporte
                </button>
                
                <button
                  onClick={handleGenerateTestReport}
                  disabled={generatingReport}
                  className="py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingReport ? 'Generando...' : '☁️ Subir a Drive'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info sobre Cron Job */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">🕐 Ejecución Automática</h2>
          
          <div className="bg-amber-50 rounded-lg p-4 text-sm">
            <p className="text-amber-800 font-medium mb-2">⚙️ Configuración Automática</p>
            <p className="text-amber-700 mb-3">
              Los reportes se generarán automáticamente todos los días a medianoche y se subirán a Google Drive organizados por año y mes.
            </p>
            
            <div className="bg-white rounded p-3 space-y-2 text-xs font-mono">
              <div className="text-slate-600">Endpoint cron:</div>
              <div className="text-blue-600">/api/cron/daily-report</div>
              <div className="text-slate-600 mt-3">Horario:</div>
              <div className="text-blue-600">0 0 * * * (Diario a medianoche)</div>
            </div>
            
            <p className="text-amber-700 mt-3 text-xs">
              Para plataformas como Vercel, agrega esta configuración en <code className="bg-amber-100 px-1 rounded">vercel.json</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
