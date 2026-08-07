/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,html,css}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geologica', 'Satoshi', 'system-ui', 'sans-serif'],
        brand: ['Klukva', 'Geologica', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      colors: {
        accent: {
          DEFAULT: '#FBAB57',
          soft: '#FEC674',
          dark: '#9a6420'
        }
      }
    }
  },
  plugins: []
};
