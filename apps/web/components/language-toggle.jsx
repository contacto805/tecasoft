'use client';

import { useState } from 'react';
import useLanguageStore from '@/lib/language-store';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguageStore();
  const [showMenu, setShowMenu] = useState(false);

  const toggleLanguage = (lang) => {
    setLanguage(lang);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
        aria-label="Change language"
      >
        <i className="ph ph-translate text-lg"></i>
        <span className="uppercase font-bold">{language}</span>
        <i className={`ph ph-caret-down text-xs transition-transform ${showMenu ? 'rotate-180' : ''}`}></i>
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          ></div>
          
          {/* Menu */}
          <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-lg border border-slate-200 shadow-lg z-50 overflow-hidden">
            <button
              onClick={() => toggleLanguage('es')}
              className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                language === 'es' ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700'
              }`}
            >
              <span className="text-xl">🇪🇸</span>
              <div>
                <div className="font-medium">Español</div>
                <div className="text-xs text-slate-500">Spanish</div>
              </div>
              {language === 'es' && (
                <i className="ph-fill ph-check-circle text-brand-600 ml-auto"></i>
              )}
            </button>
            
            <div className="border-t border-slate-100"></div>
            
            <button
              onClick={() => toggleLanguage('en')}
              className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                language === 'en' ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700'
              }`}
            >
              <span className="text-xl">🇺🇸</span>
              <div>
                <div className="font-medium">English</div>
                <div className="text-xs text-slate-500">Inglés</div>
              </div>
              {language === 'en' && (
                <i className="ph-fill ph-check-circle text-brand-600 ml-auto"></i>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
