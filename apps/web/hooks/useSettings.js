import { useState, useEffect } from 'react';

export function formatCurrency(amount, currency = 'MXN') {
  const n = parseFloat(amount) || 0;
  return `${n.toFixed(2)} ${currency || 'MXN'}`;
}

export function useSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/branding', { signal: controller.signal });
        if (response.ok) {
          const txt = await response.text();
          const data = txt ? JSON.parse(txt) : null;
          setSettings(data || {
            company_name: 'Tecavo Fruits S de RL de CV',
            company_phone: '+52 459 134 4576',
            company_email: 'contacto@tecavofruits.com',
            company_logo: null,
            footer_text: 'Tecavo Fruits S de RL de CV - Todos los derechos reservados',
            currency: 'MXN'
          });
        } else {
          setSettings({
            company_name: 'Tecavo Fruits S de RL de CV',
            company_phone: '+52 459 134 4576',
            company_email: 'contacto@tecavofruits.com',
            company_logo: null,
            footer_text: 'Tecavo Fruits S de RL de CV - Todos los derechos reservados',
            currency: 'MXN'
          });
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setError(err?.message || 'Failed to load');
        setSettings({
          company_name: 'Tecavo Fruits S de RL de CV',
          company_phone: '+52 459 134 4576',
          company_email: 'contacto@tecavofruits.com',
          company_logo: null,
          footer_text: 'Tecavo Fruits S de RL de CV - Todos los derechos reservados',
          currency: 'MXN'
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
    return () => controller.abort();
  }, []);

  const formatMoney = (amount) => formatCurrency(amount, settings?.currency || 'MXN');

  return { settings, loading, error, formatMoney, formatCurrency };
}
