/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#6C63FF",
        primaryDark: "#4B44CC",
        primaryLight: "#EEF0FF",
        accent: "#00D9A6",
        accentDark: "#00A882",
        background: "#0A0A0F",
        surface: "#12121A",
        surface2: "#1C1C28",
        border: "#2A2A3D",
        textPrimary: "#F0F0FF",
        textSecondary: "#9898B8",
        textMuted: "#55556A",
        success: "#00D9A6",
        warning: "#FFB830",
        danger: "#FF4D6A",
        info: "#4DA6FF"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"]
      },
      boxShadow: {
        glow: "0 10px 30px rgba(108, 99, 255, 0.18)"
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      backgroundImage: {
        "cta-gradient": "linear-gradient(135deg, #6C63FF 0%, #4B44CC 100%)",
        "grid-fade":
          "radial-gradient(circle at top, rgba(108,99,255,0.15), transparent 48%), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};
