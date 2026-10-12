# 📱 Instrucciones para Generar APKs

## ⚠️ Importante: Limitaciones del Sandbox

El entorno de desarrollo actual **no puede compilar APKs directamente** porque requiere:
- Android SDK (varios GB de descarga)
- Java JDK instalado
- Cuenta de Expo con acceso a EAS Build
- Conexión a internet estable para subir el código

## ✅ Solución: 3 Opciones para Generar tus APKs

---

### **OPCIÓN 1: EAS Build (Recomendado) - Gratis para siempre**

Esta es la forma **más fácil y rápida**. Expo compila en sus servidores.

#### Pasos:

1. **Instala EAS CLI en tu computadora local:**
```bash
npm install -g eas-cli
```

2. **Crea una cuenta gratuita en Expo:**
```bash
eas login
```
O regístrate en: https://expo.dev/signup

3. **Navega a cada proyecto y compila:**

**Para Órdenes de Corte:**
```bash
cd /ruta/a/cutting-orders-mobile
eas build --platform android --profile preview
```

**Para Ingreso de Fruta:**
```bash
cd /ruta/a/fruit-intake-mobile
eas build --platform android --profile preview
```

4. **Descarga los APKs:**
   - Recibirás un enlace de descarga cuando termine (15-20 min)
   - O descárgalos desde: https://expo.dev/accounts/[tu-usuario]/projects

#### Ventajas:
✅ **100% Gratis** (plan gratuito incluye builds ilimitados)
✅ No requiere Android SDK en tu máquina
✅ Compilación profesional en la nube
✅ Soporte para actualizaciones OTA (Over-The-Air)

---

### **OPCIÓN 2: Build Local (Para desarrolladores avanzados)**

Si prefieres compilar en tu máquina sin usar servidores de Expo:

#### Requisitos:
- Android Studio instalado
- JDK 17 o superior
- Android SDK configurado
- ~10 GB de espacio libre

#### Pasos:

1. **Instala Android Studio:**
   - Descarga: https://developer.android.com/studio
   - Instala Android SDK 33 (Android 13)

2. **Configura variables de entorno:**
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

3. **Compila localmente:**
```bash
cd cutting-orders-mobile
eas build --platform android --profile preview --local

cd ../fruit-intake-mobile
eas build --platform android --profile preview --local
```

4. **Encuentra los APKs:**
   - Se guardarán en la raíz de cada proyecto como `build-*.apk`

---

### **OPCIÓN 3: Expo Go (Solo para pruebas rápidas)**

**NO genera APK**, pero permite probar la app instantáneamente:

1. **Instala Expo Go en tu celular:**
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
   - iOS: https://apps.apple.com/app/expo-go/id982107779

2. **Inicia el servidor de desarrollo:**
```bash
cd cutting-orders-mobile
npm start
```

3. **Escanea el QR** que aparece en la terminal con Expo Go

⚠️ **Limitación:** Requiere que tu computadora y celular estén en la misma red WiFi

---

## 🎯 Mi Recomendación: Usa OPCIÓN 1 (EAS Build)

Es gratis, fácil, y profesional. Los APKs estarán listos en 20 minutos sin instalar nada extra.

### Comandos Completos:

```bash
# 1. Instalar EAS CLI (una sola vez)
npm install -g eas-cli

# 2. Login a Expo
eas login

# 3. Compilar Órdenes de Corte
cd cutting-orders-mobile
eas build --platform android --profile preview

# 4. Compilar Ingreso de Fruta
cd ../fruit-intake-mobile
eas build --platform android --profile preview

# 5. Descargar APKs desde el enlace que te envíen por correo
```

---

## 📦 Archivos de Configuración Ya Listos

Ambos proyectos ya tienen:
- ✅ `app.json` configurado
- ✅ `eas.json` con perfil de preview
- ✅ `.env` con URLs de API
- ✅ Iconos y splash screens
- ✅ Código listo para producción

**Solo necesitas ejecutar el build.**

---

## 🔗 Enlaces Útiles

- Documentación EAS Build: https://docs.expo.dev/build/setup/
- Crear cuenta Expo: https://expo.dev/signup
- Guía de Android Studio: https://developer.android.com/studio/install

---

## ❓ Preguntas Frecuentes

**P: ¿EAS Build es realmente gratis?**
R: Sí, el plan gratuito permite builds ilimitados para proyectos personales.

**P: ¿Cuánto tarda en compilar?**
R: Entre 15-25 minutos por APK en servidores de Expo.

**P: ¿Necesito publicar en Google Play?**
R: No, puedes distribuir los APKs directamente (instalación manual).

**P: ¿Los usuarios necesitan Expo Go?**
R: No, los APKs son apps standalone independientes.

---

## 🚀 Próximos Pasos

1. Decide qué opción prefieres (recomiendo OPCIÓN 1)
2. Sigue los pasos de esa opción
3. Comparte los APKs con tu equipo
4. Instala directamente en dispositivos Android

**¿Necesitas ayuda?** Avísame y te guío paso a paso.
