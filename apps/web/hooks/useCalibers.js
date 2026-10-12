import { useState, useEffect } from 'react';

export const useCalibers = () => {
  const [calibers10kg, setCalibers10kg] = useState([
    'Super (40\'s)',
    'Extra (48\'s)',
    'Primera (60\'s)',
    'Mediano (70\'s)',
    'Tercera (84\'s)',
    'Cuarta'
  ]);
  
  const [calibers6kg, setCalibers6kg] = useState([
    'Extra (48\'s)',
    'Primera (60\'s)',
    'Mediano (70\'s)',
    'Tercera (84\'s)'
  ]);
  
  const [qualityOptions, setQualityOptions] = useState([
    'Calidad A',
    'Calidad B',
    'Calidad C',
    'Proceso',
    'Desecho'
  ]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load calibers from database
        const calibersRes = await fetch('/api/calibers');
        if (calibersRes.ok) {
          const calibersData = await calibersRes.json();
          if (calibersData.length > 0) {
            const c10kg = calibersData
              .filter(c => c.category === '10kg')
              .map(c => c.display_name);
            const c6kg = calibersData
              .filter(c => c.category === '6kg')
              .map(c => c.display_name);
            
            if (c10kg.length > 0) setCalibers10kg(c10kg);
            if (c6kg.length > 0) setCalibers6kg(c6kg);
          }
        }

        // Load quality options from database
        const qualityRes = await fetch('/api/quality-options');
        if (qualityRes.ok) {
          const qualityData = await qualityRes.json();
          if (qualityData.length > 0) {
            const options = qualityData.map(q => q.display_name);
            setQualityOptions(options);
          }
        }
      } catch (error) {
        console.error('Error loading calibers and quality options:', error);
        // Use defaults if API fails
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return {
    calibers10kg,
    calibers6kg,
    qualityOptions,
    loading
  };
};
