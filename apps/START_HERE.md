# 🚀 COMIENZA AQUÍ - APKs Listas para Descargar

**¡Buenas noticias!** Tus dos aplicaciones móviles están completamente configuradas y listas para generar APKs que puedas instalar en dispositivos Android.

---

## 📱 Qué Tienes

### 1. **Órdenes de Corte**
Aplicación para gestionar órdenes de corte con filtrado por estado (pendientes, en proceso, completadas).

📁 Ubicación: `/home/user/apps/cutting-orders-mobile`

### 2. **Ingreso de Fruta**
Aplicación para registrar ingresos de fruta, pesaje y selección de lotes.

📁 Ubicación: `/home/user/apps/fruit-intake-mobile`

---

## ⚡ 3 Pasos para Obtener tus APKs

### Paso 1: Configurar la URL de tu API (2 minutos)

Edita estos dos archivos y añade la URL de tu servidor:

**cutting-orders-mobile/.env**
```
EXPO_PUBLIC_API_URL=https://tu-servidor.com
```

**fruit-intake-mobile/.env**
```
EXPO_PUBLIC_API_URL=https://tu-servidor.com
```

### Paso 2: Instalar Herramientas (3 minutos, solo primera vez)

```bash
npm install -g expo-cli eas-cli
eas login  # Ingresa tus credenciales de Expo (crea cuenta gratis en https://expo.dev)
```

### Paso 3: Generar APKs (10-20 minutos por app)

```bash
cd /home/user/apps
./build-apks.sh
```

Sigue el menú y elige qué app compilar.

**¡Listo!** Recibirás un enlace para descargar cada APK.

---

## 📥 Instalar en Dispositivos

Una vez tengas el APK:

1. **Conecta tu dispositivo Android** vía USB
2. **Habilita "Instalación desde fuentes desconocidas"** en Configuración > Seguridad
3. Ejecuta:
   ```bash
   adb install archivo.apk
   ```

O simplemente descarga el APK en el dispositivo y toca para instalar.

---

## 📚 Documentación

Si necesitas más detalles, lee estos archivos en orden:

1. **APK_DISTRIBUTION_SUMMARY.txt** - Resumen visual completo
2. **QUICK_APK_BUILD.md** - Guía rápida (5 min de lectura)
3. **PRE_BUILD_CHECKLIST.md** - Asegúrate de que todo está listo
4. **README_APK_DISTRIBUTION.md** - Documentación completa
5. **APK_BUILD_GUIDE.md** - En cada carpeta de app

---

## ❓ Preguntas Comunes

**P: ¿Cuánto tiempo tarda generar un APK?**
R: Primera vez ~20-30 min. Siguientes ~10-15 min.

**P: ¿Tengo que publicar en Google Play Store?**
R: No. Las APKs son privadas. Se distribuyen directamente.

**P: ¿Qué pasa si quiero actualizar la app?**
R: Actualiza la versión en `app.json`, genera nuevo APK y distribuye.

**P: ¿Funciona sin internet?**
R: La app necesita internet para conectarse a tu API, pero puedes usarla en áreas con WiFi o datos móviles.

**P: ¿Puedo cambiar los iconos?**
R: Sí. Reemplaza los archivos en `assets/` de cada app.

---

## 🔗 Enlaces Importantes

- **Expo**: https://expo.dev
- **Documentación**: https://docs.expo.dev
- **Android**: https://www.android.com

---

## ✅ Siguiente Acción

1. Configura las URLs de API en los archivos `.env`
2. Corre el script: `./build-apks.sh`
3. Espera los APKs
4. Instala en dispositivos

---

**¿Lista para comenzar?** Abre una terminal y ejecuta:

```bash
cd /home/user/apps
./build-apks.sh
```

¡Disfruta tus apps! 🚀
