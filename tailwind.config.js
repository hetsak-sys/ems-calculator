/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#111111',
        surface2: '#1C1C1C',
        border: '#2A2A2A',
      },
    },
  },
  plugins: [],
}
