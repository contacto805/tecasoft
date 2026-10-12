import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/app/api/utils/customer-portal-auth";
import { getCustomerLedger } from "@/app/api/utils/customer-account-ledger";
import jsPDF from "jspdf";
import "jspdf-autotable";

export async function GET(request) {
  const auth = await requireCustomerSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const ledger = await getCustomerLedger(auth.session.customerId, from, to);

    // Try to get branding
    let branding = { primary_color: "#0E4A22", companyName: "TECAVO FRUITS", slogan: "Del campo con amor" };
    try {
      const cfg = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/app-config`).then(r => r.json());
      if (cfg?.branding) branding = { ...branding, ...cfg.branding };
      if (cfg?.company) branding = { ...branding, ...cfg.company };
    } catch (_) {}

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Header
    doc.setFillColor(14, 74, 34); // primary
    doc.rect(0, 0, pageWidth, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("TECAVO FRUITS", margin, 12);
    doc.setFontSize(10);
    doc.text("Portal de Clientes • Estado de Cuenta", margin, 19);

    doc.setFontSize(9);
    doc.text(new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }), pageWidth - margin - 50, 12, { align: "right" });

    // Client info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Cliente: ${auth.session.customerName || ""}`, margin, 38);
    doc.text(`Número de Cliente: ${auth.session.clientNumber || ""}`, margin, 45);

    const periodo = `Periodo: ${from || "Inicio"} — ${to || "Hoy"}`;
    doc.text(periodo, pageWidth - margin, 45, { align: "right" });

    // Table
    const tableData = (ledger.movimientos || []).map(m => [
      m.fecha ? new Date(m.fecha).toLocaleDateString("es-MX") : "",
      m.tipo,
      m.folio || "",
      m.concepto || "",
      m.cargo ? `$${Number(m.cargo).toFixed(2)}` : "",
      m.abono ? `$${Number(m.abono).toFixed(2)}` : "",
      `$${Number(m.saldo_acumulado || 0).toFixed(2)}`,
    ]);

    doc.autoTable({
      startY: 55,
      head: [["Fecha", "Tipo", "Folio", "Concepto", "Cargo USD", "Abono USD", "Saldo"]],
      body: tableData.length ? tableData : [["—", "Sin movimientos", "", "", "", "", ""]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [14, 74, 34], textColor: 255 },
      margin: { left: margin, right: margin },
    });

    const finalY = doc.lastAutoTable?.finalY || 70;

    // Summary
    const r = ledger.resumen || {};
    doc.setFontSize(11);
    doc.text("RESUMEN", margin, finalY + 12);
    doc.setFontSize(10);
    doc.text(`Saldo por pagar: $${Number(r.saldo_por_pagar_usd || 0).toFixed(2)} USD`, margin, finalY + 20);
    doc.text(`Anticipos disponibles: $${Number(r.anticipos_disponibles_usd || 0).toFixed(2)} USD`, margin, finalY + 27);
    doc.text(`Saldo neto: $${Number(r.saldo_neto_usd || 0).toFixed(2)} USD ${r.es_saldo_a_favor ? "(a favor)" : ""}`, margin, finalY + 34);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Documento informativo generado por Soft Tecavo • Del campo con amor", pageWidth / 2, 285, { align: "center" });
    doc.text(`Generado: ${new Date().toLocaleString("es-MX")}`, pageWidth / 2, 290, { align: "center" });

    const pdfBuffer = doc.output("arraybuffer");

    // Audit download
    await import("@/app/api/utils/sql").then(m => m.default`
      INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
      VALUES (${auth.session.customerId}, 'STATEMENT_DOWNLOAD', ${JSON.stringify({ from, to })})
    `);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Estado_Cuenta_Tecavo_${auth.session.clientNumber || "CLI"}_${new Date().toISOString().slice(0,10)}.pdf"`,
      },
    });
  } catch (e) {
    console.error("client-portal pdf", e);
    return NextResponse.json({ error: "Error generando PDF" }, { status: 500 });
  }
}
