/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          light: '#e8edf2',
          dark: '#0b1120',
        },
        card: {
          light: 'rgba(255,255,255,0.72)',
          dark: 'rgba(20,30,50,0.72)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
