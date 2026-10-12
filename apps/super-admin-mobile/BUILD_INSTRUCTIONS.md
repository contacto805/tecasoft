# Instrucciones para Compilar y Descargar la App Super Administrador

## Requisitos Previos

1. **Cuenta de Expo** - Crear en https://expo.dev
2. **Expo CLI** - Instalar globalmente:
   ```bash
   npm install -g eas-cli
   npm install -g expo-cli
   ```
3. **Node.js** - Versión 18 o superior

## Opción 1: Compilación Rápida (Recommended)

### Para Android (APK)

```bash
# 1. Navega a la carpeta de la app
cd /home/user/apps/super-admin-mobile

# 2. Instala dependencias
npm install

# 3. Compila el APK
eas build --platform android --profile preview

# 4. Espera a que se complete la compilación (5-10 minutos)
# Se te proporcionará un enlace para descargar el APK
```

**Descarga directa:**
- Una vez compilado, obtendrás un enlace directo para descargar el APK
- Transferir el archivo `.apk` a tu dispositivo Android
- En el dispositivo: Abre el archivo APK para instalar

### Para iOS (IPA)

```bash
eas build --platform ios --profile preview
```

**Nota:** Para iOS necesitas:
- Una cuenta Apple Developer ($99/año)
- Un Mac con Xcode instalado

## Opción 2: Compilación Detallada con Configuración

```bash
# Login a tu cuenta de Expo
eas login

# Configura tu proyecto
eas build:configure

# Compila para Android
eas build --platform android

# Compila para iOS
eas build --platform ios
```

## Opción 3: Prueba Local sin Compilación (Rápido)

```bash
# Instala Expo Go en tu dispositivo desde:
# - Google Play Store (Android)
# - Apple App Store (iOS)

# En tu computadora:
cd /home/user/apps/super-admin-mobile
npm start

# Escanea el código QR con tu dispositivo
```

## Distribución de la App Compilada

### Opción A: Compartir APK Directo
1. Descarga el APK del enlace de Expo
2. Comparte el archivo por:
   - Email
   - WhatsApp
   - Google Drive
   - Cualquier servicio de almacenamiento

### Opción B: Google Play Store (Requiere Cuenta Developer)
```bash
eas submit --platform android --latest
```

### Opción C: Apple App Store (Requiere Apple Developer + Mac)
```bash
eas submit --platform ios --latest
```

## Solución de Problemas

### Error: "eas-cli no encontrado"
```bash
npm install -g eas-cli@latest
```

### Error: "EAS build failed"
- Asegúrate de estar logueado: `eas login`
- Verifica que package.json esté completo
- Limpia la caché: `npm cache clean --force`

### Error: "Permissions denied"
- En Android: Verifica que los permisos en app.json sean correctos
- En iOS: Revisa la configuración en eas.json

### La app no carga datos
- Verifica que `NEXT_PUBLIC_API_URL` esté correctamente configurado
- Asegúrate que el servidor web está corriendo
- Revisa los logs en: `adb logcat` (Android) o Xcode (iOS)

## Configuración de API

La app necesita conectarse al servidor web. Actualiza en `app.js` o `screens/LoginScreen.jsx`:

```javascript
const API_BASE_URL = 'https://tu-dominio.com'; // Cambiar por tu dominio
```

## Actualizar la App Después de Cambios

Después de hacer cambios en el código:

```bash
# Para compilación nuevamente
eas build --platform android --profile preview

# O para Expo Go (más rápido):
npm start
```

## Recursos Útiles

- [Documentación de Expo](https://docs.expo.dev)
- [Guía de EAS Build](https://docs.expo.dev/build/introduction/)
- [FAQ de Expo](https://docs.expo.dev/support/)

---

**Notas Importantes:**
- La primera compilación puede tardar 10-15 minutos
- Las compilaciones posteriores son más rápidas (caché)
- Recomendamos usar Expo Go para desarrollo y EAS Build para distribución
- Los APK tienen validez aproximada de 1 año
