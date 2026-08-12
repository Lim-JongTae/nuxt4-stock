import fs from 'fs';
import path from 'path';
import { defineEventHandler } from 'h3';

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
  const urls = ['https://openapi.ls-sec.co.kr:8080/oauth2/token', 'https://openapi.ls-sec.co.kr/oauth2/token'];
  for (const url of urls) {
    try {
      const bodyParams = new URLSearchParams({
        grant_type: 'client_credentials',
        appkey: appKey,
        appsecretkey: appSecret,
        scope: 'oob',
      });
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
        signal: AbortSignal.timeout(1500),
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
        'tr_cont': 'N',
      },
      body: JSON.stringify({ t1102InBlock: { shcode: rawCode } }),
      signal: AbortSignal.timeout(1500),
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

export default defineEventHandler(async () => {
  const env = loadEnv();
  const token = await getLSToken(env.LS_APP_KEY || '', env.LS_SECREAT || '');
  const dataPath = path.resolve(process.cwd(), 'data', 'watchlist.json');
  if (!fs.existsSync(dataPath)) {
    return { holdings: [], watchlist: [] };
  }
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const json = JSON.parse(raw);
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} (LS증권 API)`;
  if (token) {
    if (Array.isArray(json.holdings)) {
      for (const h of json.holdings) {
        const price = await getLSPrice(token, h.shcode);
        if (price !== null) {
          h.currentPrice = price;
          h.updatedAt = timestamp;
          h.targetPrice = Math.round(price * 1.08);
          h.stopLossPrice = Math.round(price * 0.955);
        }
      }
    }
    if (Array.isArray(json.watchlist)) {
      for (const w of json.watchlist) {
        const price = await getLSPrice(token, w.shcode);
        if (price !== null) {
          w.currentPrice = price;
          w.updatedAt = timestamp;
          w.targetPrice = Math.round(price * 1.08);
          w.stopLossPrice = Math.round(price * 0.955);
        }
      }
    }
  }
  return { holdings: json.holdings ?? [], watchlist: json.watchlist ?? [] };
});
