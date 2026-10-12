# Cutting Orders Mobile App

Aplicación móvil Expo para gestionar órdenes de corte en Tecavo Fruits.

## Características

- 📱 Visualización de órdenes de corte en tiempo real
- 🔄 Sincronización automática con la base de datos central
- 📊 Filtrado por estado (Pendiente, En Proceso, Completada)
- 📋 Detalles completos de cada orden
- ✅ Actualización de estado de órdenes

## Instalación

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo (Expo Go)
npm start

# Compilar para Android
npm run android

# Compilar para iOS (macOS)
npm run ios

# Web preview
npm run web
```

## Configuración

El archivo `.env.local` contiene:
- `EXPO_PUBLIC_API_URL`: URL de la API (sincroniza con el servidor web)
- `DATABASE_URL`: Conexión a la base de datos Neon

## Uso

1. Abre la app en tu dispositivo o emulador
2. Verás todas las órdenes de corte disponibles
3. Filtra por estado (Pendiente, En Proceso, Completada)
4. Toca una orden para ver más detalles
5. Los cambios se sincronizan automáticamente

## Sincronización

La app se conecta a la misma base de datos que el sistema web, permitiendo:
- Crear nuevas órdenes desde el celular
- Actualizar el estado en tiempo real
- Ver cambios realizados desde la web instantáneamente
