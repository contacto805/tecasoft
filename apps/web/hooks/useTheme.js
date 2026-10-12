import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState({
    primaryColor: '#0E4A22',
    secondaryColor: '#963821',
    accentColor: '#E0DA62',
    textColor: '#0A3020',
    borderColor: '#E0DA62'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await fetch('/api/color-schemes');
        if (response.ok) {
          const schemesRaw = await response.json().catch(() => []);
          const schemes = Array.isArray(schemesRaw) ? schemesRaw : [];
          const primaryScheme = schemes.find(s => s.module_name === 'dashboard') || schemes[0];
          if (primaryScheme) {
            setTheme({
              primaryColor: primaryScheme.primary_color || '#0E4A22',
              secondaryColor: primaryScheme.secondary_color || '#963821',
              accentColor: primaryScheme.accent_color || '#E0DA62',
              textColor: primaryScheme.text_color || '#0A3020',
              borderColor: primaryScheme.border_color || '#E0DA62'
            });
          }
        }
      } catch (err) {
        if (err?.message !== 'Failed to fetch') {
          console.error('Error loading theme:', err?.message || String(err));
        }
        // Use default theme on error
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, []);

  return { ...theme, loading };
}
