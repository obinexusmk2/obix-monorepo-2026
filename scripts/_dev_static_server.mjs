import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";

const root = process.argv[2] || process.cwd();
const port = Number(process.argv[3] || 8080);
const types = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json",
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(req.url.split("?")[0]);
    let full = join(root, path);
    if ((await stat(full)).isDirectory()) full = join(full, "index.html");
    const body = await readFile(full);
    res.writeHead(200, { "content-type": types[extname(full)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
