# Configuración de Google Drive para Almacenamiento de Documentos

Este documento guía la configuración de Google Drive para almacenar documentos de contadores de forma segura en la nube.

## Pasos para Configurar Google Drive

### 1. Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google Drive:
   - Ve a "APIs y Servicios" > "Biblioteca"
   - Busca "Google Drive API"
   - Haz clic en "Habilitar"

### 2. Crear Credenciales OAuth 2.0

1. Ve a "APIs y Servicios" > "Credenciales"
2. Haz clic en "Crear credenciales" > "ID de cliente OAuth"
3. Selecciona "Aplicación de escritorio" como tipo de aplicación
4. Completa los campos requeridos
5. Descarga las credenciales (archivo JSON)
   - Abre el archivo descargado y copia el `client_id` y `client_secret`

### 3. Obtener el Refresh Token

1. Usa la siguiente URL en tu navegador, reemplazando `YOUR_CLIENT_ID`:
```
https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000&response_type=code&scope=https://www.googleapis.com/auth/drive
```

2. Google te pedirá permisos, acepta
3. Serás redirigido a `http://localhost:3000?code=AUTH_CODE`
4. Copia el código de la URL

5. En una terminal, ejecuta (reemplaza los valores):
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=AUTH_CODE" \
  -d "redirect_uri=http://localhost:3000" \
  -d "grant_type=authorization_code"
```

6. Copia el `refresh_token` de la respuesta

### 4. Crear Carpeta Raíz en Google Drive

1. Ve a [Google Drive](https://drive.google.com/)
2. Crea una nueva carpeta llamada "Documentos Tecavo Fruits"
3. Haz clic derecho en la carpeta > "Copiar enlace"
4. La URL será: `https://drive.google.com/drive/folders/FOLDER_ID`
5. Copia el `FOLDER_ID`

### 5. Configurar Variables de Ambiente

Agrega las siguientes variables a tu archivo `.env`:

```env
GOOGLE_DRIVE_CLIENT_ID=tu_client_id
GOOGLE_DRIVE_CLIENT_SECRET=tu_client_secret
GOOGLE_DRIVE_REFRESH_TOKEN=tu_refresh_token
GOOGLE_DRIVE_FOLDER_ID=tu_folder_id
```

## Verificar la Configuración

Para verificar que Google Drive está configurado correctamente, haz una solicitud a:
```
GET /api/google-drive/validate
```

Deberías recibir una respuesta similar a:
```json
{
  "configured": true,
  "valid": true,
  "message": "Google Drive está configurado y funciona correctamente"
}
```

## Estructura de Carpetas

Los documentos se organizan automáticamente en Google Drive con la siguiente estructura:

```
Documentos Tecavo Fruits/
├── ProductorA_2024-01-15/
│   ├── contrato_64b.pdf
│   ├── situacion_fiscal.pdf
│   ├── opinion_cumplimiento.pdf
│   ├── identificacion.jpg
│   └── estado_cuenta.pdf
├── ProductorB_2024-01-16/
│   └── ...
```

Cada carpeta se crea automáticamente con el nombre del productor y la fecha de corte.

## Características

✅ Almacenamiento seguro en Google Drive  
✅ Organización automática por productor y fecha  
✅ Enlaces directos para ver/descargar documentos  
✅ Eliminación de documentos con sincronización a Google Drive  
✅ Acceso privado a través de tokens únicos  

## Solucionar Problemas

### "Las credenciales de Google Drive son inválidas"
- Verifica que `GOOGLE_DRIVE_REFRESH_TOKEN` sea válido
- Obtén un nuevo refresh token siguiendo los pasos 3-4 arriba
- Asegúrate de usar la URL de redirección correcta

### "La carpeta raíz no existe"
- Verifica que el `GOOGLE_DRIVE_FOLDER_ID` sea correcto
- Copia el ID directamente desde la URL de Google Drive
- Asegúrate de que la carpeta no haya sido eliminada

### "Error de acceso"
- Verifica que la aplicación tiene permisos de acceso a Google Drive
- En Google Cloud Console, ve a "APIs y Servicios" > "OAuth 2.0"
- Asegúrate de que la aplicación no está en modo de prueba

## Seguridad

- Las credenciales de Google Drive se almacenan como variables de ambiente
- Nunca expongas `GOOGLE_DRIVE_CLIENT_SECRET` o `GOOGLE_DRIVE_REFRESH_TOKEN` en el código
- Los documentos se almacenan en una carpeta privada accesible solo con credenciales autenticadas
- Los enlaces de contador son únicos y se generan aleatoriamente
