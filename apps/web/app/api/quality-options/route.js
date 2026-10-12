import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const options = await sql`
      SELECT * FROM quality_options 
      WHERE is_active = true
      ORDER BY id
    `;
    
    return NextResponse.json(options);
  } catch (error) {
    console.error('Error fetching quality options:', error);
    return NextResponse.json({ error: 'Error fetching quality options' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { qualityName, displayName, description, colorCode } = await request.json();

    if (!qualityName || !displayName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO quality_options (quality_name, display_name, description, color_code)
      VALUES (${qualityName}, ${displayName}, ${description || ''}, ${colorCode || ''})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating quality option:', error);
    return NextResponse.json({ error: 'Error creating quality option' }, { status: 500 });
  }
}
