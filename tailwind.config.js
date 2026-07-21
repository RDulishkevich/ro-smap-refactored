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
        sans: ['Satoshi', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        brand: ['Clash Display', 'Satoshi', 'sans-serif']
      },
      colors: {
        accent: {
          DEFAULT: '#ff5a3d',
          soft: '#ffe8e3',
          dark: '#ff7a5c'
        }
      }
    }
  },
  plugins: []
};
