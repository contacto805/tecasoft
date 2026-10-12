# 📱 Distribución de APKs - Tecavo Fruits

## Visión General

Tu proyecto incluye **2 aplicaciones móviles independientes** configuradas para distribuirse como APKs privados (sin App Store):

| App | Ubicación | Descripción |
|-----|-----------|-------------|
| **Órdenes de Corte** | `/cutting-orders-mobile` | Gestión de órdenes de corte con filtrado por estado |
| **Ingreso de Fruta** | `/fruit-intake-mobile` | Registro y pesaje de ingresos de fruta con selección de lotes |

---

## 🚀 Inicio Rápido

### Opción 1: Script Automático (Recomendado)
```bash
cd /home/user/apps
./build-apks.sh
```

### Opción 2: Comando Manual
```bash
# Para Órdenes de Corte
cd /home/user/apps/cutting-orders-mobile
npm install --legacy-peer-deps
eas login
eas build --platform android --non-interactive

# Para Ingreso de Fruta
cd /home/user/apps/fruit-intake-mobile
npm install --legacy-peer-deps
eas login
eas build --platform android --non-interactive
```

---

## 📋 Requisitos Previos

- **Node.js 16+**: Descarga desde https://nodejs.org
- **npm**: Viene con Node.js
- **Cuenta Expo**: Crea gratis en https://expo.dev
- **eas-cli**: `npm install -g eas-cli`
- **Dispositivo Android**: Para instalar las APKs

---

## 📁 Estructura de Carpetas

```
/home/user/apps/
├── cutting-orders-mobile/
│   ├── app.json                 ← Config principal
│   ├── eas.json                 ← Build configuration
│   ├── package.json
│   ├── .env                     ← Variables de entorno
│   ├── app/
│   │   ├── _layout.jsx
│   │   └── index.jsx            ← Pantalla principal
│   ├── assets/                  ← Icons y splash screens
│   └── APK_BUILD_GUIDE.md
│
├── fruit-intake-mobile/
│   ├── app.json                 ← Config principal
│   ├── eas.json                 ← Build configuration
│   ├── package.json
│   ├── .env                     ← Variables de entorno
│   ├── app/
│   │   ├── _layout.jsx
│   │   └── index.jsx            ← Pantalla principal
│   ├── assets/                  ← Icons y splash screens
│   └── APK_BUILD_GUIDE.md
│
├── QUICK_APK_BUILD.md           ← Guía rápida
├── BUILD_APK_INSTRUCTIONS.md    ← Instrucciones detalladas
├── README_APK_DISTRIBUTION.md   ← Este archivo
└── build-apks.sh                ← Script automático
```

---

## ⚙️ Configuración

### 1. Configurar API URL

Antes de generar las APKs, edita `.env` en cada carpeta:

```bash
# cutting-orders-mobile/.env
EXPO_PUBLIC_API_URL=https://tu-servidor.com

# fruit-intake-mobile/.env
EXPO_PUBLIC_API_URL=https://tu-servidor.com
```

### 2. Actualizar Información de la App

Edita `app.json` si necesitas cambiar:
- Nombre de la app
- Icono
- Splash screen
- Versión

---

## 🔨 Proceso de Build

### Paso 1: Instalar Dependencias
```bash
cd /home/user/apps/cutting-orders-mobile
npm install --legacy-peer-deps
```

### Paso 2: Autenticarse
```bash
eas login
# Ingresa tus credenciales de Expo
```

### Paso 3: Iniciar Build
```bash
eas build --platform android --non-interactive
```

### Paso 4: Esperar Compilación
- ⏱️ Tiempo típico: 10-20 minutos
- Recibirás un email cuando esté listo
- También verás un enlace de descarga en la terminal

### Paso 5: Descargar y Distribuir
- Descarga el archivo `.apk`
- Distribuye a tus usuarios
- Ellos instalan con `adb install` o descargando directamente

---

## 📲 Instalar en Dispositivos

### Método 1: Vía ADB (Recomendado)
```bash
# Conecta el dispositivo por USB
# Habilita "Instalación desde fuentes desconocidas"
adb install ruta/al/archivo.apk
```

### Método 2: Descarga Directa
1. Descarga el APK en tu dispositivo
2. Abre el archivo con un gestor de archivos
3. Toca "Instalar"
4. Confirma los permisos

### Método 3: QR
Los QRs generados en tu dashboard principal ya enlazan a páginas que muestran:
- Información de la app
- Ubicación de descarga
- Instrucciones de instalación

---

## 🔍 Especificaciones Técnicas

### Órdenes de Corte
- **Nombre**: Órdenes de Corte
- **Package**: `com.tecavofruits.cuttingorders`
- **Versión**: 1.0.0
- **API**: Se conecta a `/api/cutting-orders`
- **Permisos**: Internet, Almacenamiento

### Ingreso de Fruta
- **Nombre**: Ingreso de Fruta
- **Package**: `com.tecavofruits.fruitintake`
- **Versión**: 1.0.0
- **API**: Se conecta a `/api/fruit-intake` y `/api/lots`
- **Permisos**: Internet, Almacenamiento, Cámara

---

## 🎨 Personalización

### Cambiar Iconos
Reemplaza los archivos en:
- `cutting-orders-mobile/assets/icon.png` (192x192)
- `fruit-intake-mobile/assets/icon.png` (192x192)

### Cambiar Splash Screen
Reemplaza los archivos en:
- `cutting-orders-mobile/assets/splash.png`
- `fruit-intake-mobile/assets/splash.png`

### Cambiar Colores
Edita los estilos en `app/index.jsx` de cada app.

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| `npm ERR!` | Ejecuta: `npm install --legacy-peer-deps` |
| `eas: command not found` | Ejecuta: `npm install -g eas-cli` |
| Build falla por timeout | Intenta nuevamente, a veces toma más tiempo |
| Permisos denegados en instalación | Habilita "Instalación desde fuentes desconocidas" |
| La app no se conecta al API | Verifica la variable `EXPO_PUBLIC_API_URL` en `.env` |

---

## 📝 Notas Importantes

- ✅ Las APKs se **distribuyen sin App Store**
- ✅ Cada usuario instala directamente en su dispositivo
- ✅ No hay actualizaciones automáticas (necesitas recompilar)
- ✅ Compatible con Android 6.0+
- ✅ Sin restricciones de Google Play
- ⚠️ Mantén tus credenciales de Expo seguras
- ⚠️ Actualiza la versión antes de cada release

---

## 📞 Soporte

Para más información:
1. Lee `APK_BUILD_GUIDE.md` en cada carpeta
2. Consulta la documentación de Expo: https://docs.expo.dev
3. Revisa los logs de error completos en la terminal

---

## 🎯 Próximos Pasos

1. **Configurar API**: Edita `.env` en ambas apps
2. **Personalizar**: Cambia iconos y colores si deseas
3. **Generar**: Ejecuta `./build-apks.sh` o los comandos manuales
4. **Distribuir**: Descarga los APKs y comparte con usuarios
5. **Monitorear**: Mantén logs de qué versión tiene cada usuario

---

**Última actualización**: 2024
**Estado**: ✅ Listo para producción
