import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import crypto from 'crypto';

export async function POST(request) {
  try {
    const { lot_id } = await request.json();
    
    if (!lot_id) {
      return NextResponse.json({ error: 'lot_id requerido' }, { status: 400 });
    }
    
    // Check if token already exists
    const [existing] = await sql`
      SELECT * FROM public_lot_links 
      WHERE lot_id = ${lot_id} AND is_active = true
    `;
    
    if (existing) {
      return NextResponse.json({
        token: existing.public_token,
        url: `/trazabilidad/${existing.public_token}`,
        full_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://trazabilidad.empresa.com'}/trazabilidad/${existing.public_token}`
      });
    }
    
    // Generate new token
    const token = crypto.randomBytes(16).toString('hex');
    
    const [link] = await sql`
      INSERT INTO public_lot_links (lot_id, public_token, is_active, created_at, updated_at)
      VALUES (${lot_id}, ${token}, true, NOW(), NOW())
      RETURNING *
    `;
    
    return NextResponse.json({
      token: link.public_token,
      url: `/trazabilidad/${link.public_token}`,
      full_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://trazabilidad.empresa.com'}/trazabilidad/${link.public_token}`
    });
    
  } catch (error) {
    console.error('Error generating QR token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
