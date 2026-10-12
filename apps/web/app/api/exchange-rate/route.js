import { NextResponse } from 'next/server';

const CACHE_DURATION = 3600000; // 1 hour in milliseconds
let cachedRate = null;
let cacheTime = null;

// Función para obtener el tipo de cambio
async function fetchExchangeRate() {
  try {
    // Intentar con multiple APIs de respaldo
    const apis = [
      'https://api.exchangerate-api.com/v4/latest/USD',
      'https://api.exchangerate.host/latest?base=USD&symbols=MXN'
    ];
    
    for (const apiUrl of apis) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`API ${apiUrl} error: ${response.status}`);
          continue; // Try next API
        }
        
        const data = await response.json();
        
        // Handle different API response formats
        let rate;
        if (data?.rates?.MXN) {
          rate = data.rates.MXN;
        } else if (data?.rates && typeof data.rates === 'object') {
          rate = Object.values(data.rates)[0]; // Get first rate if structure is different
        } else {
          console.error('Unexpected API response format:', data);
          continue; // Try next API
        }
        
        if (rate && !isNaN(rate)) {
          const formattedRate = parseFloat(rate).toFixed(2);
          console.log(`📊 Exchange rate fetched: 1 USD = ${formattedRate} MXN`);
          
          return {
            rate: formattedRate,
            source: apiUrl,
            timestamp: new Date(),
            baseCurrency: 'USD',
            targetCurrency: 'MXN'
          };
        }
      } catch (apiError) {
        console.error(`Failed to fetch from ${apiUrl}:`, apiError.message);
        continue; // Try next API
      }
    }
    
    throw new Error('All exchange rate APIs failed');
  } catch (error) {
    console.error('Error fetching exchange rate:', error.message);
    
    // Fallback: retorna un valor por defecto
    console.log('📊 Using fallback exchange rate: 17.50 MXN');
    return {
      rate: '17.50',
      source: 'default',
      timestamp: new Date(),
      baseCurrency: 'USD',
      targetCurrency: 'MXN',
      fallback: true
    };
  }
}

export async function GET() {
  try {
    // Verificar si tenemos un valor en caché válido
    const now = Date.now();
    if (cachedRate && cacheTime && (now - cacheTime) < CACHE_DURATION) {
      console.log('📊 Usando tipo de cambio en caché');
      return NextResponse.json(cachedRate);
    }
    
    // Obtener nuevo tipo de cambio
    console.log('📊 Obteniendo nuevo tipo de cambio...');
    const exchangeRate = await fetchExchangeRate();
    
    // Guardar en caché
    cachedRate = exchangeRate;
    cacheTime = now;
    
    return NextResponse.json(exchangeRate);
  } catch (error) {
    console.error('Error en GET /api/exchange-rate:', error);
    
    // Retornar fallback
    return NextResponse.json(
      {
        rate: '17.50',
        source: 'default',
        timestamp: new Date(),
        baseCurrency: 'USD',
        targetCurrency: 'MXN',
        fallback: true
      },
      { status: 200 }
    );
  }
}
