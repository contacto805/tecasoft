'use client';

import { useState } from 'react';
import { generateAndDownloadReport } from '@/lib/report-generator';

export default function DownloadReportButton({ 
  moduleName,
  title,
  data,
  columns,
  format = 'pdf',
  orientation = 'portrait',
  includeStats = false,
  stats = {},
  elementId = null,
  className = ''
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await generateAndDownloadReport({
        moduleName,
        title,
        data,
        columns,
        format,
        orientation,
        includeStats,
        stats,
        elementId
      });
      
      // Log to database
      await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_name: moduleName,
          report_type: title,
          file_format: format,
          records_count: data?.length || 0
        })
      });
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte. Intente nuevamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isGenerating}
      className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-all inline-flex items-center gap-2 ${
        isGenerating
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-[#E8D547] text-slate-900 hover:bg-[#ddc635] shadow-sm hover:shadow-md'
      } ${className}`}
    >
      <i className={`ph ${isGenerating ? 'ph-spinner ph-spin' : format === 'jpg' ? 'ph-image' : 'ph-file-pdf'}`}></i>
      {isGenerating ? 'Generando...' : `Descargar ${format.toUpperCase()}`}
    </button>
  );
}
