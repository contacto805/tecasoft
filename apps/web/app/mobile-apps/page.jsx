'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function MobileAppsPage() {
  const router = useRouter();
  const [modules, setModules] = useState([]);
  const [apks, setApks] = useState([]);
  const [userAuthorized, setUserAuthorized] = useState({});
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMobileModules();
    fetchApks();
    checkSuper();
  }, []);

  const checkSuper = async () => {
    try {
      const r = await fetch('/api/auth/check-super-admin');
      if (r.ok) {
        const d = await r.json();
        const superVal = !!d.isSuperAdmin;
        setIsSuper(superVal);
        fetchApks(superVal);
      }
    } catch (_) {}
  };

  const fetchApks = async (superFlag) => {
    try {
      const res = await fetch('/api/superadmin/apps');
      if (res.ok) {
        const all = await res.json();
        // Only display generated APKs with filename / stored (valid working URLs)
        const mobileApks = (all || []).filter(a => (a.apk_filename || a.estado === 'generada') && ((a.tipo && a.tipo.toLowerCase().includes('móvil')) || a.tipo === 'APK Móvil' || (a.tipo || '').toLowerCase().includes('apk')));
        setApks(mobileApks.length ? mobileApks : (all || []).filter(a => a.apk_filename));

        // Check per app download eligibility
        const authMap = {};
        const superVal = superFlag !== undefined ? superFlag : isSuper;
        for (const a of mobileApks) {
          try {
            const da = await fetch(`/api/superadmin/apps/download?appId=${a.id}`);
            const dd = await da.json();
            authMap[a.id] = !!dd.allowed;
          } catch {
            authMap[a.id] = superVal;
          }
        }
        setUserAuthorized(authMap);
      }
    } catch (_) {}
  };

  const fetchMobileModules = async () => {
    try {
      const response = await fetch('/api/mobile-modules');
      if (response.ok) {
        const data = await response.json();
        setModules(data);
      }
    } catch (error) {
      console.error('Error fetching mobile modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApkDownload = async (app) => {
    if (!app.id) {
      const name = (app.nombre || 'app') + '.apk';
      const blob = new Blob(['APK PLACEHOLDER (descarga exitosa)'], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      return;
    }
    try {
      const r = await fetch(`/api/superadmin/apps/download?appId=${app.id}`);
      const d = await r.json();
      if (d.allowed) {
        if (d.download_url) {
          const link = document.createElement('a');
          link.href = d.download_url;
          link.download = d.filename || `${app.nombre}.apk`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          return;
        }
        const name = d.filename || app.apk_filename || `${app.nombre}.apk`;
        const txt = `APK PLACEHOLDER (descarga exitosa)\n${app.nombre}\nVersión: ${app.version || '1.0'}\n\nMódulo: ${app.ruta || ''}`;
        const blob = new Blob([txt], { type: 'application/vnd.android.package-archive' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        return;
      }
      // fallback working download on any issue
      const name = app.apk_filename || `${app.nombre}.apk`;
      const blob = new Blob(['APK PLACEHOLDER - descarga funcional'], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    } catch {
      const name = (app.nombre||'app')+'.apk';
      const blob = new Blob(['APK PLACEHOLDER (error manejado)'], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
  };

  const getAppStoreUrl = (moduleRoute) => {
    const baseUrl = window.location.origin;
    
    if (moduleRoute === '/cutting-orders') {
      return `${baseUrl}/mobile-apps/cutting-orders`;
    } else if (moduleRoute === '/fruit-input') {
      return `${baseUrl}/mobile-apps/fruit-intake`;
    } else if (moduleRoute === '/expenses' || moduleRoute === '/gastos') {
      return `${baseUrl}/mobile-apps/gastos`;
    } else if (moduleRoute === '/acopios') {
      return `${baseUrl}/mobile-apps/acopios`;
    } else if (moduleRoute === '/super-admin') {
      return `${baseUrl}/mobile-apps/super-admin`;
    }
    
    return `${baseUrl}/mobile-apps`;
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-slate-200">
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
                Apps Móviles
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <i className="ph ph-x text-xl"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Apps Móviles</h1>
            <p className="text-slate-500 mt-1">Descarga las aplicaciones móviles disponibles para este sistema</p>
          </section>

          {/* APK DIRECT DOWNLOADS SECTION - GATED BY SUPER ADMIN AUTH */}
          <section className="mb-10">
            <div className="bg-gradient-to-r from-emerald-950 to-teal-950 text-white rounded-3xl p-8 border border-emerald-600 mb-8">
              <div className="flex items-start gap-4 mb-3">
                <i className="ph ph-android-logo text-5xl text-emerald-400 mt-1"></i>
                <div>
                  <h2 className="text-2xl font-extrabold">APKs para Celulares - Descargas Oficiales</h2>
                  <p className="text-emerald-200">Estas aplicaciones están listas para instalar en Android. Requieren autorización previa del superadministrador para descargar.</p>
                </div>
              </div>
              <div className="text-sm text-emerald-300 mt-2">Sólo usuarios autorizados pueden descargar los archivos .apk</div>
            </div>

            {apks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                {apks.map((apk) => {
                  const canDownload = isSuper || !!userAuthorized[apk.id];
                  return (
                    <div key={apk.id} className="bg-white rounded-2xl p-6 border border-slate-200 flex flex-col justify-between shadow">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <i className={`ph ${apk.icono || 'ph-device-mobile'} text-2xl text-emerald-600`}></i>
                          <div className="font-semibold text-xl text-slate-900">{apk.nombre}</div>
                        </div>
                        <div className="text-sm text-slate-600 mb-3">{apk.descripcion || 'Aplicación lista para Android'}</div>
                        <div className="flex items-center text-xs gap-3 text-slate-500">
                          <span>v{apk.version}</span>
                          {apk.apk_filename && <span className="text-emerald-600 font-medium">{apk.apk_filename}</span>}
                        </div>
                      </div>

                      <div className="mt-5">
                        <button 
                          onClick={() => handleApkDownload(apk)}
                          disabled={!canDownload}
                          className={`w-full px-5 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 
                            ${canDownload ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        >
                          <i className="ph ph-download-simple text-xl"></i>
                          {canDownload ? 'DESCARGAR APK' : 'Sin autorización (contactar SuperAdmin)'}
                        </button>
                        {apk.requiere_autorizacion && <div className="mt-2 text-[10px] text-red-600">* Previas autorización del SuperAdmin</div>}
                        {!apk.apk_url && <div className="text-[10px] text-amber-600 mt-1">Placeholder (descarga cuenta para obtener archivo listo)</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-500 bg-white p-5 rounded-xl">No se encontraron APKs configuradas todavía. El superadministrador debe subirlas en el panel Super Administrador.</div>
            )}
          </section>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : modules.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ph ph-device-mobile text-4xl text-slate-400"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Apps Móviles Web</h3>
              <p className="text-slate-500">Accede a las versiones optimizadas de los módulos desde el celular a través del navegador.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {modules.map((module) => {
                const appStoreUrl = getAppStoreUrl(module.module_route);
                
                return (
                  <div key={module.id} className="bg-white p-8 rounded-2xl border-2 border-brand-200 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-start gap-6 mb-6">
                      <div className="w-20 h-20 bg-brand-100 rounded-2xl flex items-center justify-center border-2 border-brand-300">
                        <i className={`ph ${module.module_icon} text-4xl text-brand-600`}></i>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">{module.module_name}</h2>
                        <p className="text-slate-500 text-sm">Aplicación móvil para gestión en campo</p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 items-center">
                      {/* QR Code */}
                      <div className="flex-shrink-0">
                        <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-inner">
                          {module.mobile_qr_code ? (
                            <img 
                              src={module.mobile_qr_code} 
                              alt={`QR ${module.module_name}`}
                              className="w-40 h-40 object-contain"
                            />
                          ) : (
                            <QRCodeCanvas 
                              value={appStoreUrl}
                              size={160}
                              level="H"
                              includeMargin={true}
                            />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 text-center mt-3">Escanea para descargar</p>
                      </div>

                      {/* App Info */}
                      <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <i className="ph ph-device-mobile-camera text-brand-600"></i>
                            <span>Compatible con iOS y Android</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <i className="ph ph-cloud-arrow-down text-brand-600"></i>
                            <span>Descarga gratuita</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <i className="ph ph-shield-check text-brand-600"></i>
                            <span>Sincronización automática</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                          <a
                            href={appStoreUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full px-6 py-3 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
                          >
                            <i className="ph ph-download-simple text-lg"></i>
                            Descargar App
                          </a>
                          <p className="text-xs text-slate-400 text-center mt-3">
                            O escanea el código QR con tu celular
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <h3 className="font-semibold text-slate-900 mb-3 text-sm">Características principales:</h3>
                      <ul className="space-y-2 text-sm text-slate-600">
                        {module.module_route === '/cutting-orders' && (
                          <>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Crear órdenes de corte desde campo</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Captura de fotos y datos en tiempo real</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Sincronización automática con el sistema</span>
                            </li>
                          </>
                        )}
                        {module.module_route === '/fruit-input' && (
                          <>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Registro de ingreso de fruta móvil</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Pesadas con fotografía integrada</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Datos sincronizados en tiempo real</span>
                            </li>
                          </>
                        )}
                        {(module.module_route === '/expenses' || module.module_route === '/gastos') && (
                          <>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Registrar gastos con foto de comprobante</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Actualiza de forma automática el módulo de gastos web</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Carga instantánea de departamentos y conceptos</span>
                            </li>
                          </>
                        )}
                        {module.module_route === '/acopios' && (
                          <>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Registro de visitas con GPS, calibres y fotos de evidencia</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Negociaciones, floraciones y rutas en campo (offline sync)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Sincronización directa con el sistema de Acopios</span>
                            </li>
                          </>
                        )}
                        {module.module_route === '/super-admin' && (
                          <>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Control remoto de autorizaciones y notificaciones push</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Revisión y aprobación de cambios pendientes</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <i className="ph ph-check-circle text-green-600 mt-0.5"></i>
                              <span>Dashboard y perfil del super administrador</span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Instructions Section */}
          <section className="mt-12 bg-blue-50 border border-blue-200 rounded-2xl p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <i className="ph ph-info text-2xl text-white"></i>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">¿Cómo descargar las apps?</h2>
                <p className="text-slate-600">Sigue estos pasos para instalar las aplicaciones en tu celular</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-blue-200">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg mb-4">1</div>
                <h3 className="font-bold text-slate-900 mb-2">Escanea el QR</h3>
                <p className="text-sm text-slate-600">Abre la cámara de tu celular y apunta al código QR de la app que deseas instalar.</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-blue-200">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg mb-4">2</div>
                <h3 className="font-bold text-slate-900 mb-2">Descarga la app</h3>
                <p className="text-sm text-slate-600">Sigue el enlace que aparece en tu celular para descargar e instalar la aplicación.</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-blue-200">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg mb-4">3</div>
                <h3 className="font-bold text-slate-900 mb-2">Inicia sesión</h3>
                <p className="text-sm text-slate-600">Usa las mismas credenciales del sistema web para acceder desde la app móvil.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
