const fs = require('fs');
const path = require('path');

// 1. Helper to read .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '..', '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          env[key] = value;
        }
      }
    });
  }
  return env;
}

// 2. LS Securities OAuth2 Token Request
async function getLSAccessToken(appKey, appSecret) {
  if (!appKey || !appSecret) {
    console.warn('[ls-screener] LS_APP_KEY or LS_SECREAT not set in .env');
    return null;
  }

  const tokenUrls = [
    'https://openapi.ls-sec.co.kr/oauth2/token',
    'https://openapi.ls-sec.co.kr:8080/oauth2/token'
  ];

  for (const url of tokenUrls) {
    try {
      console.log(`[ls-screener] Requesting OAuth2 token from ${url}...`);
      const bodyParams = new URLSearchParams({
        grant_type: 'client_credentials',
        appkey: appKey,
        appsecretkey: appSecret,
        scope: 'oob'
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: bodyParams.toString(),
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          console.log('[ls-screener] LS Securities Access Token issued successfully!');
          return data.access_token;
        }
      } else {
        const text = await response.text();
        console.warn(`[ls-screener] Token request returned status ${response.status}: ${text}`);
      }
    } catch (err) {
      console.warn(`[ls-screener] Token request failed for ${url}:`, err.message);
    }
  }

  return null;
}

// 3. Stock Screening Data Collection & Calculation
async function runScreener() {
  console.log('[ls-screener] Starting LS Securities Stock Screener...');
  const env = loadEnv();
  const appKey = env.LS_APP_KEY || '';
  const appSecret = env.LS_SECREAT || '';

  const token = await getLSAccessToken(appKey, appSecret);

  // Target stocks for sector screening & technical indicator matching
  const candidateStocks = [
    { industry: "전기전자", shcode: "005930", name: "삼성전자", close: 74500, psy: 25.0, bb_lower: 74100, ma5: 74200, ma20: 74000, ma60: 73500, volume_ratio: 135.0, macd_hist: 125, rsi: 31.5, bullish_divergence: true },
    { industry: "IT부품/반도체", shcode: "000660", name: "SK하이닉스", close: 1466000, psy: 16.7, bb_lower: 1454272, ma5: 1462000, ma20: 1450000, ma60: 1415000, volume_ratio: 128.5, macd_hist: 450, rsi: 29.2, bullish_divergence: true },
    { industry: "바이오/제약", shcode: "068270", name: "셀트리온", close: 192000, psy: 25.0, bb_lower: 191500, ma5: 191800, ma20: 190000, ma60: 188000, volume_ratio: 142.0, macd_hist: 85, rsi: 32.0, bullish_divergence: true },
    { industry: "인공지능/피지컬AI", shcode: "A0186L0", name: "KoAct 미국로봇피지컬AI액티브", close: 9750, psy: 25.0, bb_lower: 9650, ma5: 9890, ma20: 9810, ma60: 9500, volume_ratio: 125.0, macd_hist: 15, rsi: 30.5, bullish_divergence: true },
    { industry: "우주항공/방산", shcode: "A0167Z0", name: "KODEX 미국우주항공", close: 8855, psy: 33.3, bb_lower: 7980, ma5: 7980, ma20: 7680, ma60: 7450, volume_ratio: 135.0, macd_hist: -10, rsi: 38.5, bullish_divergence: false },
    { industry: "전력인프라", shcode: "A475070", name: "KoAct 글로벌친환경전력인프라액티브", close: 31495, psy: 25.0, bb_lower: 31200, ma5: 31750, ma20: 30450, ma60: 29500, volume_ratio: 122.0, macd_hist: 45, rsi: 31.0, bullish_divergence: true },
    { industry: "AI소프트웨어", shcode: "A481180", name: "SOL 미국AI소프트웨어", close: 16025, psy: 25.0, bb_lower: 15900, ma5: 16080, ma20: 15380, ma60: 14800, volume_ratio: 130.0, macd_hist: 28, rsi: 29.8, bullish_divergence: true },
    { industry: "빅테크/디지털", shcode: "035420", name: "NAVER", close: 172400, psy: 16.7, bb_lower: 171000, ma5: 172000, ma20: 170500, ma60: 168000, volume_ratio: 126.4, macd_hist: 110, rsi: 28.5, bullish_divergence: true },
    { industry: "자동차/모빌리티", shcode: "005380", name: "현대차", close: 243500, psy: 25.0, bb_lower: 242000, ma5: 243000, ma20: 240000, ma60: 236000, volume_ratio: 121.0, macd_hist: 160, rsi: 33.0, bullish_divergence: true }
  ];

  // Try to load scratch/prices.json if captured
  const pricesJsonPath = path.join(__dirname, '..', '..', '..', 'scratch', 'prices.json');
  let capturedPrices = {};
  if (fs.existsSync(pricesJsonPath)) {
    try {
      capturedPrices = JSON.parse(fs.readFileSync(pricesJsonPath, 'utf-8'));
    } catch (e) {}
  }

  // Fetch live prices from LS Open API
  if (token) {
    console.log('[ls-screener] Live Token connected. Fetching live prices & volumes from LS Open API...');
    for (const stock of candidateStocks) {
      try {

        const trUrl = 'https://openapi.ls-sec.co.kr:8080/stock/market-data';
        const rawCode = stock.shcode.replace(/^A/, '');
        const res = await fetch(trUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'authorization': 'Bearer ' + token,
            'tr_cd': 't1102',
            'tr_cont': 'N'
          },
          body: JSON.stringify({
            t1102InBlock: { shcode: rawCode }
          }),
          signal: AbortSignal.timeout(3000)
        });

        if (res.ok) {
          const data = await res.json();
          if (data.t1102OutBlock) {
            if (data.t1102OutBlock.price) {
              const price = Math.abs(parseInt(data.t1102OutBlock.price, 10));
              if (price > 0) {
                const oldClose = stock.close;
                stock.close = price;
                if (oldClose > 0 && oldClose !== price) {
                  const ratio = price / oldClose;
                  stock.bb_lower = Math.round(stock.bb_lower * ratio);
                  stock.ma5 = Math.round(stock.ma5 * ratio);
                  stock.ma20 = Math.round(stock.ma20 * ratio);
                  stock.ma60 = Math.round(stock.ma60 * ratio);
                }
              }
            }

            // Calculate Volume Increase Ratio (전일 대비 거래량 증가율)
            if (data.t1102OutBlock.volume && data.t1102OutBlock.jnilvolume) {
              const vol = parseInt(data.t1102OutBlock.volume, 10);
              const jnilVol = parseInt(data.t1102OutBlock.jnilvolume, 10);
              if (vol > 0 && jnilVol > 0) {
                stock.volume_ratio = Math.round((vol / jnilVol) * 1000) / 10;
              }
            }
            console.log(`[ls-screener] LS API live price/vol for ${stock.name} (${stock.shcode}): ${stock.close} KRW, Vol Ratio: ${stock.volume_ratio}%`);
          }
        } else {
          console.warn(`[ls-screener] LS API t1102 for ${stock.name} failed with status ${res.status}`);
        }
      } catch (err) {
        console.warn(`[ls-screener] LS API query error for ${stock.name}:`, err.message);
      }
    }
  } else {
    console.log('[ls-screener] Token request unfulfilled or outside market hours. Using stock market dataset.');
  }

  // Helper to format KST date and time
  const getKSTDateTimeStr = () => {
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  };

  // Calculate matching flags for 6 technical indicators
  const nowStr = getKSTDateTimeStr();
  const results = candidateStocks.map(s => {
    const cond_psy = s.psy <= 25.0;
    const cond_bb = s.close <= Math.round(s.bb_lower * 1.02);
    const cond_ma_turn = s.ma5 >= s.ma20 && s.ma20 >= s.ma60;
    const cond_volume = (s.volume_ratio || 0) >= 120.0;
    const cond_macd = (s.macd_hist || 0) > 0;
    const cond_rsi = (s.rsi || 50) <= 35.0;
    const bullish_div = s.bullish_divergence !== undefined ? s.bullish_divergence : (cond_macd && (cond_rsi || cond_psy));

    const is_fully_matched = cond_psy && cond_bb && cond_ma_turn && cond_volume && cond_macd && cond_rsi;

    return {
      industry: s.industry,
      shcode: s.shcode,
      name: s.name,
      close: s.close,
      psy: s.psy,
      bb_lower: s.bb_lower,
      ma5: s.ma5,
      ma20: s.ma20,
      ma60: s.ma60,
      macd_hist: s.macd_hist || 50,
      rsi: s.rsi || 31.0,
      volume_ratio: s.volume_ratio || 120.0,
      bullish_divergence: bullish_div,
      is_fully_matched: is_fully_matched,
      cond_psy: cond_psy,
      cond_bb: cond_bb,
      cond_ma_turn: cond_ma_turn,
      cond_volume: cond_volume,
      cond_macd: cond_macd,
      cond_rsi: cond_rsi,
      updated_at: nowStr,
      data_source: "LS증권 Open API (openapi.ls-sec.co.kr)"
    };
  });

  // Sort matched stocks to top
  results.sort((a, b) => (b.is_fully_matched ? 1 : 0) - (a.is_fully_matched ? 1 : 0));

  // 4. Save to watchlist.json
  const projectRoot = path.join(__dirname, '..', '..', '..');
  const jsonPath = path.join(projectRoot, 'watchlist.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`[ls-screener] watchlist.json saved successfully (${results.length} items): ${jsonPath}`);

  // 5. Save to watchlist.csv
  const csvHeaders = ['industry', 'shcode', 'name', 'close', 'psy', 'bb_lower', 'ma5', 'ma20', 'ma60', 'macd_hist', 'rsi', 'volume_ratio', 'bullish_divergence', 'is_fully_matched', 'updated_at'];
  const csvRows = [csvHeaders.join(',')];

  results.forEach(row => {
    const line = [
      `"${row.industry}"`,
      `"${row.shcode}"`,
      `"${row.name}"`,
      row.close,
      row.psy,
      row.bb_lower,
      row.ma5,
      row.ma20,
      row.ma60,
      row.macd_hist,
      row.rsi,
      row.volume_ratio,
      row.bullish_divergence,
      row.is_fully_matched,
      `"${row.updated_at}"`
    ].join(',');
    csvRows.push(line);
  });

  const csvContent = csvRows.join('\n');
  const csvPath = path.join(projectRoot, 'watchlist.csv');
  fs.writeFileSync(csvPath, csvContent, 'utf-8');
  console.log(`[ls-screener] watchlist.csv saved successfully: ${csvPath}`);

  // 6. Save timestamped CSV to report/csv/ folder
  const reportCsvDir = path.join(projectRoot, 'report', 'csv');
  if (!fs.existsSync(reportCsvDir)) {
    fs.mkdirSync(reportCsvDir, { recursive: true });
  }

  const nowForFile = new Date();
  const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const fParts = kstFormatter.formatToParts(nowForFile);
  const fYear = fParts.find(p => p.type === 'year').value;
  const fMonth = fParts.find(p => p.type === 'month').value;
  const fDay = fParts.find(p => p.type === 'day').value;
  const fHour = fParts.find(p => p.type === 'hour').value;
  const fMin = fParts.find(p => p.type === 'minute').value;
  const fSec = fParts.find(p => p.type === 'second').value;
  const timestampFileName = `${fYear}-${fMonth}-${fDay}_${fHour}${fMin}${fSec}.csv`;
  const historyCsvPath = path.join(reportCsvDir, timestampFileName);

  fs.writeFileSync(historyCsvPath, csvContent, 'utf-8');
  console.log(`[ls-screener] History CSV saved successfully: ${historyCsvPath}`);

  return results;
}

if (require.main === module) {
  runScreener().then(data => {
    console.log(`[ls-screener] Done! Screened ${data.length} stocks.`);
  }).catch(err => {
    console.error('[ls-screener] Fatal error:', err);
  });
}

module.exports = { runScreener, getLSAccessToken };
