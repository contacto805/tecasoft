'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

export default function ReportesPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length > 0) {
          setHeaders(Object.keys(jsonData[0]));
          setData(jsonData);
        }
      } catch (error) {
        console.error('Error al leer el archivo:', error);
        alert('Error al procesar el archivo. Asegúrate de que sea un archivo Excel válido.');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleExport = () => {
    if (filteredData.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
    
    const fileName = `reporte_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter data based on search text
  const filteredData = data.filter(row => {
    if (!filterText) return true;
    return headers.some(header => {
      const value = row[header];
      return value && value.toString().toLowerCase().includes(filterText.toLowerCase());
    });
  });

  // Sort filtered data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === bValue) return 0;

    const comparison = aValue > bValue ? 1 : -1;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <i className="ph ph-arrow-left text-xl text-slate-600"></i>
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Reportes - Tecavo Soft</h1>
              <p className="text-xs text-slate-500">Importar, visualizar y exportar datos</p>
            </div>
          </div>
          <img src="https://app-cdn.appgen.com/c47548b2-8776-415f-8483-cdae09035713/assets/uploaded_1777789190200_y6fq5.png" alt="Tecavo Fruits" className="h-10 object-contain" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Action Bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full md:w-auto">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full md:w-auto px-6 py-3 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="ph ph-file-arrow-up text-xl"></i>
                Importar Excel
              </button>
            </div>

            {data.length > 0 && (
              <>
                <div className="flex-1 w-full md:w-auto">
                  <div className="relative">
                    <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Buscar en la tabla..."
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  onClick={handleExport}
                  className="w-full md:w-auto px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <i className="ph ph-file-arrow-down text-xl"></i>
                  Exportar Excel
                </button>
              </>
            )}
          </div>

          {data.length > 0 && (
            <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <i className="ph ph-database text-brand-600"></i>
                <span className="font-semibold">{data.length}</span> registro(s) totales
              </div>
              <div className="flex items-center gap-2">
                <i className="ph ph-funnel text-brand-600"></i>
                <span className="font-semibold">{filteredData.length}</span> mostrando
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Procesando archivo...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && data.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ph ph-file-excel text-4xl text-slate-400"></i>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No hay datos cargados</h3>
            <p className="text-slate-500 mb-6">Importa un archivo Excel para comenzar a visualizar y filtrar los datos</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/25 active:scale-95 transition-all inline-flex items-center gap-2"
            >
              <i className="ph ph-file-arrow-up text-xl"></i>
              Importar Archivo
            </button>
          </div>
        )}

        {/* Data Table */}
        {!loading && data.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {headers.map((header) => (
                      <th
                        key={header}
                        onClick={() => handleSort(header)}
                        className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          {header}
                          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className={`ph ph-caret-up text-xs ${sortConfig.key === header && sortConfig.direction === 'asc' ? 'text-brand-600' : 'text-slate-400'}`}></i>
                            <i className={`ph ph-caret-down text-xs -mt-1 ${sortConfig.key === header && sortConfig.direction === 'desc' ? 'text-brand-600' : 'text-slate-400'}`}></i>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                      {headers.map((header) => (
                        <td key={header} className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {row[header] !== null && row[header] !== undefined ? row[header].toString() : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredData.length === 0 && data.length > 0 && (
              <div className="p-12 text-center">
                <i className="ph ph-magnifying-glass text-4xl text-slate-300 mb-3"></i>
                <p className="text-slate-500">No se encontraron resultados para "{filterText}"</p>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {data.length === 0 && !loading && (
          <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <i className="ph ph-info text-blue-600"></i>
              Instrucciones de uso
            </h3>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span>Haz clic en "Importar Excel" y selecciona un archivo .xlsx o .xls de tu computadora</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>Los datos se cargarán automáticamente en una tabla interactiva</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>Usa la barra de búsqueda para filtrar los datos por cualquier campo</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span>Haz clic en los encabezados de columna para ordenar ascendente o descendentemente</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
                <span>Exporta los datos filtrados/ordenados a un nuevo archivo Excel con "Exportar Excel"</span>
              </li>
            </ul>
          </div>
        )}

      </main>
    </div>
  );
}
