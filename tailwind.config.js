/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '!./src/**/__tests__/**'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef3f9',
          100: '#d9e4f1',
          200: '#b3c9e3',
          300: '#7fa3cc',
          400: '#4d7db3',
          500: '#2c5d96',
          600: '#1f4a7c',
          700: '#183b64',
          800: '#0f2a4a',
          900: '#0a1d35',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
