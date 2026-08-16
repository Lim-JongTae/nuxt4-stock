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

async function testHyundai() {
  const env = loadEnv();
  const tokenRes = await fetch('https://openapi.ls-sec.co.kr:8080/oauth2/token', {
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
  const token = tokenData.access_token;
  if (!token) return;

  const t1305Res = await fetch('https://openapi.ls-sec.co.kr:8080/stock/chart', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'authorization': 'Bearer ' + token,
      'tr_cd': 't8413',
      'tr_cont': 'N'
    },
    body: JSON.stringify({
      t8413InBlock: {
        shcode: '005380',
        gubun: '2',
        qrycnt: 5,
        sdate: '20260801',
        edate: '20260816',
        cts_date: '',
        comp_yn: 'N',
        exchgubun: 'U'
      }
    })
  });

  const t1305Data = await t1305Res.json();
  console.log('\n--- LS API t8413 (현대차 005380 exchgubun: U 통합종가) Response ---');
  console.dir(t1305Data.t8413OutBlock1 || t1305Data.t8413OutBlock, { depth: null });
}

testHyundai().catch(console.error);
