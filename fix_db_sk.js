import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'stock.db');
console.log('Opening DB at:', dbPath);

const db = new Database(dbPath);

// 1. stocks 테이블 shcode 'A' 접두어 전면 정규화
const allStocks = db.prepare('SELECT * FROM stocks').all();

const updateStmt = db.prepare(`
  UPDATE stocks 
  SET shcode = ?, name = ?, industry = ?, type = ?, updated_at = ? 
  WHERE shcode = ?
`);

const deleteStmt = db.prepare('DELETE FROM stocks WHERE shcode = ?');

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO stocks (shcode, name, industry, type, avg_price, quantity, target_price, stop_price, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const nowStr = new Date().toLocaleString('ko-KR');

// 기존 A 접두어 종목 정규화
for (const stock of allStocks) {
  const cleanCode = stock.shcode.replace(/^A/i, '');
  if (cleanCode !== stock.shcode) {
    deleteStmt.run(stock.shcode);
    insertStmt.run(
      cleanCode,
      stock.name,
      stock.industry || '기타',
      stock.type || 'watchlist',
      stock.avg_price || 0,
      stock.quantity || 0,
      stock.target_price || 0,
      stock.stop_price || 0,
      nowStr
    );
    console.log(`[Normalized] ${stock.name} (${stock.shcode} -> ${cleanCode})`);
  }
}

// 2. SK텔레콤 (017670) 관심종목 UPSERT
insertStmt.run(
  '017670',
  'SK텔레콤',
  '통신업',
  'watchlist',
  0,
  0,
  0,
  0,
  nowStr
);
console.log('[UPSERT] SK텔레콤 (017670) 관심종목 추가 완료!');

// 3. holdings 테이블에 등록된 보유 종목은 stocks 테이블에서 type = 'holding'으로 맞추고 중복 방지
const holdings = db.prepare('SELECT * FROM holdings').all();
for (const h of holdings) {
  const cleanCode = h.shcode.replace(/^A/i, '');
  insertStmt.run(
    cleanCode,
    h.name,
    h.industry || '기타',
    'holding',
    h.avg_price || 0,
    h.quantity || 0,
    h.target_price || 0,
    h.stop_loss_price || 0,
    nowStr
  );
  console.log(`[Holding Synced] ${h.name} (${cleanCode}) holding 속성 동기화 완료`);
}

console.log('--- Current Stocks in DB ---');
console.log(db.prepare('SELECT * FROM stocks').all());
