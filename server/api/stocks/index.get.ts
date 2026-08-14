import { defineEventHandler } from 'h3';
import { db } from '../../db';
import { stocks } from '../../db/schema';
import { asc } from 'drizzle-orm';

export default defineEventHandler(async () => {
  try {
    const list = await db.select().from(stocks).orderBy(asc(stocks.shcode));
    
    const holdings = list.filter(item => item.type === 'holding');
    const watchlist = list.filter(item => item.type === 'watchlist');

    return {
      success: true,
      data: {
        all: list,
        holdings,
        watchlist
      }
    };
  } catch (err: any) {
    console.error('[Stocks GET Error]', err);
    return {
      success: false,
      error: err.message || 'SQLite DB 종목 조회 실패',
      data: { all: [], holdings: [], watchlist: [] }
    };
  }
});
