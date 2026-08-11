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
    psy REAL NOT NULL,
    bb_lower REAL NOT NULL,
    ma5 REAL NOT NULL,
    ma20 REAL NOT NULL,
    ma60 REAL NOT NULL,
    volume_ratio REAL NOT NULL,
    macd_hist REAL NOT NULL,
    rsi REAL NOT NULL,
    bullish_divergence INTEGER NOT NULL,
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
`);

export const db = drizzle(sqlite, { schema });

// Seed/Sync initial holdings matching 종목.md (보유종목 2개)
const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
db.delete(schema.holdings).run();
db.insert(schema.holdings).values([
  { shcode: '0186L0', name: 'KoAct 미국로봇피지컬AI액티브', industry: '인공지능/피지컬AI', quantity: 1046, avgPrice: 11317, currentPrice: 9755, targetPrice: 12200, stopLossPrice: 10800, updatedAt: now },
  { shcode: '0167Z0', name: 'KODEX 미국우주항공', industry: '우주항공/방산', quantity: 435, avgPrice: 9206, currentPrice: 8495, targetPrice: 9900, stopLossPrice: 8790, updatedAt: now }
]).run();

