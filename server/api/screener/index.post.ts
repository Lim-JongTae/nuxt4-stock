import { db } from '../../db';
import { screenerHistory } from '../../db/schema';
import { desc } from 'drizzle-orm';
import { parseStockMd } from '../../utils/stockMdParser';
import { loadEnv, getLSToken, fetchLSPrice, fetchLSShortSellTrend } from '../../utils/lsApi';
import { classifyShortSellSignal, type ShortSellRecord } from '../../utils/shortSellSignal';

export default defineEventHandler(async (event) => {
  const env = loadEnv();
  const appKey = env.LS_APP_KEY || '';
  const appSecret = env.LS_SECREAT || '';

  const { token, error: tokenError } = await getLSToken(appKey, appSecret);

  // 1. 종목.md 에서 보유종목 + 관심종목 리스트 동적 로드
  const parsedMd = parseStockMd();
  const allMdStocks = [
    ...parsedMd.holdings.map(h => ({ name: h.name, shcode: h.shcode, industry: h.industry, isHolding: true, avgPrice: h.avgPrice, quantity: h.quantity })),
    ...parsedMd.watchlist.map(w => ({ name: w.name, shcode: w.shcode, industry: w.industry, isHolding: false, avgPrice: 0, quantity: 0 }))
  ];

  const candidateStocks = allMdStocks.filter(s => s.shcode && s.shcode.trim().length >= 4);

  if (candidateStocks.length === 0) {
    return {
      success: false,
      timestamp: new Date().toLocaleString('ko-KR'),
      source: '종목.md 없음',
      error: '종목.md 파일에 유효한 종목 목록이 존재하지 않습니다.',
      oldData: [],
      newData: []
    };
  }

  // 2. DB에서 직전 분석 이력 조회
  let lastBatchRowsMap = new Map<string, any>();
  try {
    const recentRows = await db.select()
      .from(screenerHistory)
      .orderBy(desc(screenerHistory.id))
      .limit(Math.max(candidateStocks.length * 5, 100)) as any[];

    if (recentRows.length > 0) {
      const lastBatchId = recentRows[0].batchId;
      const lastBatchRows = recentRows.filter(r => r.batchId === lastBatchId);
      for (const row of lastBatchRows) {
        lastBatchRowsMap.set(row.shcode, row);
      }
    }
  } catch (e) {}

  // 3. LS증권 Open API (t1102, t8413 실시간가 + t1927 공매도일별추이) 연동
  let apiCallNote = '';
  let priceFailCount = 0;
  const stockLiveMap = new Map<string, { price?: number; shortSellHistory?: ShortSellRecord[] }>();

  if (token) {
    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 250;

    for (let i = 0; i < candidateStocks.length; i += BATCH_SIZE) {
      const batch = candidateStocks.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(async (stock) => {
        const livePrice = await fetchLSPrice(token, stock.shcode);
        const shortSellTrend = await fetchLSShortSellTrend(token, stock.shcode, livePrice);

        stockLiveMap.set(stock.shcode, {
          price: livePrice || undefined,
          shortSellHistory: shortSellTrend || undefined
        });
      }));

      results.forEach((r) => {
        if (r.status === 'rejected') {
          priceFailCount++;
        }
      });

      if (i + BATCH_SIZE < candidateStocks.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    if (priceFailCount > 0) {
      apiCallNote = `${priceFailCount}/${candidateStocks.length}개 종목 LS API 실시간 수신 실패`;
    }
  } else {
    apiCallNote = tokenError || 'LS증권 OAuth 토큰 미발급';
  }

  // 4. 타임스탬프 생성
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const localTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  const batchId = localTime.replace(/[- :]/g, '');

  // 5. 8대 기술적 지표 & 공매도 수급 퀀트 스코어 산정 (더미 가짜 데이터 전면 배제)
  const newBatch = candidateStocks.map(s => {
    const prevDbData = lastBatchRowsMap.get(s.shcode) || {};
    const liveData = stockLiveMap.get(s.shcode) || {};

    // 현재가 (LS증권 실시간가 -> DB 직전 실시간가 순)
    const closePrice = liveData.price || (liveData.shortSellHistory && liveData.shortSellHistory[0]?.price) || prevDbData.closePrice || 0;

    // 지표 값 수집 (결측치는 null 유지, 가짜 대체값 생성 안 함)
    const psy = prevDbData.psy ?? null;
    const bb_lower = prevDbData.bbLower ?? null;
    const ma5 = prevDbData.ma5 ?? null;
    const ma20 = prevDbData.ma20 ?? null;
    const ma60 = prevDbData.ma60 ?? null;
    const volume_ratio = prevDbData.volumeRatio ?? null;
    const macd_hist = prevDbData.macdHist ?? null;
    const rsi = prevDbData.rsi ?? null;
    const bullish_divergence = prevDbData.bullishDivergence !== undefined && prevDbData.bullishDivergence !== null ? Boolean(prevDbData.bullishDivergence) : null;

    // 공매도 일별 이력 (실수신 실데이터만 사용)
    let shortSellHistory: ShortSellRecord[] = liveData.shortSellHistory || [];
    if (shortSellHistory && shortSellHistory.length > 0) {
      shortSellHistory = shortSellHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // 8대 조건 검사 (typeof === 'number' 엄격 체크로 결측치는 무조건 미달성)
    const cond_psy = typeof psy === 'number' && psy <= 25.0;
    const cond_bb = typeof bb_lower === 'number' && bb_lower > 0 && closePrice > 0 && closePrice <= Math.round(bb_lower * 1.02);
    const cond_ma_turn = typeof ma5 === 'number' && typeof ma20 === 'number' && typeof ma60 === 'number' &&
                          ma5 > 0 && ma20 > 0 && ma60 > 0 && ma5 >= ma20 && ma20 >= ma60;
    const cond_volume = typeof volume_ratio === 'number' && volume_ratio >= 120.0;
    const cond_macd = typeof macd_hist === 'number' && macd_hist > 0;
    const cond_rsi = typeof rsi === 'number' && rsi <= 35.0;
    const cond_divergence = bullish_divergence === true;

    // 공매도 신호 분류 (ETF / 해외종목 구분)
    const isEtfOrForeign = s.shcode.startsWith('US') || s.name.includes('액티브') || s.name.includes('KODEX') || s.name.includes('SOL') || s.name.includes('KoAct') || s.name.includes('ETF');
    const shortSignal = classifyShortSellSignal(shortSellHistory, isEtfOrForeign);
    const cond_short_signal = shortSignal.label === "숏커버링(환매수) 유력" || shortSignal.label === "매수세가 공매도 흡수 중";

    // 100점 만점 퀀트 배점
    let score = 0;
    if (cond_psy) score += 10;
    if (cond_bb) score += 10;
    if (cond_ma_turn) score += 15;
    if (cond_volume) score += 15;
    if (cond_macd) score += 10;
    if (cond_rsi) score += 10;
    if (cond_divergence) score += 15;
    if (cond_short_signal) score += 15;

    // 8개 조건 전부 충족 (100점 만점) 시에만 true
    const is_fully_matched = cond_psy && cond_bb && cond_ma_turn && cond_volume && cond_macd && cond_rsi && cond_divergence && cond_short_signal;

    return {
      batchId,
      shcode: s.shcode,
      name: s.name,
      industry: s.industry,
      closePrice,
      psy: psy ?? null,
      bbLower: bb_lower ?? null,
      ma5: ma5 ?? null,
      ma20: ma20 ?? null,
      ma60: ma60 ?? null,
      volumeRatio: volume_ratio ?? null,
      macdHist: macd_hist ?? null,
      rsi: rsi ?? null,
      bullishDivergence: bullish_divergence ?? null,
      shortSellingStatus: shortSignal.label,
      shortSellingConfidence: shortSignal.confidence,
      shortSellingSummary: shortSignal.summary,
      shortSellMetrics: shortSignal.metrics,
      shortAvgPrice: shortSellHistory && shortSellHistory.length > 0 ? shortSellHistory[0]?.shortAvgPrice : undefined,
      shortVolume: shortSellHistory && shortSellHistory.length > 0 ? shortSellHistory[0]?.shortVolume : undefined,
      score,
      isFullyMatched: is_fully_matched,
      createdAt: localTime
    };
  });

  // DB에 갱신 결과 저장 중단 (Client-side Store & LocalStorage 영구화로 전환)
  let oldData: typeof newBatch = [];
  try {
    const recentRows = await db.select()
      .from(screenerHistory)
      .orderBy(desc(screenerHistory.id))
      .limit(Math.max(candidateStocks.length * 5, 100)) as any[];

    if (recentRows.length > 0) {
      const lastBatchId = recentRows[0].batchId;
      oldData = recentRows.filter(r => r.batchId === lastBatchId);
    }
  } catch (dbErr) {
    console.error('Screener DB query error:', dbErr);
  }

  if (oldData.length === 0) {
    oldData = newBatch.map(item => ({ ...item, createdAt: `${localTime} (이전 분석)` }));
  }

  return {
    success: true,
    timestamp: localTime,
    source: token
      ? (priceFailCount > 0 ? `LS증권 Open API (t1102/t8413/t1927 부분 수신)` : 'LS증권 Open API (openapi.ls-sec.co.kr - t1102/t8413/t1927)')
      : `LS증권 DB 데이터 (${apiCallNote})`,
    error: priceFailCount > 0 ? apiCallNote : (tokenError || null),
    oldData,
    newData: newBatch
  };
});
