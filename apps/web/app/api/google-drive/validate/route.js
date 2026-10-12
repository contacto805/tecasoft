import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Validar que todas las variables de ambiente necesarias estén configuradas
    const requiredEnvVars = [
      'GOOGLE_DRIVE_CLIENT_ID',
      'GOOGLE_DRIVE_CLIENT_SECRET',
      'GOOGLE_DRIVE_REFRESH_TOKEN',
      'GOOGLE_DRIVE_FOLDER_ID'
    ];

    const missingVars = requiredEnvVars.filter(
      varName => !process.env[varName] || process.env[varName].trim() === ''
    );

    if (missingVars.length > 0) {
      return NextResponse.json({
        configured: false,
        missing: missingVars,
        message: `Faltan las siguientes variables de ambiente: ${missingVars.join(', ')}`
      });
    }

    // Intentar obtener un access token para validar las credenciales
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
          client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
          refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
          grant_type: 'refresh_token'
        })
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        return NextResponse.json({
          configured: false,
          valid: false,
          message: 'Las credenciales de Google Drive son inválidas',
          error: errorData.error_description || errorData.error
        });
      }

      // Validar que la carpeta raíz existe
      const { access_token } = await tokenResponse.json();
      
      const folderResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${process.env.GOOGLE_DRIVE_FOLDER_ID}`,
        {
          headers: { 'Authorization': `Bearer ${access_token}` }
        }
      );

      if (!folderResponse.ok) {
        return NextResponse.json({
          configured: false,
          valid: false,
          message: 'La carpeta raíz de Google Drive no existe o no es accesible'
        });
      }

      return NextResponse.json({
        configured: true,
        valid: true,
        message: 'Google Drive está configurado y funciona correctamente'
      });
    } catch (error) {
      return NextResponse.json({
        configured: false,
        valid: false,
        message: 'Error al validar la configuración de Google Drive',
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error validating Google Drive:', error);
    return NextResponse.json(
      { error: 'Error al validar Google Drive' },
      { status: 500 }
    );
  }
}
