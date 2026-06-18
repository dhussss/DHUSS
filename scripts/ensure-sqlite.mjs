import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const match = env.match(/^DATABASE_URL=(?:"|')?(file:[^"'\n]+)(?:"|')?/m);

if (match) {
  const url = match[1];

  if (url.startsWith("file:")) {
    const rawPath = url.slice("file:".length);
    const dbPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.join(process.cwd(), "prisma", rawPath.replace(/^\.\//, ""));

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    if (!fs.existsSync(dbPath)) {
      fs.closeSync(fs.openSync(dbPath, "w"));
    }
  }
}
