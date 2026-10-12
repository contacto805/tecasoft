'use client';

export default function DownloadGuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <section className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Guía Completa de Descarga</h1>
          <p className="text-lg text-slate-600">App Super Admin - Instalación paso a paso</p>
        </section>

        {/* Video Tutorial Section (Optional) */}
        <section className="mb-12 bg-white rounded-2xl border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">📹 Video Tutorial</h2>
          <div className="bg-slate-900 rounded-xl aspect-video flex items-center justify-center">
            <div className="text-center">
              <i className="ph ph-play-circle text-6xl text-white mb-4"></i>
              <p className="text-white text-lg">Próximamente disponible</p>
            </div>
          </div>
        </section>

        {/* Step-by-Step Guide */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">📋 Pasos Detallados</h2>

          {/* Step 1 */}
          <div className="mb-8 bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <span className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center font-bold">1</span>
                Crear Cuenta de Expo
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-slate-700">
                <li>Abre tu navegador y ve a <a href="https://expo.dev" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-semibold">https://expo.dev</a></li>
                <li>Haz click en <strong>"Sign Up"</strong> (Registro)</li>
                <li>Completa el formulario con:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>Nombre completo</li>
                    <li>Correo electrónico</li>
                    <li>Contraseña segura</li>
                  </ul>
                </li>
                <li>Verifica tu correo haciendo click en el enlace que recibirás</li>
                <li>¡Listo! Ya tienes tu cuenta de Expo</li>
              </ol>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900"><strong>💡 Nota:</strong> Esta cuenta es gratuita y te permitirá compilar tus apps</p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="mb-8 bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <span className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center font-bold">2</span>
                Instalar EAS CLI
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">EAS CLI es la herramienta que usaremos para compilar la app.</p>
              <div className="bg-slate-900 rounded-lg p-4">
                <code className="text-emerald-400 font-mono text-sm">npm install -g eas-cli</code>
              </div>
              <ol className="list-decimal list-inside space-y-3 text-slate-700">
                <li>Abre tu terminal o CMD</li>
                <li>Copia y pega el comando anterior</li>
                <li>Presiona Enter y espera a que se instale</li>
                <li>Verifica que se instaló correctamente escribiendo: <code className="bg-slate-100 px-2 py-1 rounded text-slate-900 font-mono">eas --version</code></li>
              </ol>
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-900"><strong>⚠️ Importante:</strong> Necesitas tener Node.js instalado en tu computadora (versión 18 o superior)</p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-8 bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <span className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center font-bold">3</span>
                Compilar la App
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">Ahora compilaremos el APK (archivo instalable).</p>
              <div className="space-y-3">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-900 mb-2">En tu terminal:</p>
                  <code className="bg-slate-900 text-emerald-400 px-4 py-3 rounded-lg block text-sm font-mono mb-2">cd /home/user/apps/super-admin-mobile</code>
                  <code className="bg-slate-900 text-emerald-400 px-4 py-3 rounded-lg block text-sm font-mono">eas login</code>
                  <code className="bg-slate-900 text-emerald-400 px-4 py-3 rounded-lg block text-sm font-mono mt-2">eas build --platform android --profile preview</code>
                </div>
              </div>
              <ol className="list-decimal list-inside space-y-3 text-slate-700">
                <li>El primer comando te pedirá que inicies sesión con tu cuenta de Expo</li>
                <li>Ingresa tus credenciales</li>
                <li>Se iniciará la compilación (esto tarda 10-15 minutos la primera vez)</li>
                <li>Podrás ver el progreso en tiempo real</li>
                <li>Cuando termine, recibirás un enlace para descargar el APK</li>
              </ol>
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900"><strong>✅ Tip:</strong> Mientras se compila, puedes ver el progreso en <a href="https://expo.dev" target="_blank" rel="noopener noreferrer" className="underline">https://expo.dev</a> (inicia sesión)</p>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="mb-8 bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
            <div className="bg-gradient-to-r from-pink-500 to-pink-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <span className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center font-bold">4</span>
                Descargar el APK
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">Una vez que la compilación termine, descarga el archivo.</p>
              <ol className="list-decimal list-inside space-y-3 text-slate-700">
                <li>Se abrirá automáticamente una ventana con el enlace de descarga</li>
                <li>O ve a <a href="https://expo.dev" target="_blank" className="underline">https://expo.dev</a> y entra a tu cuenta</li>
                <li>Busca tu build (debe estar al inicio)</li>
                <li>Haz click en <strong>"Download"</strong></li>
                <li>Se descargará un archivo con extensión <code className="bg-slate-100 px-2 py-1 rounded text-slate-900 font-mono">.apk</code></li>
              </ol>
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <span className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center font-bold">5</span>
                Instalar en tu Android
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">Transfiere el APK a tu dispositivo Android e instala la app.</p>
              <ol className="list-decimal list-inside space-y-3 text-slate-700">
                <li>Conecta tu dispositivo Android a la computadora por USB</li>
                <li>Copia el archivo <code className="bg-slate-100 px-2 py-1 rounded text-slate-900 font-mono">.apk</code> a tu dispositivo</li>
                <li>En tu dispositivo Android, abre el Administrador de archivos</li>
                <li>Busca el archivo APK</li>
                <li>Haz tap en el archivo para instalar</li>
                <li>Puede que te pida permitir instalación de fuentes desconocidas</li>
                <li>Confirma y espera a que se instale</li>
                <li>¡Listo! Ya puedes abrir la app</li>
              </ol>
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-900"><strong>📱 Nota:</strong> Si te pide habilitar &quot;Instalar desde fuentes desconocidas&quot;, ve a Ajustes {'->'} Seguridad {'->'} Origen desconocido</p>
              </div>
            </div>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="mb-12 bg-white rounded-2xl border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">🔧 Solución de Problemas</h2>
          
          <div className="space-y-4">
            <details className="border border-slate-200 rounded-xl overflow-hidden hover:border-brand-400 transition-colors">
              <summary className="p-4 cursor-pointer font-semibold text-slate-900 hover:bg-slate-50 transition-colors flex items-center justify-between">
                ¿Qué hago si la compilación falla?
                <i className="ph ph-caret-down"></i>
              </summary>
              <div className="px-4 pb-4 text-slate-600 border-t border-slate-200 bg-slate-50">
                <ol className="list-decimal list-inside space-y-2">
                  <li>Asegúrate de estar logueado: <code className="bg-slate-200 px-2 py-1 rounded text-slate-900 font-mono">eas login</code></li>
                  <li>Limpia la caché: <code className="bg-slate-200 px-2 py-1 rounded text-slate-900 font-mono">npm cache clean --force</code></li>
                  <li>Elimina node_modules: <code className="bg-slate-200 px-2 py-1 rounded text-slate-900 font-mono">rm -rf node_modules</code></li>
                  <li>Reinstala: <code className="bg-slate-200 px-2 py-1 rounded text-slate-900 font-mono">npm install</code></li>
                  <li>Intenta compilar de nuevo</li>
                </ol>
              </div>
            </details>

            <details className="border border-slate-200 rounded-xl overflow-hidden hover:border-brand-400 transition-colors">
              <summary className="p-4 cursor-pointer font-semibold text-slate-900 hover:bg-slate-50 transition-colors flex items-center justify-between">
                La app no se conecta al servidor
                <i className="ph ph-caret-down"></i>
              </summary>
              <div className="px-4 pb-4 text-slate-600 border-t border-slate-200 bg-slate-50">
                <ol className="list-decimal list-inside space-y-2">
                  <li>Verifica que EXPO_PUBLIC_API_BASE_URL en .env sea correcto</li>
                  <li>Asegúrate que el servidor web está disponible</li>
                  <li>Revisa la conexión de internet en tu dispositivo</li>
                  <li>Si usas VPN, intenta desactivarla</li>
                </ol>
              </div>
            </details>

            <details className="border border-slate-200 rounded-xl overflow-hidden hover:border-brand-400 transition-colors">
              <summary className="p-4 cursor-pointer font-semibold text-slate-900 hover:bg-slate-50 transition-colors flex items-center justify-between">
                No puedo instalar el APK en mi dispositivo
                <i className="ph ph-caret-down"></i>
              </summary>
              <div className="px-4 pb-4 text-slate-600 border-t border-slate-200 bg-slate-50">
                <ol className="list-decimal list-inside space-y-2">
                  <li>Verifica que tu dispositivo sea Android 6.0 o superior</li>
                  <li>Habilita "Instalar desde fuentes desconocidas" en Seguridad</li>
                  <li>Asegúrate de tener espacio disponible (mínimo 50 MB)</li>
                  <li>Comprueba que el archivo APK no esté dañado</li>
                  <li>Intenta transferir el archivo nuevamente</li>
                </ol>
              </div>
            </details>
          </div>
        </section>

        {/* Success */}
        <section className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-8 text-center">
          <i className="ph ph-check-circle text-6xl text-emerald-600 mb-4 inline-block"></i>
          <h2 className="text-2xl font-bold text-emerald-900 mb-4">¡Felicidades!</h2>
          <p className="text-emerald-700 mb-6">Tu app Super Admin está lista para usar. Ahora puedes:</p>
          <ul className="text-left inline-block space-y-2 text-emerald-700">
            <li className="flex items-center gap-2"><i className="ph ph-check text-emerald-600"></i>Recibir notificaciones en tiempo real</li>
            <li className="flex items-center gap-2"><i className="ph ph-check text-emerald-600"></i>Aprobar cambios de lotificación</li>
            <li className="flex items-center gap-2"><i className="ph ph-check text-emerald-600"></i>Ver estadísticas del sistema</li>
            <li className="flex items-center gap-2"><i className="ph ph-check text-emerald-600"></i>Gestionar el sistema desde tu móvil</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
