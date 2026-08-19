import { createError, defineEventHandler, readBody } from 'h3';
import { writeShortSellQuantityCsv } from '../../utils/shortSellingQuantityCsv';
import type { ShortSellQuantityCsvRecord } from '../../../utils/types/lsSecurities';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ stockName?: string; records?: ShortSellQuantityCsvRecord[] }>(event);
  const stockName = String(body?.stockName || '').trim();
  if (!stockName || !Array.isArray(body?.records)) {
    throw createError({ statusCode: 400, statusMessage: '종목명과 CSV 기록이 필요합니다.' });
  }

  try {
    const records = await writeShortSellQuantityCsv(stockName, body.records);
    return { success: true, stockName, csvExists: true, records };
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: error?.message || 'CSV 파일을 저장할 수 없습니다.' });
  }
});
