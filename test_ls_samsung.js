import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts[0] && parts.length >= 2) {
          env[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      }
    });
  }
  return env;
}

async function run() {
  const env = loadEnv();
  console.log('LS_APP_KEY:', env.LS_APP_KEY ? 'EXISTS' : 'MISSING');
  console.log('LS_SECREAT:', env.LS_SECREAT ? 'EXISTS' : 'MISSING');

  if (!env.LS_APP_KEY || !env.LS_SECREAT) {
    console.error('Environment variables missing!');
    return;
  }

  // 1. Token
  const tokenRes = await fetch('https://openapi.ls-sec.co.kr/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      appkey: env.LS_APP_KEY,
      appsecretkey: env.LS_SECREAT,
      scope: 'oob'
    }).toString()
  });

  const tokenData = await tokenRes.json();
  console.log('Token response:', tokenData);
  const token = tokenData.access_token;
  if (!token) return;

  // 2. t1102 Current price for 005930
  const t1102Res = await fetch('https://openapi.ls-sec.co.kr/stock/market-data', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'authorization': 'Bearer ' + token,
      'tr_cd': 't1102',
      'tr_cont': 'N'
    },
    body: JSON.stringify({ t1102InBlock: { shcode: '005930' } })
  });

  const t1102Data = await t1102Res.json();
  console.log('\n--- LS API t1102 (삼성전자 005930 현재가) Raw Response ---');
  console.dir(t1102Data, { depth: null });

  // 3. t1305 Daily prices for 005930
  const t1305Res = await fetch('https://openapi.ls-sec.co.kr/stock/chart', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'authorization': 'Bearer ' + token,
      'tr_cd': 't1305',
      'tr_cont': 'N'
    },
    body: JSON.stringify({
      t1305InBlock: {
        shcode: '005930',
        dwmcode: '1',
        date: '',
        idx: '',
        cnt: 10,
        exchgubun: 'U'
      }
    })
  });

  const t1305Data = await t1305Res.json();
  console.log('\n--- LS API t1305 (삼성전자 005930 일봉) Raw Response ---');
  console.dir(t1305Data, { depth: null });

  // 4. t1927 Short sell for 005930
  const t1927Res = await fetch('https://openapi.ls-sec.co.kr/stock/etc', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'authorization': 'Bearer ' + token,
      'tr_cd': 't1927',
      'tr_cont': 'N'
    },
    body: JSON.stringify({
      t1927InBlock: {
        shcode: '005930',
        sdate: '20260715',
        edate: '20260816'
      }
    })
  });

  const t1927Data = await t1927Res.json();
  console.log('\n--- LS API t1927 (삼성전자 005930 공매도) Raw Response ---');
  console.dir(t1927Data, { depth: null });
}

run().catch(console.error);
