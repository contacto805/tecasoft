'use client';

import { useRef, useState, useEffect } from 'react';

export default function SignatureCapture({ 
  onSignatureComplete, 
  recipientName, 
  transactionType,
  onCancel 
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      
      // Set canvas size for mobile
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      
      // Set drawing style
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e293b';
    }
  }, []);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const confirmSignature = async () => {
    if (!hasSignature) {
      alert('Por favor, firme antes de confirmar');
      return;
    }

    try {
      setIsConfirming(true);
      const canvas = canvasRef.current;
      const signatureDataUrl = canvas.toDataURL('image/png');
      
      // Convert to blob for upload
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('signature', blob, 'signature.png');
      
      // Upload signature
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Error al subir la firma');
      }
      
      const { url } = await uploadResponse.json();
      
      // Call parent callback with signature URL
      onSignatureComplete(url, recipientName);
    } catch (error) {
      console.error('Error al procesar la firma:', error);
      alert('Error al guardar la firma. Intente nuevamente.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Captura de Firma Digital
          </h2>
          <p className="text-slate-600">
            {transactionType} - {recipientName}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Por favor, firme en el área blanca usando su dedo o stylus
          </p>
        </div>

        {/* Signature Canvas */}
        <div className="p-6">
          <div className="relative border-2 border-dashed border-slate-300 rounded-lg bg-white mb-4">
            <canvas
              ref={canvasRef}
              className="w-full h-64 md:h-80 touch-none cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-900 font-medium mb-1">
              📱 Instrucciones:
            </p>
            <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
              <li>Firme dentro del recuadro usando su dedo o stylus</li>
              <li>Puede borrar y volver a firmar si no queda satisfecho</li>
              <li>Debe confirmar su firma para finalizar el registro</li>
            </ul>
          </div>

          {/* Recipient Confirmation */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-900 font-medium">
              ✓ Confirmo que yo, <strong>{recipientName}</strong>, recibí este {transactionType.toLowerCase()} y estoy de acuerdo con los términos establecidos.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={clearSignature}
              disabled={!hasSignature || isConfirming}
              className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Borrar Firma
            </button>
            <button
              onClick={confirmSignature}
              disabled={!hasSignature || isConfirming}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isConfirming ? 'Guardando...' : 'Confirmar Firma'}
            </button>
          </div>

          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="w-full mt-3 px-6 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
