import { defineEventHandler, createError } from 'h3';
import { db } from '../../db';
import { stocks, watchlist, holdings, portfolioLogs } from '../../db/schema';
import { eq, or } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const shcodeParam = event.context.params?.shcode;
  if (!shcodeParam) {
    throw createError({ statusCode: 400, statusMessage: '종목코드가 누락되었습니다.' });
  }

  const rawCode = String(shcodeParam).trim();
  const cleanCode = rawCode.replace(/^A/i, '');
  const codeWithPrefix = cleanCode.length === 6 && /^\d+$/.test(cleanCode) ? `A${cleanCode}` : cleanCode;
  const nowStr = new Date().toLocaleString('ko-KR');

  try {
    // 1. stocks, watchlist, holdings 3개 테이블 전체에서 조회 및 이름 파악
    const existingStocks = await db.select().from(stocks).where(or(eq(stocks.shcode, cleanCode), eq(stocks.shcode, codeWithPrefix)));
    const existingHoldings = await db.select().from(holdings).where(or(eq(holdings.shcode, cleanCode), eq(holdings.shcode, codeWithPrefix)));
    const existingWatch = await db.select().from(watchlist).where(or(eq(watchlist.shcode, cleanCode), eq(watchlist.shcode, codeWithPrefix)));

    const stockName = existingStocks[0]?.name || existingHoldings[0]?.name || existingWatch[0]?.name || cleanCode;

    // 2. 3개 테이블 (stocks, watchlist, holdings) 모두에서 완벽 삭제
    await db.delete(stocks).where(or(eq(stocks.shcode, cleanCode), eq(stocks.shcode, codeWithPrefix)));
    await db.delete(watchlist).where(or(eq(watchlist.shcode, cleanCode), eq(watchlist.shcode, codeWithPrefix)));
    await db.delete(holdings).where(or(eq(holdings.shcode, cleanCode), eq(holdings.shcode, codeWithPrefix)));

    // 3. 매매 변동 로그 기록
    await db.insert(portfolioLogs).values({
      shcode: cleanCode,
      actionType: 'DELETE',
      message: `[종목 삭제] ${stockName}(${cleanCode}) SQLite DB (stocks, watchlist, holdings) 삭제 완료`,
      createdAt: nowStr
    });

    console.log(`✅ [종목 DB 삭제 완료]: ${stockName} (${cleanCode} / ${codeWithPrefix})`);

    return {
      success: true,
      message: `${stockName} 종목이 DB에서 완전히 삭제되었습니다.`
    };
  } catch (err: any) {
    console.error('[Stock Delete Error]', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || '종목 삭제 실패'
    });
  }
});
