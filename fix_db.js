import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'stock.db');
console.log('Opening DB at:', dbPath);

const db = new Database(dbPath);

db.exec(`DELETE FROM holdings;`);

const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

const stmt = db.prepare(`
  INSERT INTO holdings (shcode, name, industry, quantity, avg_price, current_price, target_price, stop_loss_price, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

stmt.run('0186L0', 'KoAct 미국로봇피지컬AI액티브', '인공지능/피지컬AI', 1046, 11317, 9755, 12200, 10800, now);
stmt.run('0167Z0', 'KODEX 미국우주항공', '우주항공/방산', 435, 9206, 8495, 9900, 8790, now);

console.log('Successfully updated holdings table!');
const rows = db.prepare('SELECT * FROM holdings').all();
console.log('Current holdings in DB:', rows);
