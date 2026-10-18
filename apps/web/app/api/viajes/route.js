import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const loadHistoryId = searchParams.get("loadHistoryId");
    const estatus = searchParams.get("estatus");

    let base = sql`
      SELECT v.*, c.customer_name, c.destination,
             lh.id as load_id, lh.factura_folio as load_folio, lh.total_kg as load_kg
      FROM viajes v 
      LEFT JOIN customers c ON v.customer_id = c.id
      LEFT JOIN load_history lh ON lh.id = v.load_history_id
    `;

    if (loadHistoryId) {
      base = sql`${base} WHERE v.load_history_id = ${parseInt(loadHistoryId)} ORDER BY v.fecha_salida DESC`;
    } else if (customerId) {
      base = sql`${base} WHERE v.customer_id = ${parseInt(customerId)} ORDER BY v.fecha_salida DESC`;
    } else {
      base = sql`${base} ORDER BY v.fecha_salida DESC, v.id DESC LIMIT 200`;
    }

    const rows = await base;
    return NextResponse.json(rows);
  } catch (e) {
    console.error("viajes GET", e);
    return NextResponse.json({ error: "Error al obtener viajes" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { customerId, ...rest } = data;

    // Auto folio V-
    const max = await sql`SELECT folio FROM viajes WHERE folio LIKE 'V-%' ORDER BY folio DESC LIMIT 1`;
    let next = 1;
    if (max.length && max[0].folio) {
      const n = parseInt(String(max[0].folio).replace("V-", "")) || 0;
      next = n + 1;
    }
    const folio = "V-" + String(next).padStart(6, "0");

    const [row] = await sql`
      INSERT INTO viajes (
        folio, fecha_salida, hora_salida, customer_id, destino, pais,
        transportista, operador, unidad, placas, caja_remolque,
        lotes, numero_carga, referencia_interna, numero_cajas, peso,
        valor_usd, estatus, fecha_entrega, fecha_estimada_pago, observaciones, created_by
      ) VALUES (
        ${folio}, ${rest.fecha_salida || null}, ${rest.hora_salida || null}, ${parseInt(customerId)},
        ${rest.destino || null}, ${rest.pais || "Estados Unidos"},
        ${rest.transportista || null}, ${rest.operador || null}, ${rest.unidad || null}, ${rest.placas || null},
        ${rest.caja_remolque || null}, ${rest.lotes || null}, ${rest.numero_carga || null},
        ${rest.referencia_interna || null}, ${parseInt(rest.numero_cajas) || 0}, ${parseFloat(rest.peso) || 0},
        ${parseFloat(rest.valor_usd) || 0}, ${rest.estatus || "Preparación"}, ${rest.fecha_entrega || null},
        ${rest.fecha_estimada_pago || null}, ${rest.observaciones || null}, ${rest.created_by || "sistema"}
      ) RETURNING *
    `;

    // Auto create nota for the viaje
    if (row && row.id && row.valor_usd > 0) {
      const notaFolio = "N-" + folio;
      await sql`
        INSERT INTO notas (folio, customer_id, viaje_id, fecha, importe_original_usd, saldo_usd, fecha_compromiso, estatus)
        VALUES (${notaFolio}, ${parseInt(customerId)}, ${row.id}, ${row.fecha_salida || new Date().toISOString().slice(0,10)}, 
          ${parseFloat(row.valor_usd)}, ${parseFloat(row.valor_usd)}, ${row.fecha_estimada_pago || null}, 'Pendiente')
      `;
    }

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    console.error("viajes POST", e);
    return NextResponse.json({ error: "Error al crear viaje" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const { id, ...rest } = data;
    const [row] = await sql`
      UPDATE viajes SET
        fecha_salida = ${rest.fecha_salida || null},
        hora_salida = ${rest.hora_salida || null},
        destino = ${rest.destino || null},
        transportista = ${rest.transportista || null},
        operador = ${rest.operador || null},
        placas = ${rest.placas || null},
        numero_cajas = ${parseInt(rest.numero_cajas) || 0},
        peso = ${parseFloat(rest.peso) || 0},
        valor_usd = ${parseFloat(rest.valor_usd) || 0},
        estatus = ${rest.estatus || null},
        fecha_entrega = ${rest.fecha_entrega || null},
        fecha_estimada_pago = ${rest.fecha_estimada_pago || null},
        observaciones = ${rest.observaciones || null},
        updated_by = ${rest.updated_by || "sistema"},
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    await sql`DELETE FROM viajes WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
