// Tailwind CSS config for BLOKS web app — cozy tactical theme palette
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#FDFBF7",
        cozy: {
          bg: "#F5F0E8",
          panel: "#EDE8DC",
          border: "#D4C9B0",
          text: "#3D3529",
          muted: "#8A7E6A",
        },
        toxic: {
          red: "#FF1744",
          orange: "#FF6D00",
          glitch: "#00E5FF",
        },
        brand: {
          primary: "#5C4A32",
          accent: "#C8A96E",
        },
      },
      fontFamily: {
        sans: ["Pretendard", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
