import { useState, useEffect, useRef, useCallback } from 'react';

export const useScaleDevice = (deviceId, isEnabled) => {
  const [weight, setWeight] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const readerRef = useRef(null);
  const portRef = useRef(null);

  const connect = useCallback(async () => {
    if (!isEnabled || !deviceId) {
      setConnectionStatus('disabled');
      return;
    }

    try {
      setConnectionStatus('connecting');
      setError(null);

      // Check if WebSerial API is available
      if (!navigator.serial) {
        throw new Error('Tu navegador no soporta conexión con dispositivos seriales. Usa Chrome, Edge o un navegador compatible.');
      }

      // Request access to serial port
      const port = await navigator.serial.requestPort();
      portRef.current = port;

      // Open the port
      await port.open({ baudRate: 9600 });
      setConnectionStatus('connected');
      setIsConnected(true);

      // Start reading from port
      const reader = port.readable.getReader();
      readerRef.current = reader;

      // Read incoming data
      const readLoop = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            // Convert received bytes to string
            const decoder = new TextDecoder();
            const dataString = decoder.decode(value);
            
            // Extract weight value (format may vary by scale model)
            // Common formats: "XXX.XX kg", "XXX.XX", etc.
            const weightMatch = dataString.match(/(\d+\.?\d*)/);
            
            if (weightMatch) {
              const weightValue = parseFloat(weightMatch[1]);
              if (!isNaN(weightValue)) {
                setWeight(weightValue);
              }
            }
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error('Error reading from scale:', error);
            setError(`Error leyendo escala: ${error.message}`);
            setConnectionStatus('error');
          }
        }
      };

      readLoop();
    } catch (error) {
      console.error('Error connecting to scale:', error);
      setError(error.message);
      setConnectionStatus('error');
      setIsConnected(false);
    }
  }, [isEnabled, deviceId]);

  const disconnect = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }

      if (portRef.current && portRef.current.readable) {
        await portRef.current.close();
        portRef.current = null;
      }

      setIsConnected(false);
      setConnectionStatus('disconnected');
      setWeight(null);
    } catch (error) {
      console.error('Error disconnecting from scale:', error);
      setError(error.message);
    }
  }, []);

  const clearWeight = useCallback(() => {
    setWeight(null);
  }, []);

  return {
    weight,
    isConnected,
    error,
    connectionStatus,
    connect,
    disconnect,
    clearWeight
  };
};
