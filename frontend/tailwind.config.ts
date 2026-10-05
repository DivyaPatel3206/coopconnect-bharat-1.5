import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        indigo: {
          DEFAULT: "#1B3A5C",
          dark: "#122841",
        },
        coop: {
          green: "#2E7D4F",
          saffron: "#E08A28",
          paper: "#F7F4ED",
          sand: "#EFEAE0",
          ink: "#1A1A1A",
          slate: "#6B7280",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
