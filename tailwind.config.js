/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#C09428',
          light: '#D4AA38',
          dark: '#8B6914',
          bg: '#FBF8F0',
        },
        cream: '#F5F0E6',
        sidebar: '#1B1108',
        primary: '#1A1008',
        muted: '#7A6A5A',
        border: '#E5DDD0',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
}
