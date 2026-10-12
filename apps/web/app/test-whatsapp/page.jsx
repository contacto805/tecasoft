'use client';

import { useState } from 'react';

export default function TestWhatsAppPage() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);

  // Check API status on load
  const checkStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp');
      const data = await response.json();
      setApiStatus(data);
    } catch (error) {
      setApiStatus({ error: error.message });
    }
  };

  // Send test message
  const sendMessage = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, message }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🟢 Test WhatsApp API
          </h1>
          <p className="text-gray-600 mb-6">
            Prueba la integración de WhatsApp Business API
          </p>

          {/* API Status */}
          <div className="mb-6">
            <button
              onClick={checkStatus}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Verificar Estado de API
            </button>

            {apiStatus && (
              <div
                className={`mt-3 p-4 rounded-lg ${
                  apiStatus.configured
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                <p className="font-semibold">
                  {apiStatus.configured ? '✅ Configurado' : '⚠️ No Configurado'}
                </p>
                <p className="text-sm mt-1">{apiStatus.message}</p>
                {apiStatus.phoneId && (
                  <p className="text-sm mt-1">
                    Phone ID: {apiStatus.phoneId}
                  </p>
                )}
              </div>
            )}
          </div>

          <hr className="my-6" />

          {/* Send Message Form */}
          <form onSubmit={sendMessage} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Número de Teléfono
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5551234567"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-black font-semibold"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Solo números, sin espacios ni guiones (10-15 dígitos)
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mensaje
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hola, este es un mensaje de prueba desde Tecavo Soft"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-black font-semibold h-32 resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando...' : '📤 Enviar Mensaje'}
            </button>
          </form>

          {/* Result */}
          {result && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                result.success
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              <p className="font-semibold">
                {result.success ? '✅ Éxito' : '❌ Error'}
              </p>
              <p className="text-sm mt-1">
                {result.message || result.error}
              </p>
              {result.details && (
                <p className="text-xs mt-2 opacity-75">{result.details}</p>
              )}
              {result.messageId && (
                <p className="text-xs mt-2">Message ID: {result.messageId}</p>
              )}
            </div>
          )}

          {/* Usage Examples */}
          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">
              📖 Ejemplos de Uso
            </h3>
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                <strong>Mensaje simple:</strong>
              </p>
              <pre className="bg-gray-800 text-white p-3 rounded text-xs overflow-x-auto">
{`POST /api/whatsapp
{
  "phone": "5551234567",
  "message": "Tu orden ha sido procesada"
}`}
              </pre>

              <p className="mt-4">
                <strong>Con template:</strong>
              </p>
              <pre className="bg-gray-800 text-white p-3 rounded text-xs overflow-x-auto">
{`POST /api/whatsapp
{
  "phone": "5551234567",
  "template": "tecavo_ticket",
  "templateParams": ["FOLIO-123", "https://app.com/ticket/123"]
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
