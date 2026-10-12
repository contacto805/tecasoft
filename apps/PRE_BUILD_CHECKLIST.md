# ✅ PRE-BUILD CHECKLIST

Antes de generar las APKs, asegúrate de completar estos pasos:

## 🔧 Requisitos del Sistema

- [ ] Node.js 16+ instalado (`node --version`)
- [ ] npm instalado (`npm --version`)
- [ ] Conexión a internet estable
- [ ] Cuenta de Expo creada en https://expo.dev
- [ ] Expo CLI instalado: `npm install -g expo-cli`
- [ ] EAS CLI instalado: `npm install -g eas-cli`

## 📱 Órdenes de Corte

### Configuración
- [ ] Abre `/home/user/apps/cutting-orders-mobile/.env`
- [ ] Configura `EXPO_PUBLIC_API_URL` con tu servidor
  ```
  EXPO_PUBLIC_API_URL=https://tu-dominio.com
  ```

### Revisión
- [ ] Verifica que `app.json` tiene el nombre correcto
- [ ] Revisa que el package es `com.tecavofruits.cuttingorders`
- [ ] Confirma la versión en `app.json` (actualmente: 1.0.0)
- [ ] Verifica los permisos en `app.json` (Internet, Storage)

### Iconografía (Opcional)
- [ ] Reemplaza `/assets/icon.png` si deseas otro icono (192x192)
- [ ] Reemplaza `/assets/splash.png` si deseas otra pantalla de inicio

## 📦 Ingreso de Fruta

### Configuración
- [ ] Abre `/home/user/apps/fruit-intake-mobile/.env`
- [ ] Configura `EXPO_PUBLIC_API_URL` con tu servidor
  ```
  EXPO_PUBLIC_API_URL=https://tu-dominio.com
  ```

### Revisión
- [ ] Verifica que `app.json` tiene el nombre correcto
- [ ] Revisa que el package es `com.tecavofruits.fruitintake`
- [ ] Confirma la versión en `app.json` (actualmente: 1.0.0)
- [ ] Verifica los permisos en `app.json` (Internet, Storage, Camera)

### Iconografía (Opcional)
- [ ] Reemplaza `/assets/icon.png` si deseas otro icono (192x192)
- [ ] Reemplaza `/assets/splash.png` si deseas otra pantalla de inicio

## 🔐 Autenticación Expo

- [ ] Ejecuta: `eas login`
- [ ] Ingresa tus credenciales de Expo
- [ ] Verifica el login con: `eas whoami`

## 🌐 Conectividad API

### Órdenes de Corte
- [ ] Tu servidor responde en `EXPO_PUBLIC_API_URL`
- [ ] El endpoint `/api/cutting-orders` está disponible
- [ ] Tu servidor acepta requests desde la app

### Ingreso de Fruta
- [ ] Tu servidor responde en `EXPO_PUBLIC_API_URL`
- [ ] El endpoint `/api/fruit-intake` está disponible
- [ ] El endpoint `/api/lots` está disponible
- [ ] Tu servidor acepta requests desde la app

## 📝 Documentación

- [ ] Leíste `README_APK_DISTRIBUTION.md`
- [ ] Entiendes el flujo de build con EAS
- [ ] Conoces cómo instalar el APK en dispositivos

## 🚀 Antes de Ejecutar Build

- [ ] Todas las secciones anteriores están completadas ✓
- [ ] Has guardado todos los cambios en `.env` archivos
- [ ] Tu conexión a internet es estable
- [ ] Tienes suficiente espacio en disco (~5GB para builds)

## 🎯 Siguiente Paso

Cuando todo esté listo, ejecuta:

```bash
cd /home/user/apps
./build-apks.sh
```

O manualmente:

```bash
# Para Órdenes de Corte
cd /home/user/apps/cutting-orders-mobile
npm install --legacy-peer-deps
eas build --platform android --non-interactive

# Para Ingreso de Fruta
cd /home/user/apps/fruit-intake-mobile
npm install --legacy-peer-deps
eas build --platform android --non-interactive
```

## 📧 Después del Build

- [ ] Espera el email de Expo notificando que está lista
- [ ] Descarga el archivo APK
- [ ] Verifica que el archivo se descargó correctamente
- [ ] Prueba instalar en un dispositivo Android

## 🔄 Para Futuras Compilaciones

- [ ] Aumenta el número de versión en `app.json`
- [ ] Documenta qué cambios hiciste
- [ ] Mantén un log de versiones distribuidas

---

**Última revisión**: 2024-06-06  
**Estado**: Lista para producción ✅
