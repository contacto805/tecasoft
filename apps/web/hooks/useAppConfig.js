import { useState, useEffect } from 'react';

/**
 * useAppConfig - THE ONLY config hook the frontend should use.
 * All other useSettings / useBranding become thin wrappers during migration.
 */
let cachedConfig = null;
let listeners = [];

export function useAppConfig() {
  const [config, setConfig] = useState(cachedConfig || {
    version: 0,
    company: { name: 'TECAVO FRUITS', slogan: 'Del campo con amor' },
    branding: {},
    theme: {},
    navigation: []
  });
  const [loading, setLoading] = useState(!cachedConfig);

  const load = async () => {
    try {
      const res = await fetch('/api/app-config');
      if (res.ok) {
        const data = await res.json();
        cachedConfig = data;
        listeners.forEach(l => l(data));
        setConfig(data);
      }
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    if (!cachedConfig) load();

    const onFocus = () => load();
    const onVis = () => { if (!document.hidden) load(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);

    const unsubscribe = (fn) => { listeners = listeners.filter(l => l !== fn); };
    listeners.push(setConfig);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      listeners = listeners.filter(l => l !== setConfig);
    };
  }, []);

  // Apply CSS variables immediately when config changes
  useEffect(() => {
    if (typeof document === 'undefined' || !config?.theme) return;
    const root = document.documentElement;
    Object.entries(config.theme || {}).forEach(([k, v]) => {
      if (k.startsWith('--')) root.style.setProperty(k, v);
    });
    if (config.branding?.primary_color) {
      root.style.setProperty('--color-primary', config.branding.primary_color);
    }
  }, [config]);

  return { config, loading, reload: load };
}

// Legacy thin wrappers (preserve existing imports during transition)
export function useSettings() {
  const { config } = useAppConfig();
  return {
    settings: {
      company_name: config?.company?.name,
      company_phone: config?.company?.phone,
      company_email: config?.company?.email,
      footer_text: config?.company?.slogan,
      currency: config?.localization?.currency || 'MXN',
      logo_url: config?.company?.logo_url
    },
    loading: false
  };
}

export function useBranding() {
  const { config } = useAppConfig();
  return {
    branding: {
      ...config?.branding,
      companyName: config?.company?.name,
      address: config?.company?.address,
      logo_url: config?.company?.logo_url,
      primary_color: config?.branding?.primary_color || '#1F6B3A'
    },
    loading: false
  };
}
