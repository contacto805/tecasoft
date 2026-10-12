import { useEffect, useRef, useState } from 'react';

export function useQRScanner(onQRDetected) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  // Load jsQR dynamically
  const loadJsQR = async () => {
    if (window.jsQR) return;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    document.head.appendChild(script);
  };

  const startScanning = async () => {
    try {
      await loadJsQR();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setScanning(true);
        setError(null);

        // Start scanning loop
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const video = videoRef.current;

        const scanLoop = () => {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (code) {
              if (onQRDetected) {
                onQRDetected(code.data);
              }
            }
          }
          if (scanning) {
            requestAnimationFrame(scanLoop);
          }
        };

        scanLoop();
      }
    } catch (err) {
      console.error('Error starting QR scanner:', err);
      setError(err.message || 'No se puede acceder a la cámara');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setScanning(false);
  };

  return {
    videoRef,
    canvasRef,
    scanning,
    error,
    startScanning,
    stopScanning
  };
}
