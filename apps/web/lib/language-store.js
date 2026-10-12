import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useLanguageStore = create(
  persist(
    (set) => ({
      language: 'es', // Default to Spanish
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'tecavo-language-storage',
    }
  )
);

export default useLanguageStore;
