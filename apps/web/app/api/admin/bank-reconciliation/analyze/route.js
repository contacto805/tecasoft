import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request) {
  try {
    const body = await request.json();
    const { statement_id, raw_rows } = body; // raw_rows for csv/excel pre-parsed

    if (!statement_id) {
      return NextResponse.json({ error: "statement_id requerido" }, { status: 400 });
    }

    const [stmt] = await sql`SELECT * FROM bank_statements WHERE id = ${parseInt(statement_id)}`;
    if (!stmt) return NextResponse.json({ error: "Estado no encontrado" }, { status: 404 });

    // If raw_rows provided (CSV/Excel), insert them first
    let movements = [];
    if (Array.isArray(raw_rows) && raw_rows.length > 0) {
      await sql`DELETE FROM bank_movements WHERE statement_id = ${parseInt(statement_id)}`;
      for (const r of raw_rows) {
        const [m] = await sql`
          INSERT INTO bank_movements (statement_id, movement_date, description, reference, beneficiary, payer, charge, credit, amount, currency, account, clabe, bank_identifier, concept, status)
          VALUES (${parseInt(statement_id)}, ${r.movement_date || r.date || null}, ${r.description || r.concepto || null}, ${r.reference || r.referencia || null},
                  ${r.beneficiary || null}, ${r.payer || null}, ${parseFloat(r.charge)||0}, ${parseFloat(r.credit)||0},
                  ${parseFloat(r.amount) || (parseFloat(r.charge)||0) - (parseFloat(r.credit)||0) },
                  ${r.currency || 'MXN'}, ${r.account || null}, ${r.clabe || null}, ${r.bank_identifier || null}, ${r.concept || null}, 'sin_analizar')
          RETURNING *
        `;
        movements.push(m);
      }
    } else {
      movements = await sql`SELECT * FROM bank_movements WHERE statement_id = ${parseInt(statement_id)} ORDER BY movement_date ASC`;
    }

    if (movements.length === 0) {
      return NextResponse.json({ success: true, message: "Sin movimientos para analizar", movements: [] });
    }

    // Fetch context for classification (real entities, no invention)
    const [payments] = await sql`SELECT id, folio, producer_name, beneficiary_name, amount, saldo_pendiente, bank_name, account_number, clabe, scheduled_payment_date, concept FROM payment_schedule WHERE saldo_pendiente > 0 OR status != 'paid' ORDER BY scheduled_payment_date LIMIT 80`;
    const [suppliers] = await sql`SELECT id, supplier_name, rfc, banco, cuenta, clabe, categoria FROM purchase_order_suppliers WHERE is_active = true LIMIT 50`;
    const [customers] = await sql`SELECT id, customer_name, rfc, commercial_name FROM customers LIMIT 50`;
    const [abonos] = await sql`SELECT id, folio, customer_id, banco_receptor, cuenta_receptora, referencia_bancaria, importe_recibido, fecha FROM abonos ORDER BY fecha DESC LIMIT 30`;

    // Build rich prompt for classification
    const systemPrompt = `Eres el motor de conciliación bancaria inteligente de TECAVO SOFT (frutas frescas de exportación).
Extrae y clasifica movimientos bancarios reales contra registros del sistema.
NUNCA inventes datos. Usa solo la información proporcionada.

Para cada movimiento devuelve SOLO JSON array con:
{
  "movement_id": number,
  "suggested_entity_type": "producer" | "supplier" | "customer" | "payment_schedule" | "abono" | "expense" | "traspaso" | "comision" | "otro",
  "suggested_entity_id": number o null,
  "suggested_document_type": "payment_schedule" | "liquidacion" | "abono" | "compra" | "gasto" | null,
  "suggested_document_id": number o null,
  "category": "Transferencia a productor" | "Pago a proveedor" | "Depósito de cliente" | "Comisión bancaria" | "Traspaso entre cuentas" | "Flete" | "Nómina" | "Gasto operativo" | "Otro",
  "confidence": 0.0 a 1.0,
  "classification_reason": "breve explicación verificable (ej: coincide con folio PAG-2025-042 monto exacto y CLABE)",
  "status": "clasificacion_sugerida" | "pendiente_revision" | "sin_identificar"
}

Reglas obligatorias:
- Coincidencias exactas de importe + referencia o CLABE o nombre = alta confianza.
- Nunca marcar conciliado automáticamente.
- Si hay duda (importe parcial, nombre similar pero no exacto) -> pendiente_revision y confidence < 0.75.
- Transferencias entre cuentas propias -> traspaso (no gasto).
- Comisiones -> gasto bancario.
- Pagos a productores -> payment_schedule.
- Abonos de clientes -> abono o customer.
- No crear nuevas obligaciones si ya existe una.
- Usa los datos reales de context que te paso.`;

    const userContent = `ESTADO BANCARIO:
Banco: ${stmt.bank_name} | Cuenta: ${stmt.account_number} | Periodo: ${stmt.period_start} - ${stmt.period_end}
Saldo inicial reportado: ${stmt.saldo_inicial} | Saldo final reportado: ${stmt.saldo_final}

MOVIMIENTOS A CLASIFICAR:
${movements.slice(0, 60).map(m => `ID:${m.id} | ${m.movement_date} | ${m.description || ''} | Ref:${m.reference || ''} | Benef:${m.beneficiary || ''} | Cargo:${m.charge} | Abono:${m.credit} | Monto:${m.amount}`).join('\n')}

CONTEXTO DEL SISTEMA (solo estos registros existen):
PAGOS PROGRAMADOS (payment_schedule): ${payments.map(p => `id:${p.id} folio:${p.folio} productor:${p.producer_name} beneficiario:${p.beneficiary_name} monto:${p.amount} saldo:${p.saldo_pendiente} banco:${p.bank_name} clabe:${p.clabe}`).join(' | ')}
PROVEEDORES: ${suppliers.map(s => `id:${s.id} ${s.supplier_name} cat:${s.categoria} banco:${s.banco} clabe:${s.clabe}`).join(' | ')}
CLIENTES: ${customers.map(c => `id:${c.id} ${c.customer_name}`).join(' | ')}
ABONOS RECIBIDOS: ${abonos.map(a => `id:${a.id} folio:${a.folio} importe:${a.importe_recibido} ref:${a.referencia_bancaria}`).join(' | ')}

Devuelve SOLO el array JSON de clasificaciones. No agregues texto extra.`;

    const gemini = new OpenAI({
      apiKey: process.env.APPGEN_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.GEMINI_BASE_URL || "https://appgen.com/api/cloud/gemini/v1beta/openai",
      defaultHeaders: { "X-AppGen-App-Id": process.env.APP_ID || "" },
    });

    const completion = await gemini.chat.completions.create({
      model: "gemini-3.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      temperature: 0.05,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content || "[]";
    let classifications = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      classifications = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (_) {
      classifications = [];
    }

    // Apply suggestions to DB (never auto-conciliate)
    let updated = 0;
    for (const c of classifications) {
      if (!c.movement_id) continue;
      await sql`
        UPDATE bank_movements SET
          status = ${c.status || 'clasificacion_sugerida'},
          suggested_entity_type = ${c.suggested_entity_type || null},
          suggested_entity_id = ${c.suggested_entity_id || null},
          suggested_document_type = ${c.suggested_document_type || null},
          suggested_document_id = ${c.suggested_document_id || null},
          category = ${c.category || null},
          confidence = ${parseFloat(c.confidence) || 0.5},
          classification_reason = ${c.classification_reason || null},
          updated_at = NOW()
        WHERE id = ${parseInt(c.movement_id)} AND statement_id = ${parseInt(statement_id)}
      `;
      updated++;
    }

    // Update statement status
    await sql`UPDATE bank_statements SET status = 'clasificacion_sugerida', updated_at = NOW() WHERE id = ${parseInt(statement_id)}`;

    // Return fresh movements with suggestions
    const refreshed = await sql`SELECT * FROM bank_movements WHERE statement_id = ${parseInt(statement_id)} ORDER BY movement_date ASC`;

    return NextResponse.json({
      success: true,
      analyzed: updated,
      movements: refreshed,
      note: "Clasificaciones sugeridas por TECAVO IA. Ninguna se aplica automáticamente. Revise y concilie manualmente."
    });
  } catch (error) {
    console.error("Bank analyze error:", error);
    return NextResponse.json({
      success: false,
      message: "Análisis IA no disponible. Ingrese clasificaciones manualmente.",
      movements: []
    });
  }
}