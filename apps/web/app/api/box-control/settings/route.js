import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Fetch all settings
export async function GET() {
  try {
    const settings = await sql`
      SELECT * FROM box_control_settings 
      ORDER BY setting_key ASC
    `;

    // Convert to key-value object
    const settingsObj = {};
    settings.forEach(s => {
      let value = s.setting_value;
      if (s.setting_type === 'numeric') {
        value = parseFloat(value);
      } else if (s.setting_type === 'boolean') {
        value = value === 'true';
      }
      settingsObj[s.setting_key] = {
        value,
        type: s.setting_type,
        description: s.description,
        editable_by: s.editable_by
      };
    });

    return NextResponse.json({ success: true, settings: settingsObj, rawSettings: settings });
  } catch (error) {
    console.error('Error in GET /api/box-control/settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update setting
export async function PUT(request) {
  try {
    const { setting_key, setting_value } = await request.json();

    if (!setting_key) {
      return NextResponse.json({ error: 'Missing setting_key' }, { status: 400 });
    }

    const result = await sql`
      UPDATE box_control_settings 
      SET 
        setting_value = ${String(setting_value)},
        updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = ${setting_key}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error in PUT /api/box-control/settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
