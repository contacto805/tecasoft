import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    let q = sql`
      SELECT a.*, c.customer_name,
        (a.equivalente_usd - COALESCE((SELECT SUM(monto_aplicado_usd) FROM abono_aplicaciones WHERE abono_id = a.id),0)) as disponible_usd
      FROM abonos a 
      LEFT JOIN customers c ON a.customer_id = c.id 
      ORDER BY a.fecha DESC LIMIT 200
    `;
    if (customerId) {
      q = sql`
        SELECT a.*, c.customer_name,
          (a.equivalente_usd - COALESCE((SELECT SUM(monto_aplicado_usd) FROM abono_aplicaciones WHERE abono_id = a.id),0)) as disponible_usd
        FROM abonos a LEFT JOIN customers c ON a.customer_id = c.id 
        WHERE a.customer_id = ${parseInt(customerId)} ORDER BY a.fecha DESC
      `;
    }
    return NextResponse.json(await q);
  } catch (e) {
    return NextResponse.json({ error: "Error abonos" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { customerId, moneda_recibida, importe_recibido, tipo_cambio, ...rest } = data;

    let equiv = parseFloat(importe_recibido) || 0;
    let tc = parseFloat(tipo_cambio) || 1;
    if (moneda_recibida === "MXN" && tc > 0) {
      equiv = (parseFloat(importe_recibido) || 0) / tc;
    }

    // Auto folio AB-
    const max = await sql`SELECT folio FROM abonos WHERE folio LIKE 'AB-%' ORDER BY folio DESC LIMIT 1`;
    let next = 1;
    if (max.length && max[0].folio) {
      const n = parseInt(String(max[0].folio).replace("AB-", "")) || 0;
      next = n + 1;
    }
    const folio = "AB-" + String(next).padStart(6, "0");

    const [row] = await sql`
      INSERT INTO abonos (folio, fecha, hora, customer_id, banco_receptor, cuenta_receptora, referencia_bancaria,
        moneda_recibida, importe_recibido, tipo_cambio, equivalente_usd, comprobante_url, observaciones, created_by)
      VALUES (
        ${folio}, ${rest.fecha || new Date().toISOString().slice(0,10)}, ${rest.hora || null}, ${parseInt(customerId)},
        ${rest.banco_receptor || null}, ${rest.cuenta_receptora || null}, ${rest.referencia_bancaria || null},
        ${moneda_recibida || 'USD'}, ${parseFloat(importe_recibido) || 0}, ${tc}, ${equiv},
        ${rest.comprobante_url || null}, ${rest.observaciones || null}, ${rest.created_by || 'sistema'}
      ) RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error crear abono" }, { status: 500 });
  }
}
