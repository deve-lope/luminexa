/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'luminexa-navy': '#0F172A',
        'luminexa-accent': '#7C3AED',
        'luminexa-mist': '#F8FAFC',
        'luminexa-slate': '#1E293B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
