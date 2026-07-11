/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'luminexa-navy': '#0F172A',
        'luminexa-accent': '#7C3AED',
        'luminexa-accent-dark': '#6D28D9',
        'luminexa-mist': '#F8FAFC',
        'luminexa-slate': '#1E293B',
        'luminexa-canvas': '#F8F7FC',
        'luminexa-canvas-warm': '#F5F3FF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'lx-soft': '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(124, 58, 237, 0.06)',
        'lx-card':
          '0 0 0 1px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.03), 0 12px 32px rgba(124, 58, 237, 0.08)',
        'lx-elevated':
          '0 0 0 1px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.06), 0 24px 48px rgba(124, 58, 237, 0.12)',
        'lx-tab': '0 -8px 32px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.6)',
        'lx-nav': '4px 0 24px rgba(15, 23, 42, 0.04)',
      },
      borderRadius: {
        lx: '1rem',
        'lx-lg': '1.25rem',
        'lx-xl': '1.5rem',
      },
      backgroundImage: {
        'lx-mesh':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124, 58, 237, 0.1), transparent), radial-gradient(ellipse 50% 40% at 100% 0%, rgba(139, 92, 246, 0.07), transparent), radial-gradient(ellipse 40% 30% at 0% 100%, rgba(167, 139, 250, 0.05), transparent)',
        'lx-hero': 'linear-gradient(135deg, #0F172A 0%, #4C1D95 50%, #6D28D9 100%)',
        'lx-hero-soft': 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 50%, #FAFAFA 100%)',
      },
    },
  },
  plugins: [],
};
