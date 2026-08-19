import { defineEventHandler, getQuery, createError } from 'h3';
import { readShortSellQuantityCsv } from '../../utils/shortSellingQuantityCsv';
import type { ShortSellQuantityCsvResponse } from '../../../utils/types/lsSecurities';

export default defineEventHandler(async (event): Promise<ShortSellQuantityCsvResponse> => {
  const query = getQuery(event);
  const stockName = String(query.stockName || '').trim();
  if (!stockName) {
    throw createError({ statusCode: 400, statusMessage: '종목명이 필요합니다.' });
  }

  try {
    const records = await readShortSellQuantityCsv(stockName);
    return { stockName, csvExists: records !== null, records: records || [] };
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: error?.message || 'CSV 파일을 읽을 수 없습니다.' });
  }
});
