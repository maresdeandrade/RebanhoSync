import { defineConfig, loadEnv } from "vite";
import { validateBackendBuildEnvironment } from "./scripts/codex/backend-environment.mjs";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode, command }) => {
  if (command === "build")
    validateBackendBuildEnvironment(mode, {
      ...loadEnv(mode, process.cwd(), ""),
      ...process.env,
    });
  return {
    server: {
      host: "::",
      port: 8080,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks() {
            // Disable manual chunking to avoid circular dependencies
            return undefined;
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
  };
});
