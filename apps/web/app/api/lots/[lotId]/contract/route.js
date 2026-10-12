import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import jsPDF from "jspdf";

export async function GET(request, { params }) {
  try {
    const { lotId } = await params;
    const { searchParams } = new URL(request.url);
    const inlineView = searchParams.get("inline") === "1" || searchParams.get("view") === "1";

    const [lot] = await sql`
      SELECT 
        id,
        lot_number,
        producer,
        broker_name,
        orchard_name,
        municipality,
        date
      FROM lots 
      WHERE id = ${parseInt(lotId)}
      LIMIT 1
    `;

    if (!lot) {
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }

    // Producer / firmante data for placeholders (support producer or broker)
    const producerName = lot.producer || lot.broker_name || "______________________________";
    const orchard = lot.orchard_name || "______________________________";
    const mun = lot.municipality || "______________________________";

    // Load custom contract template and fill placeholders
    let baseTemplate = null;
    try {
      const [tpl] = await sql`
        SELECT base_text 
        FROM contract_templates 
        WHERE template_key = 'default_contract' 
        LIMIT 1
      `;
      if (tpl?.base_text) baseTemplate = tpl.base_text;
    } catch (_) {}

    const defaultContractText = 
`CONTRATO DE COMPRAVENTA DE COSECHA FUTURA que celebran por una parte
{Nombre de productor}, actuando por su propio derecho, a quien en lo sucesivo se le denominará "EL VENDEDOR", y por la otra TECAVO FRUITS S de RL de CV, a quien se le denominará "EL COMPRADOR", formalizando el acuerdo al tenor de las siguientes declaraciones y cláusulas:

DECLARACIONES
I. Declara "EL VENDEDOR":
• Ser legítimo propietario/productor de la fruta de la variedad Aguacate Hass, misma que se encuentra cultivada en el predio o parcela denominada "{Nombre del huerto}", ubicada en el municipio de "{Nombre del municipio}", Michoacán.
• Tener plena capacidad jurídica para enajenar los frutos descritos libres de cualquier gravamen o afectación.
II. Declara "EL COMPRADOR":
• Tener interés en adquirir la cosecha referida para su comercialización/exportación.
• Conocer el estado actual de la fruta y estar conforme con la misma.
III. DECLARACIÓN DE DESVINCULACIÓN (Cláusula Especial):
• Ambas partes reconocen y aceptan de mutuo acuerdo que la presente operación comercial es de carácter estrictamente privado y mercantil. Queda expresamente excluida y desvinculada de la aplicación del artículo 64-b o de cualquier uso, costumbre, índice o regulación de precios mínimos de referencia asociados a contratos de integración o de comercialización tutelada. El precio y las condiciones se rigen exclusivamente por la libre voluntad de las partes aquí firmantes.`;

    let templateText = baseTemplate || defaultContractText;

    // Auto-fill placeholders using real lot data
    const filledText = templateText
      .replace(/\{Nombre de productor\}/g, producerName)
      .replace(/\{Nombre del huerto\}/g, orchard)
      .replace(/\{Nombre del municipio\}/g, mun);

    const contractBody = filledText;

    // Create PDF - US Letter (carta) 215.9 x 279.4 mm
    const doc = new jsPDF({ format: "letter", unit: "mm" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Corporate colors Tecavo Fruits
    const greenDark = [14, 74, 34];
    const greenLight = [34, 105, 62];

    // --- MEMBRETADA HEADER WITH USER PROVIDED LOGO IMAGE ---
    const headerLogoUrl = "https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1784239435811_e9a67.jpeg";

    let headerBottom = 18;
    try {
      const logoResp = await fetch(headerLogoUrl);
      if (logoResp.ok) {
        const logoBuf = await logoResp.arrayBuffer();
        const base64 = Buffer.from(logoBuf).toString("base64");
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        // Full width letterhead image on top ~40mm tall for imagen membretada
        doc.addImage(dataUrl, "JPEG", 0, 0, pageW, 28);
        headerBottom = 30;
      }
    } catch (e) {
      // Fallback solid header
      doc.setFillColor(...greenDark);
      doc.rect(0, 0, pageW, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("TECAVO FRUITS S. DE R.L. DE C.V.", pageW / 2, 12, { align: "center" });
      doc.setFontSize(8);
      doc.text("Exportación de Aguacate Hass • Michoacán, México", pageW / 2, 17.5, { align: "center" });
      headerBottom = 26;
    }

    // Title
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...greenDark);
    doc.text("CONTRATO DE COMPRAVENTA DE FRUTA", pageW / 2, headerBottom + 9, { align: "center" });

    // Sub info
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("Cosecha Futura • Lote " + (lot.lot_number || ""), pageW / 2, headerBottom + 14.5, { align: "center" });

    // Accent divider line
    doc.setDrawColor(...greenDark);
    doc.setLineWidth(0.6);
    doc.line(18, headerBottom + 17.5, pageW - 18, headerBottom + 17.5);

    // Body text
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    // Start text
    const bodyStartY = headerBottom + 24;

    // Use split into paragraphs, clean bullets
    const paragraphs = contractBody.split(/\n/);

    let y = bodyStartY;
    const leftMargin = 18;
    const maxWidth = pageW - 36;

    paragraphs.forEach((line) => {
      if (!line.trim()) {
        y += 3.5;
        return;
      }
      if (y > pageH - 52) {
        // new page if runs out (rare)
        doc.addPage();
        y = 20;
      }

      const wrapped = doc.splitTextToSize(line, maxWidth);
      doc.text(wrapped, leftMargin, y);
      y += (wrapped.length * 4.2) + 1.8;
    });

    // --- Signatures section (membretada style matching user spec)
    y = Math.max(y + 12, 215);

    // Left column: Buyer
    doc.setDrawColor(...greenDark);
    doc.setLineWidth(0.5);
    doc.line(18, y, 95, y);

    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "normal");
    doc.text("Jorge Alberto Pérez Vélez Barriga", 56.5, y + 5, { align: "center" });
    doc.setFontSize(7.5);
    doc.setTextColor(14, 74, 34);
    doc.setFont("helvetica", "bold");
    doc.text("Representante Legal de Tecavo Fruits S de RL de CV", 56.5, y + 9.5, { align: "center" });

    // Right column: Vendedor
    doc.setDrawColor(...greenDark);
    doc.line(108, y, 195, y);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(producerName, 151.5, y + 5, { align: "center" });
    doc.setFontSize(7.5);
    doc.text("Productor / Comercializador", 151.5, y + 9.5, { align: "center" });

    // Footer corporate
    doc.setFillColor(...greenDark);
    doc.rect(0, pageH - 16, pageW, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("TECAVO FRUITS S. DE R.L. DE C.V.", pageW / 2, pageH - 10, { align: "center" });
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("Calidad • Confianza • Exportación   |   Michoacán, México   •   Tamaño Carta", pageW / 2, pageH - 5.5, { align: "center" });

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": inlineView 
          ? `inline; filename="Contrato_Lote_${lot.lot_number || lotId}.pdf"` 
          : `attachment; filename="Contrato_Lote_${lot.lot_number || lotId}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generando contrato PDF:", error);
    return NextResponse.json({ error: "Error al generar el contrato" }, { status: 500 });
  }
}
