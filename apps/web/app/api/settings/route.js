import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const settings = await sql`SELECT DISTINCT ON (key) key, value FROM system_settings ORDER BY key, id DESC`;
    
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    return NextResponse.json(settingsObj);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    
    const updates = [];
    for (const [key, value] of Object.entries(data)) {
      // Safe upsert using delete+insert inside transaction-like (single statement preferred)
      await sql`
        INSERT INTO system_settings (key, value, updated_at) 
        VALUES (${key}, ${value}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
      `;
      updates.push({ key, value });
    }
    
    return NextResponse.json({ success: true, updated: updates });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
