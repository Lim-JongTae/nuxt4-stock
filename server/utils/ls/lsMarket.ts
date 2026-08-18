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

// 6. Fetch Top 5 Rising & Bottom 5 Declining Sectors via LS API (t8424 / t1531) - 상승/하락 5대 업종 수집 (공식 8080 단일 URL)
export async function fetchLSSectorData(token: string): Promise<{
  topSectors: Array<{ code: string; name: string; rate: number }>;
  bottomSectors: Array<{ code: string; name: string; rate: number }>;
} | null> {
  if (!token) {
    console.log('⚠️ [fetchLSSectorData] 토큰 없음');
    return null;
  }

  console.log('🔵 [fetchLSSectorData] 업종 데이터 수집 시작 (t8424)');

  try {
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
        rowsLength: rows?.length || 0,
        sampleRow: rows?.[0]
      });

      if (Array.isArray(rows) && rows.length > 0) {
        const sanitizeSectorName = (name: string): string | null => {
          if (!name) return null;
          const clean = name.replace(/\s+/g, '');

          // 이름 정규화만 수행 (하드코딩 필터 제거)
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

        const parsedList: Array<{ code: string; name: string; rate: number }> = [];
        const BATCH_SIZE = 3;
        for (let i = 0; i < validSectors.length; i += BATCH_SIZE) {
          const batch = validSectors.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(async (sec) => {
              try {
                const t1531Res = await fetch('https://openapi.ls-sec.co.kr:8080/indtp/market-data', {
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
                  signal: AbortSignal.timeout(4000)
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
              } catch (e: any) {}
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
