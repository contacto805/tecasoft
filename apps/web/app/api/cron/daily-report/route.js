import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Este endpoint será llamado por un servicio cron externo (como Vercel Cron)
// Configurar en vercel.json para que se ejecute diariamente a medianoche

export async function GET(request) {
  try {
    // Verificar que la petición venga de un cron autorizado
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-here';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Obtener la fecha de ayer (el reporte se genera a medianoche para el día anterior)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = yesterday.toISOString().split('T')[0];
    
    // Verificar si Google Drive está configurado
    const driveConfig = await sql`
      SELECT value FROM system_settings WHERE key = 'google_drive_config'
    `;
    
    if (!driveConfig || driveConfig.length === 0) {
      console.log('Google Drive no configurado, saltando reporte automático');
      return NextResponse.json({ 
        success: false, 
        message: 'Google Drive no está configurado' 
      });
    }
    
    // Llamar al endpoint de reportes para generar y subir
    const baseUrl = new URL(request.url).origin;
    const response = await fetch(`${baseUrl}/api/reports/daily`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload-to-drive',
        date: reportDate
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`Reporte diario generado y subido: ${reportDate}`);
      
      // Registrar en audit log
      await sql`
        INSERT INTO sync_audit_log (
          entity_type, entity_id, action, module_name, 
          user_id, new_values, created_at
        ) VALUES (
          'daily_report', 0, 'auto_generated', 'cron',
          'system', ${JSON.stringify(result)}, NOW()
        )
      `;
      
      return NextResponse.json({ 
        success: true, 
        message: 'Reporte generado y subido exitosamente',
        details: result
      });
    } else {
      console.error('Error generando reporte:', result.error);
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in daily report cron:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
