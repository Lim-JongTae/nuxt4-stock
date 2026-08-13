import path from 'path';
import fs from 'fs';
import { type ShortSellRecord } from './shortSellSignal';

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

let cachedToken: { token: string; expiresAt: number } | null = null;

// Helper to clean and parse number safely from LS API strings
function parseLSNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  const str = String(val).replace(/[,+\s]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

// Helper to return undefined for empty/null values while preserving valid 0
function parseLSNumberOrUndefined(val: any): number | undefined {
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  const str = String(val).replace(/[,+\s]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? undefined : Math.abs(num);
}

// Domestic Korean Stock Code Validation (Must be exactly 6 characters, e.g. 005930, 0186L0)
function sanitizeDomesticShcode(shcode: string): string | null {
  if (!shcode) return null;
  const cleaned = String(shcode).trim().replace(/^A/i, '');
  if (cleaned.startsWith('US') || cleaned.length !== 6) {
    return null;
  }
  return cleaned;
}

// OAuth2 Token Fetcher for LS Securities API
export async function getLSToken(appKey: string, appSecret: string): Promise<{ token: string | null; error: string | null }> {
  if (!appKey || !appSecret) {
    return { token: null, error: 'LS_APP_KEY 또는 LS_SECREAT 환경변수가 .env에 설정되어 있지 않습니다.' };
  }

  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return { token: cachedToken.token, error: null };
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
          cachedToken = { token: data.access_token, expiresAt: Date.now() + expiresInMs };
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

// 1. Fetch Current Stock Price via LS API (t1102 - /stock/market-data)
export async function fetchLSPrice(token: string, shcode: string): Promise<number | null> {
  const rawCode = sanitizeDomesticShcode(shcode);
  if (!rawCode) return null;

  const urls = [
    'https://openapi.ls-sec.co.kr:8080/stock/market-data',
    'https://openapi.ls-sec.co.kr/stock/market-data'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'authorization': 'Bearer ' + token,
          'tr_cd': 't1102',
          'tr_cont': 'N'
        },
        body: JSON.stringify({ t1102InBlock: { shcode: rawCode } }),
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.t1102OutBlock && data.t1102OutBlock.price) {
          const price = parseLSNumber(data.t1102OutBlock.price);
          if (price > 0) return price;
        }
      }
    } catch (e: any) {}
  }
  return null;
}

// 2. Fetch Stock Daily Prices via LS API (t1305 기간별주가 TR - /stock/market-data, exchgubun: 'U' 통합시세 KRX+NXT)
export async function fetchLST1305Prices(
  token: string,
  shcode: string,
  externalLivePrice?: number | null
): Promise<Map<string, { close: number; open: number; high: number; low: number; volume: number; change?: number; diff?: number }> | null> {
  const rawCode = sanitizeDomesticShcode(shcode);
  if (!rawCode) return null;

  const htsMap = new Map<string, { close: number; open: number; high: number; low: number; volume: number; change?: number; diff?: number }>();

  const urls = [
    'https://openapi.ls-sec.co.kr:8080/stock/market-data',
    'https://openapi.ls-sec.co.kr/stock/market-data'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'authorization': 'Bearer ' + token,
          'tr_cd': 't1305',
          'tr_cont': 'N'
        },
        body: JSON.stringify({
          t1305InBlock: {
            shcode: rawCode,
            dwmcode: 1, // 1@일
            date: '',
            idx: 0,
            cnt: 15,   // 과거 15개 일봉 수집
            exchgubun: 'U' // U: 통합 (KRX 정규장 + NXT 대체거래소 통합 HTS 수치 100% 일치)
          }
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const data = await res.json();
        const rows = data.t1305OutBlock1 || data.t1305OutBlock;
        if (Array.isArray(rows) && rows.length > 0) {
          rows.forEach((r: any) => {
            const rawDate = String(r.date || '').trim();
            const formattedDate = rawDate.length === 8 
              ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
              : rawDate;
            const closePrice = parseLSNumber(r.close);
            const openPrice = parseLSNumber(r.open);
            const highPrice = parseLSNumber(r.high);
            const lowPrice = parseLSNumber(r.low);
            const volume = parseLSNumber(r.volume);
            const change = parseLSNumber(r.change);
            const diff = parseFloat(String(r.diff || 0));

            if (formattedDate && closePrice > 0) {
              htsMap.set(formattedDate, {
                close: closePrice,
                open: openPrice,
                high: highPrice,
                low: lowPrice,
                volume,
                change,
                diff
              });
            }
          });

          // 오늘 날짜 데이터는 t1102 라이브 실시간가가 전달되면 덮어씀
          if (externalLivePrice && externalLivePrice > 0) {
            const todayStr = formatDateYYYYMMDD(new Date());
            const formattedToday = `${todayStr.slice(0, 4)}-${todayStr.slice(4, 6)}-${todayStr.slice(6, 8)}`;
            const existing = htsMap.get(formattedToday);
            if (existing) {
              htsMap.set(formattedToday, {
                ...existing,
                close: externalLivePrice
              });
            }
          }

          if (htsMap.size > 0) return htsMap;
        }
      }
    } catch (e: any) {}
  }
  return null;
}

export const fetchLST8410SujungPrices = fetchLST1305Prices;
export const fetchLSHtsPeriodicalPrices = fetchLST1305Prices;

// 3. Fetch Short Selling Details via LS API (t1927) - 공매도 전용 지표만 수집
export async function fetchLSShortSellDetailMap(
  token: string,
  shcode: string
): Promise<Map<string, { balanceRatio: number; shortAvgPrice: number }>> {
  const detailMap = new Map<string, { balanceRatio: number; shortAvgPrice: number }>();
  const rawCode = sanitizeDomesticShcode(shcode);
  if (!rawCode) return detailMap;

  const now = new Date();
  const edate = formatDateYYYYMMDD(now);
  const past = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
  const sdate = formatDateYYYYMMDD(past);

  const urls = [
    'https://openapi.ls-sec.co.kr:8080/stock/etc',
    'https://openapi.ls-sec.co.kr/stock/etc'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'authorization': 'Bearer ' + token,
          'tr_cd': 't1927',
          'tr_cont': 'N'
        },
        body: JSON.stringify({
          t1927InBlock: {
            shcode: rawCode,
            sdate: sdate,
            edate: edate
          }
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const data = await res.json();
        const rows = data.t1927OutBlock1 || data.t1927OutBlock;
        if (Array.isArray(rows) && rows.length > 0) {
          rows.forEach((r: any) => {
            const rawDate = String(r.date || '').trim();
            const formattedDate = rawDate.length === 8 
              ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
              : rawDate;
            
            const balanceRatio = parseLSNumberOrUndefined(r.gm_per) ?? parseLSNumberOrUndefined(r.ms_m_rate) ?? parseLSNumberOrUndefined(r.ms_rate) ?? 0;
            const shortAvgPrice = parseLSNumberOrUndefined(r.gm_avg) ?? parseLSNumberOrUndefined(r.price) ?? 0;

            if (formattedDate) {
              detailMap.set(formattedDate, { balanceRatio, shortAvgPrice });
            }
          });
          if (detailMap.size > 0) break;
        }
      }
    } catch (e: any) {}
  }
  return detailMap;
}

// 4. Fetch Short Selling Trend (t1305 주식 시세 + t1927 공매도 분리 결합)
export async function fetchLSShortSellTrend(
  token: string,
  shcode: string,
  externalLivePrice?: number | null
): Promise<ShortSellRecord[] | null> {
  const rawCode = sanitizeDomesticShcode(shcode);
  if (!rawCode) return null;

  try {
    const livePrice = externalLivePrice !== undefined ? externalLivePrice : await fetchLSPrice(token, shcode);
    const htsPriceMap = await fetchLST1305Prices(token, shcode, livePrice);
    const shortDetailMap = await fetchLSShortSellDetailMap(token, shcode);

    const todayStr = formatDateYYYYMMDD(new Date());
    const formattedToday = `${todayStr.slice(0, 4)}-${todayStr.slice(4, 6)}-${todayStr.slice(6, 8)}`;

    const allDates = new Set<string>([
      ...(htsPriceMap ? Array.from(htsPriceMap.keys()) : []),
      ...Array.from(shortDetailMap.keys())
    ]);

    if (allDates.size > 0) {
      const combinedRecords: ShortSellRecord[] = Array.from(allDates).map((date) => {
        const hts = htsPriceMap?.get(date);
        const shortDetail = shortDetailMap.get(date);

        // 시세 종가 및 거래량은 오직 t1305 원본에서 추출
        let price = hts?.close || 0;
        let volume = hts?.volume || 0;

        // 오늘 날짜 데이터는 t1102 라이브 실시간가로 덮어써서 메인 종가와 통일
        if (date === formattedToday && livePrice && livePrice > 0) {
          price = livePrice;
        }

        const shortAvgPrice = shortDetail?.shortAvgPrice ? shortDetail.shortAvgPrice : undefined;
        const balanceRatio = shortDetail?.balanceRatio ?? 0;

        return {
          date,
          price,
          volume,
          shortAvgPrice,
          balanceRatio
        };
      }).filter(r => r.price > 0);

      const sorted = combinedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return sorted.slice(0, 5);
    }
  } catch (e: any) {}
  return null;
}

function formatDateYYYYMMDD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}
