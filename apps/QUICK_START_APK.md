# 🚀 Inicio Rápido: Generar APKs en 5 Minutos

## Paso 1: Instala EAS CLI (una sola vez)

Abre tu terminal y ejecuta:

```bash
npm install -g eas-cli
```

## Paso 2: Inicia sesión en Expo

```bash
eas login
```

Si no tienes cuenta, créala gratis en: https://expo.dev/signup

## Paso 3: Compila las APKs

### Para Órdenes de Corte:

```bash
cd /ruta/completa/a/cutting-orders-mobile
eas build --platform android --profile preview
```

### Para Ingreso de Fruta:

```bash
cd /ruta/completa/a/fruit-intake-mobile
eas build --platform android --profile preview
```

## Paso 4: Descarga los APKs

- Espera 15-20 minutos
- Recibirás un correo con el enlace de descarga
- O entra a https://expo.dev y descárgalos desde tu panel

## Paso 5: Instala en dispositivos Android

1. Transfiere el APK a tu celular (email, USB, Drive, etc.)
2. Abre el APK en el celular
3. Permite "Instalar desde fuentes desconocidas" si te lo pide
4. ¡Listo! La app está instalada

---

## ⚡ Alternativa: Compilar Ambas Apps en Paralelo

Abre dos terminales y ejecuta en cada una:

**Terminal 1:**
```bash
cd cutting-orders-mobile
eas build --platform android --profile preview
```

**Terminal 2:**
```bash
cd fruit-intake-mobile
eas build --platform android --profile preview
```

Así ambas se compilarán al mismo tiempo.

---

## 🎯 Resumen

| Paso | Comando | Tiempo |
|------|---------|--------|
| 1. Instalar EAS | `npm install -g eas-cli` | 1 min |
| 2. Login | `eas login` | 1 min |
| 3. Build App 1 | `eas build --platform android --profile preview` | 20 min |
| 4. Build App 2 | `eas build --platform android --profile preview` | 20 min |
| **Total** | | **~22 min** |

---

## ✅ Todo está Configurado

Ambas apps ya tienen:
- URLs de API configuradas
- Iconos y splash screens
- Nombres y versiones
- Permisos necesarios

**Solo ejecuta los comandos y espera.**

---

## 🆘 ¿Problemas?

**Error: "eas: command not found"**
```bash
npm install -g eas-cli
```

**Error: "Not logged in"**
```bash
eas login
```

**Error: "Project not configured"**
→ Los archivos `app.json` y `eas.json` ya están listos, verifica que estés en la carpeta correcta.

---

**¿Listo?** Ejecuta los comandos y en 20 minutos tendrás tus APKs.
