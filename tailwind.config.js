/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./assets/js/**/*.js", "./contact.php"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Barlow Condensed", "sans-serif"],
        body: ["Barlow", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#dce8ff",
          200: "#b7d0ff",
          300: "#85adff",
          400: "#4d81f5",
          500: "#2f5dda",
          600: "#2148b6",
          700: "#1d3b8f",
          800: "#1f346f",
          900: "#0f1b36",
        },
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s ease-out forwards",
        pulseSoft: "pulseSoft 4s ease-in-out infinite",
      },
      boxShadow: {
        card: "0 14px 40px rgba(15, 27, 54, 0.14)",
      },
    },
  },
  plugins: [],
}

