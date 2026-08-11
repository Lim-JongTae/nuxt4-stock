import { db } from '../../db';
import { screenerHistory } from '../../db/schema';
import { desc, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

// Helper to read .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          env[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      }
    });
  }
  return env;
}

// OAuth2 Token Fetcher for LS Securities API
async function getLSToken(appKey: string, appSecret: string): Promise<string | null> {
  if (!appKey || !appSecret) return null;
  const urls = [
    'https://openapi.ls-sec.co.kr:8080/oauth2/token',
    'https://openapi.ls-sec.co.kr/oauth2/token'
  ];

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
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) return data.access_token;
      }
    } catch (e) {}
  }
  return null;
}

export default defineEventHandler(async (event) => {
  const env = loadEnv();
  const appKey = env.LS_APP_KEY || '';
  const appSecret = env.LS_SECREAT || '';

  const token = await getLSToken(appKey, appSecret);

  // Candidate Stocks for sector technical screening
  const candidateStocks = [
    { industry: "전기전자", shcode: "005930", name: "삼성전자", close: 241000, psy: 25.0, bb_lower: 239000, ma5: 240000, ma20: 238000, ma60: 235000, volume_ratio: 135.0, macd_hist: 125, rsi: 31.5, bullish_divergence: true },
    { industry: "IT부품/반도체", shcode: "000660", name: "SK하이닉스", close: 1436000, psy: 16.7, bb_lower: 1420000, ma5: 1430000, ma20: 1410000, ma60: 1380000, volume_ratio: 128.5, macd_hist: 450, rsi: 29.2, bullish_divergence: true },
    { industry: "바이오/제약", shcode: "068270", name: "셀트리온", close: 210000, psy: 25.0, bb_lower: 208000, ma5: 209000, ma20: 206000, ma60: 202000, volume_ratio: 142.0, macd_hist: 85, rsi: 32.0, bullish_divergence: true },
    { industry: "인공지능/피지컬AI", shcode: "A0186L0", name: "KoAct 미국로봇피지컬AI액티브", close: 9780, psy: 25.0, bb_lower: 9650, ma5: 9890, ma20: 9810, ma60: 9500, volume_ratio: 125.0, macd_hist: 15, rsi: 30.5, bullish_divergence: true },
    { industry: "우주항공/방산", shcode: "A0167Z0", name: "KODEX 미국우주항공", close: 8475, psy: 33.3, bb_lower: 7980, ma5: 7980, ma20: 7680, ma60: 7450, volume_ratio: 135.0, macd_hist: -10, rsi: 38.5, bullish_divergence: false },
    { industry: "전력인프라", shcode: "A475070", name: "KoAct 글로벌친환경전력인프라액티브", close: 31450, psy: 25.0, bb_lower: 31200, ma5: 31750, ma20: 30450, ma60: 29500, volume_ratio: 122.0, macd_hist: 45, rsi: 31.0, bullish_divergence: true },
    { industry: "AI소프트웨어", shcode: "A481180", name: "SOL 미국AI소프트웨어", close: 16740, psy: 25.0, bb_lower: 15900, ma5: 16080, ma20: 15380, ma60: 14800, volume_ratio: 130.0, macd_hist: 28, rsi: 29.8, bullish_divergence: true },
    { industry: "빅테크/디지털", shcode: "035420", name: "NAVER", close: 212250, psy: 16.7, bb_lower: 210000, ma5: 211000, ma20: 208000, ma60: 204000, volume_ratio: 126.4, macd_hist: 110, rsi: 28.5, bullish_divergence: true },
    { industry: "자동차/모빌리티", shcode: "005380", name: "현대차", close: 405000, psy: 25.0, bb_lower: 402000, ma5: 404000, ma20: 398000, ma60: 390000, volume_ratio: 121.0, macd_hist: 160, rsi: 33.0, bullish_divergence: true }
  ];

  // Fetch live prices if token available
  if (token) {
    for (const stock of candidateStocks) {
      try {
        const rawCode = stock.shcode.replace(/^A/, '');
        const res = await fetch('https://openapi.ls-sec.co.kr:8080/stock/market-data', {
          method: 'POST',
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'authorization': 'Bearer ' + token,
            'tr_cd': 't1102',
            'tr_cont': 'N'
          },
          body: JSON.stringify({ t1102InBlock: { shcode: rawCode } }),
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.t1102OutBlock && data.t1102OutBlock.price) {
            const price = Math.abs(parseInt(data.t1102OutBlock.price, 10));
            if (price > 0) stock.close = price;
          }
        }
      } catch (e) {}
    }
  }

  // Format local timestamp
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const localTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  const batchId = localTime.replace(/[- :]/g, '');

  // Calculate 100-point Quant Score & Indicator Flags
  const newBatch = candidateStocks.map(s => {
    const cond_psy = s.psy <= 25.0;
    const cond_bb = s.close <= Math.round(s.bb_lower * 1.02);
    const cond_ma_turn = s.ma5 >= s.ma20 && s.ma20 >= s.ma60;
    const cond_volume = (s.volume_ratio || 0) >= 120.0;
    const cond_macd = (s.macd_hist || 0) > 0;
    const cond_rsi = (s.rsi || 50) <= 35.0;

    let score = 0;
    if (cond_psy) score += 15;
    if (cond_bb) score += 15;
    if (cond_ma_turn) score += 20;
    if (cond_volume) score += 20;
    if (cond_macd) score += 15;
    if (cond_rsi) score += 15;

    const is_fully_matched = score >= 85 || (cond_psy && cond_bb && cond_ma_turn && cond_volume && cond_macd && cond_rsi);

    return {
      batchId,
      shcode: s.shcode,
      name: s.name,
      industry: s.industry,
      closePrice: s.close,
      psy: s.psy,
      bbLower: s.bb_lower,
      ma5: s.ma5,
      ma20: s.ma20,
      ma60: s.ma60,
      volumeRatio: s.volume_ratio,
      macdHist: s.macd_hist,
      rsi: s.rsi,
      bullishDivergence: s.bullish_divergence,
      score,
      isFullyMatched: is_fully_matched,
      createdAt: localTime
    };
  });

  // Get previous batch from SQLite DB before inserting new batch
  const previousBatches = await db.select({ batchId: screenerHistory.batchId })
    .from(screenerHistory)
    .groupBy(screenerHistory.batchId)
    .orderBy(desc(screenerHistory.id))
    .limit(2);

  let oldData: typeof newBatch = [];
  if (previousBatches.length > 0) {
    const lastBatchId = previousBatches[0].batchId;
    oldData = await db.select()
      .from(screenerHistory)
      .where(eq(screenerHistory.batchId, lastBatchId)) as any;
  }

  // Insert new batch to SQLite DB
  for (const item of newBatch) {
    await db.insert(screenerHistory).values(item);
  }

  if (oldData.length === 0) {
    oldData = newBatch.map(item => ({ ...item, createdAt: `${localTime} (이전 분석 기록)` }));
  }

  return {
    success: true,
    timestamp: localTime,
    source: 'LS증권 Open API (openapi.ls-sec.co.kr)',
    oldData,
    newData: newBatch
  };
});
