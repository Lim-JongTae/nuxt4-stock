import path from 'path';
import fs from 'fs';

// Helper to read .env
export function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        const key = parts[0]?.trim();
        if (key && parts.length >= 2) {
          env[key] = parts.slice(1).join('=').trim();
        }
      }
    });
  }
  return env;
}

const tokenCacheMap = new Map<string, { token: string; expiresAt: number }>();

// Helper to clean and parse number safely from LS API strings (preserves negative signs)
export function parseLSNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  const str = String(val).replace(/[,+\s]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Helper to return undefined for empty/null values while preserving valid 0 and negative signs
export function parseLSNumberOrUndefined(val: any): number | undefined {
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  const str = String(val).replace(/[,+\s]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? undefined : num;
}

// Domestic Korean Stock Code Validation (Must be exactly 6 characters, e.g. 005930, 0186L0)
export function sanitizeDomesticShcode(shcode: string): string | null {
  if (!shcode) return null;
  const cleaned = String(shcode).trim().replace(/^A/i, '');
  if (cleaned.startsWith('US') || cleaned.length !== 6) {
    return null;
  }
  return cleaned;
}

// Helper to format Date to YYYYMMDD
export function formatDateYYYYMMDD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

// OAuth2 Token Fetcher for LS Securities API (Support multi-account with Map cache)
export async function getLSToken(appKey: string, appSecret: string): Promise<{ token: string | null; error: string | null }> {
  if (!appKey || !appSecret) {
    return { token: null, error: 'LS_APP_KEY 또는 LS_SECREAT 환경변수가 .env에 설정되어 있지 않습니다.' };
  }

  const cacheKey = `${appKey.trim()}:${appSecret.trim()}`;
  const cached = tokenCacheMap.get(cacheKey);

  if (cached && cached.expiresAt - 60_000 > Date.now()) {
    return { token: cached.token, error: null };
  }

  const urls = [
    'https://openapi.ls-sec.co.kr:8080/oauth2/token',
    'https://openapi.ls-sec.co.kr/oauth2/token'
  ];

  let lastErr = '';
  for (const url of urls) {
    try {
      const bodyParams = new URLSearchParams({
        grant_type: 'client_credentials',
        appkey: appKey,
        appsecretkey: appSecret,
        scope: 'oob'
      });
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
        signal: AbortSignal.timeout(8000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          const expiresInMs = (Number(data.expires_in) || 300) * 1000;
          tokenCacheMap.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + expiresInMs });
          return { token: data.access_token, error: null };
        }
      } else {
        const text = await response.text().catch(() => '');
        lastErr = `HTTP ${response.status}: ${text.slice(0, 200)}`;
      }
    } catch (e: any) {
      lastErr = e.message || String(e);
    }
  }
  return { token: null, error: `LS증권 OAuth 토큰 발급 실패 (${lastErr})` };
}

export const getLSOAuthToken = getLSToken;
