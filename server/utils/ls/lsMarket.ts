import { parseLSNumber } from './lsAuth';

// 5. Fetch Market Basis & Futures/Options Direction (t2111 / t2424) - 시장 베이시스 동적 수집 (공식 8080 단일 URL)
export async function fetchLSMarketBasis(token: string) {
  if (!token) return null;

  try {
    const res = await fetch('https://openapi.ls-sec.co.kr:8080/future/market-data', {
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
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const data = await res.json();
      const block = data.t2111OutBlock || data.t2111OutBlock1;
      if (block) {
        const futuresPrice = parseLSNumber(block.price || block.futsise || block.close);
        const kospi200Index = parseLSNumber(block.k200val || block.k200 || block.k202val);

        const sbasisRaw = block.sbasis !== undefined && block.sbasis !== null && String(block.sbasis).trim() !== ''
          ? parseFloat(String(block.sbasis))
          : (block.cbasis !== undefined && block.cbasis !== null && String(block.cbasis).trim() !== ''
            ? parseFloat(String(block.cbasis))
            : (futuresPrice > 0 && kospi200Index > 0 ? futuresPrice - kospi200Index : 0));

        const basis = isNaN(sbasisRaw) ? 0 : Math.round(sbasisRaw * 100) / 100;
        const oi = parseLSNumber(block.openyak || block.open_interest);
        const programNetBuy = parseLSNumber(block.netbuy || block.pgm_net);
        const vkospi = parseLSNumber(block.vkospi) || 0;

        let basisStatus = '보합';
        if (basis > 0.05) basisStatus = '콘탱고 (매수 우위)';
        else if (basis < -0.05) basisStatus = '백워데이션 (경계)';

        return {
          basis,
          basisStatus,
          futuresPrice,
          kospi200Index,
          oi,
          programNetBuy,
          vkospi,
          updatedAt: new Date().toLocaleString('ko-KR'),
          dataSource: 'live' as const
        };
      }
    }
  } catch (e: any) {
    console.error('🔴 [LS증권 t2111 선물 베이시스 수신 실패]:', e.message || String(e));
  }

  return null;
}

// 6. Fetch Top 5 Rising & Bottom 5 Declining Sectors via LS API (t8424 / t1514) - 상승/하락 5대 업종 수집 (공식 8080 단일 URL)
export async function fetchLSSectorData(token: string): Promise<{
  topSectors: Array<{ code: string; name: string; rate: number }>;
  bottomSectors: Array<{ code: string; name: string; rate: number }>;
} | null> {
  if (!token) {
    console.log('⚠️ [fetchLSSectorData] 토큰 없음');
    return null;
  }

  console.log('🔵 [fetchLSSectorData] 업종 데이터 수집 시작 (t8424 + t1514)');

  try {
    // 1. t8424로 업종 목록 조회
    const res = await fetch('https://openapi.ls-sec.co.kr:8080/indtp/market-data', {
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
      signal: AbortSignal.timeout(4000)
    });

    console.log('📡 [fetchLSSectorData] t8424 응답:', {
      status: res.status,
      ok: res.ok
    });

    if (res.ok) {
      const data = await res.json();
      const rows = data.t8424OutBlock || data.t8424OutBlock1;

      console.log('📊 [fetchLSSectorData] t8424 데이터:', {
        hasRows: Array.isArray(rows),
        rowsLength: rows?.length || 0
      });

      if (Array.isArray(rows) && rows.length > 0) {
        // 2. 주요 업종만 필터링 (ETF/레버리지/인버스 등 제외)
        const mainSectors = rows.filter((r: any) => {
          const name = String(r.hname || '').trim();
          const code = String(r.upcode || '').trim();

          // 3자리 이하 코드만 (주요 업종)
          if (code.length > 3) return false;

          // 제외 키워드
          const excludeKeywords = ['F-', 'MF-', 'SF-', 'KF-', 'KODEX', 'KINDEX', 'WISE', 'TIGER',
                                   '레버리지', '인버스', 'ETF', 'ETN', '선물', '옵션', '커버드콜',
                                   '총수익', 'USD', 'KRX', 'KOSPI', 'KOSDAQ', 'ESG'];

          return !excludeKeywords.some(kw => name.includes(kw));
        });

        console.log(`🎯 [fetchLSSectorData] 주요 업종 필터링: ${rows.length}개 → ${mainSectors.length}개`);

        const sanitizeSectorName = (name: string): string | null => {
          if (!name) return null;
          const clean = name.replace(/\s+/g, '');

          if (clean === '전기전자') return '전기/전자';
          if (clean === '철강금속') return '철강/금속';
          if (clean === '종이목재') return '종이/목재';
          if (clean === '섬유의복') return '섬유/의복';
          if (clean === '전기가스업') return '전기가스';
          return clean;
        };

        const validSectors: Array<{ code: string; name: string }> = [];
        mainSectors.forEach((r: any) => {
          const rawName = String(r.hname || r.upname || '').trim();
          const name = sanitizeSectorName(rawName);
          const code = String(r.upcode || r.code || '').trim();
          if (name && code) {
            validSectors.push({ code, name });
          }
        });

        console.log(`📋 [fetchLSSectorData] 유효 업종: ${validSectors.length}개`);

        const parsedList: Array<{ code: string; name: string; rate: number }> = [];
        const BATCH_SIZE = 5;

        console.log(`🔄 [fetchLSSectorData] 업종 등락률 수집 시작 (${validSectors.length}개 업종) - t1514 사용`);

        for (let i = 0; i < validSectors.length; i += BATCH_SIZE) {
          const batch = validSectors.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(async (sec) => {
              try {
                // t1514 (업종기간별추이) 사용 - 당일 등락률 조회
                const t1514Res = await fetch('https://openapi.ls-sec.co.kr:8080/indtp/market-data', {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json; charset=utf-8',
                    'authorization': 'Bearer ' + token,
                    'tr_cd': 't1514',
                    'tr_cont': 'N'
                  },
                  body: JSON.stringify({
                    t1514InBlock: {
                      upcode: sec.code,
                      gubun: '0',
                      date: '',
                      cnt: 1
                    }
                  }),
                  signal: AbortSignal.timeout(4000)
                });

                if (t1514Res.ok) {
                  const t1514Data = await t1514Res.json();
                  const rows = t1514Data.t1514OutBlock1 || t1514Data.t1514OutBlock;

                  if (Array.isArray(rows) && rows.length > 0) {
                    const latestData = rows[0];
                    const rawDiff = parseFloat(String(latestData.diff || latestData.change || latestData.drate || 0));
                    const sign = String(latestData.sign || '').trim();
                    const isNeg = sign === '4' || sign === '5' || sign === '-';
                    const rate = isNeg ? -Math.abs(rawDiff) : Math.abs(rawDiff);

                    if (!isNaN(rate) && rate !== 0) {
                      console.log(`  ✓ [${sec.code}] ${sec.name}: ${isNeg ? '' : '+'}${rate.toFixed(2)}%`);
                      return { code: sec.code, name: sec.name, rate };
                    } else {
                      console.log(`  ⊘ [${sec.code}] ${sec.name}: 등락률 0% (거래 없음)`);
                    }
                  } else {
                    console.log(`  ✗ [${sec.code}] ${sec.name}: 데이터 없음`);
                  }
                } else {
                  console.log(`  ✗ [${sec.code}] ${sec.name}: API 응답 실패 (status ${t1514Res.status})`);
                }
              } catch (e: any) {
                console.log(`  ✗ [${sec.code}] ${sec.name}: 오류 - ${e.message}`);
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
            await new Promise(r => setTimeout(r, 100));
          }
        }

        if (parsedList.length > 0) {
          const topSectors = [...parsedList].sort((a, b) => b.rate - a.rate).slice(0, 5);
          const bottomSectors = [...parsedList].sort((a, b) => a.rate - b.rate).slice(0, 5);

          console.log('✅ [fetchLSSectorData] 업종 데이터 수집 완료:', {
            totalSectors: parsedList.length,
            topSectorsCount: topSectors.length,
            topSectors: topSectors,
            bottomSectorsCount: bottomSectors.length
          });

          return { topSectors, bottomSectors };
        } else {
          console.log('⚠️ [fetchLSSectorData] parsedList가 비어있음 (등락률 데이터 수집 실패)');
        }
      } else {
        console.log('⚠️ [fetchLSSectorData] t8424 rows가 비어있거나 배열이 아님');
      }
    } else {
      console.log('🔴 [fetchLSSectorData] t8424 API 응답 실패:', res.status);
    }
  } catch (e: any) {
    console.error('🔴 [LS증권 업종 데이터 수신 실패]:', e.message || String(e));
  }

  console.log('❌ [fetchLSSectorData] 업종 데이터 수집 실패 - null 반환');
  return null;
}

export const fetchLSTopSectors = fetchLSSectorData;
