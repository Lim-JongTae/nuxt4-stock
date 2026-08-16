import { defineEventHandler, readBody, createError } from 'h3';
import { db } from '../../db';
import { stocks, watchlist, holdings, portfolioLogs } from '../../db/schema';
import { eq, or } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const shcodeParam = event.context.params?.shcode;
  if (!shcodeParam) {
    throw createError({ statusCode: 400, statusMessage: '종목코드가 누락되었습니다.' });
  }

  const body = await readBody<{
    name?: string;
    industry?: string;
    type?: 'holding' | 'watchlist';
    avgPrice?: number;
    quantity?: number;
  }>(event);

  const rawCode = String(shcodeParam).trim();
  const cleanCode = rawCode.replace(/^A/i, '');
  const codeWithPrefix = cleanCode.length === 6 && /^\d+$/.test(cleanCode) ? `A${cleanCode}` : cleanCode;
  const nowStr = new Date().toLocaleString('ko-KR');

  try {
    const existingStocks = await db.select().from(stocks).where(or(eq(stocks.shcode, cleanCode), eq(stocks.shcode, codeWithPrefix)));
    const existingHoldings = await db.select().from(holdings).where(or(eq(holdings.shcode, cleanCode), eq(holdings.shcode, codeWithPrefix)));
    const existingWatch = await db.select().from(watchlist).where(or(eq(watchlist.shcode, cleanCode), eq(watchlist.shcode, codeWithPrefix)));

    const current = existingStocks[0] || existingHoldings[0] || existingWatch[0];
    const newName = body.name || current?.name || cleanCode;
    const newIndustry = body.industry || current?.industry || '주요업종';
    const newType = body.type || (current as any)?.type || (existingHoldings.length > 0 ? 'holding' : 'watchlist');
    const newAvgPrice = typeof body.avgPrice === 'number' ? body.avgPrice : (current as any)?.avgPrice || 0;
    const newQuantity = typeof body.quantity === 'number' ? body.quantity : (current as any)?.quantity || 0;

    // 1. stocks 테이블 갱신 / upsert
    await db.insert(stocks)
      .values({
        shcode: cleanCode,
        name: newName,
        industry: newIndustry,
        type: newType,
        avgPrice: newAvgPrice,
        quantity: newQuantity,
        updatedAt: nowStr
      })
      .onConflictDoUpdate({
        target: stocks.shcode,
        set: {
          name: newName,
          industry: newIndustry,
          type: newType,
          avgPrice: newAvgPrice,
          quantity: newQuantity,
          updatedAt: nowStr
        }
      });

    // 2. 구분에 따라 holdings / watchlist 테이블 동기화
    if (newType === 'holding') {
      await db.insert(holdings)
        .values({
          shcode: cleanCode,
          name: newName,
          industry: newIndustry,
          quantity: newQuantity,
          avgPrice: newAvgPrice,
          updatedAt: nowStr
        })
        .onConflictDoUpdate({
          target: holdings.shcode,
          set: {
            name: newName,
            industry: newIndustry,
            quantity: newQuantity,
            avgPrice: newAvgPrice,
            updatedAt: nowStr
          }
        });
      await db.delete(watchlist).where(or(eq(watchlist.shcode, cleanCode), eq(watchlist.shcode, codeWithPrefix)));
    } else {
      await db.insert(watchlist)
        .values({
          shcode: cleanCode,
          name: newName,
          industry: newIndustry,
          createdAt: nowStr
        })
        .onConflictDoUpdate({
          target: watchlist.shcode,
          set: {
            name: newName,
            industry: newIndustry
          }
        });
      await db.delete(holdings).where(or(eq(holdings.shcode, cleanCode), eq(holdings.shcode, codeWithPrefix)));
    }

    // 3. 매매 변동 로그 기록
    const logMsg = `[종목 정보 수정] ${newName}(${cleanCode}) ➡️ 유형: ${newType}, 평단: ${(newAvgPrice || 0).toLocaleString()}원, 수량: ${newQuantity || 0}주`;
    await db.insert(portfolioLogs).values({
      shcode: cleanCode,
      actionType: 'UPDATE',
      message: logMsg,
      createdAt: nowStr
    });

    console.log(`✅ [종목 DB 수정 완료]: ${newName} (${cleanCode})`);

    return {
      success: true,
      message: `${newName} 종목 정보가 업데이트되었습니다.`
    };
  } catch (err: any) {
    console.error('[Stock Update Error]', err);
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || '종목 정보 수정 실패'
    });
  }
});
