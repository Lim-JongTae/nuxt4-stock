import { defineEventHandler, readBody, createError } from 'h3';
import { db } from '../../db';
import { stocks, portfolioLogs } from '../../db/schema';
import { eq } from 'drizzle-orm';

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

  const targetCode = String(shcodeParam).trim();
  const nowStr = new Date().toLocaleString('ko-KR');

  try {
    const existing = await db.select().from(stocks).where(eq(stocks.shcode, targetCode));
    if (existing.length === 0) {
      throw createError({ statusCode: 404, statusMessage: '해당 종목을 DB에서 찾을 수 없습니다.' });
    }

    const current = existing[0];
    const newName = body.name || current.name;
    const newIndustry = body.industry || current.industry;
    const newType = body.type || current.type;
    const newAvgPrice = typeof body.avgPrice === 'number' ? body.avgPrice : current.avgPrice;
    const newQuantity = typeof body.quantity === 'number' ? body.quantity : current.quantity;

    await db.update(stocks)
      .set({
        name: newName,
        industry: newIndustry,
        type: newType,
        avgPrice: newAvgPrice,
        quantity: newQuantity,
        updatedAt: nowStr
      })
      .where(eq(stocks.shcode, targetCode));

    // 매매 변동 로그 기록
    const logMsg = `[종목 정보 수정] ${newName}(${targetCode}) ➡️ 유형: ${newType}, 평단: ${(newAvgPrice || 0).toLocaleString()}원, 수량: ${newQuantity || 0}주`;

    await db.insert(portfolioLogs).values({
      shcode: targetCode,
      actionType: 'UPDATE',
      message: logMsg,
      createdAt: nowStr
    });

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
