import { defineEventHandler, readBody, createError } from 'h3';
import { db } from '../../db';
import { stocks, portfolioLogs } from '../../db/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    shcode: string;
    name: string;
    industry?: string;
    type: 'holding' | 'watchlist';
    avgPrice?: number;
    quantity?: number;
  }>(event);

  if (!body || !body.shcode || !body.name || !body.type) {
    throw createError({
      statusCode: 400,
      statusMessage: '종목코드(shcode), 종목명(name), 구분(type)은 필수 입력 항목입니다.'
    });
  }

  const cleanCode = String(body.shcode).trim().replace(/^A/i, '');
  const shcodeWithPrefix = cleanCode.length === 6 && /^\d+$/.test(cleanCode) ? cleanCode : `A${cleanCode}`;
  const nowStr = new Date().toLocaleString('ko-KR');

  try {
    await db.insert(stocks).values({
      shcode: shcodeWithPrefix,
      name: body.name.trim(),
      industry: body.industry || '기타',
      type: body.type,
      avgPrice: Number(body.avgPrice) || 0,
      quantity: Number(body.quantity) || 0,
      updatedAt: nowStr
    }).onConflictDoUpdate({
      target: stocks.shcode,
      set: {
        name: body.name.trim(),
        industry: body.industry || '기타',
        type: body.type,
        avgPrice: Number(body.avgPrice) || 0,
        quantity: Number(body.quantity) || 0,
        updatedAt: nowStr
      }
    });

    // 매매 변동 로그 기록
    const logMsg = body.type === 'holding'
      ? `[보유종목 추가/등록] ${body.name}(${shcodeWithPrefix}) ${body.quantity || 0}주 (평단: ${(body.avgPrice || 0).toLocaleString()}원)`
      : `[관심종목 추가/등록] ${body.name}(${shcodeWithPrefix}) 신규 등록`;

    await db.insert(portfolioLogs).values({
      shcode: shcodeWithPrefix,
      actionType: 'ADD',
      message: logMsg,
      createdAt: nowStr
    });

    return {
      success: true,
      message: `${body.name} 종목이 정상적으로 DB에 추가되었습니다.`
    };
  } catch (err: any) {
    console.error('[Stock Add Error]', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || '종목 추가 중 DB 오류가 발생했습니다.'
    });
  }
});
