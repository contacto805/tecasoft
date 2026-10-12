#!/bin/bash

# Script para construir APKs de Tecavo Fruits Mobile Apps
# Uso: ./build-apks.sh

set -e

echo "================================"
echo "🔧 Constructor de APKs"
echo "Tecavo Fruits Mobile Apps"
echo "================================"
echo ""

# Verificar si tenemos los requisitos
if ! command -v npm &> /dev/null; then
    echo "❌ npm no encontrado. Por favor instala Node.js"
    exit 1
fi

if ! command -v eas &> /dev/null; then
    echo "⚠️  eas-cli no instalado. Instalando..."
    npm install -g eas-cli
fi

# Función para construir una app
build_app() {
    local app_path=$1
    local app_name=$2
    
    echo ""
    echo "📱 Construyendo: $app_name"
    echo "Ubicación: $app_path"
    echo "---"
    
    cd "$app_path"
    
    # Instalar dependencias
    echo "📦 Instalando dependencias..."
    npm install --legacy-peer-deps
    
    # Construir APK
    echo "🔨 Compilando APK..."
    eas build --platform android --non-interactive
    
    echo "✅ $app_name completado!"
    cd - > /dev/null
}

# Verificar login
echo "🔐 Verificando autenticación Expo..."
if ! eas whoami &> /dev/null; then
    echo "⚠️  No estás autenticado. Ejecuta: eas login"
    eas login
fi

echo ""
echo "¿Cuál deseas compilar?"
echo "1) Órdenes de Corte"
echo "2) Ingreso de Fruta"
echo "3) Ambas"
read -p "Opción (1-3): " choice

case $choice in
    1)
        build_app "/home/user/apps/cutting-orders-mobile" "Órdenes de Corte"
        ;;
    2)
        build_app "/home/user/apps/fruit-intake-mobile" "Ingreso de Fruta"
        ;;
    3)
        build_app "/home/user/apps/cutting-orders-mobile" "Órdenes de Corte"
        build_app "/home/user/apps/fruit-intake-mobile" "Ingreso de Fruta"
        ;;
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac

echo ""
echo "================================"
echo "✅ Proceso completado!"
echo "================================"
echo "Descarga tus APKs desde: https://expo.dev"
echo ""
echo "Para instalar en dispositivo:"
echo "  adb install archivo.apk"
