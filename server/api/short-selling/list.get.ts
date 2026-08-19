import { defineEventHandler, createError } from 'h3';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ShortSellCsvListResponse } from '../../../utils/types/lsSecurities';

const CSV_DIRECTORY = path.resolve(process.cwd(), 'data', 'short-selling-csv');

export default defineEventHandler(async (): Promise<ShortSellCsvListResponse> => {
  try {
    await fs.access(CSV_DIRECTORY);
  } catch {
    return { files: [] };
  }

  try {
    const entries = await fs.readdir(CSV_DIRECTORY, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.csv'))
        .map(async (entry) => {
          const filePath = path.join(CSV_DIRECTORY, entry.name);
          const stats = await fs.stat(filePath);
          const stockName = entry.name.replace(/\.csv$/, '');

          // CSV 레코드 개수 계산
          let recordCount = 0;
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.trim().split('\n');
            recordCount = Math.max(0, lines.length - 1); // 헤더 제외
          } catch {
            recordCount = 0;
          }

          return {
            stockName,
            fileName: entry.name,
            modifiedAt: stats.mtime.toISOString(),
            recordCount
          };
        })
    );

    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return { files };
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'CSV 파일 목록을 읽을 수 없습니다.' });
  }
});
