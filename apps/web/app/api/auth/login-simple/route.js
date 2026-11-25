import { randomBytes, randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const body = await request.json().catch(()=>({}));
    const email = String(body.email||"").trim().toLowerCase();
    const pin = String(body.pin||"").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!/^(?:\d{4}|\d{6})$/.test(pin)) {
      return NextResponse.json({success:false,error:"Ingresa un correo válido y un PIN de 4 o 6 dígitos."},{status:400});
    }
    const [budget] = await sql`
      INSERT INTO erp_login_attempts(email,attempts,started_at) VALUES(${email},1,now())
      ON CONFLICT(email) DO UPDATE SET
        attempts=CASE WHEN erp_login_attempts.started_at < now()-interval '15 minutes' THEN 1 ELSE least(erp_login_attempts.attempts+1,6) END,
        started_at=CASE WHEN erp_login_attempts.started_at < now()-interval '15 minutes' THEN now() ELSE erp_login_attempts.started_at END
      RETURNING attempts`;
    if (budget.attempts>5) return NextResponse.json({success:false,error:"Intenta de nuevo en 15 minutos."},{status:429});
    const [user] = await sql`SELECT u.id,u.name,u.email,u.admin_role,u.is_super_admin,a.password
      FROM "user" u JOIN account a ON a."userId"=u.id AND a."providerId"='credential'
      WHERE lower(u.email)=${email}
      AND NOT EXISTS (SELECT 1 FROM user_pins p WHERE p.user_id=u.id AND p.activo=false
        AND NOT EXISTS (SELECT 1 FROM user_pins active WHERE active.user_id=u.id AND active.activo=true))
      LIMIT 1`;
    const valid = user?.password?.startsWith("$2") ? await compare(pin,user.password) : !!user?.password&&pin===user.password;
    if (!valid) return NextResponse.json({success:false,error:"Correo o PIN incorrecto."},{status:401});

    const token = randomBytes(32).toString("hex");
    const maxAge=60*60*24*7;
    const expires=new Date(Date.now()+maxAge*1000).toISOString();
    await sql.transaction([
      sql`INSERT INTO session(id,"userId",token,"expiresAt") VALUES(${randomUUID()},${user.id},${token},${expires})`,
      sql`DELETE FROM erp_login_attempts WHERE email=${email}`
    ]);
    const jar=await cookies();
    const opts={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge,path:"/"};
    jar.set("tecavo_session_token",token,opts);
    jar.set("better-auth.session_token",token,opts);
    const {password,...profile}=user;
    return NextResponse.json({success:true,user:profile});
  } catch (error) {
    console.error("Error de autenticación ERP",error.message);
    return NextResponse.json({success:false,error:"No se pudo iniciar sesión."},{status:500});
  }
}
