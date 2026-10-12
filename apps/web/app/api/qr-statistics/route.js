import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lot_id');
    const token = searchParams.get('token');
    
    let whereClause = sql``;
    
    if (lotId) {
      whereClause = sql`WHERE lot_id = ${parseInt(lotId)}`;
    } else if (token) {
      whereClause = sql`WHERE public_token = ${token}`;
    }
    
    // Get scan statistics
    const stats = await sql`
      SELECT 
        COUNT(*) as total_scans,
        COUNT(DISTINCT ip_address) as unique_visitors,
        COUNT(DISTINCT DATE(access_timestamp)) as days_with_scans,
        MIN(access_timestamp) as first_scan,
        MAX(access_timestamp) as last_scan
      FROM public_qr_access_log
      ${whereClause}
    `;
    
    // Get scans by date
    const scansByDate = await sql`
      SELECT 
        DATE(access_timestamp) as date,
        COUNT(*) as scans
      FROM public_qr_access_log
      ${whereClause}
      GROUP BY DATE(access_timestamp)
      ORDER BY date DESC
      LIMIT 30
    `;
    
    // Get scans by country
    const scansByCountry = await sql`
      SELECT 
        COALESCE(country, 'Unknown') as country,
        COUNT(*) as scans
      FROM public_qr_access_log
      ${whereClause}
      GROUP BY country
      ORDER BY scans DESC
      LIMIT 10
    `;
    
    // Get scans by device
    const scansByDevice = await sql`
      SELECT 
        COALESCE(device_type, 'Unknown') as device_type,
        COUNT(*) as scans
      FROM public_qr_access_log
      ${whereClause}
      GROUP BY device_type
      ORDER BY scans DESC
    `;
    
    return NextResponse.json({
      stats: stats[0] || {},
      by_date: scansByDate,
      by_country: scansByCountry,
      by_device: scansByDevice
    });
    
  } catch (error) {
    console.error('Error fetching QR statistics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
