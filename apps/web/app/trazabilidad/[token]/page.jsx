'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PublicTraceabilityPage() {
  const params = useParams();
  const token = params.token;
  
  const [lot, setLot] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    
    fetchLotData();
    logAccess();
  }, [token]);

  const fetchLotData = async () => {
    try {
      const response = await fetch(`/api/trazabilidad/${token}`);
      if (!response.ok) {
        throw new Error('Lote no encontrado');
      }
      const data = await response.json();
      setLot(data.lot);
      setConfig(data.config);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logAccess = async () => {
    try {
      // Get device type
      const userAgent = navigator.userAgent;
      let deviceType = 'desktop';
      if (/mobile/i.test(userAgent)) deviceType = 'mobile';
      if (/tablet/i.test(userAgent)) deviceType = 'tablet';
      
      await fetch(`/api/trazabilidad/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_type: deviceType,
          referer: document.referrer
        })
      });
    } catch (err) {
      console.error('Error logging access:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <i className="ph ph-warning text-3xl text-red-600"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Lote no encontrado</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  const {
    primary_color = '#10b981',
    secondary_color = '#3b82f6',
    accent_color = '#f59e0b',
    text_color = '#1f2937',
    background_color = '#ffffff',
    card_background_color = '#f9fafb',
    header_background_color = '#ffffff',
    footer_background_color = '#f3f4f6',
    border_color = '#e5e7eb',
    button_color = '#10b981',
    font_family = 'Inter, sans-serif',
    font_size_title = 24,
    font_size_body = 14,
    font_size_small = 12,
    logo_url,
    company_name = 'Tecavo Fruits',
    header_text = 'Trazabilidad Certificada',
    footer_text = 'Calidad garantizada desde el origen',
    commercial_message = 'Fruta fresca de la más alta calidad',
    show_origin_data = true,
    show_production_data = true,
    show_commercial_data = true,
    show_producer = true,
    show_orchard = true,
    show_location = true,
    show_harvest_date = true,
    show_variety = true,
    show_weight = true,
    header_image_url,
    product_image_url,
    certification_images = [],
    gallery_images = []
  } = config || {};

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: background_color,
        fontFamily: font_family,
        color: text_color
      }}
    >
      {/* Header */}
      <header 
        className="shadow-sm"
        style={{ backgroundColor: header_background_color }}
      >
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          {logo_url && (
            <img 
              src={logo_url} 
              alt={company_name} 
              className="h-12 object-contain"
            />
          )}
          <div className="text-right">
            <h1 
              className="font-bold"
              style={{ fontSize: `${font_size_title}px`, color: primary_color }}
            >
              {header_text}
            </h1>
            <p 
              className="mt-1"
              style={{ fontSize: `${font_size_small}px`, opacity: 0.7 }}
            >
              {company_name}
            </p>
          </div>
        </div>
      </header>

      {/* Header Image */}
      {header_image_url && (
        <div className="w-full h-48 overflow-hidden">
          <img 
            src={header_image_url} 
            alt="Header" 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Lot Number Badge */}
        <div className="text-center mb-8">
          <div 
            className="inline-block px-6 py-3 rounded-2xl shadow-lg"
            style={{ backgroundColor: primary_color }}
          >
            <p className="text-sm font-medium text-white opacity-90">Lote</p>
            <p className="text-2xl font-bold text-white">{lot.lot_number}</p>
          </div>
        </div>

        {/* Origin Data */}
        {show_origin_data && (
          <section 
            className="mb-6 p-6 rounded-2xl shadow-sm border"
            style={{ 
              backgroundColor: card_background_color,
              borderColor: border_color
            }}
          >
            <h2 
              className="text-xl font-bold mb-4 flex items-center gap-2"
              style={{ color: primary_color }}
            >
              <i className="ph ph-map-pin"></i>
              Datos de Origen
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {show_producer && lot.producer && (
                <div>
                  <p 
                    className="text-sm font-medium mb-1"
                    style={{ fontSize: `${font_size_small}px`, opacity: 0.6 }}
                  >
                    Productor
                  </p>
                  <p 
                    className="font-semibold"
                    style={{ fontSize: `${font_size_body}px` }}
                  >
                    {lot.producer}
                  </p>
                </div>
              )}
              
              {show_orchard && lot.orchard_name && (
                <div>
                  <p 
                    className="text-sm font-medium mb-1"
                    style={{ fontSize: `${font_size_small}px`, opacity: 0.6 }}
                  >
                    Huerta
                  </p>
                  <p 
                    className="font-semibold"
                    style={{ fontSize: `${font_size_body}px` }}
                  >
                    {lot.orchard_name}
                  </p>
                </div>
              )}
              
              {show_location && (lot.origin || lot.municipality) && (
                <div>
                  <p 
                    className="text-sm font-medium mb-1"
                    style={{ fontSize: `${font_size_small}px`, opacity: 0.6 }}
                  >
                    Ubicación
                  </p>
                  <p 
                    className="font-semibold"
                    style={{ fontSize: `${font_size_body}px` }}
                  >
                    {lot.municipality ? `${lot.municipality}, ${lot.origin}` : lot.origin}
                  </p>
                </div>
              )}
              
              {show_harvest_date && lot.date && (
                <div>
                  <p 
                    className="text-sm font-medium mb-1"
                    style={{ fontSize: `${font_size_small}px`, opacity: 0.6 }}
                  >
                    Fecha de Corte
                  </p>
                  <p 
                    className="font-semibold"
                    style={{ fontSize: `${font_size_body}px` }}
                  >
                    {new Date(lot.date).toLocaleDateString('es-MX', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Production Data */}
        {show_production_data && (
          <section 
            className="mb-6 p-6 rounded-2xl shadow-sm border"
            style={{ 
              backgroundColor: card_background_color,
              borderColor: border_color
            }}
          >
            <h2 
              className="text-xl font-bold mb-4 flex items-center gap-2"
              style={{ color: secondary_color }}
            >
              <i className="ph ph-package"></i>
              Datos de Producción
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {show_variety && lot.fruit_type && (
                <div>
                  <p 
                    className="text-sm font-medium mb-1"
                    style={{ fontSize: `${font_size_small}px`, opacity: 0.6 }}
                  >
                    Variedad
                  </p>
                  <p 
                    className="font-semibold"
                    style={{ fontSize: `${font_size_body}px` }}
                  >
                    {lot.fruit_type}
                  </p>
                </div>
              )}
              
              {show_weight && lot.total_kg_received && (
                <div>
                  <p 
                    className="text-sm font-medium mb-1"
                    style={{ fontSize: `${font_size_small}px`, opacity: 0.6 }}
                  >
                    Kilogramos Recibidos
                  </p>
                  <p 
                    className="font-semibold"
                    style={{ fontSize: `${font_size_body}px` }}
                  >
                    {parseFloat(lot.total_kg_received).toLocaleString('es-MX')} kg
                  </p>
                </div>
              )}
              
              {show_weight && lot.total_kg_packed && (
                <div>
                  <p 
                    className="text-sm font-medium mb-1"
                    style={{ fontSize: `${font_size_small}px`, opacity: 0.6 }}
                  >
                    Kilogramos Empacados
                  </p>
                  <p 
                    className="font-semibold"
                    style={{ fontSize: `${font_size_body}px` }}
                  >
                    {parseFloat(lot.total_kg_packed).toLocaleString('es-MX')} kg
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Commercial Message */}
        {show_commercial_data && commercial_message && (
          <section 
            className="mb-6 p-6 rounded-2xl shadow-sm border text-center"
            style={{ 
              backgroundColor: card_background_color,
              borderColor: border_color
            }}
          >
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: `${accent_color}20` }}
            >
              <i 
                className="ph ph-seal-check text-2xl"
                style={{ color: accent_color }}
              ></i>
            </div>
            <p 
              className="font-medium"
              style={{ fontSize: `${font_size_body}px` }}
            >
              {commercial_message}
            </p>
          </section>
        )}

        {/* Product Image */}
        {product_image_url && (
          <div className="mb-6 rounded-2xl overflow-hidden shadow-sm">
            <img 
              src={product_image_url} 
              alt="Producto" 
              className="w-full h-64 object-cover"
            />
          </div>
        )}

        {/* Certification Images */}
        {certification_images && certification_images.length > 0 && (
          <section className="mb-6">
            <h3 
              className="text-lg font-bold mb-3 text-center"
              style={{ color: primary_color }}
            >
              Certificaciones
            </h3>
            <div className="flex flex-wrap justify-center gap-4">
              {certification_images.map((img, idx) => (
                <img 
                  key={idx}
                  src={img} 
                  alt={`Certificación ${idx + 1}`}
                  className="h-16 object-contain"
                />
              ))}
            </div>
          </section>
        )}

        {/* Gallery */}
        {gallery_images && gallery_images.length > 0 && (
          <section className="mb-6">
            <h3 
              className="text-lg font-bold mb-3 text-center"
              style={{ color: primary_color }}
            >
              Galería
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {gallery_images.map((img, idx) => (
                <div 
                  key={idx}
                  className="rounded-xl overflow-hidden shadow-sm"
                >
                  <img 
                    src={img} 
                    alt={`Galería ${idx + 1}`}
                    className="w-full h-40 object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Status Badge */}
        <div className="text-center mb-8">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={{ 
              backgroundColor: lot.status === 'Activo' ? `${primary_color}15` : '#e5e7eb',
              color: lot.status === 'Activo' ? primary_color : text_color
            }}
          >
            <div 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: lot.status === 'Activo' ? primary_color : '#9ca3af' }}
            ></div>
            Estado: {lot.status || 'Activo'}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer 
        className="mt-12 py-8 text-center"
        style={{ backgroundColor: footer_background_color }}
      >
        <p 
          className="font-medium mb-2"
          style={{ fontSize: `${font_size_body}px` }}
        >
          {footer_text}
        </p>
        <p 
          className="opacity-60"
          style={{ fontSize: `${font_size_small}px` }}
        >
          © {new Date().getFullYear()} {company_name}. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
