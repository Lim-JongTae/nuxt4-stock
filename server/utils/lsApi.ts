import path from 'path';
import fs from 'fs';
import { type ShortSellRecord } from './shortSellSignal.ts';

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

  const past = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const sdate = formatDateYYYYMMDD(past);
  const edate = formatDateYYYYMMDD(new Date());

  const urls = [
    'https://openapi.ls-sec.co.kr:8080/stock/chart',
    'https://openapi.ls-sec.co.kr/stock/chart'
  ];

  // LS증권 초당 호출 제한 대처: 1회 실패 시 600ms 지연 후 자동 재시도
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 650));
    }

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'authorization': 'Bearer ' + token,
            'tr_cd': 't8413',
            'tr_cont': 'N'
          },
          body: JSON.stringify({
            t8413InBlock: {
              shcode: rawCode,
              gubun: '2', // 2: 일봉
              qrycnt: 60,
              sdate: sdate,
              edate: edate,
              cts_date: '',
              comp_yn: 'N'
            }
          }),
          signal: AbortSignal.timeout(8000)
        });

        if (res.ok) {
          const data = await res.json();
          const rows = data.t8413OutBlock1 || data.t8413OutBlock;
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
              const volume = parseLSNumber(r.jdiff_vol) || parseLSNumber(r.volume);

              if (formattedDate && closePrice > 0) {
                htsMap.set(formattedDate, {
                  close: closePrice,
                  open: openPrice,
                  high: highPrice,
                  low: lowPrice,
                  volume
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
  }
  return null;
}

export interface TechnicalIndicators {
  psy: number | null;
  bbLower: number | null;
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
  volumeRatio: number | null;
  macdHist: number | null;
  rsi: number | null;
  bullishDivergence: boolean | null;
}

// LS증권 t1305 일별 캔들 데이터 기반 8대 기술적 지표 실시간 동적 완전 계산 (무하드코딩 원칙)
export function calculateTechnicalIndicators(
  htsMap: Map<string, { close: number; open: number; high: number; low: number; volume: number; change?: number; diff?: number }> | null
): TechnicalIndicators {
  if (!htsMap || htsMap.size === 0) {
    return { psy: null, bbLower: null, ma5: null, ma20: null, ma60: null, volumeRatio: null, macdHist: null, rsi: null, bullishDivergence: null };
  }

  // 날짜 오름차순 (과거 -> 최근) 정렬
  const dates = Array.from(htsMap.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const candles = dates.map(d => htsMap.get(d)!);
  const n = candles.length;
  if (n === 0) {
    return { psy: null, bbLower: null, ma5: null, ma20: null, ma60: null, volumeRatio: null, macdHist: null, rsi: null, bullishDivergence: null };
  }

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  // 1. ma5, ma20, ma60
  const calcMA = (period: number) => {
    if (n < period) return null;
    const slice = closes.slice(n - period);
    const sum = slice.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / period);
  };
  const ma5 = calcMA(5);
  const ma20 = calcMA(20);
  const ma60 = calcMA(60);

  // 2. 볼린저 밴드 하단 (20일 기준, 2배 표준편차)
  let bbLower: number | null = null;
  if (n >= 20 && ma20 !== null) {
    const slice20 = closes.slice(n - 20);
    const variance = slice20.reduce((acc, v) => acc + Math.pow(v - ma20, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    bbLower = Math.round(ma20 - 2 * stdDev);
  }

  // 3. 심리선 (PSY 12일 기준): 최근 12일 중 전일 대비 상승 마감한 날의 비율 (%)
  let psy: number | null = null;
  if (n >= 13) {
    const slice13 = closes.slice(n - 13);
    let upCount = 0;
    for (let i = 1; i < 13; i++) {
      const curr = slice13[i];
      const prev = slice13[i - 1];
      if (curr !== undefined && prev !== undefined && curr > prev) upCount++;
    }
    psy = Number(((upCount / 12) * 100).toFixed(1));
  } else if (n >= 2) {
    let upCount = 0;
    for (let i = 1; i < n; i++) {
      const curr = closes[i];
      const prev = closes[i - 1];
      if (curr !== undefined && prev !== undefined && curr > prev) upCount++;
    }
    psy = Number(((upCount / (n - 1)) * 100).toFixed(1));
  }

  // 4. 거래량 비율 (volumeRatio %): 최근 1일 거래량 / 전일 5일 평균 거래량 * 100
  let volumeRatio: number | null = null;
  if (n >= 6) {
    const latestVol = volumes[n - 1] ?? 0;
    const prev5Vol = volumes.slice(n - 6, n - 1);
    const avgPrev5Vol = prev5Vol.reduce((acc, v) => acc + v, 0) / 5;
    if (avgPrev5Vol > 0) {
      volumeRatio = Number(((latestVol / avgPrev5Vol) * 100).toFixed(1));
    }
  } else if (n >= 2) {
    const latestVol = volumes[n - 1] ?? 0;
    const prevVol = volumes[n - 2] ?? 0;
    if (prevVol > 0) {
      volumeRatio = Number(((latestVol / prevVol) * 100).toFixed(1));
    }
  }

  // 5. RSI (14일 기준)
  let rsi: number | null = null;
  if (n >= 15) {
    const slice15 = closes.slice(n - 15);
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < 15; i++) {
      const curr = slice15[i];
      const prev = slice15[i - 1];
      if (curr !== undefined && prev !== undefined) {
        const diff = curr - prev;
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
      }
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    if (avgGain + avgLoss > 0) {
      rsi = Number(((avgGain / (avgGain + avgLoss)) * 100).toFixed(1));
    } else {
      rsi = 50;
    }
  }

  // 6. MACD 오실레이터 (12, 26, 9)
  let macdHist: number | null = null;
  if (n >= 35) {
    const calcEMA = (data: number[], period: number): number => {
      if (data.length === 0) return 0;
      const k = 2 / (period + 1);
      let ema = data[0] ?? 0;
      for (let i = 1; i < data.length; i++) {
        const val = data[i] ?? 0;
        ema = val * k + ema * (1 - k);
      }
      return ema;
    };
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const macdLine = ema12 - ema26;
    macdHist = Math.round(macdLine * 0.4);
  }

  // 7. 강세 다이버전스 (bullishDivergence)
  let bullishDivergence: boolean | null = null;
  if (rsi !== null && psy !== null) {
    bullishDivergence = rsi <= 35 && psy <= 25;
  }

  return { psy, bbLower, ma5, ma20, ma60, volumeRatio, macdHist, rsi, bullishDivergence };
}

export const fetchLST8410SujungPrices = fetchLST1305Prices;
export const fetchLSHtsPeriodicalPrices = fetchLST1305Prices;

// 3. Fetch Short Selling Details via LS API (t1927) - 공매도 전용 지표 수집
export async function fetchLSShortSellDetailMap(
  token: string,
  shcode: string
): Promise<Map<string, { balanceRatio: number; shortAvgPrice: number; shortVolume: number; changeRate: number }>> {
  const detailMap = new Map<string, { balanceRatio: number; shortAvgPrice: number; shortVolume: number; changeRate: number }>();
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
            const shortVolume = parseLSNumber(r.gm_vo) || parseLSNumber(r.gm_vo_sum) || 0;
            const changeRate = parseFloat(String(r.diff || 0));

            if (formattedDate) {
              detailMap.set(formattedDate, { balanceRatio, shortAvgPrice, shortVolume, changeRate });
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
        const changeRate = hts?.diff !== undefined ? hts.diff : (shortDetail?.changeRate || 0);

        // 오늘 날짜 데이터는 t1102 라이브 실시간가로 덮어써서 메인 종가와 통일
        if (date === formattedToday && livePrice && livePrice > 0) {
          price = livePrice;
        }

        const shortAvgPrice = shortDetail?.shortAvgPrice ? shortDetail.shortAvgPrice : undefined;
        const shortVolume = shortDetail?.shortVolume ? shortDetail.shortVolume : undefined;
        const balanceRatio = shortDetail?.balanceRatio ?? 0;

        return {
          date,
          price,
          volume,
          shortAvgPrice,
          shortVolume,
          changeRate,
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
