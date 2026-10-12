#!/bin/bash

# 🚀 Script para compilar APK de Ingreso de Fruta
# Ejecuta este script desde tu computadora local (no desde el sandbox)

echo "📱 Compilando APK de Ingreso de Fruta..."
echo ""
echo "⚠️  Asegúrate de tener EAS CLI instalado:"
echo "    npm install -g eas-cli"
echo ""
echo "🔐 Inicia sesión en Expo si es necesario:"
echo "    eas login"
echo ""
echo "🏗️  Iniciando compilación en EAS Build..."
echo ""

# Opción 1: Build en la nube (Recomendado - Gratis)
eas build --platform android --profile preview

echo ""
echo "✅ Build iniciado!"
echo "📧 Recibirás un correo con el enlace de descarga cuando termine (~20 min)"
echo "🌐 O visita: https://expo.dev"
echo ""
echo "💡 Tip: Para compilar ambas apps, abre otra terminal y ejecuta el script de la otra app"
