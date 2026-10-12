# ⚡ Construcción Rápida de APKs

## Resumen
Las dos apps móviles están completamente configuradas y listas para generar APKs.

## Ubicaciones
- 📱 **Órdenes de Corte**: `/home/user/apps/cutting-orders-mobile`
- 📦 **Ingreso de Fruta**: `/home/user/apps/fruit-intake-mobile`

## Pasos Rápidos (3 minutos)

### 1. Preparación (Una sola vez)
```bash
# Instalar herramientas globales
npm install -g expo-cli eas-cli

# Crear cuenta en https://expo.dev (gratuita)
eas login
```

### 2. Generar APK de Órdenes de Corte
```bash
cd /home/user/apps/cutting-orders-mobile
npm install
eas build --platform android --non-interactive
```

### 3. Generar APK de Ingreso de Fruta
```bash
cd /home/user/apps/fruit-intake-mobile
npm install
eas build --platform android --non-interactive
```

### 4. Descargar
Recibirás un enlace para descargar cada APK después de que termine la compilación (~10-15 minutos).

## Instalar en Dispositivo
```bash
adb install archivo.apk
```

## Características

### Órdenes de Corte
- ✅ Lista de órdenes por estado
- ✅ Filtrado por pendiente/en proceso/completada
- ✅ Detalles de cada orden
- ✅ Conexión a API

### Ingreso de Fruta
- ✅ Registro de nuevos ingresos
- ✅ Selección de lotes
- ✅ Pesaje de frutas
- ✅ Historial de ingresos
- ✅ Estadísticas de peso total

## Configuración

Para cambiar la URL de API, edita `.env`:

```bash
# cutting-orders-mobile/.env
EXPO_PUBLIC_API_URL=https://tu-dominio.com

# fruit-intake-mobile/.env
EXPO_PUBLIC_API_URL=https://tu-dominio.com
```

## Notas
- Las APKs son privadas (sin App Store)
- Compatible con Android 6.0+
- Distribuidas sin firma de Google Play
- Pueden instalarse varias veces sin conflicto

## Si Hay Errores
1. Ejecuta: `npm install --legacy-peer-deps`
2. Limpia caché: `expo start --clear`
3. Revisa la conexión a internet
4. Consulta `APK_BUILD_GUIDE.md` en cada carpeta
