/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        night:   "#12082E",
        abyss:   "#1A0533",
        grape:   "#7B2FBE",
        orchid:  "#C084FC",
        cyan:    "#06B6D4",
        amber:   "#F59E0B",
        jade:    "#10B981",
        crimson: "#DC2626",
        slate:   "#374151",
        frost:   "#F5F3FF",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "glow":       "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%":   { boxShadow: "0 0 5px #7B2FBE" },
          "100%": { boxShadow: "0 0 20px #C084FC, 0 0 40px #7B2FBE" },
        },
      },
    },
  },
  plugins: [],
};
