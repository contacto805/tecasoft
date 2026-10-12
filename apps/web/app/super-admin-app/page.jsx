'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SuperAdminAppPage() {
  const router = useRouter();
  const [copiedSteps, setCopiedSteps] = useState({});

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedSteps({ ...copiedSteps, [key]: true });
    setTimeout(() => setCopiedSteps({ ...copiedSteps, [key]: false }), 2000);
  };

  const buildSteps = [
    {
      id: 'account',
      title: '1. Crear Cuenta de Expo',
      description: 'Necesita una cuenta para compilar la aplicación',
      url: 'https://expo.dev',
      details: 'Ir a https://expo.dev → Sign Up → Crear con email y contraseña → Verificar email'
    },
    {
      id: 'cli',
      title: '2. Instalar EAS CLI',
      description: 'Herramienta para compilar y descargar la app',
      command: 'npm install -g eas-cli',
      details: 'Ejecuta este comando en tu terminal para instalar EAS CLI globalmente'
    },
    {
      id: 'build',
      title: '3. Compilar la App',
      description: 'Genera el APK listo para instalar',
      command: 'cd /home/user/apps/super-admin-mobile && eas build --platform android --profile preview',
      details: 'Este comando compilará tu app. La primera compilación tarda 10-15 minutos'
    }
  ];

  const features = [
    {
      icon: 'ph-bell',
      title: 'Notificaciones en Tiempo Real',
      description: 'Recibe alertas automáticas cuando se registren o modifiquen lotificaciones'
    },
    {
      icon: 'ph-check-circle',
      title: 'Aprobación de Cambios',
      description: 'Revisa y aprueba o rechaza cambios pendientes antes de confirmarse'
    },
    {
      icon: 'ph-chart-bar',
      title: 'Dashboard Ejecutivo',
      description: 'Panel con estadísticas en tiempo real de toda la operación'
    },
    {
      icon: 'ph-lock',
      title: 'Acceso Total',
      description: 'Acceso exclusivo para Super Administrador con todos los permisos'
    },
    {
      icon: 'ph-list',
      title: 'Centro de Notificaciones',
      description: 'Historial completo de notificaciones push con seguimiento'
    },
    {
      icon: 'ph-user',
      title: 'Gestión de Perfil',
      description: 'Configuración de cuenta y preferencias de notificaciones'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <section className="mb-14 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-100 rounded-2xl mb-4">
            <i className="ph ph-phone text-3xl text-brand-600"></i>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">App Super Administrador</h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Descarga e instala la aplicación móvil exclusiva del Super Administrador con acceso total al sistema y notificaciones en tiempo real.
          </p>
        </section>

        {/* Features Grid */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Características</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="bg-white rounded-xl p-6 border border-slate-200 hover:border-brand-400 hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-brand-50 rounded-lg flex items-center justify-center mb-4">
                  <i className={`ph ${feature.icon} text-2xl text-brand-600`}></i>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Installation Steps */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Pasos para Descargar e Instalar</h2>
          
          <div className="space-y-4 mb-10">
            {buildSteps.map((step) => (
              <div key={step.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
                <button
                  onClick={() => copyToClipboard(step.command || step.url, step.id)}
                  className="w-full p-6 flex items-start justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">{step.title}</h3>
                    <p className="text-slate-600 mb-3">{step.description}</p>
                    {step.command && (
                      <code className="bg-slate-900 text-emerald-400 px-4 py-2 rounded-lg block text-sm font-mono mb-2 break-all">
                        {step.command}
                      </code>
                    )}
                    {step.url && (
                      <a href={step.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-2">
                        {step.url}
                        <i className="ph ph-arrow-up-right"></i>
                      </a>
                    )}
                    <p className="text-sm text-slate-500 mt-3">{step.details}</p>
                  </div>
                  {step.command && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(step.command, step.id);
                      }}
                      className="ml-4 px-4 py-2 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      {copiedSteps[step.id] ? (
                        <>
                          <i className="ph ph-check"></i>
                          Copiado
                        </>
                      ) : (
                        <>
                          <i className="ph ph-copy"></i>
                          Copiar
                        </>
                      )}
                    </button>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Access */}
        <section className="mb-16 bg-white rounded-2xl border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Acceso Rápido</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="https://expo.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all flex items-center gap-4"
            >
              <i className="ph ph-monitor text-3xl text-blue-600"></i>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Dashboard de Expo</h3>
                <p className="text-sm text-blue-700">Inicia sesión para ver tus compilaciones</p>
              </div>
            </a>
            <a
              href="https://docs.expo.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 hover:border-emerald-400 hover:shadow-lg transition-all flex items-center gap-4"
            >
              <i className="ph ph-book text-3xl text-emerald-600"></i>
              <div>
                <h3 className="font-semibold text-emerald-900 mb-1">Documentación</h3>
                <p className="text-sm text-emerald-700">Guías y referencias</p>
              </div>
            </a>
            <button
              onClick={() => router.push('/super-admin-app/download-guide')}
              className="p-6 bg-gradient-to-br from-brand-50 to-brand-100 rounded-xl border border-brand-200 hover:border-brand-400 hover:shadow-lg transition-all flex items-center gap-4"
            >
              <i className="ph ph-download text-3xl text-brand-600"></i>
              <div className="text-left">
                <h3 className="font-semibold text-brand-900 mb-1">Guía Descarga</h3>
                <p className="text-sm text-brand-700">Instrucciones detalladas</p>
              </div>
            </button>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="bg-white rounded-2xl border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Preguntas Frecuentes</h2>
          <div className="space-y-4">
            <details className="border border-slate-200 rounded-xl overflow-hidden hover:border-brand-400 transition-colors">
              <summary className="p-6 cursor-pointer font-semibold text-slate-900 hover:bg-slate-50 transition-colors flex items-center justify-between">
                ¿Cuánto tiempo tarda la primera compilación?
                <i className="ph ph-plus text-slate-400"></i>
              </summary>
              <div className="px-6 pb-6 text-slate-600 border-t border-slate-200 bg-slate-50">
                La primera compilación puede tardar entre 10 a 15 minutos. Las compilaciones posteriores serán más rápidas gracias a la caché.
              </div>
            </details>
            
            <details className="border border-slate-200 rounded-xl overflow-hidden hover:border-brand-400 transition-colors">
              <summary className="p-6 cursor-pointer font-semibold text-slate-900 hover:bg-slate-50 transition-colors flex items-center justify-between">
                ¿Necesito una Mac para compilar iOS?
                <i className="ph ph-plus text-slate-400"></i>
              </summary>
              <div className="px-6 pb-6 text-slate-600 border-t border-slate-200 bg-slate-50">
                Sí, para compilar aplicaciones iOS necesitas una Mac con Xcode instalado y una cuenta Apple Developer ($99/año). Para Android, cualquier computadora funciona.
              </div>
            </details>
            
            <details className="border border-slate-200 rounded-xl overflow-hidden hover:border-brand-400 transition-colors">
              <summary className="p-6 cursor-pointer font-semibold text-slate-900 hover:bg-slate-50 transition-colors flex items-center justify-between">
                ¿Cómo comparto la app con otros usuarios?
                <i className="ph ph-plus text-slate-400"></i>
              </summary>
              <div className="px-6 pb-6 text-slate-600 border-t border-slate-200 bg-slate-50">
                Puedes compartir el archivo APK directamente por email, WhatsApp o Google Drive. Los usuarios pueden instalarla simplemente abriendo el archivo en su dispositivo Android.
              </div>
            </details>
            
            <details className="border border-slate-200 rounded-xl overflow-hidden hover:border-brand-400 transition-colors">
              <summary className="p-6 cursor-pointer font-semibold text-slate-900 hover:bg-slate-50 transition-colors flex items-center justify-between">
                ¿Qué hago si la app no se conecta al servidor?
                <i className="ph ph-plus text-slate-400"></i>
              </summary>
              <div className="px-6 pb-6 text-slate-600 border-t border-slate-200 bg-slate-50">
                Verifica que EXPO_PUBLIC_API_BASE_URL en el archivo .env sea correcto, asegúrate que el servidor web está disponible, y revisa que no haya problemas de CORS.
              </div>
            </details>
          </div>
        </section>
      </div>
    </div>
  );
}
