import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import OpenAI from "openai";

// client created lazily inside handler to avoid build fail without keys

export async function POST(request) {
  try {
    const body = await request.json();
    const { document_url, document_type, raw_text } = body;

    let extractionPrompt = `Eres un experto contable de una empresa agrícola (frutas frescas de exportación).
Extrae la información EXACTA y devuelve SOLO un JSON válido con estas claves:
{
  "beneficiary_name": "nombre del beneficiario o productor o proveedor",
  "producer_name": "nombre del productor o proveedor si diferente",
  "bank_name": "nombre banco",
  "account_number": "número de cuenta",
  "clabe": "CLABE interbancaria",
  "amount": número monto total,
  "invoice_number": "número de factura o documento",
  "rfc": "RFC o identificación fiscal",
  "document_date": "fecha del documento en YYYY-MM-DD",
  "concept": "descripción breve del pago o concepto"
}
Si no estás seguro pon null en el campo. No inventes datos.`;

    let messages = [
      { role: "system", content: extractionPrompt },
      { role: "user", content: "" }
    ];

    if (raw_text) {
      messages[1].content = `Texto del documento:\n${raw_text}`;
    } else if (document_url) {
      messages[1].content = [
        { type: "text", text: "Analiza el siguiente documento de pago/factura y extrae los campos indicados. URL imagen o PDF (proporciona cualquier OCR si aplica):" },
        { type: "image_url", image_url: { url: document_url } }
      ];
    } else {
      return NextResponse.json({ error: "document_url o raw_text requerido" }, { status: 400 });
    }

    const gemini = new OpenAI({
      apiKey: process.env.APPGEN_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.GEMINI_BASE_URL || "https://appgen.com/api/cloud/gemini/v1beta/openai",
      defaultHeaders: { "X-AppGen-App-Id": process.env.APP_ID || "" },
    });
    const completion = await gemini.chat.completions.create({
      model: "gemini-3.5-flash",
      messages,
      temperature: 0.1,
      max_tokens: 800,
    });

    const content = completion.choices[0]?.message?.content || "";
    
    // Try to parse JSON from response robust
    let extracted = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (e) {
      extracted = {
        beneficiary_name: null,
        producer_name: null,
        bank_name: null,
        account_number: null,
        clabe: null,
        amount: null,
        invoice_number: null,
        rfc: null,
        document_date: null,
        concept: "Verificar manualmente"
      };
    }

    // Save extraction record for audit (linked to future payment id later or separate)
    const inserted = await sql`
      INSERT INTO payment_ai_extractions (
        document_url, 
        document_type, 
        extracted_data, 
        confidence_score, 
        verified
      ) VALUES (
        ${document_url || null},
        ${document_type || 'invoice'},
        ${JSON.stringify(extracted)},
        0.82,
        false
      ) RETURNING *
    `;

    return NextResponse.json({
      success: true,
      extracted,
      extraction_id: inserted[0].id,
      message: "Verifique la información detectada antes de programar el pago."
    });
  } catch (error) {
    console.error("AI extract error:", error);
    // Graceful fallback if AI fails
    return NextResponse.json({
      success: false,
      extracted: {
        beneficiary_name: "",
        producer_name: "",
        bank_name: "",
        account_number: "",
        clabe: "",
        amount: 0,
        invoice_number: "",
        rfc: "",
        document_date: new Date().toISOString().split("T")[0],
        concept: ""
      },
      message: "Extracción automática no disponible. Por favor ingresa manualmente los datos del documento."
    });
  }
}
