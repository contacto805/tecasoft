import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Generador de código corto 4 dígitos (00-99) para contadores/productores + código alfanumérico legacy 
async function generateFourDigitCode(sqlClient) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0'); // 1000-9999
    const existsInToken = await sqlClient`SELECT id FROM lot_accountant_tokens WHERE token = ${code}`;
    const existsInLot = await sqlClient`SELECT id FROM lots WHERE accountant_code = ${code}`;
    if (!existsInToken.length && !existsInLot.length) return code;
  }
  // fallback very unlikely
  return String(Date.now()).slice(-4);
}

async function generateShortUniquePin(sqlClient) {
  // fallback older
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 8; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const [exists] = await sqlClient`
      SELECT id FROM lot_accountant_tokens WHERE token = ${code}
    `;
    if (!exists) return code;
  }
  return 'P' + Date.now().toString(36).slice(-5).toUpperCase();
}

export async function POST(request, { params }) {
  try {
    const { lotId } = await params;
    const body = await request.json().catch(()=> ({}));
    const preferFourDigit = body.preferFourDigit === true || body.useCode4 === true;

    // Verificar si ya existe un código para este lote en tokens
    const [existingToken] = await sql`
      SELECT token FROM lot_accountant_tokens 
      WHERE lot_id = ${lotId}
    `;

    // also check accountant_code on lot
    const [lotWithCode] = await sql`SELECT accountant_code FROM lots WHERE id = ${parseInt(lotId)}`;

    if (existingToken || lotWithCode?.accountant_code) {
      const code = existingToken?.token || lotWithCode.accountant_code;
      return NextResponse.json({ 
        token: code,
        pin: code,
        code4: /[0-9]{4}/.test(code) ? code : (lotWithCode?.accountant_code || null),
        link: `/contador/${code}`
      });
    }

    // Nuevos: generar preferentemente 4 dígitos (spec)
    let finalCode;
    if (preferFourDigit) {
      finalCode = await generateFourDigitCode(sql);
    } else {
      finalCode = await generateShortUniquePin(sql);
    }

    // Guardar token (para compatibilidad)
    await sql`
      INSERT INTO lot_accountant_tokens (lot_id, token)
      VALUES (${parseInt(lotId)}, ${finalCode})
    `;

    // Guardar en lot accountant_code si es 4 digitos
    if (/^\d{4}$/.test(finalCode)) {
      await sql`
        UPDATE lots SET accountant_code = ${finalCode} WHERE id = ${parseInt(lotId)}
      `;
    }

    return NextResponse.json({ 
      token: finalCode, 
      pin: finalCode,
      code4: /^\d{4}$/.test(finalCode) ? finalCode : null,
      link: `/contador/${finalCode}`
    });
  } catch (error) {
    console.error('Error generating accountant link/pin:', error);
    return NextResponse.json(
      { error: 'Error al generar código PIN para contador' },
      { status: 500 }
    );
  }
}

export async function GET(request, { params }) {
  try {
    const { lotId } = await params;

    const [tokenData] = await sql`
      SELECT token FROM lot_accountant_tokens 
      WHERE lot_id = ${lotId}
    `;

    if (!tokenData) {
      return NextResponse.json({ link: null, pin: null });
    }

    const code = tokenData.token;
    return NextResponse.json({ 
      token: code,
      pin: code,
      link: `/contador/${code}`
    });
  } catch (error) {
    console.error('Error fetching accountant pin:', error);
    return NextResponse.json(
      { error: 'Error al obtener PIN para contador' },
      { status: 500 }
    );
  }
}
