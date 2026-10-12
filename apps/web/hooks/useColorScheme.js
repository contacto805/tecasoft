'use client';

import { useEffect, useState } from 'react';

export function useColorScheme(moduleName) {
  const [colors, setColors] = useState({
    primary_color: '#0E4A22',
    secondary_color: '#963821',
    accent_color: '#E0DA62',
    text_color: '#0A3020',
    bg_color: '#ffffff',
    border_color: '#E0DA62'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!moduleName) {
      setLoading(false);
      return;
    }

    const fetchColors = async () => {
      try {
        const response = await fetch('/api/color-schemes');
        if (response.ok) {
          const schemesRaw = await response.json().catch(() => []);
          const schemes = Array.isArray(schemesRaw) ? schemesRaw : [];
          const scheme = schemes.find(s => s.module_name === moduleName);
          
          if (scheme) {
            setColors({
              primary_color: scheme.primary_color || '#0E4A22',
              secondary_color: scheme.secondary_color || '#963821',
              accent_color: scheme.accent_color || '#E0DA62',
              text_color: scheme.text_color || '#0A3020',
              bg_color: scheme.bg_color || '#ffffff',
              border_color: scheme.border_color || '#E0DA62'
            });
          }
        }
      } catch (error) {
        if (error?.message !== 'Failed to fetch') {
          console.error('Error fetching color scheme:', error?.message || String(error));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchColors();

    // Escuchar eventos de actualización de colores
    const handleColorUpdate = (event) => {
      if (event.detail?.module === moduleName) {
        setColors(event.detail.colors);
      }
    };

    window.addEventListener('colorSchemeUpdated', handleColorUpdate);

    return () => {
      window.removeEventListener('colorSchemeUpdated', handleColorUpdate);
    };
  }, [moduleName]);

  return { colors, loading };
}
