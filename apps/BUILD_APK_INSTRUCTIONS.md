# Instrucciones para Generar APKs - Tecavo Fruits Mobile Apps

## Descripción General
Tienes 2 aplicaciones móviles listas para generar APKs:

1. **cutting-orders-mobile** - Módulo de Órdenes de Corte
2. **fruit-intake-mobile** - Módulo de Ingreso de Fruta

Ambas están configuradas para distribuirse como APKs privados sin publicar en Google Play Store.

## Carpetas de las Aplicaciones

```
/home/user/apps/
├── cutting-orders-mobile/    ← APK 1: Órdenes de Corte
│   ├── app.json              ← Configuración de la app
│   ├── eas.json              ← Configuración para build
│   ├── package.json
│   ├── APK_BUILD_GUIDE.md    ← Instrucciones detalladas
│   └── assets/               ← Logos e iconos
│
└── fruit-intake-mobile/      ← APK 2: Ingreso de Fruta
    ├── app.json              ← Configuración de la app
    ├── eas.json              ← Configuración para build
    ├── package.json
    ├── APK_BUILD_GUIDE.md    ← Instrucciones detalladas
    └── assets/               ← Logos e iconos
```

## Métodos para Generar APK

### Método 1: Build en la Nube con Expo (RECOMENDADO)
Más fácil, sin requisitos locales.

```bash
# Para Órdenes de Corte
cd /home/user/apps/cutting-orders-mobile
npm install
eas login
eas build --platform android --non-interactive

# Para Ingreso de Fruta
cd /home/user/apps/fruit-intake-mobile
npm install
eas login
eas build --platform android --non-interactive
```

### Método 2: Build Local
Requiere tener Android SDK instalado.

```bash
cd /home/user/apps/cutting-orders-mobile
npm install
expo run:android
```

## Qué Obtienes

- ✅ APK ejecutable para Android
- ✅ Sin dependencia de Google Play Store
- ✅ Distribución privada
- ✅ Instalación directa en dispositivos

## Especificaciones

### Órdenes de Corte
- Nombre: Órdenes de Corte
- Package: com.tecavofruits.cuttingorders
- Versión: 1.0.0
- Características: Listado de órdenes, filtrado por estado

### Ingreso de Fruta
- Nombre: Ingreso de Fruta
- Package: com.tecavofruits.fruitintake
- Versión: 1.0.0
- Características: Registro de ingresos, pesaje, selección de lotes

## Configuración de API

Antes de generar las APKs, configura la URL de tu API en `.env`:

```bash
# cutting-orders-mobile/.env
EXPO_PUBLIC_API_URL=https://tu-servidor.com

# fruit-intake-mobile/.env
EXPO_PUBLIC_API_URL=https://tu-servidor.com
```

## Instalación en Dispositivos

Una vez tengas el archivo APK:

```bash
# Conectar dispositivo vía USB
# Habilitar "Instalación desde fuentes desconocidas"
adb install ruta/al/archivo.apk
```

## Soporte

Para más detalles, lee los archivos:
- `APK_BUILD_GUIDE.md` en cada carpeta de app
- Documentación oficial de Expo: https://docs.expo.dev/build/introduction/

## Próximos Pasos

1. Instala Node.js si no lo tienes
2. Crea cuenta en Expo (gratis)
3. Instala Expo CLI: `npm install -g expo-cli eas-cli`
4. Sigue los pasos del método 1 o 2 arriba
5. Descarga las APKs generadas
6. Distribuye a tus usuarios para instalar
