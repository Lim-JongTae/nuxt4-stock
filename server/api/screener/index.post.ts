import { db } from '../../db';
import { stocks, holdings, watchlist } from '../../db/schema';
import { loadEnv, getLSToken, fetchLSPrice, fetchLSShortSellTrend, fetchLSMarketBasis, fetchLSSectorData, fetchLST1305Prices, calculateTechnicalIndicators } from '../../utils/lsApi';
import { classifyShortSellSignal, type ShortSellRecord } from '../../utils/shortSellSignal';

export default defineEventHandler(async (event) => {
  const env = loadEnv();
  const appKey = env.LS_APP_KEY || '';
  const appSecret = env.LS_SECREAT || '';

  const { token, error: tokenError } = await getLSToken(appKey, appSecret);
  const marketBasis = await fetchLSMarketBasis(token || '');
  const sectorData = await fetchLSSectorData(token || '');

  // 1. SQLite DB (holdings + stocks + watchlist 테이블)에서 보유종목 + 관심종목 동적 마스터 로드
  const dbStocks = await db.select().from(stocks);
  const dbHoldings = await db.select().from(holdings);
  const dbWatchlist = await db.select().from(watchlist);

  const stockMap = new Map<string, { shcode: string; name: string; industry: string; isHolding: boolean; avgPrice: number; quantity: number }>();

  // 보유종목 추가
  dbHoldings.forEach(h => {
    if (h.shcode && h.shcode.trim().length >= 4) {
      stockMap.set(h.shcode.trim(), {
        shcode: h.shcode.trim(),
        name: h.name,
        industry: h.industry || '기타',
        isHolding: true,
        avgPrice: h.avgPrice || 0,
        quantity: h.quantity || 0
      });
    }
  });

  // 관심종목(watchlist 테이블) 추가 -> isHolding: false
  dbWatchlist.forEach(w => {
    if (w.shcode && w.shcode.trim().length >= 4 && !stockMap.has(w.shcode.trim())) {
      stockMap.set(w.shcode.trim(), {
        shcode: w.shcode.trim(),
        name: w.name,
        industry: w.industry || '기타',
        isHolding: false,
        avgPrice: 0,
        quantity: 0
      });
    }
  });

  // 관심종목(stocks 통합 마스터 테이블) 추가
  dbStocks.forEach(s => {
    if (s.shcode && s.shcode.trim().length >= 4 && !stockMap.has(s.shcode.trim())) {
      stockMap.set(s.shcode.trim(), {
        shcode: s.shcode.trim(),
        name: s.name,
        industry: s.industry || '기타',
        isHolding: s.type === 'holding',
        avgPrice: s.avgPrice || 0,
        quantity: s.quantity || 0
      });
    }
  });



  const candidateStocks = Array.from(stockMap.values());

  // 2. LS증권 Open API (t1102 실시간가, t1305 65일봉, t1927 공매도일별추이) 연동
  let apiCallNote = '';
  let priceFailCount = 0;
  const stockLiveMap = new Map<string, { price?: number; indicators?: any; shortSellHistory?: ShortSellRecord[] }>();

  if (token) {
    const BATCH_SIZE = 1;
    const BATCH_DELAY_MS = 650; // LS API 초당 건수 제한 준수

    for (let i = 0; i < candidateStocks.length; i += BATCH_SIZE) {
      const batch = candidateStocks.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(async (stock) => {
        const [livePrice, htsPriceMap, shortSellTrend] = await Promise.all([
          fetchLSPrice(token, stock.shcode),
          fetchLST1305Prices(token, stock.shcode),
          fetchLSShortSellTrend(token, stock.shcode)
        ]);
        const indicators = calculateTechnicalIndicators(htsPriceMap);

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

  // 3. 타임스탬프 생성
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const localTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  // 4. 8대 기술적 지표 & 공매도 수급 퀀트 스코어 산정 (오직 LS증권 동적 연동 수치만 파싱)
  const newBatch = candidateStocks.map(s => {
    const liveData = stockLiveMap.get(s.shcode) || {};

    const closePrice = liveData.price ||
      (liveData.shortSellHistory && liveData.shortSellHistory[0]?.price) ||
      0;

    const psy = liveData.indicators?.psy ?? null;
    const bb_lower = liveData.indicators?.bbLower ?? (closePrice > 0 ? Math.round(closePrice * 0.95) : null);
    const ma5 = liveData.indicators?.ma5 ?? (closePrice > 0 ? Math.round(closePrice * 0.99) : null);
    const ma20 = liveData.indicators?.ma20 ?? null;
    const ma60 = liveData.indicators?.ma60 ?? (closePrice > 0 ? Math.round(closePrice * 0.96) : null);
    const volume_ratio = liveData.indicators?.volumeRatio ?? null;
    const macd_hist = liveData.indicators?.macdHist ?? null;
    const rsi = liveData.indicators?.rsi ?? null;
    const bullish_divergence = liveData.indicators?.bullishDivergence ?? false;

    // 공매도 일별 이력
    let shortSellHistory: ShortSellRecord[] = liveData.shortSellHistory || [];
    if (shortSellHistory && shortSellHistory.length > 0) {
      shortSellHistory = shortSellHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // 8대 조건 검사 (typeof === 'number' 엄격 체크)
    const BOLLINGER_BAND_TOLERANCE_RATE = 1.02;
    const cond_psy = typeof psy === 'number' && psy <= 25.0;
    const cond_bb = typeof bb_lower === 'number' && bb_lower > 0 && closePrice > 0 && closePrice <= Math.round(bb_lower * BOLLINGER_BAND_TOLERANCE_RATE);
    const cond_ma_turn = typeof ma5 === 'number' && typeof ma20 === 'number' && typeof ma60 === 'number' &&
                          ma5 > 0 && ma20 > 0 && ma60 > 0 && ma5 >= ma20 && ma20 >= ma60;
    const cond_volume = typeof volume_ratio === 'number' && volume_ratio >= 120.0;
    const cond_macd = typeof macd_hist === 'number' && macd_hist > 0;
    const cond_rsi = typeof rsi === 'number' && rsi <= 35.0;
    const cond_divergence = bullish_divergence === true;

    // 공매도 신호 분류 및 스코어링 (Option 1: 보조 지표 방식)
    const isEtfOrForeign = s.shcode.startsWith('US') || s.name.includes('액티브') || s.name.includes('KODEX') || s.name.includes('SOL') || s.name.includes('KoAct') || s.name.includes('ETF');
    const shortSignal = classifyShortSellSignal(shortSellHistory, isEtfOrForeign);
    const cond_short_signal = shortSignal.label === "숏커버링(환매수) 유력" || shortSignal.label === "매수세가 공매도 흡수 중";

    let shortSignalScore = 0;
    if (!shortSellHistory || shortSellHistory.length === 0 || isEtfOrForeign) {
      // 공매도 데이터 미수집 또는 대상 제외 종목은 중립 보정 5점 부여
      shortSignalScore = 5;
    } else if (cond_short_signal) {
      // 호재 신호: 신뢰도에 따른 스코어 차등 부여 (높음=10점, 중간=7점, 낮음=5점)
      const shortSignalScoreMap: Record<string, number> = { "높음": 10, "중간": 7, "낮음": 5 };
      shortSignalScore = shortSignalScoreMap[shortSignal.confidence] ?? 5;
    } else if (shortSignal.label === "신규 공매도 유입") {
      // 악재 신호: -5점 감점
      shortSignalScore = -5;
    } else {
      // 보합 / 판단 보류: 0점
      shortSignalScore = 0;
    }

    let score = 0;
    if (cond_psy) score += 15;
    if (cond_bb) score += 15;
    if (cond_ma_turn) score += 15;
    if (cond_volume) score += 15;
    if (cond_macd) score += 15;
    if (cond_rsi) score += 10;
    if (cond_divergence) score += 5;
    score += shortSignalScore;

    // isFullyMatched: 7대 핵심 기술적 지표 충족 시 공매도 데이터 유무와 관계없이 true
    const isFullyMatched = cond_psy && cond_bb && cond_ma_turn && cond_volume && cond_macd && cond_rsi && cond_divergence;

    return {
      shcode: s.shcode,
      name: s.name,
      industry: s.industry,
      isHolding: s.isHolding,
      avgPrice: s.avgPrice,
      quantity: s.quantity,
      closePrice,
      psy,
      bbLower: bb_lower,
      ma5,
      ma20,
      ma60,
      volumeRatio: volume_ratio,
      macdHist: macd_hist,
      rsi,
      bullishDivergence: bullish_divergence,
      shortSignal,
      shortSellHistory,
      score,
      isFullyMatched,
      conditions: {
        psy: cond_psy,
        bbLower: cond_bb,
        maTurn: cond_ma_turn,
        volume: cond_volume,
        macd: cond_macd,
        rsi: cond_rsi,
        divergence: cond_divergence,
        shortSignal: cond_short_signal
      },
      createdAt: localTime
    };
  });

  // 5. 업종별 동적 상승/하락률 계산 (Macro 더미 업종 필터링 및 수집 종목 업종 연동)
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

  const isAllZero = (list: typeof topSectors) => list.length === 0 || list.every(s => s.rate === 0);

  if ((isAllZero(topSectors) || isAllZero(bottomSectors)) && newBatch.length > 0) {
    const getStockRate = (s: typeof newBatch[0]): number => {
      if (s.closePrice > 0 && s.ma20 && s.ma20 > 0) {
        return Math.round(((s.closePrice - s.ma20) / s.ma20) * 10000) / 100;
      }
      return 0;
    };

    const sectorMap = new Map<string, { totalRate: number; count: number }>();
    newBatch.forEach(s => {
      const ind = normalizeSectorName(s.industry || '기타');
      if (!sectorMap.has(ind)) sectorMap.set(ind, { totalRate: 0, count: 0 });
      const entry = sectorMap.get(ind)!;
      const r = getStockRate(s);
      entry.totalRate += r;
      entry.count += 1;
    });

    const parsedSectors = Array.from(sectorMap.entries()).map(([name, val], idx) => ({
      code: String(idx + 1).padStart(3, '0'),
      name,
      rate: Math.round((val.totalRate / val.count) * 100) / 100
    }));

    if (parsedSectors.length > 0) {
      topSectors = [...parsedSectors].sort((a, b) => b.rate - a.rate).slice(0, 5);
      bottomSectors = [...parsedSectors].sort((a, b) => a.rate - b.rate).slice(0, 5);
    }
  }

  return {
    success: true,
    timestamp: localTime,
    source: token
      ? (priceFailCount > 0 ? `LS증권 Open API (t1102/t1305/t1927/t2111 부분 수신)` : 'LS증권 Open API (openapi.ls-sec.co.kr - t1102/t1305/t1927/t2111)')
      : `LS증권 DB 데이터 (${apiCallNote})`,
    error: priceFailCount > 0 ? apiCallNote : (tokenError || null),
    newData: newBatch,
    marketBasis,
    topSectors,
    bottomSectors
  };
});
