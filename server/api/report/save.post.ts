import { defineEventHandler, readBody, createError } from 'h3';
import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ shcode: string; name: string; report: string }>(event);
  if (!body || !body.shcode || !body.report) {
    throw createError({
      statusCode: 400,
      statusMessage: 'shcode와 report 내용이 필요합니다.'
    });
  }

  const cleanCode = String(body.shcode).trim().replace(/^A/i, '');
  const nowStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const reportDir = path.resolve(process.cwd(), 'report');

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // 1. Markdown 개별 진단 보고서 파일만 영구 저장 (report/YYYY-MM-DD_[shcode].md)
  const mdFileName = `${nowStr}_${cleanCode}.md`;
  const mdFilePath = path.join(reportDir, mdFileName);
  fs.writeFileSync(mdFilePath, body.report, 'utf-8');

  return {
    success: true,
    mdPath: mdFileName
  };
});
