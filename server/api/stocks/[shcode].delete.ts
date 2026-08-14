import { defineEventHandler, createError } from 'h3';
import { db } from '../../db';
import { stocks, portfolioLogs } from '../../db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const shcodeParam = event.context.params?.shcode;
  if (!shcodeParam) {
    throw createError({ statusCode: 400, statusMessage: '종목코드가 누락되었습니다.' });
  }

  const targetCode = String(shcodeParam).trim();
  const nowStr = new Date().toLocaleString('ko-KR');

  try {
    const existing = await db.select().from(stocks).where(eq(stocks.shcode, targetCode));
    const stockName = existing.length > 0 ? existing[0].name : targetCode;

    await db.delete(stocks).where(eq(stocks.shcode, targetCode));

    // 매매 변동 로그 기록
    await db.insert(portfolioLogs).values({
      shcode: targetCode,
      actionType: 'DELETE',
      message: `[종목 삭제] ${stockName}(${targetCode}) 포트폴리오/관심목록에서 삭제 완료`,
      createdAt: nowStr
    });

    return {
      success: true,
      message: `${stockName} 종목이 DB에서 삭제되었습니다.`
    };
  } catch (err: any) {
    console.error('[Stock Delete Error]', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || '종목 삭제 실패'
    });
  }
});
