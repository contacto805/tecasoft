import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    
    // Find lot by public token
    const [link] = await sql`
      SELECT * FROM public_lot_links 
      WHERE public_token = ${token} AND is_active = true
    `;
    
    if (!link) {
      return NextResponse.json({ error: 'Lote no encontrado o token inválido' }, { status: 404 });
    }
    
    // Get lot information
    const [lot] = await sql`
      SELECT 
        l.*,
        co.producer_name as cutting_producer,
        co.orchard_name as cutting_orchard,
        co.location as cutting_location
      FROM lots l
      LEFT JOIN cutting_orders co ON l.cutting_order_id = co.id
      WHERE l.id = ${link.lot_id}
    `;
    
    if (!lot) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }
    
    // Get public dashboard configuration
    const [config] = await sql`
      SELECT * FROM public_dashboard_config 
      WHERE is_active = true 
      ORDER BY id DESC 
      LIMIT 1
    `;
    
    // Log the access (get client IP and user agent from headers)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await sql`
      INSERT INTO public_qr_access_log (
        lot_id, 
        public_token, 
        ip_address, 
        user_agent,
        access_timestamp
      ) VALUES (
        ${link.lot_id},
        ${token},
        ${ip},
        ${userAgent},
        NOW()
      )
    `;
    
    // Filter lot data to only include public information
    const publicLotData = {
      lot_number: lot.lot_number,
      producer: lot.producer || lot.cutting_producer,
      orchard_name: lot.orchard_name || lot.cutting_orchard,
      origin: lot.origin || lot.cutting_location,
      municipality: lot.municipality,
      fruit_type: lot.fruit_type,
      date: lot.date,
      total_kg_received: lot.total_kg_received,
      total_kg_packed: lot.total_kg_packed,
      status: lot.status
    };
    
    return NextResponse.json({
      lot: publicLotData,
      config: config || {}
    });
    
  } catch (error) {
    console.error('Error fetching public lot data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Log QR scan statistics
export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const body = await request.json();
    
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await sql`
      INSERT INTO public_qr_access_log (
        lot_id,
        public_token,
        ip_address,
        user_agent,
        country,
        state,
        city,
        device_type,
        referer,
        access_timestamp
      ) VALUES (
        ${body.lot_id || null},
        ${token},
        ${ip},
        ${userAgent},
        ${body.country || null},
        ${body.state || null},
        ${body.city || null},
        ${body.device_type || null},
        ${body.referer || null},
        NOW()
      )
    `;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging QR access:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
