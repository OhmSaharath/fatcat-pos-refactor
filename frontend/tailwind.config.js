/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        chipotle: {
          brown: '#451400',
          'brown-hover': '#5A1E06',
          red: '#C4121A',
          gold: '#A8622D',
          'gold-soft': '#F6EDE3',
        },
        app: {
          bg: '#FBF8F5',
          border: '#ECE7DE',
          'border-dark': '#D4CCC1',
          primary: '#2B1810',
          muted: '#796E65',
        },
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans Thai', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        thai: ['IBM Plex Sans Thai', 'sans-serif'],
        en: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
