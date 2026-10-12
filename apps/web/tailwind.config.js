const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                    colors: {
                        brand: {
                            50: 'var(--brand-50)',
                            100: 'var(--brand-100)',
                            500: 'var(--brand-500)',
                            600: 'var(--brand-600)',
                            700: 'var(--brand-700)',
                            900: '#064e3b',
                            primary: 'var(--brand-primary)',
                            secondary: 'var(--brand-secondary)',
                            accent: 'var(--brand-accent)',
                            text: 'var(--brand-text)',
                            border: 'var(--brand-border)',
                        }
                    },
                    backgroundImage: {
                        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                    }
                }
            },
  plugins: [],
};
export default config;
