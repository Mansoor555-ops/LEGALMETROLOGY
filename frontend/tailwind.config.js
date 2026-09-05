/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        govt: {
          navy: "#0B3D6E",
          dark: "#172554",
          light: "#F8FAFC",
          card: "#FFFFFF",
          border: "#E2E8F0",
          pass: "#15803D",
          fail: "#B91C1C",
          review: "#B45309"
        }
      }
    },
  },
  plugins: [],
}
