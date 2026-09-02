/**
 * `obix dev` — zero-bundle dev server.
 *
 * Serves the app directory as static files, transpiling `*.ts` on the fly with
 * esbuild (no bundling), resolving the bare `obix-core` specifier through an
 * injected import map, and live-reloading the browser over Server-Sent Events
 * when any source file changes.
 */
import { createServer, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";
import * as esbuild from "esbuild";
import type { CliResult } from "./types.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const RELOAD = `\n<script>new EventSource("/__obix_reload").onmessage=()=>location.reload();</script>\n`;
const IMPORT_MAP = `<script type="importmap">{"imports":{"obix-core":"/__obix/obix-core/index.js","obix-core/":"/__obix/obix-core/"}}</script>\n`;

export interface DevOptions {
  cwd?: string;
  port?: number;
}

export interface DevServer extends CliResult {
  data: { port: number; close: () => Promise<void> };
}

export async function dev(options: DevOptions = {}): Promise<DevServer> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const port = options.port ?? 5173;
  const clients = new Set<ServerResponse>();

  let coreDist: string | null = null;
  try {
    coreDist = join(
      dirname(createRequire(join(cwd, "package.json")).resolve("obix-core/package.json")),
      "dist",
    );
  } catch {
    /* app may not depend on obix-core directly; import map still points somewhere harmless */
  }

  async function transpileTs(file: string): Promise<string> {
    const src = await readFile(file, "utf8");
    const out = await esbuild.transform(src, {
      loader: "ts",
      format: "esm",
      target: "es2022",
      sourcemap: "inline",
      sourcefile: file,
    });
    return out.code;
  }

  const server = createServer(async (req, res) => {
    const raw = (req.url ?? "/").split("?")[0]!;
    const urlPath = decodeURIComponent(raw);

    if (urlPath === "/__obix_reload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    try {
      let filePath: string;
      if (urlPath.startsWith("/__obix/obix-core/")) {
        if (!coreDist) {
          res.writeHead(404).end("obix-core not resolvable");
          return;
        }
        filePath = normalize(join(coreDist, urlPath.slice("/__obix/obix-core/".length)));
        if (!filePath.startsWith(coreDist)) {
          res.writeHead(403).end();
          return;
        }
      } else {
        filePath = normalize(join(cwd, urlPath === "/" ? "index.html" : urlPath));
        if (!filePath.startsWith(cwd)) {
          res.writeHead(403).end();
          return;
        }
        try {
          if ((await stat(filePath)).isDirectory()) filePath = join(filePath, "index.html");
        } catch {
          // .js request that only exists as .ts on disk
          if (extname(filePath) === ".js") filePath = filePath.slice(0, -3) + ".ts";
        }
      }

      const ext = extname(filePath);
      if (ext === ".ts") {
        const code = await transpileTs(filePath);
        res.writeHead(200, { "Content-Type": MIME[".js"]! });
        res.end(code);
        return;
      }

      let body = await readFile(filePath);
      // Only the entry document gets the import map + live-reload shim.
      // Component `.html` templates (fetched by obix-core) are served verbatim.
      const isEntryDoc = ext === ".html" && (urlPath === "/" || /\/index\.html$/.test(urlPath));
      if (isEntryDoc) {
        let text = body.toString();
        text = text.includes("<head>")
          ? text.replace("<head>", "<head>\n" + IMPORT_MAP)
          : IMPORT_MAP + text;
        text = text.includes("</body>") ? text.replace("</body>", RELOAD + "</body>") : text + RELOAD;
        body = Buffer.from(text);
      }
      res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
    }
  });

  const watcher = watch(cwd, { recursive: true }, (_evt, filename) => {
    const f = String(filename ?? "");
    if (f.includes("node_modules") || f.startsWith("dist")) return;
    for (const c of clients) c.write("data: reload\n\n");
  });

  await new Promise<void>((r) => server.listen(port, r));

  return {
    ok: true,
    message: `obix dev → http://localhost:${port}   (serving ${cwd})`,
    data: {
      port,
      close: () =>
        new Promise<void>((r) => {
          watcher.close();
          for (const c of clients) c.end();
          server.close(() => r());
        }),
    },
  };
}
