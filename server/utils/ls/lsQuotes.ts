import type { StockCandleMap, StockCandleData, FetchLSQuoteParams } from '../../../utils/types/lsSecurities';
import { sanitizeDomesticShcode, parseLSNumber, formatDateYYYYMMDD } from './lsAuth';

// 1. Fetch Live Current Price via LS API (t1102 TR)
export async function fetchLSPrice(
  token: string,
  shcode: string
): Promise<number | null> {
  const rawCode = sanitizeDomesticShcode(shcode);
  if (!rawCode) return null;

  const urls = [
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
          'tr_cd': 't1102',
          'tr_cont': 'N'
        },
        body: JSON.stringify({
          t1102InBlock: {
            shcode: rawCode
          }
        }),
        signal: AbortSignal.timeout(2500)
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.t1102OutBlock && data.t1102OutBlock.price) {
          const price = parseLSNumber(data.t1102OutBlock.price);
          if (price > 0) return price;
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ [LS증권 t1102 현재가 API 수신 실패 - ${shcode}]:`, e.message || String(e));
    }
  }
  return null;
}

// 2. Fetch Stock Daily Prices via LS API (t8413 일봉 차트 TR - exchgubun: "U" 통합시세 KRX+NXT)
export async function fetchLST1305Prices(
  token: string,
  shcode: string,
  externalLivePrice?: number | null
): Promise<StockCandleMap | null>;
export async function fetchLST1305Prices(
  params: FetchLSQuoteParams
): Promise<StockCandleMap | null>;
export async function fetchLST1305Prices(
  tokenOrParams: string | FetchLSQuoteParams,
  shcodeArg?: string,
  externalLivePriceArg?: number | null
): Promise<StockCandleMap | null> {
  const token = typeof tokenOrParams === 'string' ? tokenOrParams : tokenOrParams.token;
  const shcode = typeof tokenOrParams === 'string' ? (shcodeArg || '') : tokenOrParams.shcode;
  const externalLivePrice = typeof tokenOrParams === 'string' ? externalLivePriceArg : tokenOrParams.externalLivePrice;

  const rawCode = sanitizeDomesticShcode(shcode);
  if (!rawCode) return null;

  const htsMap: StockCandleMap = new Map<string, StockCandleData>();

  const past = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const sdate = formatDateYYYYMMDD(past);
  const edate = formatDateYYYYMMDD(new Date());

  const urls = [
    'https://openapi.ls-sec.co.kr:8080/stock/chart',
    'https://openapi.ls-sec.co.kr/stock/chart'
  ];

  // LS증권 초당 호출 제한 대처: 1회 실패 시 650ms 지연 후 자동 재시도
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 650));
    }

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'authorization': 'Bearer ' + token,
            'tr_cd': 't8413',
            'tr_cont': 'N'
          },
          body: JSON.stringify({
            t8413InBlock: {
              shcode: rawCode,
              gubun: '2', // 2: 일봉
              qrycnt: 60,
              sdate: sdate,
              edate: edate,
              cts_date: '',
              comp_yn: 'N',
              exchgubun: 'U' // 'U': 통합시세 (KRX + NXT 통합 종가 전용!)
            }
          }),
          signal: AbortSignal.timeout(2500)
        });

        if (res.ok) {
          const data = await res.json();
          const rows = data.t8413OutBlock1 || data.t8413OutBlock;
          if (Array.isArray(rows) && rows.length > 0) {
            rows.forEach((r: any) => {
              const rawDate = String(r.date || '').trim();
              const formattedDate = rawDate.length === 8 
                ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
                : rawDate;
              const closePrice = parseLSNumber(r.close);
              const openPrice = parseLSNumber(r.open);
              const highPrice = parseLSNumber(r.high);
              const lowPrice = parseLSNumber(r.low);
              const volume = parseLSNumber(r.jdiff_vol) || parseLSNumber(r.volume);

              if (formattedDate && closePrice > 0) {
                htsMap.set(formattedDate, {
                  close: closePrice,
                  open: openPrice,
                  high: highPrice,
                  low: lowPrice,
                  volume
                });
              }
            });

            // 오늘 날짜 데이터는 t1102 실시간가가 전달되면 덮어씀
            if (externalLivePrice && externalLivePrice > 0) {
              const todayStr = formatDateYYYYMMDD(new Date());
              const formattedToday = `${todayStr.slice(0, 4)}-${todayStr.slice(4, 6)}-${todayStr.slice(6, 8)}`;
              const existing = htsMap.get(formattedToday);
              if (existing) {
                existing.close = externalLivePrice;
              } else {
                htsMap.set(formattedToday, {
                  close: externalLivePrice,
                  open: externalLivePrice,
                  high: externalLivePrice,
                  low: externalLivePrice,
                  volume: 0
                });
              }
            }

            if (htsMap.size > 0) break;
          }
        }
      } catch (e: any) {
        console.warn(`⚠️ [LS증권 t8413 통합시세 API 수신 실패 - ${shcode}]:`, e.message || String(e));
      }
    }

    if (htsMap.size > 0) break;
  }

  return htsMap.size > 0 ? htsMap : null;
}
