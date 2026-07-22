import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f7f4",
          100: "#e3ebe3",
          500: "#3d6b4f",
          600: "#2f5540",
          900: "#1a2e24",
        },
      },
    },
  },
  plugins: [],
};

export default config;
