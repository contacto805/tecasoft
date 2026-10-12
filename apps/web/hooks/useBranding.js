import { useState, useEffect } from 'react';

export function useBranding() {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBranding = async (controller) => {
    try {
      const res = await fetch('/api/branding', { signal: controller?.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const txt = await res.text();
      const data = txt ? JSON.parse(txt) : {};
      
      // Fetch company info from system settings
      let companyName = 'TECAVO SOFT';
      let address = 'Dirección de empresa';
      let saderRegistry = 'Registro SADER';
      
      try {
        const settingsRes = await fetch('/api/settings', { signal: controller?.signal });
        if (settingsRes.ok) {
          const stxt = await settingsRes.text();
          const settings = stxt ? JSON.parse(stxt) : {};
          companyName = settings.company_name || 'TECAVO SOFT';
          address = settings.company_address || 'Dirección de empresa';
          saderRegistry = settings.sader_registry || 'Registro SADER';
        }
      } catch (settingsError) {
        if (settingsError?.name !== 'AbortError') console.warn('Could not fetch settings:', settingsError?.message);
      }
      
      const mainFont = data.font_family || 'sans-serif';
      const brData = {
        background_color: data.background_color || '#ffffff',
        primary_color: data.primary_color || '#0E4A22',
        secondary_color: data.secondary_color || '#963821',
        accent_color: data.accent_color || '#E0DA62',
        text_color: data.text_color || '#111827',
        watermark_enabled: data.watermark_enabled || false,
        watermark_opacity: data.watermark_opacity || 15,
        watermark_position: data.watermark_position || 'center',
        logo_url: data.logo_url || null,
        logo: data.logo_url || '/logo.svg',
        excel_plantilla_url: data.excel_plantilla_url || null,
        companyName: companyName,
        address: address,
        saderRegistry: saderRegistry,
        font_family: mainFont,
        heading_font_family: data.heading_font_family || mainFont,
        body_font_family: data.body_font_family || mainFont,
        custom_fonts: Array.isArray(data.custom_fonts) ? data.custom_fonts : []
      };
      setBranding(brData);

      try {
        if (typeof document !== 'undefined') {
          let styleEl = document.getElementById('appgen-custom-fonts');
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'appgen-custom-fonts';
            document.head.appendChild(styleEl);
          }
          let rules = '';
          (brData.custom_fonts || []).forEach((f) => {
            if (f && f.url && f.name) {
              const safe = String(f.name).replace(/['"\\]/g, '');
              rules += `@font-face { font-family: '${safe}'; src: url('${f.url}'); font-display: swap; }`;
            }
          });
          const hFont = brData.heading_font_family || brData.font_family;
          const bFont = brData.body_font_family || brData.font_family;
          const hCustom = (brData.custom_fonts || []).some(f => f.name === hFont);
          const bCustom = (brData.custom_fonts || []).some(f => f.name === bFont);
          if (hFont) {
            const fam = hCustom ? `'${hFont}'` : hFont;
            rules += `h1, h2, h3, h4, h5, h6, .heading, .title, .section-title, [class*="title"], [class*="heading"], .font-heading { font-family: ${fam}, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }`;
          }
          if (bFont) {
            const fam = bCustom ? `'${bFont}'` : bFont;
            rules += `body, p, span, div, li, label, input, textarea, button, select, .app-font, .font-body, main, .text, table, td, th { font-family: ${fam}, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }`;
          }
          styleEl.textContent = rules;
        }
      } catch (_) {}
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (error?.message !== 'Failed to fetch') {
        console.error('Error fetching branding:', error?.message || (error && error.toString ? error.toString() : 'fetch issue'));
      }
      setBranding({
        background_color: '#ffffff',
        primary_color: '#0E4A22',
        secondary_color: '#963821',
        accent_color: '#E0DA62',
        text_color: '#111827',
        watermark_enabled: false,
        watermark_opacity: 15,
        watermark_position: 'center',
        logo_url: null,
        logo: '/logo.svg',
        excel_plantilla_url: null,
        companyName: 'TECAVO SOFT',
        address: 'Dirección de empresa',
        saderRegistry: 'Registro SADER',
        font_family: 'sans-serif',
        heading_font_family: 'sans-serif',
        body_font_family: 'sans-serif',
        custom_fonts: []
      });

      try {
        if (typeof document !== 'undefined') {
          const styleEl = document.getElementById('appgen-custom-fonts');
          if (styleEl) styleEl.textContent = '';
        }
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchBranding(controller);

    // Real-time listeners: refetch branding when window regains focus or becomes visible
    // so superadmin config changes (colors, logo, fonts) propagate immediately to all modules
    const onFocus = () => fetchBranding();
    const onVisibility = () => { if (!document.hidden) fetchBranding(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { branding, loading };
}
