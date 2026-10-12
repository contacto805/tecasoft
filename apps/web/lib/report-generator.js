// Unified report generation utility for PDF and JPG. Adds logo + datos generales de la empacadora on all.
import html2canvas from 'html2canvas';
import { drawCompanyHeader } from './company-header';

export async function generatePDFReport({ 
  moduleName, 
  title, 
  data, 
  columns,
  orientation = 'portrait',
  includeStats = false,
  stats = {},
  brandingOverride = null
}) {
  // Use dynamic import to ensure client-only execution and plugin loads correctly
  const jsPDFModule = await import('jspdf');
  const jsPDFCtor = jsPDFModule.default || jsPDFModule.jsPDF || jsPDFModule;
  await import('jspdf-autotable');
  
  const pdf = new jsPDFCtor(orientation, 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  // Use branding for company header/logo
  let brand = brandingOverride;
  if (!brand) {
    try {
      const r = await fetch('/api/branding');
      brand = await r.json();
    } catch { brand = null; }
  }
  let yPosition = drawCompanyHeader(pdf, brand || { companyName: 'TECAVO FRUITS' });

  // Title - right after header
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title || 'Reporte', 14, yPosition + 6);
  
  // Date and module
  pdf.setFontSize(9);
  const now = new Date().toLocaleString('es-MX', { 
    timeZone: 'America/Mexico_City', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'
  });
  pdf.text(`Generado: ${now}  |  Módulo: ${moduleName || ''}`, 14, yPosition + 14);
  
  yPosition += 22;
  
  // Stats summary if included
  if (includeStats && Object.keys(stats).length > 0) {
    pdf.setTextColor(2, 77, 50);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Resumen de Métricas', 14, yPosition);
    yPosition += 7;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(50, 50, 50);
    
    Object.entries(stats).forEach(([key, value]) => {
      const valStr = (value === null || value === undefined) ? '-' : String(value);
      pdf.text(`${key}: ${valStr}`, 14, yPosition);
      yPosition += 5;
    });
    
    yPosition += 5;
  }
  
  // Table data
  if (data && data.length > 0 && columns) {
    pdf.autoTable({
      startY: yPosition,
      head: [columns.map(col => col.header)],
      body: data.map(row => columns.map(col => {
        const value = row[col.key];
        if (value === null || value === undefined) return '-';
        if (col.format) return col.format(value);
        return String(value);
      })),
      theme: 'striped',
      headStyles: {
        fillColor: [2, 77, 50], // #024D32
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [50, 50, 50]
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { top: 10, left: 14, right: 14 },
      styles: {
        overflow: 'linebreak',
        cellPadding: 3
      }
    });
  }
  
  // Footer with page numbers
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pdf.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  return pdf;
}

export async function generateJPGFromElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }
  
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    logging: false,
    useCORS: true
  });
  
  return canvas.toDataURL('image/jpeg', 0.95);
}

export function downloadPDF(pdf, fileName) {
  try {
    pdf.save(fileName);
  } catch (e) {
    console.error('PDF save failed', e);
    // fallback text download
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export function downloadJPG(dataUrl, fileName) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}

export async function generateAndDownloadReport({
  moduleName,
  title,
  data,
  columns,
  format = 'pdf',
  orientation = 'portrait',
  includeStats = false,
  stats = {},
  elementId = null
}) {
  const timestamp = new Date().toISOString().split('T')[0];
  const fileName = `${moduleName}_${timestamp}`;
  
  if (format === 'jpg' && elementId) {
    const dataUrl = await generateJPGFromElement(elementId);
    downloadJPG(dataUrl, `${fileName}.jpg`);
    return { format: 'jpg', fileName: `${fileName}.jpg` };
  } else {
    const pdf = await generatePDFReport({
      moduleName,
      title,
      data,
      columns,
      orientation,
      includeStats,
      stats
    });
    downloadPDF(pdf, `${fileName}.pdf`);
    return { format: 'pdf', fileName: `${fileName}.pdf` };
  }
}
