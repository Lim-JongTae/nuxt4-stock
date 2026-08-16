import { db } from '../../db';
import { stocks } from '../../db/schema';
import { loadEnv, getLSToken } from '../../utils/ls/lsAuth';
import { fetchLSPrice } from '../../utils/ls/lsQuotes';

export default defineEventHandler(async () => {
  const env = loadEnv();
  const token = await getLSToken(env.LS_APP_KEY || '', env.LS_SECREAT || '');

  const items = await db.select().from(stocks).all();
  const localTime = new Date().toLocaleString('ko-KR');

  for (const item of items) {
    if (token) {
      try {
        const livePrice = await fetchLSPrice(token, item.shcode);
        if (livePrice && livePrice > 0) {
          item.closePrice = livePrice;
          item.updatedAt = localTime;
        }
      } catch (e: any) {
        console.warn(`⚠️ [LS증권 t1102 관심종목 시세 갱신 실패 - ${item.shcode}]:`, e.message || String(e));
      }
    }
  }

  return items;
});
