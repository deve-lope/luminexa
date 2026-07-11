/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'luminexa-ink': '#10231F',
        'luminexa-navy': '#10231F',
        'luminexa-accent': '#0D9488',
        'luminexa-accent-dark': '#0F766E',
        'luminexa-mist': '#F0FDFA',
        'luminexa-slate': '#1F2A33',
        'luminexa-canvas': '#F6F7F5',
        'luminexa-canvas-warm': '#F2F4F1',
        'luminexa-line': '#E4E7E4',
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'lx-soft': '0 1px 2px rgba(16, 35, 31, 0.04), 0 4px 14px rgba(16, 35, 31, 0.05)',
        'lx-card': '0 1px 2px rgba(16, 35, 31, 0.04), 0 6px 20px rgba(16, 35, 31, 0.06)',
        'lx-elevated':
          '0 2px 6px rgba(16, 35, 31, 0.06), 0 16px 36px rgba(13, 148, 136, 0.12)',
        'lx-tab': '0 -6px 24px rgba(16, 35, 31, 0.07), 0 0 0 1px rgba(255, 255, 255, 0.7)',
        'lx-nav': '4px 0 20px rgba(16, 35, 31, 0.04)',
      },
      borderRadius: {
        lx: '1rem',
        'lx-lg': '1.25rem',
        'lx-xl': '1.5rem',
      },
      backgroundImage: {
        /* Barely-there wash so the ground isn't sterile flat gray */
        'lx-mesh':
          'radial-gradient(ellipse 70% 45% at 50% -12%, rgba(13, 148, 136, 0.07), transparent), radial-gradient(ellipse 45% 35% at 100% 0%, rgba(56, 189, 248, 0.05), transparent)',
        'lx-hero': 'linear-gradient(to bottom right, #134E4A 0%, #0D9488 60%, #14B8A6 100%)',
        'lx-hero-soft': 'linear-gradient(to bottom right, #F0FDFA 0%, #E7F6F1 55%, #F6F7F5 100%)',
      },
    },
  },
  plugins: [],
};
