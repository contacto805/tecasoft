# Cómo compilar APK instalable para Acopiadores

Esta aplicación móvil está lista para generar instalables válidos de Expo.

## Requisitos previos
- Node 18+
- npm / yarn  + npx
- Cuenta Expo (npx eas login)
- Android Studio (solo si debug)

## Pasos para generar APK instalable

1. Entra en la carpeta de la app
cd /home/user/apps/acopios-mobile

2. Instala dependencias faltantes
npx expo install

3. (Primera vez) Configura EAS:
npx eas build:configure

4. Construir APK para Android (installable local)
npx eas build --platform android --profile preview

Esto genera un .apk descargable vía Expo.

Puedes subirlo a drive o usar "Install APK" directamente en celulares.

Una vez hecho APK:
- Copia el link generado
- Abre en teléfono → descarga e instala

## Instalar en teléfonos de campo
Habilitar "Instalación desde fuentes desconocidas".

## Sincronización
El app usa automáticamente la API de Acopios cuando hay conexión.
Si no hay internet, guarda local para subir más tarde con botón SYNC.

## Notas
- Los usuarios deben tener PIN configurado previamente desde panel web /admin/users
- Una vez creado APK ya se queda no necesita más cambios frecuentes en code
- GPS y cámara requieren permisos en primera ejecución.

## Ayuda
Si necesitas una instancia nueva del app contacta al equipo Administrativo.
