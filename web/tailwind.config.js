/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#e6f4ea',
          DEFAULT: '#2e7d32', // Green primary
          dark: '#1b5e20',
        }
      }
    },
  },
  plugins: [],
}
