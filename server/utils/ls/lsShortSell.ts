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

  try {
    const res = await fetch('https://openapi.ls-sec.co.kr:8080/stock/etc', {
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
      signal: AbortSignal.timeout(5000)
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
          
          const balanceRatioRaw = parseLSNumberOrUndefined(r.gm_per) ?? 0;
          const balanceRatio = balanceRatioRaw !== undefined ? balanceRatioRaw : 0;

          const shortAvgPrice = parseLSNumberOrUndefined(r.gm_avg) ?? parseLSNumberOrUndefined(r.price) ?? 0;
          const shortVolume = parseLSNumber(r.gm_vo_sum) || 0;  // 누적 공매도 수량 = 잔고수량
          const changeRate = parseFloat(String(r.diff || 0));

          if (formattedDate) {
            detailMap.set(formattedDate, { balanceRatio, shortAvgPrice, shortVolume, changeRate });
          }
        });
      }
    }
  } catch (e: any) {
    console.error(`🔴 [LS증권 t1927 공매도 수신 실패 - ${shcode}]:`, e.message || String(e));
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
    // 병렬 처리: fetchLSPrice와 fetchLSShortSellDetailMap은 독립적
    const [livePrice, shortDetailMap] = await Promise.all([
      externalLivePrice !== undefined
        ? Promise.resolve(externalLivePrice)
        : fetchLSPrice(token, shcode),
      fetchLSShortSellDetailMap(token, shcode)
    ]);

    // htsPriceMap은 livePrice에 의존하므로 순차 실행
    const htsPriceMap = await fetchLST1305Prices(token, shcode, livePrice);

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
        // hts.diff는 존재하지 않으므로 shortDetail.changeRate만 사용
        const changeRate = shortDetail?.changeRate || 0;

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
