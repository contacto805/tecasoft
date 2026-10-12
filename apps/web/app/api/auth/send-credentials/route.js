import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Email configuration
const getTransporter = () => {
  // Check if SMTP credentials are configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("⚠️ SMTP credentials not configured. Email functionality is disabled.");
    return null;
  }

  // Log configuration (without exposing password)
  console.log("📧 SMTP Configuration:");
  console.log("  Host:", process.env.SMTP_HOST);
  console.log("  Port:", process.env.SMTP_PORT);
  console.log("  User:", process.env.SMTP_USER);
  console.log("  Pass:", process.env.SMTP_PASS ? "***configured***" : "MISSING");
  console.log("  From:", process.env.SMTP_FROM);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    debug: true, // Enable debug output
    logger: true // Enable logging
  });
};

export async function POST(request) {
  try {
    const { email } = await request.json();

    console.log("🔍 STEP 1 - Email validation:");
    console.log("  Email received:", email);

    if (!email) {
      console.log("❌ STEP 1 FAILED - Email is missing");
      return NextResponse.json(
        { error: "El correo electrónico es requerido" },
        { status: 400 }
      );
    }

    console.log("✅ STEP 1 PASSED - Email provided:", email);

    // Check SMTP configuration early
    console.log("🔍 STEP 1.5 - Checking SMTP configuration:");
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("❌ STEP 1.5 FAILED - SMTP not configured");
      console.log("  Missing:", {
        host: !process.env.SMTP_HOST,
        user: !process.env.SMTP_USER,
        pass: !process.env.SMTP_PASS
      });
      return NextResponse.json(
        { 
          error: "El servicio de correo electrónico no está configurado. Por favor contacta al administrador del sistema para que configure las credenciales SMTP." 
        },
        { status: 503 }
      );
    }
    console.log("✅ STEP 1.5 PASSED - SMTP credentials are configured");

    // Find user by email
    console.log("🔍 STEP 2 - Database user lookup:");
    const users = await sql`
      SELECT u.id, u.email, u.name, a.password
      FROM "user" u
      LEFT JOIN account a ON u.id = a."userId"
      WHERE u.email = ${email.toLowerCase()}
    `;

    console.log("  Query result:", {
      found: users.length > 0,
      count: users.length,
      user: users.length > 0 ? { email: users[0].email, name: users[0].name, hasPassword: !!users[0].password } : null
    });

    if (users.length === 0) {
      console.log("⚠️ STEP 2 - User not found, returning success (security measure)");
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: "Si el correo existe en el sistema, recibirás las instrucciones de acceso"
      });
    }

    console.log("✅ STEP 2 PASSED - User found:", users[0].email);

    const user = users[0];

    // Get company info for email branding
    console.log("🔍 STEP 3 - Fetching company settings:");
    const companySettings = await sql`
      SELECT key, value FROM system_settings
      WHERE key IN ('company_name', 'company_email', 'company_phone', 'company_logo')
    `;

    const settings = {};
    companySettings.forEach(setting => {
      settings[setting.key] = setting.value;
    });

    const companyName = settings.company_name || "Tecavo Fruits";
    const companyRFC = "TFR230302EU5";
    const companyEmail = settings.company_email || "contacto@tecavofruits.com";
    const companyPhone = settings.company_phone || "+52 4591344576";

    console.log("✅ STEP 3 PASSED - Company settings loaded:", { companyName, companyEmail });

    // Prepare email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .logo { width: 80px; height: 80px; margin: 0 auto 15px; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .credentials { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; }
            .credential-item { margin: 10px 0; }
            .credential-label { color: #6b7280; font-size: 14px; }
            .credential-value { font-size: 16px; font-weight: bold; color: #1f2937; font-family: monospace; }
            .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .button:hover { background: #4f46e5; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">🔐 Credenciales de Acceso</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">${companyName}</p>
              <p style="margin: 5px 0 0 0; opacity: 0.8; font-size: 14px;">RFC: ${companyRFC}</p>
            </div>
            
            <div class="content">
              <p>Hola <strong>${user.name || "Usuario"}</strong>,</p>
              
              <p>Has solicitado las credenciales de acceso a <strong>${companyName}</strong>.</p>
              
              <div class="credentials">
                <div class="credential-item">
                  <div class="credential-label">Correo electrónico:</div>
                  <div class="credential-value">${user.email}</div>
                </div>
                <div class="credential-item">
                  <div class="credential-label">Usuario:</div>
                  <div class="credential-value">${user.email}</div>
                </div>
              </div>

              <div class="warning">
                <strong>⚠️ Importante:</strong> Por seguridad, no enviamos la contraseña por correo electrónico. Si no recuerdas tu contraseña, contacta al administrador del sistema.
              </div>

              <div style="text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com'}/login" class="button">
                  Iniciar Sesión
                </a>
              </div>

              <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                Si tienes problemas para acceder, contáctanos:
              </p>
              <ul style="color: #6b7280; font-size: 14px;">
                <li>📧 Email: <a href="mailto:${companyEmail}" style="color: #6366f1;">${companyEmail}</a></li>
                <li>📱 Teléfono: <a href="tel:${companyPhone}" style="color: #6366f1;">${companyPhone}</a></li>
              </ul>
            </div>

            <div class="footer">
              <p><strong>${companyName}</strong></p>
              <p>RFC: ${companyRFC}</p>
              <p>Todos los derechos reservados © ${new Date().getFullYear()}</p>
              <p>📞 ${companyPhone} | 📧 ${companyEmail}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    console.log("🔍 STEP 4 - Setting up email transporter:");
    const transporter = getTransporter();
    
    if (!transporter) {
      console.log("❌ STEP 4 FAILED - SMTP not configured");
      console.log("  Missing env vars: SMTP_HOST, SMTP_USER, or SMTP_PASS");
      return NextResponse.json(
        { error: "El servicio de correo electrónico no está disponible en este momento. Por favor contacta al administrador." },
        { status: 503 }
      );
    }

    console.log("✅ STEP 4 PASSED - Email transporter created");

    try {
      // Verify SMTP connection before sending
      console.log("🔍 STEP 5 - Verifying SMTP connection...");
      await transporter.verify();
      console.log("✅ STEP 5 PASSED - SMTP connection verified");
      
      console.log("🔍 STEP 6 - Sending email:");
      console.log("  To:", user.email);
      console.log("  From:", process.env.SMTP_FROM || `"${companyName}" <${process.env.SMTP_USER}>`);
      console.log("  Subject:", `🔐 Credenciales de acceso - ${companyName}`);
      
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"${companyName}" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: `🔐 Credenciales de acceso - ${companyName}`,
        html: htmlContent,
      });

      console.log("✅ STEP 6 PASSED - Email sent successfully!");
      console.log("  Message ID:", info.messageId);
      console.log("  Response:", info.response);
      console.log("  Accepted:", info.accepted);
      console.log("  Rejected:", info.rejected);
      
      return NextResponse.json({
        success: true,
        message: "Las credenciales han sido enviadas a tu correo electrónico"
      });
    } catch (emailError) {
      console.log("❌ STEP 6 FAILED - Email sending error:");
      console.error("❌ Error completo al enviar correo:");
      console.error("  Código:", emailError.code);
      console.error("  Respuesta:", emailError.responseCode);
      console.error("  Mensaje:", emailError.message);
      console.error("  Stack:", emailError.stack);
      
      // Provide more specific error messages
      let errorMessage = "No se pudo enviar el correo electrónico. ";
      if (emailError.responseCode === 535 || emailError.code === 'EAUTH') {
        errorMessage += "Las credenciales SMTP del servidor son incorrectas. El administrador debe verificar los datos de configuración del correo (SMTP_HOST, SMTP_USER, SMTP_PASS en las variables de entorno).";
      } else if (emailError.responseCode === 421 || emailError.code === 'ECONNREFUSED') {
        errorMessage += "No se pudo conectar al servidor de correo. Por favor intenta más tarde o contacta al administrador.";
      } else if (emailError.responseCode === 534 || emailError.code === 'EAUTH_METHOD') {
        errorMessage += "Error de autenticación con el servidor de correo. El administrador debe verificar la configuración SMTP.";
      } else {
        errorMessage += "Error inesperado al enviar el correo. Por favor contacta al administrador del sistema.";
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? emailError.message : undefined
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Send credentials error:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al procesar tu solicitud. Por favor intenta nuevamente." },
      { status: 500 }
    );
  }
}
