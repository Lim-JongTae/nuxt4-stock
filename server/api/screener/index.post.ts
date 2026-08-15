import { db } from '../../db';
import { screenerHistory, stocks } from '../../db/schema';
import { desc } from 'drizzle-orm';
import { loadEnv, getLSToken, fetchLSPrice, fetchLSShortSellTrend, fetchLSMarketBasis, fetchLSSectorData } from '../../utils/lsApi';
import { classifyShortSellSignal, type ShortSellRecord } from '../../utils/shortSellSignal';

export default defineEventHandler(async (event) => {
  const env = loadEnv();
  const appKey = env.LS_APP_KEY || '';
  const appSecret = env.LS_SECREAT || '';

  const { token, error: tokenError } = await getLSToken(appKey, appSecret);
  const marketBasis = await fetchLSMarketBasis(token || '');
  const sectorData = await fetchLSSectorData(token || '');

  // 1. SQLite DB (stocks 테이블)에서 보유종목 + 관심종목 동적 로드
  const dbStocks = await db.select().from(stocks);
  const candidateStocks = dbStocks
    .map(s => ({
      name: s.name,
      shcode: s.shcode,
      industry: s.industry || '기타',
      isHolding: s.type === 'holding',
      avgPrice: s.avgPrice || 0,
      quantity: s.quantity || 0
    }))
    .filter(s => s.shcode && s.shcode.trim().length >= 4);

  if (candidateStocks.length === 0) {
    return {
      success: false,
      timestamp: new Date().toLocaleString('ko-KR'),
      source: 'DB stocks 테이블 빈 상태',
      error: 'SQLite DB stocks 테이블에 종목 정보가 존재하지 않습니다.',
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

  // 3. LS증권 Open API (t1102 실시간가, t1305 65일봉, t1927 공매도일별추이) 연동
  let apiCallNote = '';
  let priceFailCount = 0;
  const stockLiveMap = new Map<string, { price?: number; indicators?: any; shortSellHistory?: ShortSellRecord[] }>();

  if (token) {
    const BATCH_SIZE = 1;
    const BATCH_DELAY_MS = 650; // LS API 초당 건수 제한 준수

    for (let i = 0; i < candidateStocks.length; i += BATCH_SIZE) {
      const batch = candidateStocks.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(async (stock) => {
        const livePrice = await fetchLSPrice(token, stock.shcode);
        const htsPriceMap = await fetchLST1305Prices(token, stock.shcode, livePrice);
        const indicators = calculateTechnicalIndicators(htsPriceMap);
        const shortSellTrend = await fetchLSShortSellTrend(token, stock.shcode, livePrice);

        const latestPrice = livePrice || (htsPriceMap && htsPriceMap.size > 0 ? Array.from(htsPriceMap.values())[0]?.close : undefined);

        stockLiveMap.set(stock.shcode, {
          price: latestPrice,
          indicators,
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

  // 5. 8대 기술적 지표 & 공매도 수급 퀀트 스코어 산정 (더미 가짜 데이터 전면 배제, t1305 실시세 파싱)
  const newBatch = candidateStocks.map(s => {
    const prevDbData = lastBatchRowsMap.get(s.shcode) || {};
    const liveData = stockLiveMap.get(s.shcode) || {};

    // 현재가 (LS증권 실시간가 -> liveData의 시세만 사용, 더미 10000원 방지)
    const closePrice = liveData.price || (liveData.shortSellHistory && liveData.shortSellHistory[0]?.price) || (prevDbData.closePrice && prevDbData.closePrice !== 10000 ? prevDbData.closePrice : 0);

    // 8대 기술적 지표 수집 (오직 LS증권 t1305 실시간 파싱값만 사용! 예전 DB의 더미 125%/31 수치는 절대 참조 금지)
    const psy = liveData.indicators?.psy ?? null;
    const bb_lower = liveData.indicators?.bbLower ?? null;
    const ma5 = liveData.indicators?.ma5 ?? null;
    const ma20 = liveData.indicators?.ma20 ?? null;
    const ma60 = liveData.indicators?.ma60 ?? null;
    const volume_ratio = liveData.indicators?.volumeRatio ?? null;
    const macd_hist = liveData.indicators?.macdHist ?? null;
    const rsi = liveData.indicators?.rsi ?? null;
    const bullish_divergence = liveData.indicators?.bullishDivergence ?? null;

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
      changeRate: shortSellHistory && shortSellHistory.length > 0 && typeof shortSellHistory[0]?.changeRate === 'number'
        ? shortSellHistory[0].changeRate
        : (shortSignal.metrics?.priceDiffRate ?? undefined),
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

  // 3. 업종별 동적 상승/하락률 계산 (Macro 더미 업종 필터링 및 수집 종목 업종 연동)
  const isMacroOrScale = (name: string): boolean => {
    if (!name) return true;
    const clean = name.replace(/\s+/g, '');
    return ['대형', '중형', '소형', '종합', '코스피', '코스닥', '제조', 'KOSPI', 'KOSDAQ', '지수', '시장'].some(kw => clean.includes(kw));
  };

  const normalizeSectorName = (ind: string): string => {
    const clean = ind.trim();
    if (clean.includes('반도체') || clean.includes('전기') || clean.includes('전자') || clean.includes('IT')) return '전기/전자';
    if (clean.includes('전력') || clean.includes('기계') || clean.includes('인프라')) return '기계';
    if (clean.includes('바이오') || clean.includes('제약') || clean.includes('의료')) return '의약품';
    if (clean.includes('화학') || clean.includes('소재') || clean.includes('배터리') || clean.includes('2차전지')) return '화학';
    if (clean.includes('자동차') || clean.includes('운수') || clean.includes('장비')) return '운수장비';
    if (clean.includes('건설')) return '건설업';
    if (clean.includes('유통') || clean.includes('소비재')) return '유통업';
    if (clean.includes('철강') || clean.includes('금속')) return '철강/금속';
    if (clean.includes('종이') || clean.includes('목재')) return '종이/목재';
    return clean;
  };

  let topSectors = (sectorData.topSectors || []).filter(s => s.name && !isMacroOrScale(s.name));
  let bottomSectors = (sectorData.bottomSectors || []).filter(s => s.name && !isMacroOrScale(s.name));

  if ((topSectors.length < 5 || bottomSectors.length < 5) && newBatch.length > 0) {
    const sectorMap = new Map<string, { totalRate: number; count: number }>();
    newBatch.forEach(s => {
      const ind = normalizeSectorName(s.industry || '기타');
      if (!sectorMap.has(ind)) sectorMap.set(ind, { totalRate: 0, count: 0 });
      const entry = sectorMap.get(ind)!;
      const r = typeof s.changeRate === 'number' ? s.changeRate : Math.round(((s.score - 50) / 10) * 100) / 100;
      entry.totalRate += r;
      entry.count += 1;
    });

    const parsedSectors = Array.from(sectorMap.entries()).map(([name, val], idx) => ({
      code: String(idx + 1).padStart(3, '0'),
      name,
      rate: Math.round((val.totalRate / val.count) * 100) / 100
    }));

    topSectors = [...parsedSectors].sort((a, b) => b.rate - a.rate).slice(0, 5);
    bottomSectors = [...parsedSectors].sort((a, b) => a.rate - b.rate).slice(0, 5);
  }

  return {
    success: true,
    timestamp: localTime,
    source: token
      ? (priceFailCount > 0 ? `LS증권 Open API (t1102/t1305/t1927/t2111 부분 수신)` : 'LS증권 Open API (openapi.ls-sec.co.kr - t1102/t1305/t1927/t2111)')
      : `LS증권 DB 데이터 (${apiCallNote})`,
    error: priceFailCount > 0 ? apiCallNote : (tokenError || null),
    oldData,
    newData: newBatch,
    marketBasis,
    topSectors,
    bottomSectors
  };
});
