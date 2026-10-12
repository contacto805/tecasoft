import { useEffect, useState } from 'react';

export function useSettings() {
  const [settings, setSettings] = useState({
    company_name: 'Tecavo Fruits Soft',
    company_phone: '+1 (234) 567-8900',
    company_address: 'Calle Principal 123, Edén, Michoacán',
    company_logo_url: '/logo.svg',
    footer_text: 'Todos los derechos reservados'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, loading };
}
