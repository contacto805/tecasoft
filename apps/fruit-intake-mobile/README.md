# Fruit Intake Mobile App

Aplicación móvil Expo para registrar ingreso de fruta en Tecavo Fruits.

## Características

- 🍎 Registro rápido de ingresos de fruta
- ⚖️ Captura de peso en kilogramos
- 📊 Estadísticas en tiempo real (total ingresos, peso total)
- 🔄 Sincronización automática con la base de datos central
- 📥 Vista historial de ingresos
- 📋 Exportación de datos

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
2. Verás el registro de ingresos existentes
3. Presiona el botón "+" para agregar un nuevo ingreso
4. Selecciona el lote y el peso
5. El ingreso se guarda inmediatamente en la base de datos
6. Los datos se sincronizan con la web automáticamente

## Características de Ingreso

- **Lote**: Selecciona el lote de fruta
- **Peso**: Ingresa el peso en kilogramos
- **Timestamp**: Se registra automáticamente la hora del ingreso
- **Sincronización**: Envío inmediato al servidor

## Exportación

Los ingresos pueden exportarse a CSV desde la pantalla de historial.
