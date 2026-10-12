import { useEffect, useState } from 'react';

export function useTheme() {
  const [primaryColor, setPrimaryColor] = useState('#10b981');
  const [buttonColor, setButtonColor] = useState('#10b981');
  const [headerColor, setHeaderColor] = useState('#10b981');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        
        // Apply all color settings
        if (data.primary_color) {
          setPrimaryColor(data.primary_color);
        }
        if (data.button_color) {
          setButtonColor(data.button_color);
          applyButtonColor(data.button_color);
        }
        if (data.header_color) {
          setHeaderColor(data.header_color);
          applyColor('--header-color', data.header_color);
        }
        if (data.background_color) {
          setBackgroundColor(data.background_color);
          applyColor('--bg-color', data.background_color);
        }
        if (data.font_family) {
          setFontFamily(data.font_family);
          applyFontFamily(data.font_family);
        }
        
        // Apply additional color settings
        if (data.text_primary_color) applyColor('--text-primary', data.text_primary_color);
        if (data.text_secondary_color) applyColor('--text-secondary', data.text_secondary_color);
        if (data.heading_color) applyColor('--heading-color', data.heading_color);
        if (data.card_bg_color) applyColor('--card-bg', data.card_bg_color);
        if (data.sidebar_bg_color) applyColor('--sidebar-bg', data.sidebar_bg_color);
        if (data.border_color) applyColor('--border-color', data.border_color);
        if (data.link_color) applyColor('--link-color', data.link_color);
        if (data.hover_color) applyColor('--hover-color', data.hover_color);
        if (data.accent_color) applyColor('--accent-color', data.accent_color);
      } catch (error) {
        console.error('Error fetching theme:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTheme();
  }, []);

  const applyButtonColor = (color: string) => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    document.documentElement.style.setProperty('--brand-primary', color);
    document.documentElement.style.setProperty('--brand-primary-rgb', `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty('--brand-50', lighten(color, 0.95));
    document.documentElement.style.setProperty('--brand-100', lighten(color, 0.85));
    document.documentElement.style.setProperty('--brand-200', lighten(color, 0.7));
    document.documentElement.style.setProperty('--brand-500', color);
    document.documentElement.style.setProperty('--brand-600', darken(color, 0.1));
    document.documentElement.style.setProperty('--brand-700', darken(color, 0.2));
  };

  const applyColor = (property: string, color: string) => {
    document.documentElement.style.setProperty(property, color);
  };

  const applyFontFamily = (font: string) => {
    document.documentElement.style.setProperty('--font-family', font);
    document.body.style.fontFamily = font;
  };

  const lighten = (color: string, amount: number) => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    const newR = Math.round(r + (255 - r) * amount);
    const newG = Math.round(g + (255 - g) * amount);
    const newB = Math.round(b + (255 - b) * amount);

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  const darken = (color: string, amount: number) => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    const newR = Math.round(r * (1 - amount));
    const newG = Math.round(g * (1 - amount));
    const newB = Math.round(b * (1 - amount));

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  return { primaryColor, buttonColor, headerColor, backgroundColor, fontFamily, loading };
}
