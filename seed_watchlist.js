import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'stock.db');
const db = new Database(dbPath);

const now = new Date().toLocaleString('ko-KR');

db.exec(`
  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shcode TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    industry TEXT,
    created_at TEXT NOT NULL
  );
`);

const stmtWatch = db.prepare(`
  INSERT OR IGNORE INTO watchlist (shcode, name, industry, created_at)
  VALUES (?, ?, ?, ?)
`);

stmtWatch.run('000660', 'SK하이닉스', '전기/전자', now);
stmtWatch.run('035420', 'NAVER', '서비스업', now);
stmtWatch.run('035720', '카카오', '서비스업', now);
stmtWatch.run('005380', '현대차', '운수장비', now);
stmtWatch.run('196170', '알테오젠', '의약품', now);
stmtWatch.run('068270', '셀트리온', '의약품', now);
stmtWatch.run('005930', '삼성전자', '전기/전자', now);
stmtWatch.run('475070', 'KoAct 글로벌친환경전력인프라액티브', '전력인프라', now);

const stmtStocks = db.prepare(`
  INSERT OR IGNORE INTO stocks (shcode, name, industry, type, avg_price, quantity, target_price, stop_price, updated_at)
  VALUES (?, ?, ?, 'watchlist', 0, 0, 0, 0, ?)
`);

stmtStocks.run('000660', 'SK하이닉스', '전기/전자', now);
stmtStocks.run('035420', 'NAVER', '서비스업', now);
stmtStocks.run('035720', '카카오', '서비스업', now);
stmtStocks.run('005380', '현대차', '운수장비', now);
stmtStocks.run('196170', '알테오젠', '의약품', now);
stmtStocks.run('068270', '셀트리온', '의약품', now);
stmtStocks.run('005930', '삼성전자', '전기/전자', now);
stmtStocks.run('475070', 'KoAct 글로벌친환경전력인프라액티브', '전력인프라', now);

// Also sync holdings into stocks table
const stmtHoldingsStocks = db.prepare(`
  INSERT OR IGNORE INTO stocks (shcode, name, industry, type, avg_price, quantity, target_price, stop_price, updated_at)
  VALUES (?, ?, ?, 'holding', ?, ?, ?, ?, ?)
`);

stmtHoldingsStocks.run('0186L0', 'KoAct 미국로봇피지컬AI액티브', '인공지능/피지컬AI', 11317, 1046, 12200, 10800, now);
stmtHoldingsStocks.run('0167Z0', 'KODEX 미국우주항공', '우주항공/방산', 9206, 435, 9900, 8790, now);

console.log('Successfully synced 8 watchlists + 2 holdings into SQLite DB!');
const watchRows = db.prepare('SELECT * FROM watchlist').all();
console.log('Total Watchlist in DB:', watchRows.length);
const holdingRows = db.prepare('SELECT * FROM holdings').all();
console.log('Total Holdings in DB:', holdingRows.length);
