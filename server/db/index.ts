import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'stock.db');
const sqlite = new Database(dbPath);

// Create tables if not exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shcode TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    industry TEXT,
    quantity INTEGER NOT NULL,
    avg_price REAL NOT NULL,
    current_price REAL DEFAULT 0,
    target_price REAL DEFAULT 0,
    stop_loss_price REAL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS screener_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    shcode TEXT NOT NULL,
    name TEXT NOT NULL,
    industry TEXT NOT NULL,
    close_price REAL NOT NULL,
    psy REAL,
    bb_lower REAL,
    ma5 REAL,
    ma20 REAL,
    ma60 REAL,
    volume_ratio REAL,
    macd_hist REAL,
    rsi REAL,
    bullish_divergence INTEGER,
    short_selling_status TEXT,
    short_selling_confidence TEXT,
    short_selling_summary TEXT,
    short_sell_metrics TEXT,
    score INTEGER NOT NULL,
    is_fully_matched INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date TEXT NOT NULL,
    title TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shcode TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    industry TEXT,
    created_at TEXT NOT NULL
  );
`);

// Auto migration check: NOT NULL 제약 해제 및 컬럼 갱신 마이그레이션
try {
  const screenerCols = sqlite.prepare("PRAGMA table_info(screener_history)").all() as { name: string; notnull: number }[];
  const existingCols = new Set(screenerCols.map(c => c.name));
  
  // psy 컬럼이 NOT NULL(notnull === 1)이거나 신규 공매도 컬럼이 없는 기존 DB 구조 감지
  const psyCol = screenerCols.find(c => c.name === 'psy');
  const needsMigration = (psyCol && psyCol.notnull === 1) || !existingCols.has('short_selling_status');

  if (needsMigration) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS screener_history_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        shcode TEXT NOT NULL,
        name TEXT NOT NULL,
        industry TEXT NOT NULL,
        close_price REAL NOT NULL,
        psy REAL,
        bb_lower REAL,
        ma5 REAL,
        ma20 REAL,
        ma60 REAL,
        volume_ratio REAL,
        macd_hist REAL,
        rsi REAL,
        bullish_divergence INTEGER,
        short_selling_status TEXT,
        short_selling_confidence TEXT,
        short_selling_summary TEXT,
        short_sell_metrics TEXT,
        score INTEGER NOT NULL,
        is_fully_matched INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      INSERT INTO screener_history_new (
        id, batch_id, shcode, name, industry, close_price, psy, bb_lower,
        ma5, ma20, ma60, volume_ratio, macd_hist, rsi, bullish_divergence,
        score, is_fully_matched, created_at
      )
      SELECT 
        id, batch_id, shcode, name, industry, close_price, psy, bb_lower,
        ma5, ma20, ma60, volume_ratio, macd_hist, rsi, bullish_divergence,
        score, is_fully_matched, created_at
      FROM screener_history;

      DROP TABLE screener_history;
      ALTER TABLE screener_history_new RENAME TO screener_history;
    `);
  }
} catch (e) {
  console.error('[DB Migration Error]', e);
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS stocks (
    shcode TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT DEFAULT '기타',
    type TEXT NOT NULL,
    avg_price REAL DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    target_price REAL DEFAULT 0,
    stop_price REAL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS portfolio_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shcode TEXT NOT NULL,
    action_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export const db = drizzle(sqlite, { schema });
export const sqliteDb = sqlite;

// Seed initial holdings matching 종목.md (보유종목 2개)
// 주의: 이전 버전은 매 모듈 로드(서버 재시작/재빌드/HMR 등)마다 무조건
// delete + insert를 실행해서, 그 사이 실제로 갱신된 current_price/quantity 등이
// 매번 하드코딩된 초기값으로 덮어써지는 버그가 있었음.
// -> holdings 테이블이 비어있을 때(최초 1회)만 시드하도록 변경.
const holdingsCount = sqlite.prepare('SELECT COUNT(*) AS cnt FROM holdings').get() as { cnt: number };
if (holdingsCount.cnt === 0) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  db.insert(schema.holdings).values([
    { shcode: '0186L0', name: 'KoAct 미국로봇피지컬AI액티브', industry: '인공지능/피지컬AI', quantity: 1046, avgPrice: 11317, currentPrice: 9755, targetPrice: 12200, stopLossPrice: 10800, updatedAt: now },
    { shcode: '0167Z0', name: 'KODEX 미국우주항공', industry: '우주항공/방산', quantity: 435, avgPrice: 9206, currentPrice: 8495, targetPrice: 9900, stopLossPrice: 8790, updatedAt: now }
  ]).run();
}

const watchlistCount = sqlite.prepare('SELECT COUNT(*) AS cnt FROM watchlist').get() as { cnt: number };
if (watchlistCount.cnt === 0) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  db.insert(schema.watchlist).values([
    { shcode: '475070', name: 'KoAct 글로벌친환경전력인프라액티브', industry: '전력인프라', createdAt: now },
    { shcode: '481180', name: 'SOL 미국AI소프트웨어', industry: 'AI소프트웨어', createdAt: now },
    { shcode: '035420', name: 'NAVER', industry: '빅테크/디지털', createdAt: now },
    { shcode: '005930', name: '삼성전자', industry: '전기전자', createdAt: now },
    { shcode: '000660', name: 'SK하이닉스', industry: 'IT부품/반도체', createdAt: now },
    { shcode: '068270', name: '셀트리온', industry: '바이오/제약', createdAt: now }
  ]).run();
}


