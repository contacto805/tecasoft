import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const config = await sql`
      SELECT value FROM system_settings WHERE key = 'google_drive_config'
    `;
    
    if (config && config.length > 0) {
      const driveConfig = JSON.parse(config[0].value);
      // No enviar datos sensibles al frontend
      return NextResponse.json({
        configured: true,
        hasClientId: !!driveConfig.clientId,
        hasClientSecret: !!driveConfig.clientSecret,
        hasRefreshToken: !!driveConfig.refreshToken,
        rootFolderId: driveConfig.rootFolderId || ''
      });
    }
    
    return NextResponse.json({ configured: false });
  } catch (error) {
    console.error('Error fetching Google Drive config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { clientId, clientSecret, refreshToken, rootFolderId } = body;
    
    // Validar datos requeridos
    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json({ 
        error: 'Faltan datos requeridos: clientId, clientSecret, refreshToken' 
      }, { status: 400 });
    }
    
    // Validar que el refresh token funciona
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    
    if (!tokenResponse.ok) {
      return NextResponse.json({ 
        error: 'Credenciales inválidas. Verifica tu Client ID, Client Secret y Refresh Token.' 
      }, { status: 400 });
    }
    
    const { access_token } = await tokenResponse.json();
    
    // Si no hay rootFolderId, crear carpeta "Reportes Diarios"
    let finalRootFolderId = rootFolderId;
    if (!finalRootFolderId) {
      const folderMetadata = {
        name: 'Reportes Diarios - Tecavo',
        mimeType: 'application/vnd.google-apps.folder'
      };
      
      const createFolderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(folderMetadata)
      });
      
      const folderResult = await createFolderResponse.json();
      finalRootFolderId = folderResult.id;
    }
    
    // Guardar configuración
    const configData = JSON.stringify({
      clientId,
      clientSecret,
      refreshToken,
      rootFolderId: finalRootFolderId
    });
    
    // Verificar si ya existe configuración
    const existing = await sql`
      SELECT id FROM system_settings WHERE key = 'google_drive_config'
    `;
    
    if (existing && existing.length > 0) {
      await sql`
        UPDATE system_settings 
        SET value = ${configData}, updated_at = NOW()
        WHERE key = 'google_drive_config'
      `;
    } else {
      await sql`
        INSERT INTO system_settings (key, value, created_at, updated_at)
        VALUES ('google_drive_config', ${configData}, NOW(), NOW())
      `;
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Configuración de Google Drive guardada exitosamente',
      rootFolderId: finalRootFolderId
    });
    
  } catch (error) {
    console.error('Error saving Google Drive config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await sql`
      DELETE FROM system_settings WHERE key = 'google_drive_config'
    `;
    
    return NextResponse.json({ 
      success: true,
      message: 'Configuración de Google Drive eliminada'
    });
  } catch (error) {
    console.error('Error deleting Google Drive config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
