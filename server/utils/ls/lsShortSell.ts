import type { ShortSellRecord, FetchLSQuoteParams } from '../../../utils/types/lsSecurities';
import { sanitizeDomesticShcode, parseLSNumber, parseLSNumberOrUndefined, formatDateYYYYMMDD } from './lsAuth';
import { fetchLSPrice, fetchLST1305Prices } from './lsQuotes';

// 3. Fetch Short Selling Details via LS API (t1927) - 공매도 전용 지표 수집
export async function fetchLSShortSellDetailMap(
  token: string,
  shcode: string
): Promise<Map<string, { balanceRatio: number; shortAvgPrice: number; shortVolume: number; changeRate: number }>> {
  const detailMap = new Map<string, { balanceRatio: number; shortAvgPrice: number; shortVolume: number; changeRate: number }>();
  const rawCode = sanitizeDomesticShcode(shcode);
  if (!rawCode) return detailMap;

  const now = new Date();
  const edate = formatDateYYYYMMDD(now);
  const past = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
  const sdate = formatDateYYYYMMDD(past);

  const urls = [
    'https://openapi.ls-sec.co.kr:8080/stock/etc',
    'https://openapi.ls-sec.co.kr/stock/etc'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'authorization': 'Bearer ' + token,
          'tr_cd': 't1927',
          'tr_cont': 'N'
        },
        body: JSON.stringify({
          t1927InBlock: {
            shcode: rawCode,
            sdate: sdate,
            edate: edate
          }
        }),
        signal: AbortSignal.timeout(2500)
      });

      if (res.ok) {
        const data = await res.json();
        const rows = data.t1927OutBlock1 || data.t1927OutBlock;
        if (Array.isArray(rows) && rows.length > 0) {
          rows.forEach((r: any) => {
            const rawDate = String(r.date || '').trim();
            const formattedDate = rawDate.length === 8 
              ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
              : rawDate;
            
            const balanceRatio = parseLSNumberOrUndefined(r.gm_per) ?? parseLSNumberOrUndefined(r.ms_m_rate) ?? parseLSNumberOrUndefined(r.ms_rate) ?? 0;
            const shortAvgPrice = parseLSNumberOrUndefined(r.gm_avg) ?? parseLSNumberOrUndefined(r.price) ?? 0;
            const shortVolume = parseLSNumber(r.gm_vo) || parseLSNumber(r.gm_vo_sum) || 0;
            const changeRate = parseFloat(String(r.diff || 0));

            if (formattedDate) {
              detailMap.set(formattedDate, { balanceRatio, shortAvgPrice, shortVolume, changeRate });
            }
          });
          if (detailMap.size > 0) break;
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ [LS증권 t1927 공매도 API 수신 실패 - ${shcode}]:`, e.message || String(e));
    }
  }
  return detailMap;
}

// 4. Fetch Short Selling Trend (t1305 주식 시세 + t1927 공매도 분리 결합)
export async function fetchLSShortSellTrend(
  token: string,
  shcode: string,
  externalLivePrice?: number | null
): Promise<ShortSellRecord[] | null>;
export async function fetchLSShortSellTrend(
  params: FetchLSQuoteParams
): Promise<ShortSellRecord[] | null>;
export async function fetchLSShortSellTrend(
  tokenOrParams: string | FetchLSQuoteParams,
  shcodeArg?: string,
  externalLivePriceArg?: number | null
): Promise<ShortSellRecord[] | null> {
  const token = typeof tokenOrParams === 'string' ? tokenOrParams : tokenOrParams.token;
  const shcode = typeof tokenOrParams === 'string' ? (shcodeArg || '') : tokenOrParams.shcode;
  const externalLivePrice = typeof tokenOrParams === 'string' ? externalLivePriceArg : tokenOrParams.externalLivePrice;

  const rawCode = sanitizeDomesticShcode(shcode);
  if (!rawCode) return null;

  try {
    const livePrice = externalLivePrice !== undefined ? externalLivePrice : await fetchLSPrice(token, shcode);
    const htsPriceMap = await fetchLST1305Prices(token, shcode, livePrice);
    const shortDetailMap = await fetchLSShortSellDetailMap(token, shcode);

    const todayStr = formatDateYYYYMMDD(new Date());
    const formattedToday = `${todayStr.slice(0, 4)}-${todayStr.slice(4, 6)}-${todayStr.slice(6, 8)}`;

    const allDates = new Set<string>([
      ...(htsPriceMap ? Array.from(htsPriceMap.keys()) : []),
      ...Array.from(shortDetailMap.keys())
    ]);

    if (allDates.size > 0) {
      const combinedRecords: ShortSellRecord[] = Array.from(allDates).map((date) => {
        const hts = htsPriceMap?.get(date);
        const shortDetail = shortDetailMap.get(date);

        let price = hts?.close || 0;
        let volume = hts?.volume || 0;
        const changeRate = hts?.diff !== undefined ? hts.diff : (shortDetail?.changeRate || 0);

        if (date === formattedToday && livePrice && livePrice > 0) {
          price = livePrice;
        }

        const shortAvgPrice = shortDetail?.shortAvgPrice ? shortDetail.shortAvgPrice : undefined;
        const shortVolume = shortDetail?.shortVolume ? shortDetail.shortVolume : undefined;
        const balanceRatio = shortDetail?.balanceRatio ?? 0;

        return {
          date,
          price,
          volume,
          shortAvgPrice,
          shortVolume,
          changeRate,
          balanceRatio
        };
      }).filter(r => r.price > 0);

      const sorted = combinedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return sorted.slice(0, 5);
    }
  } catch (e: any) {
    console.warn(`⚠️ [LS증권 공매도 수급 데이터 조합 실패 - ${shcode}]:`, e.message || String(e));
  }
  return null;
}
