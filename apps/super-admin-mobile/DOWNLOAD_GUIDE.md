# 📱 Guía de Descarga - App Super Admin

## 🚀 Pasos Rápidos para Descargar la App

### 1. **Crear Cuenta de Expo (Una sola vez)**
   - Ir a https://expo.dev
   - Click en "Sign Up"
   - Crear cuenta con email y contraseña
   - Verificar email

### 2. **Instalar EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

### 3. **Compilar la App**
   
   **Opción A - Automática (Recomendado):**
   ```bash
   cd /home/user/apps/super-admin-mobile
   chmod +x build.sh
   ./build.sh
   ```
   
   **Opción B - Manual:**
   ```bash
   cd /home/user/apps/super-admin-mobile
   eas login
   npm install
   eas build --platform android --profile preview
   ```

### 4. **Descargar el APK**
   - Se abrirá una ventana del navegador con el enlace de descarga
   - O acceder a: https://expo.dev/dashboard
   - Buscar tu build
   - Click en "Download"

### 5. **Instalar en tu Android**
   - Transferir el archivo `.apk` a tu dispositivo
   - Aceptar instalación de fuentes desconocidas
   - Abrir el APK
   - Instalar

---

## 📊 Estado de Compilación

Mientras se compila, puedes seguir el progreso:

1. **En Expo Dashboard:**
   - https://expo.dev/dashboard
   - Ir a "Builds"
   - Ver el estado en tiempo real

2. **En Terminal:**
   ```bash
   eas build --platform android --status
   ```

---

## 🔄 Actualizar la App Después de Cambios

Cuando realices cambios en el código:

```bash
cd /home/user/apps/super-admin-mobile
npm install  # Si agregaste dependencias nuevas
eas build --platform android --profile preview
```

---

## 📲 Compartir la App con Otros

### Método 1: Compartir APK Directo
1. Descarga el APK
2. Envía por:
   - WhatsApp
   - Email
   - Google Drive
   - OneDrive

### Método 2: Enlace de Expo (Más Fácil)
1. En Expo Dashboard
2. Click en tu build
3. Compartir el enlace directo

---

## ⚙️ Configuración Importante

Antes de compilar, edita el archivo `.env`:

```bash
cp .env.example .env
```

Actualiza:
```
EXPO_PUBLIC_API_BASE_URL=https://tu-dominio-web.com
```

---

## 🆘 Problemas Comunes

### "eas-cli no encontrado"
```bash
npm install -g eas-cli@latest
```

### "No estoy logueado"
```bash
eas login
```

### "Build falló"
- Verifica que package.json sea válido
- Limpia caché: `npm cache clean --force`
- Intenta de nuevo

### "La app no conecta al servidor"
- Verifica que `EXPO_PUBLIC_API_BASE_URL` sea correcto
- Asegúrate que el servidor web está disponible
- Revisa que no haya problemas de CORS

---

## 📈 Próximos Pasos

Después de que la app esté compilada y funcionando:

1. **Distribuirla a Usuarios:**
   - Envía el APK o enlace de descarga
   - Los usuarios pueden instalarla directamente

2. **Actualizar Código:**
   - Haz cambios en el código
   - Compila nuevamente
   - Distribuye la nueva versión

3. **Publicar en Play Store (Opcional):**
   - Crear cuenta de Google Play Developer ($25 una sola vez)
   - Subirla para revisión
   - Disponible para todos en Play Store

---

## 📞 Soporte

Si tienes problemas:
1. Revisa el archivo `BUILD_INSTRUCTIONS.md`
2. Visita https://docs.expo.dev
3. Contacta al soporte de Expo

---

**Versión:** 1.0.0  
**Última actualización:** 2024
