import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// 1. Holdings Table (보유 종목 상세 현황)
export const holdings = sqliteTable('holdings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shcode: text('shcode').notNull().unique(),
  name: text('name').notNull(),
  industry: text('industry'),
  quantity: integer('quantity').notNull(),
  avgPrice: real('avg_price').notNull(),
  currentPrice: real('current_price').default(0),
  targetPrice: real('target_price').default(0),
  stopLossPrice: real('stop_loss_price').default(0),
  updatedAt: text('updated_at').notNull()
});

// 2. Screener History Table (유망업종 & 기술적 지표 퀀트 스크리닝 이력)
export const screenerHistory = sqliteTable('screener_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  batchId: text('batch_id').notNull(), // 예: 2026-08-11_130000
  shcode: text('shcode').notNull(),
  name: text('name').notNull(),
  industry: text('industry').notNull(),
  closePrice: real('close_price').notNull(),
  psy: real('psy'),
  bbLower: real('bb_lower'),
  ma5: real('ma5'),
  ma20: real('ma20'),
  ma60: real('ma60'),
  volumeRatio: real('volume_ratio'),
  macdHist: real('macd_hist'),
  rsi: real('rsi'),
  bullishDivergence: integer('bullish_divergence', { mode: 'boolean' }),
  shortSellingStatus: text('short_selling_status'),
  shortSellingConfidence: text('short_selling_confidence'),
  shortSellingSummary: text('short_selling_summary'),
  shortSellMetrics: text('short_sell_metrics', { mode: 'json' }),
  score: integer('score').notNull(), // 0 ~ 100 퀀트 점수
  isFullyMatched: integer('is_fully_matched', { mode: 'boolean' }).notNull(),
  createdAt: text('created_at').notNull()
});

// 3. AI Reports Archive Table (일별 AI 투자 보고서 아카이브)
export const aiReports = sqliteTable('ai_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportDate: text('report_date').notNull(),
  title: text('title').notNull(),
  contentMarkdown: text('content_markdown').notNull(),
  createdAt: text('created_at').notNull()
});

// 4. Watchlist Table (관심 종목)
export const watchlist = sqliteTable('watchlist', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shcode: text('shcode').notNull().unique(),
  name: text('name').notNull(),
  industry: text('industry'),
  createdAt: text('created_at').notNull(),
});
