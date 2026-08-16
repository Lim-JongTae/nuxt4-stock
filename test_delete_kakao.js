import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'stock.db');
const db = new Database(dbPath);

console.log('--- BEFORE DELETING KAKAO (035720) ---');
console.log('Watchlist Kakao:', db.prepare("SELECT * FROM watchlist WHERE shcode LIKE '%035720%'").all());
console.log('Holdings Kakao:', db.prepare("SELECT * FROM holdings WHERE shcode LIKE '%035720%'").all());
console.log('Stocks Kakao:', db.prepare("SELECT * FROM stocks WHERE shcode LIKE '%035720%'").all());
