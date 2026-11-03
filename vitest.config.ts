import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Os módulos de servidor importam "server-only", que só existe no build do Next.
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
