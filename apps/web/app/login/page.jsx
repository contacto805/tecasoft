'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LanguageToggle from '@/components/language-toggle';
import useLanguageStore from '@/lib/language-store';
import { t } from '@/lib/translations';

export default function LoginPage() {
  const router = useRouter();
  const { language } = useLanguageStore();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [credentialsEmail, setCredentialsEmail] = useState('');
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsMessage, setCredentialsMessage] = useState('');
  const [smtpConfigured, setSmtpConfigured] = useState(true);

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 4) {
      setPin(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate PIN length
    if (pin.length !== 4) {
      setError(t('login.pinLengthError', language));
      return;
    }

    setLoading(true);

    // 🔍 FRONTEND LOG - What we're sending
    const payload = {
      email: email.trim().toLowerCase(),
      pin: pin,
    };
    console.log('========================================');
    console.log('🔵 FRONTEND: Login form submitted (PIN Auth)');
    console.log('🔵 FRONTEND: Raw email from input:', email);
    console.log('🔵 FRONTEND: Raw PIN from input:', pin);
    console.log('🔵 FRONTEND: Email length:', email.length);
    console.log('🔵 FRONTEND: PIN length:', pin.length);
    console.log('🔵 FRONTEND: PIN is numeric:', /^\d{4}$/.test(pin));
    console.log('🔵 FRONTEND: Trimmed & lowercased email:', payload.email);
    console.log('🔵 FRONTEND: Payload being sent:', payload);
    console.log('🔵 FRONTEND: Payload as JSON string:', JSON.stringify(payload));
    console.log('========================================');

    try {
      const response = await fetch('/api/auth/login-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      console.log('🔵 FRONTEND: Response status:', response.status);
      console.log('🔵 FRONTEND: Response ok:', response.ok);

      const data = await response.json();
      console.log('🔵 FRONTEND: Response data:', data);

      if (!response.ok || !data.success) {
        console.log('🔵 FRONTEND: Login failed:', data.error);
        setError(data.error || t('login.invalidCredentials', language));
        setLoading(false);
        return;
      }

      console.log('🔵 FRONTEND: Login successful!');
      console.log('🔵 FRONTEND: User data:', data.user);
      console.log('🔵 FRONTEND: Token received:', data.token?.substring(0, 30) + '...');
      console.log('🔵 FRONTEND: Redirecting to dashboard...');

      // Login successful - session cookie is set
      // Force reload after redirect to ensure auth state is refreshed
      window.location.href = '/';
    } catch (err) {
      console.error('Login error:', err);
      setError(t('login.connectionError', language));
      setLoading(false);
    }
  };

  const checkSmtpStatus = async () => {
    try {
      const response = await fetch('/api/auth/smtp-status');
      const data = await response.json();
      setSmtpConfigured(data.configured);
      if (!data.configured) {
        setCredentialsMessage(data.message);
      }
    } catch (err) {
      console.error('SMTP status check error:', err);
    }
  };

  const handleSendCredentials = async (e) => {
    e.preventDefault();
    setCredentialsMessage('');
    setCredentialsLoading(true);

    try {
      const response = await fetch('/api/auth/send-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credentialsEmail.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'No se pudieron enviar las credenciales. Por favor intenta nuevamente.';
        setCredentialsMessage(errorMsg);
        setCredentialsLoading(false);
        return;
      }

      setCredentialsMessage(data.message || '✅ Credenciales enviadas exitosamente. Revisa tu correo electrónico.');
      setCredentialsEmail('');
      
      // Close form after 3 seconds
      setTimeout(() => {
        setShowCredentialsForm(false);
        setCredentialsMessage('');
      }, 3000);
    } catch (err) {
      console.error('Send credentials error:', err);
      setCredentialsMessage('Error de conexión. Verifica tu conexión a internet e intenta nuevamente.');
    } finally {
      setCredentialsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      {/* Language Toggle - Fixed Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageToggle />
      </div>
      
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-lg bg-brand-600 flex items-center justify-center border border-brand-500/20">
              <img src="/logo.svg" alt="Tecavo" className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('login.title', language)}</h1>
          <p className="text-slate-500 mt-2">{t('login.subtitle', language)}</p>
          <p className="text-[13px] mt-1"><a href="/" className="text-emerald-700 underline">Ir a pantalla principal (seleccionar grupo)</a></p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">{t('login.signIn', language)}</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('login.email', language)}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder', language)}
                required
                autoFocus
                className="w-full px-4 py-3.5 rounded-lg border-2 border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-bold text-lg"
              />
            </div>

            {/* PIN Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('login.pin', language)}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                value={pin}
                onChange={handlePinChange}
                placeholder={t('login.pinPlaceholder', language)}
                maxLength="4"
                required
                className="w-full px-4 py-4 rounded-lg border-2 border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-center focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-black text-4xl tracking-[1rem]"
              />
              <p className="text-xs text-slate-500 mt-1.5 text-center">
                {t('login.pinHelp', language)}
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? t('login.signingIn', language) : t('login.signInButton', language)}
            </button>

            {/* Request Credentials Button */}
            <button
              type="button"
              onClick={() => {
                setShowCredentialsForm(!showCredentialsForm);
                if (!showCredentialsForm) {
                  checkSmtpStatus();
                }
              }}
              className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 active:scale-95 transition-all"
            >
              {showCredentialsForm ? t('login.cancel', language) : t('login.requestCredentials', language)}
            </button>
          </form>

          {/* Credentials Request Form */}
          {showCredentialsForm && (
            <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                {t('login.requestCredentialsTitle', language)}
              </h3>
              
              {!smtpConfigured ? (
                <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <i className="ph ph-warning text-2xl text-yellow-600 flex-shrink-0 mt-0.5"></i>
                    <div>
                      <h4 className="font-semibold text-yellow-900 mb-1">{t('login.serviceUnavailable', language)}</h4>
                      <p className="text-sm text-yellow-800 mb-3">
                        {t('login.smtpNotConfigured', language)}
                      </p>
                      <p className="text-xs text-yellow-700 bg-yellow-100 p-2 rounded border border-yellow-200">
                        <strong>{t('login.forAdmins', language)}</strong> {t('login.smtpConfigInstructions', language)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSendCredentials} className="space-y-3">
                    <input
                      type="email"
                      value={credentialsEmail}
                      onChange={(e) => setCredentialsEmail(e.target.value)}
                      placeholder={t('login.enterEmail', language)}
                      required
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors font-bold text-base"
                    />
                    <button
                      type="submit"
                      disabled={credentialsLoading}
                      className="w-full px-4 py-2.5 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {credentialsLoading ? t('login.sending', language) : t('login.sendCredentials', language)}
                    </button>
                  </form>
                  
                  {credentialsMessage && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${
                      credentialsMessage.includes('✅')
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                      {credentialsMessage}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
