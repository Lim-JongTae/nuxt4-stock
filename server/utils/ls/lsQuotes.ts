import type { StockCandleMap, StockCandleData, FetchLSQuoteParams } from '../../../utils/types/lsSecurities';
import { sanitizeDomesticShcode, parseLSNumber, formatDateYYYYMMDD } from './lsAuth';

// 1. Fetch Live Current Price via LS API (t1102 TR)
export async function fetchLSPrice(
  token: string,
  shcode: string
): Promise<number | null> {
  const rawCode = sanitizeDomesticShcode(shcode);
  if (!rawCode) return null;

  try {
    const res = await fetch('https://openapi.ls-sec.co.kr:8080/stock/market-data', {
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
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.t1102OutBlock && data.t1102OutBlock.price) {
        const price = parseLSNumber(data.t1102OutBlock.price);
        if (price > 0) return price;
      }
    }
  } catch (e: any) {
    console.error(`🔴 [LS증권 t1102 시세 수신 실패 - ${shcode}]:`, e.message || String(e));
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

  const past = new Date(Date.now() - 160 * 24 * 60 * 60 * 1000);
  const sdate = formatDateYYYYMMDD(past);
  const edate = formatDateYYYYMMDD(new Date());

  try {
    const res = await fetch('https://openapi.ls-sec.co.kr:8080/stock/chart', {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'authorization': 'Bearer ' + token,
        'tr_cd': 't8410',
        'tr_cont': 'N'
      },
      body: JSON.stringify({
        t8410InBlock: {
          shcode: rawCode,
          gubun: '2',      // 2: 일봉
          qrycnt: 100,
          sdate: sdate,
          edate: edate,
          cts_date: '',
          comp_yn: 'N',
          sujung: 'Y'
        }
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const data = await res.json();
      const rows = data.t8410OutBlock1 || data.t8410OutBlock;
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
      }
    } else {
      console.error(`🔴 [LS증권 t8410 응답 오류 - ${shcode}]: HTTP ${res.status}`);
    }
  } catch (e: any) {
    console.error(`🔴 [LS증권 t8410 차트 수신 실패 - ${shcode}]:`, e.message || String(e));
  }

  // 오늘 날짜 데이터는 externalLivePrice 실시간가가 전달되면 덮어씀
  if (externalLivePrice && externalLivePrice > 0) {
    const todayStr = formatDateYYYYMMDD(new Date());
    const formattedToday = `${todayStr.slice(0, 4)}-${todayStr.slice(4, 6)}-${todayStr.slice(6, 8)}`;
    const existing = htsMap.get(formattedToday);
    if (existing) {
      existing.close = externalLivePrice;
      if (externalLivePrice > existing.high) existing.high = externalLivePrice;
      if (existing.low === 0 || externalLivePrice < existing.low) existing.low = externalLivePrice;
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

  return htsMap.size > 0 ? htsMap : null;
}
