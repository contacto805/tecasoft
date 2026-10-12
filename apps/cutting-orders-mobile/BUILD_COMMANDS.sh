#!/bin/bash

# 🚀 Script para compilar APK de Órdenes de Corte
# Ejecuta este script desde tu computadora local (no desde el sandbox)

echo "📱 Compilando APK de Órdenes de Corte..."
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
echo "💡 Tip: Puedes compilar las dos apps en paralelo abriendo otra terminal"
