import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    // Get pallet configuration settings
    const settings = await sql`
      SELECT key, value FROM system_settings 
      WHERE key LIKE 'pallet_%'
      ORDER BY key
    `;

    // Return default pallet config if not set
    const config = {
      pallet_weight: 22, // kg per pallet
      box_weight: 2,     // kg per box
      boxes_per_pallet: 50 // boxes per pallet
    };

    settings.forEach(setting => {
      if (setting.key === 'pallet_weight') config.pallet_weight = parseFloat(setting.value);
      if (setting.key === 'box_weight') config.box_weight = parseFloat(setting.value);
      if (setting.key === 'boxes_per_pallet') config.boxes_per_pallet = parseInt(setting.value);
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching pallet config:', error);
    return NextResponse.json(
      { error: 'Error fetching pallet config' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { pallet_weight, box_weight, boxes_per_pallet } = await request.json();

    // Update or create settings
    if (pallet_weight !== undefined) {
      await sql`
        INSERT INTO system_settings (key, value, created_at, updated_at)
        VALUES ('pallet_weight', ${pallet_weight.toString()}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = ${pallet_weight.toString()}, updated_at = CURRENT_TIMESTAMP
      `;
    }

    if (box_weight !== undefined) {
      await sql`
        INSERT INTO system_settings (key, value, created_at, updated_at)
        VALUES ('box_weight', ${box_weight.toString()}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = ${box_weight.toString()}, updated_at = CURRENT_TIMESTAMP
      `;
    }

    if (boxes_per_pallet !== undefined) {
      await sql`
        INSERT INTO system_settings (key, value, created_at, updated_at)
        VALUES ('boxes_per_pallet', ${boxes_per_pallet.toString()}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = ${boxes_per_pallet.toString()}, updated_at = CURRENT_TIMESTAMP
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating pallet config:', error);
    return NextResponse.json(
      { error: 'Error updating pallet config' },
      { status: 500 }
    );
  }
}
