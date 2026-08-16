import { defineEventHandler } from 'h3';
import { db } from '../../db';
import { stocks, holdings, watchlist } from '../../db/schema';

export default defineEventHandler(async () => {
  try {
    const dbHoldings = await db.select().from(holdings).all();
    const dbWatchlist = await db.select().from(watchlist).all();
    const dbStocks = await db.select().from(stocks).all();

    const mergedMap = new Map<string, any>();

    // 1. holdings 테이블 통합 (보유종목)
    dbHoldings.forEach(h => {
      mergedMap.set(h.shcode, {
        shcode: h.shcode,
        name: h.name,
        industry: h.industry || '보유종목',
        type: 'holding',
        avgPrice: h.avgPrice || 0,
        quantity: h.quantity || 0,
        currentPrice: h.currentPrice || h.avgPrice || 0
      });
    });

    // 2. watchlist 테이블 통합 (관심종목)
    dbWatchlist.forEach(w => {
      if (!mergedMap.has(w.shcode)) {
        mergedMap.set(w.shcode, {
          shcode: w.shcode,
          name: w.name,
          industry: w.industry || '주요업종',
          type: 'watchlist',
          avgPrice: 0,
          quantity: 0
        });
      }
    });

    // 3. stocks 마스터 테이블 통합
    dbStocks.forEach(s => {
      if (!mergedMap.has(s.shcode)) {
        mergedMap.set(s.shcode, {
          shcode: s.shcode,
          name: s.name,
          industry: s.industry || '주요업종',
          type: s.type || 'watchlist',
          avgPrice: s.avgPrice || 0,
          quantity: s.quantity || 0
        });
      }
    });

    const allList = Array.from(mergedMap.values()).sort((a, b) => a.shcode.localeCompare(b.shcode));
    const holdingsList = allList.filter(item => item.type === 'holding');
    const watchlistList = allList.filter(item => item.type === 'watchlist');

    return {
      success: true,
      data: {
        all: allList,
        holdings: holdingsList,
        watchlist: watchlistList
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
