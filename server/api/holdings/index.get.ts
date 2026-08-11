import { db } from '../../db';
import { holdings } from '../../db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (key) env[key] = val;
        }
      }
    });
  }
  return env;
}

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

async function getLSPrice(token: string, shcode: string): Promise<number | null> {
  try {
    const rawCode = shcode.replace(/^A/, '');
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
        if (price > 0) return price;
      }
    }
  } catch (e) {}
  return null;
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

export default defineEventHandler(async () => {
  const env = loadEnv();
  const token = await getLSToken(env.LS_APP_KEY || '', env.LS_SECREAT || '');

  // 1. Initial Sync from report JSON if DB empty or required
  try {
    const reportDir = path.resolve(process.cwd(), 'report');
    if (fs.existsSync(reportDir)) {
      const files = fs.readdirSync(reportDir)
        .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .sort()
        .reverse();

      if (files.length > 0 && files[0]) {
        const latestFile = path.join(reportDir, files[0]);
        const content = fs.readFileSync(latestFile, 'utf-8');
        const json = JSON.parse(content);

        if (json && Array.isArray(json.holdings) && json.holdings.length > 0) {
          const now = new Date();
          const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

          db.delete(holdings).run();

          for (const item of json.holdings) {
            const shcode = item.name.includes('로봇') ? '0186L0' : item.name.includes('우주') ? '0167Z0' : item.shcode || 'UNKNOWN';
            const industry = item.name.includes('로봇') ? '인공지능/피지컬AI' : item.name.includes('우주') ? '우주항공/방산' : '주요보유';
            const avgPrice = parseNumber(item.avgPrice);
            const currentPrice = parseNumber(item.currentPrice);
            const quantity = parseNumber(item.quantity);

            db.insert(holdings).values({
              shcode,
              name: item.name,
              industry,
              quantity,
              avgPrice,
              currentPrice,
              targetPrice: Math.round(avgPrice * 1.08),
              stopLossPrice: Math.round(avgPrice * 0.955),
              updatedAt: kstTime
            }).run();
          }
        }
      }
    }
  } catch (err) {
    console.error('Error syncing holdings from report:', err);
  }

  // 2. Real-time Price Update via LS Securities Open API
  const items = await db.select().from(holdings).all();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const localTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (LS증권 API)`;

  if (token && items.length > 0) {
    for (const item of items) {
      const livePrice = await getLSPrice(token, item.shcode);
      if (livePrice && livePrice > 0) {
        item.currentPrice = livePrice;
        item.updatedAt = localTime;
        db.update(holdings)
          .set({ currentPrice: livePrice, updatedAt: localTime })
          .where(eq(holdings.shcode, item.shcode))
          .run();
      }
    }
  }

  return items;
});


