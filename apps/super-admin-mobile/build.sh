#!/bin/bash

# Script para compilar la app Super Admin

echo "=========================================="
echo "Super Admin Mobile - Script de Compilación"
echo "=========================================="
echo ""

# Verificar si eas-cli está instalado
if ! command -v eas &> /dev/null; then
    echo "❌ eas-cli no está instalado"
    echo "Instalando eas-cli..."
    npm install -g eas-cli
fi

# Verificar si estamos logueados en Expo
echo "Verificando login en Expo..."
eas whoami > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  No estás logueado en Expo"
    echo "Ejecutando: eas login"
    eas login
fi

# Instalar dependencias locales
echo ""
echo "📦 Instalando dependencias..."
npm install

# Preguntar por plataforma
echo ""
echo "¿Qué plataforma deseas compilar?"
echo "1) Android (APK)"
echo "2) iOS (IPA)"
echo "3) Ambas"
read -p "Selecciona (1-3): " platform_choice

case $platform_choice in
    1)
        echo ""
        echo "🔨 Compilando para Android..."
        eas build --platform android --profile preview
        ;;
    2)
        echo ""
        echo "🔨 Compilando para iOS..."
        eas build --platform ios --profile preview
        ;;
    3)
        echo ""
        echo "🔨 Compilando para Android..."
        eas build --platform android --profile preview
        echo ""
        echo "🔨 Compilando para iOS..."
        eas build --platform ios --profile preview
        ;;
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac

echo ""
echo "✅ Compilación completada!"
echo "Tu aplicación está lista para descargar desde el dashboard de Expo"
echo ""
echo "Dashboard: https://expo.dev/dashboard"
