#!/bin/bash
# Genera el APK del módulo Acopios

cd "$(dirname "$0")"

echo "Instalando dependencias..."
npx expo install

echo "Generando APK..."
npx eas build --platform android --profile preview --non-interactive || npx expo export:embed --platform android

echo "Listo. APK descargable en EAS (si tienes cuenta EXPO) o usa npx expo run:android para pruebas."
