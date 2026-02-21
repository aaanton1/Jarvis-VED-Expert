import path from "node:path";
import { defineConfig } from "prisma/config";

const dbPath = path.resolve(__dirname, "../data/jarvis.db");

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: `file:${dbPath}`,
  },
});
