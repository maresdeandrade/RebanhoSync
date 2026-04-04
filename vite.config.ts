import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("react-router-dom") ||
            id.includes("react-dom") ||
            id.includes("/react/")
          ) {
            return "react-vendor";
          }

          if (id.includes("@supabase/")) {
            return "supabase-vendor";
          }

          if (id.includes("dexie")) {
            return "offline-vendor";
          }

          if (id.includes("recharts") || id.includes("/d3-")) {
            return "charts-vendor";
          }

          if (
            id.includes("@radix-ui/") ||
            id.includes("lucide-react") ||
            id.includes("class-variance-authority") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            id.includes("sonner")
          ) {
            return "ui-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
