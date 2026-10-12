import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { module_name, report_type, file_format, records_count } = await request.json();

    const fileName = `${module_name}_${new Date().toISOString().split('T')[0]}.${file_format}`;

    const result = await sql`
      INSERT INTO module_reports (
        module_name,
        report_type,
        file_name,
        file_format,
        records_count,
        status
      )
      VALUES (
        ${module_name},
        ${report_type},
        ${fileName},
        ${file_format},
        ${records_count || 0},
        'completed'
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error logging report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleName = searchParams.get('module');

    let reports;
    if (moduleName) {
      reports = await sql`
        SELECT * FROM module_reports 
        WHERE module_name = ${moduleName}
        ORDER BY generated_at DESC 
        LIMIT 50
      `;
    } else {
      reports = await sql`
        SELECT * FROM module_reports 
        ORDER BY generated_at DESC 
        LIMIT 100
      `;
    }

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
