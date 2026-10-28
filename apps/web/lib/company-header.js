// Shared helper: add logo + company (empacadora) header to printed / downloaded documents
// Use in any jsPDF generator. For frontend: use Branding data from useBranding()
// IMPORTANT: All documents now prefer assigned template config if provided via useDocumentTemplate or passed.
// Styles (colors, fonts) from document_templates table take priority when assignment exists in module_document_assignments

export async function getTemplateStyleForModule(moduleCode, outputType = 'pdf') {
  try {
    const res = await fetch(`/api/document-templates/resolve?module=${moduleCode}&output_type=${outputType}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && (data.primary_color || data.logo_url || data.id)) return data;
    return null;
  } catch (e) { return null; }
}

export function drawCompanyHeader(doc, brandingData, startY = 8, templateStyle = null) {
  // Priority: template from Tickets y Documentos > Branding
  const primary = templateStyle?.primary_color || brandingData?.primary_color || '#0E4A22';
  const companyName = templateStyle?.company_name || brandingData?.companyName || brandingData?.company_name || 'TECAVO FRUITS S. DE R.L. DE C.V.';
  const address = brandingData?.address || 'Carretera a Huerta s/n, Michoacán';
  const phone = brandingData?.phone || '';
  const rfc = brandingData?.rfc || '';
  const logo = templateStyle?.logo_url || brandingData?.logo_url || brandingData?.logoUrl || null;

  // Apply template typography when provided
  const titleFontSize = templateStyle?.font_size_title || 13;
  const smallFontSize = templateStyle?.font_size_small || 8;
  const fontFamily = (templateStyle?.font_family || 'helvetica').toLowerCase();

  const pageW = doc.internal.pageSize.getWidth();
  
  // Draw company header block with theme color
  const rgb = hexToRgb(primary);
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(0, 0, pageW, 26, 'F');

  // Logo
  let xText = 14;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 12, 4, 28, 18);
      xText = 48;
    } catch (e) {}
  }

  // Name + Datos generales Empacadora
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(titleFontSize);
  doc.text(companyName, xText, 14);

  doc.setFontSize(smallFontSize);
  doc.setFont(fontFamily, 'normal');
  let line2 = address;
  if (phone || rfc) line2 += `  |  ${phone || ''} ${rfc ? ' RFC: ' + rfc : ''}`;
  doc.text(line2.substring(0, 84), xText, 20);

  // Module title line / separator on return y
  return Math.max(30, startY);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return { r, g, b };
}

// For Excel (XLSX add header rows with branding)
export function prependCompanyHeaderToExcelRows(brandingData, title = 'Documento') {
  const companyName = brandingData?.companyName || 'TECAVO FRUITS S. DE R.L. DE C.V.';
  const address = brandingData?.address || '';
  const now = new Date().toLocaleDateString('es-MX');
  return [
    [companyName, ''],
    [address, ''],
    [`${title} — Generado: ${now}`, ''],
    [], // empty row
  ];
}

// Server-side helper (for API routes such as contract) - async fetch branding 
export async function getBrandingDataForServer(request) {
  try {
    // Prefer internal API call during build/runtime
    const base = request ? new URL(request.url).origin : '';
    const res = await fetch(`${base}/api/branding`, { cache: 'no-store' });
    if (!res.ok) throw new Error('no brand');
    const b = await res.json();
    return { 
      companyName: b.company_name || b.companyName || 'TECAVO FRUITS', 
      address: b.address || 'Dirección Empacadora',
      phone: b.phone || '', rfc: b.rfc || '', 
      logo_url: b.logo_url || b.logoUrl || null 
    };
  } catch (e) {
    return { companyName: 'TECAVO FRUITS S DE RL DE CV', address: 'Carretera a Huerta s/n, Michoacán', logo_url: null };
  }
}
