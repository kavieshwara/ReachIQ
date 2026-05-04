import dns from "node:dns";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js/dist/index.cjs");
const execFile = promisify(execFileCallback);

dns.setDefaultResultOrder?.("ipv4first");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseFetchTimeoutMs = Math.max(3000, Number(process.env.SUPABASE_FETCH_TIMEOUT_MS || 12000));

if (!supabaseUrl || !serviceKey) {
  console.warn("[ReachIQ] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend environment.");
}

async function fetchWithTimeout(input, init = {}) {
  const request = input instanceof Request ? input : null;
  const requestUrl = request ? request.url : String(input);
  const method = String(init.method || request?.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || request?.headers || {});
  let requestBody = init.body;

  try {
    if (requestBody === undefined && request) {
      requestBody = await request.clone().text();
    }

    const tempDir = await mkdtemp(path.join(tmpdir(), "reachiq-supabase-"));
    const headerPath = path.join(tempDir, "headers.txt");
    const curlCommand = process.platform === "win32" ? "curl.exe" : "curl";
    const timeoutSeconds = String(Math.max(3, Math.ceil(supabaseFetchTimeoutMs / 1000)));
    const args = [
      "--http1.1",
      "-sS",
      "-X",
      method,
      "--connect-timeout",
      "5",
      "--max-time",
      timeoutSeconds,
      "-D",
      headerPath,
      "-o",
      "-",
      requestUrl
    ];

    headers.forEach((value, key) => {
      args.push("-H", `${key}: ${value}`);
    });

    if (requestBody !== undefined && requestBody !== null && method !== "GET" && method !== "HEAD") {
      const bodyBuffer = Buffer.isBuffer(requestBody)
        ? requestBody
        : typeof requestBody === "string"
          ? Buffer.from(requestBody, "utf8")
          : requestBody instanceof URLSearchParams
            ? Buffer.from(requestBody.toString(), "utf8")
            : requestBody instanceof ArrayBuffer
              ? Buffer.from(requestBody)
              : ArrayBuffer.isView(requestBody)
                ? Buffer.from(requestBody.buffer, requestBody.byteOffset, requestBody.byteLength)
                : Buffer.from(String(requestBody), "utf8");

      const requestBodyPath = path.join(tempDir, "body.bin");
      await writeFile(requestBodyPath, bodyBuffer);
      args.push("--data-binary", `@${requestBodyPath}`);
    }

    try {
      const { stdout, stderr } = await execFile(curlCommand, args, {
        encoding: "buffer",
        maxBuffer: 10 * 1024 * 1024,
        timeout: supabaseFetchTimeoutMs + 1000,
        windowsHide: true
      });

      const headerText = await readFile(headerPath, "utf8");
      const statusMatches = [...headerText.matchAll(/HTTP\/\d(?:\.\d)?\s+(\d{3})/g)];
      const status = Number(statusMatches.at(-1)?.[1] || 200);
      const responseHeaders = new Headers();
      const headerLines = headerText.trim().split(/\r?\n/);
      for (const line of headerLines.slice(1)) {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex <= 0) {
          continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        responseHeaders.append(key, value);
      }

      if (stderr?.length) {
        const stderrText = stderr.toString("utf8").trim();
        if (stderrText) {
          responseHeaders.set("x-reachiq-curl-warning", stderrText);
        }
      }

      const responseBody = status === 204 || status === 205 || status === 304 ? null : stdout;

      return new Response(responseBody, {
        status,
        headers: responseHeaders
      });
    } catch (error) {
      if (error?.killed || error?.signal === "SIGTERM") {
        const timeoutError = new Error(`Supabase request timed out after ${supabaseFetchTimeoutMs}ms`);
        timeoutError.name = "SupabaseTimeoutError";
        throw timeoutError;
      }

      throw error;
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`Supabase request timed out after ${supabaseFetchTimeoutMs}ms`);
      timeoutError.name = "SupabaseTimeoutError";
      throw timeoutError;
    }

    throw error;
  }
}

const sharedOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    fetch: fetchWithTimeout
  }
};

export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  serviceKey || "placeholder",
  sharedOptions
);

export function getUserClient(accessToken) {
  return createClient(supabaseUrl || "https://placeholder.supabase.co", serviceKey || "placeholder", {
    ...sharedOptions,
    global: {
      ...sharedOptions.global,
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}
