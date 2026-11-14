import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Cookie } from 'playwright';

/**
 * Raw cookie shape produced by Chrome extensions (EditThisCookie, Cookie-Editor, etc.)
 * or Playwright storageState exports.
 */
export interface RawExtensionCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expirationDate?: number;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string | null;
  session?: boolean;
  hostOnly?: boolean;
  storeId?: string;
}

export interface StorageStateLike {
  cookies: RawExtensionCookie[];
  origins?: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

export interface LoadedSession {
  source: string;
  cookies: Cookie[];
  presentAuthTokens: string[];
  missingAuthTokens: string[];
}

export const REQUIRED_GOOGLE_AUTH_TOKENS = [
  '__Secure-1PSID',
  '__Secure-3PSID',
  'SAPISID',
  'SID',
] as const;

export const DEFAULT_COOKIE_PATHS = [
  '.secrets/cookies.json',
  'auth_cookies.json',
] as const;

/**
 * Maps Chrome extension `sameSite` values (`unspecified`, `no_restriction`, `lax`, `strict`)
 * to Playwright's `None | Lax | Strict`.
 */
export function normalizeSameSite(
  rawSameSite?: string | null,
): 'None' | 'Lax' | 'Strict' {
  if (!rawSameSite) {
    return 'None';
  }
  const lowered = rawSameSite.toLowerCase();
  if (lowered === 'no_restriction' || lowered === 'none') {
    return 'None';
  }
  if (lowered === 'lax') {
    return 'Lax';
  }
  if (lowered === 'strict') {
    return 'Strict';
  }
  return 'None';
}

/**
 * Converts raw extension cookies into Playwright `BrowserContext.addCookies()` format.
 */
export function normalizeCookies(rawCookies: RawExtensionCookie[]): Cookie[] {
  return rawCookies
    .filter((c) => Boolean(c && c.name && c.domain))
    .map((c) => {
      const expiresCandidate =
        typeof c.expirationDate === 'number'
          ? c.expirationDate
          : typeof c.expires === 'number'
            ? c.expires
            : -1;

      return {
        name: c.name,
        value: c.value ?? '',
        domain: c.domain,
        path: c.path || '/',
        expires: Number.isFinite(expiresCandidate) ? expiresCandidate : -1,
        httpOnly: Boolean(c.httpOnly),
        secure: Boolean(c.secure),
        sameSite: normalizeSameSite(c.sameSite),
      };
    });
}

/**
 * Parses either a JSON array of cookies, a Playwright storageState object,
 * or a base64-encoded JSON payload of either shape.
 */
export function parseCookiePayload(rawContent: string): RawExtensionCookie[] {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    throw new Error('Cookie payload is empty.');
  }

  let jsonText = trimmed;
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
    if (!decoded.startsWith('[') && !decoded.startsWith('{')) {
      throw new Error(
        'Cookie payload is neither valid JSON nor base64-encoded JSON.',
      );
    }
    jsonText = decoded;
  }

  const parsed = JSON.parse(jsonText) as RawExtensionCookie[] | StorageStateLike;
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.cookies)) {
    return parsed.cookies;
  }

  throw new Error(
    'Parsed cookie JSON must be an array or an object with a `cookies` array.',
  );
}

/**
 * Checks presence of critical Google Workspace / Google Labs SSO session cookies.
 */
export function inspectAuthTokens(cookies: Cookie[]): {
  presentAuthTokens: string[];
  missingAuthTokens: string[];
} {
  const names = new Set(cookies.map((c) => c.name));
  const presentAuthTokens: string[] = [];
  const missingAuthTokens: string[] = [];

  for (const token of REQUIRED_GOOGLE_AUTH_TOKENS) {
    if (names.has(token)) {
      presentAuthTokens.push(token);
    } else {
      missingAuthTokens.push(token);
    }
  }

  return { presentAuthTokens, missingAuthTokens };
}

/**
 * Loads and normalizes session cookies from:
 * 1. Explicit file path or `.secrets/cookies.json` / `auth_cookies.json`
 * 2. `process.env.POMELLI_AUTH_SESSION`
 */
export function loadNormalizedCookies(options?: {
  cookieFilePath?: string;
  cwd?: string;
}): LoadedSession {
  const cwd = options?.cwd ?? process.cwd();
  const candidatePaths = options?.cookieFilePath
    ? [options.cookieFilePath]
    : [...DEFAULT_COOKIE_PATHS];

  for (const relOrAbsPath of candidatePaths) {
    const resolved = path.isAbsolute(relOrAbsPath)
      ? relOrAbsPath
      : path.resolve(cwd, relOrAbsPath);

    if (fs.existsSync(resolved)) {
      const content = fs.readFileSync(resolved, 'utf8');
      const rawCookies = parseCookiePayload(content);
      const cookies = normalizeCookies(rawCookies);
      const { presentAuthTokens, missingAuthTokens } =
        inspectAuthTokens(cookies);

      return {
        source: `file:${path.relative(cwd, resolved) || resolved}`,
        cookies,
        presentAuthTokens,
        missingAuthTokens,
      };
    }
  }

  const envPayload = process.env.POMELLI_AUTH_SESSION;
  if (envPayload && envPayload.trim().length > 0) {
    const rawCookies = parseCookiePayload(envPayload);
    const cookies = normalizeCookies(rawCookies);
    const { presentAuthTokens, missingAuthTokens } =
      inspectAuthTokens(cookies);

    return {
      source: 'env:POMELLI_AUTH_SESSION',
      cookies,
      presentAuthTokens,
      missingAuthTokens,
    };
  }

  throw new Error(
    `No Pomelli session cookies found. Provide .secrets/cookies.json, auth_cookies.json, or POMELLI_AUTH_SESSION.`,
  );
}

/**
 * Injects normalized session cookies into a Playwright BrowserContext.
 * Falls back to per-cookie insertion if Chromium rejects an individual non-secure SameSite=None cookie.
 */
export async function injectSessionCookies(
  context: BrowserContext,
  options?: { cookieFilePath?: string; cwd?: string },
): Promise<LoadedSession> {
  const session = loadNormalizedCookies(options);

  if (session.missingAuthTokens.length > 0) {
    console.warn(
      `[auth] Warning: missing Google SSO tokens (${session.missingAuthTokens.join(', ')}) from ${session.source}.`,
    );
  } else {
    console.log(
      `[auth] Loaded ${session.cookies.length} cookies from ${session.source} (all primary Google SSO tokens present).`,
    );
  }

  try {
    await context.addCookies(session.cookies);
  } catch (batchErr) {
    // Chromium rejects SameSite=None cookies if secure=false; adjust only offending cookies when needed.
    const sanitized = session.cookies.map((cookie) =>
      cookie.sameSite === 'None' && !cookie.secure
        ? { ...cookie, sameSite: 'Lax' as const }
        : cookie,
    );
    try {
      await context.addCookies(sanitized);
    } catch {
      throw batchErr;
    }
  }

  return session;
}

/**
 * Persists the current BrowserContext storage state (cookies + localStorage) to disk
 * for seamless session reuse across runs.
 */
export async function saveStorageState(
  context: BrowserContext,
  outputPath = 'auth_cookies.json',
): Promise<string> {
  const resolved = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(process.cwd(), outputPath);

  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  await context.storageState({ path: resolved });
  return resolved;
}
