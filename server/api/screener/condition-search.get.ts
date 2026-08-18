import { defineEventHandler, createError } from 'h3';
import { loadEnv, getLSToken, fetchLSPrice, fetchLST1305Prices, fetchLSShortSellTrend, calculateTechnicalIndicators } from '../../utils/lsApi';
import { classifyShortSellSignal } from '../../utils/shortSellSignal';

export default defineEventHandler(async (event) => {
  const env = loadEnv();
  const appKey = env.LS_APP_KEY || '';
  const appSecret = env.LS_SECREAT || '';

  const { token, error: tokenError } = await getLSToken(appKey, appSecret);
  if (!token) {
    return {
      success: false,
      timestamp: new Date().toLocaleString('ko-KR'),
      source: 'LS증권 API인증 실패',
      error: tokenError || 'LS증권 OAuth 토큰 발급에 실패하였습니다.',
      data: []
    };
  }

  const url = 'https://openapi.ls-sec.co.kr:8080/stock/item-search';

  try {
    // 1. t1866 호출하여 서버저장 조건식 목록 조회
    const res1866 = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'authorization': `Bearer ${token}`,
        'tr_cd': 't1866',
        'tr_cont': 'N'
      },
      body: JSON.stringify({
        t1866InBlock: {
          user_id: ''
        }
      })
    });

    const data1866: any = await res1866.json();
    let targetIndex = null;
    let targetName = '8대지표_과매도반등_퀀트';

    const outBlock = data1866?.t1866OutBlock || data1866?.t1866OutBlock1;
    if (outBlock) {
      const list = Array.isArray(outBlock) ? outBlock : [outBlock];
      const found = list.find((item: any) => {
        const name = item.query_name || item.sName || '';
        return name.includes('8대지표') || name.includes('과매도') || name.includes('퀀트');
      });

      if (found) {
        targetIndex = found.query_index || found.nIndex || found.sIndex;
        targetName = found.query_name || found.sName || targetName;
      } else if (list.length > 0) {
        targetIndex = list[0].query_index || list[0].nIndex || list[0].sIndex;
        targetName = list[0].query_name || list[0].sName;
      }
    }

    // 만약 t1866 목록이 야간 시간이나 권한 문제로 비어있을 경우 예시/기본 인덱스 '0' 시도
    if (!targetIndex) {
      targetIndex = '0';
    }

    // 2. t1859 조건검색 실행
    const res1859 = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'authorization': `Bearer ${token}`,
        'tr_cd': 't1859',
        'tr_cont': 'N'
      },
      body: JSON.stringify({
        t1859InBlock: {
          sAlertNum: '0000',
          sIndex: String(targetIndex)
        }
      })
    });

    const data1859: any = await res1859.json();
    const out1859 = data1859?.t1859OutBlock1 || data1859?.t1859OutBlock;
    
    let rawStocks: Array<{ shcode: string; name?: string }> = [];

    if (out1859) {
      const arr = Array.isArray(out1859) ? out1859 : [out1859];
      rawStocks = arr.map((item: any) => ({
        shcode: item.shcode || item.shcode_raw || item.cd || '',
        name: item.hname || item.name || ''
      })).filter(item => item.shcode);
    }

    // 3. 수집된 종목들에 대해 8대 지표 및 2차 공매도 숏커버링 퀀트 검증 수행
    const processedResults = [];

    for (const stock of rawStocks) {
      const cleanCode = stock.shcode.trim().replace(/^A/i, '');
      const shcodeWithPrefix = `A${cleanCode}`;

      // t1102 시세
      const priceData = await fetchLSPrice(token, cleanCode);
      // t1305 65일 일봉
      const candles = await fetchLST1305Prices(token, cleanCode, priceData);
      const tech = calculateTechnicalIndicators(candles);

      // t1927 공매도
      const shortRecords = await fetchLSShortSellTrend(token, cleanCode, priceData);
      const isEtfOrForeign = cleanCode.startsWith('US') || (stock.name || '').includes('ETF') || (stock.name || '').includes('KODEX');

      // DTC 계산: 공매도 누적 잔고수량 / 20일 평균 거래량
      let dtc: number | null = null;
      if (shortRecords && shortRecords.length > 0) {
        const latestShort = shortRecords[0];
        const shortVolume = latestShort?.shortVolume;

        if (shortVolume && shortVolume > 0) {
          const recentRecords = shortRecords.slice(0, Math.min(20, shortRecords.length));
          const totalVolume = recentRecords.reduce((sum, r) => sum + (r.volume || 0), 0);
          const avgDailyVolume = totalVolume / recentRecords.length;

          if (avgDailyVolume > 0) {
            dtc = Number((shortVolume / avgDailyVolume).toFixed(2));
          }
        }
      }

      const shortSignal = classifyShortSellSignal(shortRecords || [], isEtfOrForeign, dtc);

      const candleArray = candles && candles.size > 0 ? Array.from(candles.values()) : [];
      const latestCandlePrice = candleArray.length > 0 ? candleArray[candleArray.length - 1]?.close : 0;
      const closePrice = priceData || latestCandlePrice || 0;

      // 8대 조건 검사 & 퀀트 점수 산출
      const BOLLINGER_BAND_TOLERANCE_RATE = 1.02;
      const isBbLowerSupport = typeof tech.bbLower === 'number' && tech.bbLower > 0 && closePrice > 0 && closePrice <= Math.round(tech.bbLower * BOLLINGER_BAND_TOLERANCE_RATE);
      const isMaGoldenCross = typeof tech.ma5 === 'number' && typeof tech.ma20 === 'number' && typeof tech.ma60 === 'number' &&
                            tech.ma5 > 0 && tech.ma20 > 0 && tech.ma60 > 0 && tech.ma5 >= tech.ma20 && tech.ma20 >= tech.ma60;
      const isVolumeSpike = typeof tech.volumeRatio === 'number' && tech.volumeRatio >= 120.0;
      const isShortSignalValid = shortSignal.label === "숏커버링(환매수) 유력" || shortSignal.label === "매수세가 공매도 흡수 중";

      let shortSignalScore = 0;
      if (isShortSignalValid) {
        const shortSignalScoreMap: Record<string, number> = { "높음": 15, "중간": 11, "낮음": 7 };
        shortSignalScore = shortSignalScoreMap[shortSignal.confidence] ?? 7;
      }

      let score = 0;
      if (typeof tech.psy === 'number' && tech.psy <= 25) score += 10;
      if (typeof tech.rsi === 'number' && tech.rsi <= 35) score += 10;
      if (isBbLowerSupport) score += 10;
      if (isMaGoldenCross) score += 15;
      if (isVolumeSpike) score += 15;
      if (typeof tech.macdHist === 'number' && tech.macdHist > 0) score += 10;
      if (tech.bullishDivergence === true) score += 15;
      score += shortSignalScore;

      processedResults.push({
        shcode: shcodeWithPrefix,
        name: stock.name || cleanCode,
        industry: '조건검색 발굴',
        closePrice: closePrice,
        changeRate: 0,
        score,
        psy: tech.psy,
        rsi: tech.rsi,
        bbLower: tech.bbLower,
        ma5: tech.ma5,
        ma20: tech.ma20,
        volumeRatio: tech.volumeRatio,
        macdHist: tech.macdHist,
        shortSellingStatus: shortSignal.label,
        shortSignalSummary: shortSignal.summary,
        isFullyMatched: score >= 85
      });
    }

    return {
      success: true,
      timestamp: new Date().toLocaleString('ko-KR'),
      conditionName: targetName,
      conditionIndex: targetIndex,
      totalFound: processedResults.length,
      data: processedResults
    };

  } catch (err: any) {
    console.error('[Condition Search Error]', err);
    return {
      success: false,
      timestamp: new Date().toLocaleString('ko-KR'),
      error: err.message || '서버저장 조건검색 실행 중 오류가 발생했습니다.',
      data: []
    };
  }
});
