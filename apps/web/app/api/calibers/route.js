import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  try {
    let query;
    if (category) {
      query = sql`
        SELECT * FROM caliber_definitions 
        WHERE is_active = true AND category = ${category}
        ORDER BY id
      `;
    } else {
      query = sql`
        SELECT * FROM caliber_definitions 
        WHERE is_active = true
        ORDER BY category, id
      `;
    }
    
    const calibers = await query;
    return NextResponse.json(calibers);
  } catch (error) {
    console.error('Error fetching calibers:', error);
    return NextResponse.json({ error: 'Error fetching calibers' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { caliberCode, caliberName, displayName, category } = await request.json();

    if (!caliberCode || !caliberName || !displayName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO caliber_definitions (caliber_code, caliber_name, display_name, category)
      VALUES (${caliberCode}, ${caliberName}, ${displayName}, ${category || '10kg'})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating caliber:', error);
    return NextResponse.json({ error: 'Error creating caliber' }, { status: 500 });
  }
}
