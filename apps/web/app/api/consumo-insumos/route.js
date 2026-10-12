import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const b = await request.json();
    const { folio_proceso, cantidad_real_consumida, motivo_ajuste, usuario = 'supervisor', pin = '' } = b;

    const real = parseFloat(cantidad_real_consumida) || 0;
    const teorica = real * 0.95; // ejemplo

    const [row] = await sql`
      INSERT INTO consumo_insumos_lote (folio_proceso, cantidad_teorica, cantidad_real_consumida, costo_total_insumo_lote, estatus_cierre)
      VALUES (${folio_proceso || null}, ${teorica}, ${real}, ${real * 12.5}, ${motivo_ajuste ? 'Editado' : 'Automatizado'})
      RETURNING *
    `;

    if (motivo_ajuste) {
      await sql`
        INSERT INTO bitacora_auditoria_insumos (consumo_id, usuario, campo_modificado, valor_anterior, valor_nuevo, motivo_ajuste, pin_usado, timestamp)
        VALUES (${row.id}, ${usuario}, 'cantidad_real_consumida', ${teorica}, ${real}, ${motivo_ajuste}, ${pin || 'sin-pin'}, CURRENT_TIMESTAMP)
      `;
    }

    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
