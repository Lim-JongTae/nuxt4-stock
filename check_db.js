import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'stock.db');
const db = new Database(dbPath);

console.log('--- 1. HOLDINGS TABLE ---');
const holdingsRows = db.prepare('SELECT * FROM holdings').all();
console.dir(holdingsRows, { depth: null });

console.log('\n--- 2. WATCHLIST TABLE ---');
const watchlistRows = db.prepare('SELECT * FROM watchlist').all();
console.dir(watchlistRows, { depth: null });

console.log('\n--- 3. STOCKS TABLE ---');
const stocksRows = db.prepare('SELECT * FROM stocks').all();
console.dir(stocksRows, { depth: null });
