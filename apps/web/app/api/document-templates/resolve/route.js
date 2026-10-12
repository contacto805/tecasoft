import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: resolve the best document template for a given module + output_type
// e.g. /api/document-templates/resolve?module=embarques&output_type=pdf
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleCode = searchParams.get("module") || searchParams.get("module_code");
    const outputType = searchParams.get("output_type") || "pdf";

    if (!moduleCode) {
      return NextResponse.json({ error: "module requerido" }, { status: 400 });
    }

    // 1) Direct assignment first
    let assigned = await sql`
      SELECT a.*, dt.* 
      FROM module_document_assignments a
      LEFT JOIN document_templates dt ON a.template_id = dt.id
      WHERE a.module_code = ${moduleCode} 
        AND a.output_type = ${outputType}
        AND dt.is_active = true
      LIMIT 1
    `;

    if (assigned.length > 0 && assigned[0].id) {
      return NextResponse.json(assigned[0]);
    }

    // For pdf/ticket/note fallbacks even for input mismatch
    assigned = await sql`
      SELECT a.*, dt.* 
      FROM module_document_assignments a
      LEFT JOIN document_templates dt ON a.template_id = dt.id
      WHERE a.module_code = ${moduleCode} 
        AND dt.is_active = true
      ORDER BY 
        CASE WHEN a.output_type = ${outputType} THEN 0 ELSE 1 END,
        a.is_default DESC
      LIMIT 1
    `;
    if (assigned.length > 0 && assigned[0].id) {
      return NextResponse.json(assigned[0]);
    }

    // 2) Default template matching outputType (or document_type)
    let def = await sql`
      SELECT * FROM document_templates 
      WHERE is_active = true 
        AND (is_default = true OR document_type = ${outputType})
      ORDER BY 
        CASE WHEN is_default THEN 0 ELSE 1 END,
        CASE WHEN document_type = ${outputType} THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT 1
    `;
    if (def.length > 0) {
      return NextResponse.json({ ...def[0], _resolved_as: 'default' });
    }

    // 3) Absolute last resort: any active template
    def = await sql`
      SELECT * FROM document_templates 
      WHERE is_active = true 
      ORDER BY is_default DESC, created_at DESC
      LIMIT 1
    `;
    let resolved = def[0] || null;

    // **Merge global branding files (logo + plantilla Excel) so uploads in "Tickets y Documentos" are actually used in assigned modules and exports**
    let gLogo = null;
    let gExcel = null;
    try {
      const s = await sql`SELECT key, value FROM system_settings WHERE key IN ('logo_url', 'excel_plantilla_url') LIMIT 10`;
      s.forEach(row => {
        if (row.key === 'logo_url') gLogo = row.value;
        if (row.key === 'excel_plantilla_url') gExcel = row.value;
      });
    } catch (_) {}

    if (resolved) {
      if (!resolved.logo_url) resolved.logo_url = gLogo;
      // attach base_excel if missing or for excel outputs
      if (!resolved.base_file_url) resolved.base_file_url = gExcel;
      resolved.logo_url_global = gLogo;
      resolved.excel_plantilla_url = gExcel;
      return NextResponse.json({ ...resolved, _resolved_as: resolved._resolved_as || 'final' });
    }
    // If no templates at all, still return globals so system uses the active logo/excel uploaded here
    return NextResponse.json({ logo_url: gLogo, excel_plantilla_url: gExcel, template_name: 'Global', document_type: 'global', _resolved_as: 'branding' });
  } catch (err) {
    console.error("Resolve template error:", err);
    return NextResponse.json({ error: "Error resolviendo plantilla" }, { status: 500 });
  }
}
