# 📱 Super Admin Mobile App

Aplicación móvil exclusiva para el Super Administrador del sistema de gestión agrícola Tecavo Fruits.

## 📋 Descripción

Esta es la aplicación móvil del Super Administrador que proporciona:

- **Acceso Total**: Control completo del sistema desde el dispositivo móvil
- **Notificaciones en Tiempo Real**: Alertas automáticas cuando se registren o modifiquen lotificaciones
- **Aprobación de Cambios**: Revisar y aprobar cambios antes de confirmarse en el sistema
- **Dashboard Ejecutivo**: Estadísticas en tiempo real de toda la operación
- **Centro de Notificaciones**: Historial completo de alertas y eventos
- **Gestión de Perfil**: Configuración de cuenta y preferencias

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 18+ instalado
- Cuenta de Expo (https://expo.dev)
- npm o yarn

### Instalación Local

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar en modo desarrollo
npm start

# 3. Escanear código QR con Expo Go en tu dispositivo
```

## 📦 Compilación y Descarga

### Método 1: Compilación Automática (Recomendado)

```bash
# Ejecutar script de compilación
chmod +x build.sh
./build.sh
```

### Método 2: Compilación Manual

```bash
# Instalar EAS CLI globalmente
npm install -g eas-cli

# Login a tu cuenta de Expo
eas login

# Compilar para Android
eas build --platform android --profile preview

# Compilar para iOS
eas build --platform ios --profile preview
```

## 📱 Características Principales

### 1. **Pantalla de Login**
- Autenticación exclusiva para Super Administrador
- Validación de credenciales contra el servidor

### 2. **Dashboard**
- Estadísticas en tiempo real:
  - Cambios pendientes de aprobación
  - Notificaciones pendientes
  - Total de lotificaciones registradas
  - Cargas completadas
  - Ingresos operativos
  - Usuarios activos

### 3. **Centro de Notificaciones**
- Historial de todas las notificaciones push
- Marcado de notificaciones como leídas
- Filtrado por tipo de notificación
- Acciones rápidas desde las notificaciones

### 4. **Aprobaciones**
- Lista de cambios pendientes de aprobación
- Detalles completos de cada cambio
- Opción para aprobar o rechazar
- Historial de aprobaciones

### 5. **Perfil**
- Información del usuario Super Administrador
- Configuración de notificaciones
- Preferencias de la app

## 🔧 Configuración

### Variables de Entorno

Crear archivo `.env`:

```bash
cp .env.example .env
```

Editar `.env`:

```
EXPO_PUBLIC_API_BASE_URL=https://tu-dominio-web.com
```

## 📲 Compartir la App

Después de compilar, el APK estará disponible en:
- Dashboard de Expo: https://expo.dev/dashboard
- Link directo de descarga desde tu build

### Distribución

Puedes compartir el APK por:
- Email
- WhatsApp
- Google Drive
- OneDrive
- Cualquier método de compartición de archivos

Los usuarios simplemente necesitan:
1. Descargar el APK
2. Transferirlo a su dispositivo Android
3. Abrir el archivo para instalar

## 🔐 Seguridad

- Autenticación por email y contraseña
- Tokens de sesión almacenados de forma segura
- Permisos de notificaciones requeridos
- Validación de servidor en cada solicitud

## 📊 Notificaciones Push

La app recibe notificaciones automáticamente cuando:

1. **Nueva Lotificación Registrada**
   - Notifica al Super Admin cuando se registra una nueva lotificación

2. **Cambio Pendiente de Aprobación**
   - Alerta cuando alguien intenta modificar datos de lotificación
   - Requiere aprobación antes de confirmar el cambio

3. **Nueva Carga Despachada**
   - Notificación cuando se realiza una nueva carga

4. **Eventos del Sistema**
   - Cambios críticos en la operación

## 🐛 Solución de Problemas

### La app no se conecta

- Verifica que `EXPO_PUBLIC_API_BASE_URL` sea correcto
- Asegúrate que el servidor web está disponible
- Revisa que no haya problemas de CORS

### Notificaciones no llegan

- Verifica que los permisos de notificaciones estén habilitados
- Comprueba que el token push se registró correctamente
- Revisa los logs del servidor

### Error en compilación

```bash
# Limpiar caché
npm cache clean --force
rm -rf node_modules
npm install

# Intentar compilar de nuevo
eas build --platform android --profile preview
```

## 📚 Documentación

- **BUILD_INSTRUCTIONS.md** - Instrucciones detalladas de compilación
- **DOWNLOAD_GUIDE.md** - Guía de descarga para usuarios finales
- [Documentación de Expo](https://docs.expo.dev)

## 🔄 Actualizar la App

Después de hacer cambios en el código:

```bash
# Instalar nuevas dependencias (si aplica)
npm install

# Compilar nueva versión
eas build --platform android --profile preview

# Distribuir a usuarios
```

## 📈 Próximos Pasos

- [ ] Publicar en Google Play Store
- [ ] Publicar en Apple App Store
- [ ] Implementar sincronización offline
- [ ] Agregar gráficos de estadísticas avanzadas
- [ ] Soporte para múltiples idiomas

## 📞 Soporte

Para problemas o sugerencias:
1. Revisa la documentación en `BUILD_INSTRUCTIONS.md`
2. Consulta https://docs.expo.dev
3. Contacta al equipo de desarrollo

## 📄 Licencia

Aplicación propietaria de Tecavo Fruits.

---

**Versión:** 1.0.0  
**Última actualización:** 2024  
**Plataforma:** Expo (React Native)
