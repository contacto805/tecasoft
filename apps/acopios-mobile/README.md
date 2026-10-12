# App Móvil Acopios de Campo

## Propósito
Aplicación para instalar en dispositivos de Acopiadores:
Acceso con nombre de usuario + PIN (4 dígitos).
Registrar visitas a huertas en tiempo real y offline.

Funcionalidad principal:
- Captura GPS automática (requiere permisos)
- Entrada calibración obligatoria 100%
- Toma y subida de fotos evidenciales (3 obligatorias)
- Registro de negociación directa
- Guardado offline + sync automático

## Acceso
Usa el mismo nombre de usuario y PIN de 4 dígitos asignado por administración desde el panel web.

## Login offline
Funciona sin internet (almacena localmente).

## Requisitos instalación
Instalar APK generado para Android.

Para compilar: 
- Instalar Expo y Node 18+
- cd acopios-mobile
- npx expo install   (si faltan)

Luego:
npx expo start --android   (pruebas dev)
eas build --platform android --profile preview   (APK instalación directa)

## API
Utiliza API principal existente del proyecto Web (todas las rutas /api/acopios/* )

Todas las visitas se sincronizan automáticamente con el módulo de Acopios web.
