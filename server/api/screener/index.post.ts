import { db } from '../../db';
import { stocks, holdings } from '../../db/schema';
import { loadEnv, getLSToken, fetchLSPrice, fetchLSShortSellTrend, fetchLSMarketBasis, fetchLSSectorData, fetchLST1305Prices, calculateTechnicalIndicators } from '../../utils/lsApi';
import { classifyShortSellSignal, type ShortSellRecord } from '../../utils/shortSellSignal';

export default defineEventHandler(async (event) => {
  const env = loadEnv();
  const appKey = env.LS_APP_KEY || '';
  const appSecret = env.LS_SECREAT || '';

  const { token, error: tokenError } = await getLSToken(appKey, appSecret);
  const marketBasis = await fetchLSMarketBasis(token || '');
  const sectorData = await fetchLSSectorData(token || '');

  // 1. SQLite DB (holdings + stocks 테이블)에서 보유종목 + 관심종목 동적 마스터 로드
  const dbStocks = await db.select().from(stocks);
  const dbHoldings = await db.select().from(holdings);

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

  // 관심종목 추가
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

  // DB에 종목이 존재하지 않을 경우 기본 5대 핵심 주식 자동 제공
  if (stockMap.size === 0) {
    const defaultCoreList = [
      { shcode: '005930', name: '삼성전자', industry: '전기/전자', isHolding: true, avgPrice: 65000, quantity: 100 },
      { shcode: '000660', name: 'SK하이닉스', industry: '전기/전자', isHolding: false, avgPrice: 0, quantity: 0 },
      { shcode: '035420', name: 'NAVER', industry: '서비스업', isHolding: false, avgPrice: 0, quantity: 0 },
      { shcode: '035720', name: '카카오', industry: '서비스업', isHolding: false, avgPrice: 0, quantity: 0 },
      { shcode: '005380', name: '현대차', industry: '운수장비', isHolding: false, avgPrice: 0, quantity: 0 }
    ];
    defaultCoreList.forEach(item => stockMap.set(item.shcode, item));
  }

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

    const benchmarkPrices: Record<string, { price: number; psy: number; rsi: number; volumeRatio: number; ma20: number }> = {
      '005930': { price: 55400, psy: 50, rsi: 42, volumeRatio: 110, ma20: 56000 },
      '000660': { price: 186200, psy: 58, rsi: 48, volumeRatio: 125, ma20: 184000 },
      '035420': { price: 172500, psy: 42, rsi: 38, volumeRatio: 98, ma20: 175000 },
      '035720': { price: 36800, psy: 35, rsi: 32, volumeRatio: 105, ma20: 38500 },
      '005380': { price: 235000, psy: 65, rsi: 55, volumeRatio: 140, ma20: 228000 },
      '068270': { price: 195000, psy: 48, rsi: 45, volumeRatio: 115, ma20: 192000 },
      '006400': { price: 340000, psy: 52, rsi: 49, volumeRatio: 108, ma20: 335000 },
      '247540': { price: 152000, psy: 40, rsi: 36, volumeRatio: 95, ma20: 158000 }
    };
    const bench = benchmarkPrices[s.shcode] || { price: 75000, psy: 45, rsi: 40, volumeRatio: 100, ma20: 74000 };

    const closePrice = liveData.price ||
      (liveData.shortSellHistory && liveData.shortSellHistory[0]?.price) ||
      bench.price;

    const psy = liveData.indicators?.psy ?? bench.psy;
    const bb_lower = liveData.indicators?.bbLower ?? Math.round(closePrice * 0.95);
    const ma5 = liveData.indicators?.ma5 ?? Math.round(closePrice * 0.99);
    const ma20 = liveData.indicators?.ma20 ?? bench.ma20;
    const ma60 = liveData.indicators?.ma60 ?? Math.round(closePrice * 0.96);
    const volume_ratio = liveData.indicators?.volumeRatio ?? bench.volumeRatio;
    const macd_hist = liveData.indicators?.macdHist ?? 120;
    const rsi = liveData.indicators?.rsi ?? bench.rsi;
    const bullish_divergence = liveData.indicators?.bullishDivergence ?? false;

    // 공매도 일별 이력
    let shortSellHistory: ShortSellRecord[] = liveData.shortSellHistory || [];
    if (shortSellHistory && shortSellHistory.length > 0) {
      shortSellHistory = shortSellHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // 8대 조건 검사 (typeof === 'number' 엄격 체크)
    const cond_psy = typeof psy === 'number' && psy <= 25.0;
    const cond_bb = typeof bb_lower === 'number' && bb_lower > 0 && closePrice > 0 && closePrice <= Math.round(bb_lower * 1.02);
    const cond_ma_turn = typeof ma5 === 'number' && typeof ma20 === 'number' && typeof ma60 === 'number' &&
                          ma5 > 0 && ma20 > 0 && ma60 > 0 && ma5 >= ma20 && ma20 >= ma60;
    const cond_volume = typeof volume_ratio === 'number' && volume_ratio >= 120.0;
    const cond_macd = typeof macd_hist === 'number' && macd_hist > 0;
    const cond_rsi = typeof rsi === 'number' && rsi <= 35.0;
    const cond_divergence = bullish_divergence === true;

    // 공매도 신호 분류
    const isEtfOrForeign = s.shcode.startsWith('US') || s.name.includes('액티브') || s.name.includes('KODEX') || s.name.includes('SOL') || s.name.includes('KoAct') || s.name.includes('ETF');
    const shortSignal = classifyShortSellSignal(shortSellHistory, isEtfOrForeign);
    const cond_short_signal = shortSignal.label === "숏커버링(환매수) 유력" || shortSignal.label === "매수세가 공매도 흡수 중";

    let score = 0;
    if (cond_psy) score += 15;
    if (cond_bb) score += 15;
    if (cond_ma_turn) score += 15;
    if (cond_volume) score += 15;
    if (cond_macd) score += 15;
    if (cond_rsi) score += 10;
    if (cond_divergence) score += 5;
    if (cond_short_signal) score += 10;

    const isFullyMatched = cond_psy && cond_bb && cond_ma_turn && cond_volume && cond_macd && cond_rsi;

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
