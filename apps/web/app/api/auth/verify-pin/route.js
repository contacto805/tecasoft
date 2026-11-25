import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";
import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const user=await getVerifiedErpUser();
    if (!user) return NextResponse.json({success:false,error:"Inicia sesión."},{status:401});
    const pin=String((await request.json()).pin||"").trim();
    if (!/^(?:\d{4}|\d{6})$/.test(pin)) return NextResponse.json({success:false,error:"PIN inválido."},{status:400});
    const [budget]=await sql`INSERT INTO erp_login_attempts(email,attempts,started_at) VALUES('verify:'||${user.id},1,now())
      ON CONFLICT(email) DO UPDATE SET
        attempts=CASE WHEN erp_login_attempts.started_at<now()-interval '15 minutes' THEN 1 ELSE least(erp_login_attempts.attempts+1,6) END,
        started_at=CASE WHEN erp_login_attempts.started_at<now()-interval '15 minutes' THEN now() ELSE erp_login_attempts.started_at END RETURNING attempts`;
    if (budget.attempts>5) return NextResponse.json({success:false,error:"Intenta de nuevo en 15 minutos."},{status:429});
    const [account]=await sql`SELECT password FROM account WHERE "userId"=${user.id} AND "providerId"='credential' LIMIT 1`;
    const secret=account?.password;
    const match=secret?.startsWith("$2")?await compare(pin,secret):!!secret&&secret===pin;
    return NextResponse.json({success:match,isSuperAdmin:!!(match&&user.is_super_admin)});
  } catch (error) {
    console.error("Verificación del PIN de ERP",error.message);
    return NextResponse.json({success:false,error:"No se pudo verificar el PIN."},{status:500});
  }
}
