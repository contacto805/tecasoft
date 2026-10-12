# Guía para Generar APK - Ingreso de Fruta

## Requisitos
1. Node.js 16 o superior instalado
2. Expo CLI instalado (`npm install -g expo-cli`)
3. Cuenta en Expo (gratuita en https://expo.dev)
4. EAS CLI instalado (`npm install -g eas-cli`)

## Pasos para Generar la APK

### 1. Instalar Dependencias
```bash
cd /home/user/apps/fruit-intake-mobile
npm install
```

### 2. Login en Expo (Primera vez)
```bash
expo login
# O si usas eas-cli:
eas login
```

### 3. Generar APK con EAS
```bash
# Opción 1: Build en la nube (Recomendado)
eas build --platform android --non-interactive

# Opción 2: Build local (requiere Android SDK)
expo run:android
```

### 4. Descargar la APK
Después de ejecutar `eas build`, recibirás un enlace para descargar el archivo APK.

### 5. Instalar en un Dispositivo
```bash
# Conectar dispositivo USB y habilitar depuración
adb install app-release.apk
```

## Propiedades de la APK
- **Nombre**: Ingreso de Fruta
- **Package**: com.tecavofruits.fruitintake
- **Versión**: 1.0.0
- **Plataforma**: Android
- **Distribución**: Privada (sin App Store)

## Variables de Entorno
Edita `.env` para configurar la URL del API:
```
EXPO_PUBLIC_API_URL=https://tu-app.com
```

## Troubleshooting
- Si hay errores de compilación, ejecuta `npm install --legacy-peer-deps`
- Para limpiar caché: `expo start --clear`
- Verifica que tengas permisos en el archivo APK descargado

## Notas Importantes
- La APK está configurada para distribuirse privatamente
- Recuerda actualizar la versión en `app.json` antes de cada release
- Mantén las credenciales de Expo seguras
