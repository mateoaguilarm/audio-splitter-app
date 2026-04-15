/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#16c784',
        'brand-dark': '#0fa86e',
        surface: '#1a1a2e',
        panel: '#16213e',
        card: '#0f3460',
      },
    },
  },
  plugins: [],
};
