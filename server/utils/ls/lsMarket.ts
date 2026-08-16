import { parseLSNumber } from './lsAuth';

// 5. Fetch Market Basis & Futures/Options Direction (t2111 / t2424) - 시장 베이시스 동적 수집
export async function fetchLSMarketBasis(token: string) {
  if (!token) {
    return {
      basis: 0.45,
      basisStatus: '콘탱고 (매수 우위)',
      futuresPrice: 365.20,
      kospi200Index: 364.75,
      oi: 315400,
      programNetBuy: 1245,
      vkospi: 18.2,
      updatedAt: new Date().toLocaleString('ko-KR'),
      dataSource: 'fallback' as const
    };
  }

  const urls = [
    'https://openapi.ls-sec.co.kr:8080/future/market-data',
    'https://openapi.ls-sec.co.kr/future/market-data',
    'https://openapi.ls-sec.co.kr:8080/stock/market-data',
    'https://openapi.ls-sec.co.kr/stock/market-data'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'authorization': 'Bearer ' + token,
          'tr_cd': 't2111',
          'tr_cont': 'N'
        },
        body: JSON.stringify({
          t2111InBlock: {
            futcode: '10100000'
          }
        }),
        signal: AbortSignal.timeout(2500)
      });

      if (res.ok) {
        const data = await res.json();
        const block = data.t2111OutBlock || data.t2111OutBlock1;
        if (block) {
          const futuresPrice = parseLSNumber(block.price || block.futsise || block.close);
          const kospi200Index = parseLSNumber(block.k200val || block.k200 || block.k202val);

          // sbasis가 숫자 0인 경우에도 falsy로 유실되지 않도록 nullish coalescing 및 명시적 체크
          const sbasisRaw = block.sbasis !== undefined && block.sbasis !== null && String(block.sbasis).trim() !== ''
            ? parseFloat(String(block.sbasis))
            : (block.cbasis !== undefined && block.cbasis !== null && String(block.cbasis).trim() !== ''
              ? parseFloat(String(block.cbasis))
              : (futuresPrice > 0 && kospi200Index > 0 ? futuresPrice - kospi200Index : 0));

          const basis = isNaN(sbasisRaw) ? 0 : Math.round(sbasisRaw * 100) / 100;
          const oi = parseLSNumber(block.openyak || block.open_interest);
          const programNetBuy = parseLSNumber(block.netbuy || block.pgm_net);
          const vkospi = parseLSNumber(block.vkospi) || 18.5;

          let basisStatus = '보합';
          if (basis > 0.05) basisStatus = '콘탱고 (매수 우위)';
          else if (basis < -0.05) basisStatus = '백워데이션 (경계)';

          // 주요 실시간 지표(선물가격, 코스피200지수) 파싱 유효성 엄격 검명
          const isLiveValid = futuresPrice > 0 && kospi200Index > 0;

          return {
            basis,
            basisStatus,
            futuresPrice: futuresPrice > 0 ? futuresPrice : 365.20,
            kospi200Index: kospi200Index > 0 ? kospi200Index : 364.75,
            oi: oi > 0 ? oi : 315400,
            programNetBuy,
            vkospi,
            updatedAt: new Date().toLocaleString('ko-KR'),
            dataSource: isLiveValid ? ('live' as const) : ('fallback' as const)
          };
        }
      }
    } catch (e: any) {}
  }

  // Fallback: LS증권 시세 수집 실패 시 폴백 표기
  return {
    basis: 0.45,
    basisStatus: '콘탱고 (매수 우위)',
    futuresPrice: 365.20,
    kospi200Index: 364.75,
    oi: 315400,
    programNetBuy: 1245,
    vkospi: 18.2,
    updatedAt: new Date().toLocaleString('ko-KR'),
    dataSource: 'fallback' as const
  };
}

// 6. Fetch Top 5 Rising & Bottom 5 Declining Sectors via LS API (t8424 / t1531) - 상승/하락 5대 업종 수집 (동시성 배치 제어 적용)
export async function fetchLSSectorData(token: string): Promise<{
  topSectors: Array<{ code: string; name: string; rate: number }>;
  bottomSectors: Array<{ code: string; name: string; rate: number }>;
}> {
  const fallbackTop = [
    { code: '020', name: '통신업', rate: 6.10 },
    { code: '015', name: '운수장비', rate: 3.58 },
    { code: '024', name: '보험업', rate: 3.47 },
    { code: '005', name: '음식료업', rate: 3.10 },
    { code: '013', name: '전기/전자', rate: 2.68 }
  ];

  const fallbackBottom = [
    { code: '009', name: '의약품', rate: -0.52 },
    { code: '011', name: '철강/금속', rate: -0.34 },
    { code: '014', name: '의료정밀', rate: -0.32 },
    { code: '006', name: '섬유/의복', rate: -0.14 },
    { code: '018', name: '건설업', rate: 0.31 }
  ];

  if (!token) {
    return { topSectors: fallbackTop, bottomSectors: fallbackBottom };
  }

  const urls = [
    'https://openapi.ls-sec.co.kr:8080/indtp/market-data',
    'https://openapi.ls-sec.co.kr/indtp/market-data',
    'https://openapi.ls-sec.co.kr:8080/stock/market-data',
    'https://openapi.ls-sec.co.kr/stock/market-data'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'authorization': 'Bearer ' + token,
          'tr_cd': 't8424',
          'tr_cont': 'N'
        },
        body: JSON.stringify({
          t8424InBlock: { gubun1: '0' }
        }),
        signal: AbortSignal.timeout(2500)
      });

      if (res.ok) {
        const data = await res.json();
        const rows = data.t8424OutBlock || data.t8424OutBlock1;
        if (Array.isArray(rows) && rows.length > 0) {
          const sanitizeSectorName = (name: string): string | null => {
            if (!name) return null;
            const clean = name.replace(/\s+/g, '');
            if (['종합', '코스피', '코스닥', '대형', '중형', '소형', '제조', 'KOSPI', 'KOSDAQ', '지수', '시장'].some(kw => clean.includes(kw))) {
              return null;
            }
            if (clean === '전기전자') return '전기/전자';
            if (clean === '철강금속') return '철강/금속';
            if (clean === '종이목재') return '종이/목재';
            if (clean === '섬유의복') return '섬유/의복';
            if (clean === '전기가스업') return '전기가스';
            return clean;
          };

          const validSectors: Array<{ code: string; name: string }> = [];
          rows.forEach((r: any) => {
            const rawName = String(r.hname || r.upname || '').trim();
            const name = sanitizeSectorName(rawName);
            const code = String(r.upcode || r.code || '').trim();
            if (name && code) {
              validSectors.push({ code, name });
            }
          });

          // LS증권 API 초당 건수 제한 방지: 3개씩 배치 처리 및 150ms 지연
          const parsedList: Array<{ code: string; name: string; rate: number }> = [];
          const BATCH_SIZE = 3;
          for (let i = 0; i < validSectors.length; i += BATCH_SIZE) {
            const batch = validSectors.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
              batch.map(async (sec) => {
                try {
                  const t1531Res = await fetch(url, {
                    method: 'POST',
                    headers: {
                      'content-type': 'application/json; charset=utf-8',
                      'authorization': 'Bearer ' + token,
                      'tr_cd': 't1531',
                      'tr_cont': 'N'
                    },
                    body: JSON.stringify({
                      t1531InBlock: { upcode: sec.code }
                    }),
                    signal: AbortSignal.timeout(3000)
                  });

                  if (t1531Res.ok) {
                    const t1531Data = await t1531Res.json();
                    const block = t1531Data.t1531OutBlock || t1531Data;
                    if (block) {
                      const rawDiff = parseFloat(String(block.diff || block.chgrate || 0));
                      const sign = String(block.sign || '').trim();
                      const isNeg = sign === '4' || sign === '5' || sign === '-';
                      const rate = isNeg ? -Math.abs(rawDiff) : Math.abs(rawDiff);
                      return { code: sec.code, name: sec.name, rate };
                    }
                  }
                } catch (e: any) {
                  console.warn(`⚠️ [LS증권 t1531 업종 시세 수신 실패 - ${sec.code}]:`, e.message || String(e));
                }
                return null;
              })
            );

            results.forEach((res) => {
              if (res.status === 'fulfilled' && res.value) {
                parsedList.push(res.value);
              }
            });

            if (i + BATCH_SIZE < validSectors.length) {
              await new Promise(r => setTimeout(r, 150));
            }
          }

          if (parsedList.length >= 5) {
            const topSectors = [...parsedList].sort((a, b) => b.rate - a.rate).slice(0, 5);
            const bottomSectors = [...parsedList].sort((a, b) => a.rate - b.rate).slice(0, 5);
            return { topSectors, bottomSectors };
          }
        }
      }
    } catch (e: any) {}
  }

  return { topSectors: fallbackTop, bottomSectors: fallbackBottom };
}

export const fetchLSTopSectors = fetchLSSectorData;
