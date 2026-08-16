import { defineEventHandler } from 'h3';
import { db } from '../../db';
import { stocks, holdings, watchlist as watchlistTable } from '../../db/schema';

export default defineEventHandler(async () => {
  try {
    const dbHoldings = await db.select().from(holdings).all();
    const dbWatchlist = await db.select().from(watchlistTable).all();
    const dbStocks = await db.select().from(stocks).all();

    const holdingsList = [...dbHoldings];
    const watchlistMap = new Map<string, any>();

    // 1. watchlist 테이블 항목 수집
    dbWatchlist.forEach(w => {
      watchlistMap.set(w.shcode, {
        shcode: w.shcode,
        name: w.name,
        industry: w.industry || '주요업종',
        type: 'watchlist'
      });
    });

    // 2. stocks 마스터 테이블 관심종목 수집
    dbStocks.forEach(s => {
      if (s.type === 'watchlist' && !watchlistMap.has(s.shcode)) {
        watchlistMap.set(s.shcode, {
          shcode: s.shcode,
          name: s.name,
          industry: s.industry || '주요업종',
          type: 'watchlist'
        });
      }
    });

    const watchlistList = Array.from(watchlistMap.values());

    return {
      success: true,
      holdings: holdingsList,
      watchlist: watchlistList
    };
  } catch (e: any) {
    console.error('⚠️ [Watchlist API GET Error]:', e);
    return {
      success: false,
      holdings: [],
      watchlist: []
    };
  }
});
