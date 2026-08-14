import { sqliteDb } from './index';

async function seedStocks() {
  console.log('[Seed] 종목.md 데이터 ➡️ SQLite DB stocks 테이블 이관 시작...');

  // SQLite DB 테이블 자동 생성
  sqliteDb.exec(`
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

  const initialStocks = [
    // 보유 종목
    {
      shcode: 'A0186L0',
      name: 'KoAct 미국로봇피지컬AI액티브',
      industry: '인공지능/피지컬AI',
      type: 'holding',
      avgPrice: 11317,
      quantity: 1046
    },
    {
      shcode: 'A0167Z0',
      name: 'KODEX 미국우주항공',
      industry: '우주항공/방산',
      type: 'holding',
      avgPrice: 9206,
      quantity: 435
    },
    // 관심 종목
    {
      shcode: 'A475070',
      name: 'KoAct 글로벌친환경전력인프라액티브',
      industry: '전력인프라',
      type: 'watchlist',
      avgPrice: 0,
      quantity: 0
    },
    {
      shcode: 'A481180',
      name: 'SOL 미국AI소프트웨어',
      industry: 'AI소프트웨어',
      type: 'watchlist',
      avgPrice: 0,
      quantity: 0
    },
    {
      shcode: '035420',
      name: 'NAVER',
      industry: '빅테크/디지털',
      type: 'watchlist',
      avgPrice: 0,
      quantity: 0
    },
    {
      shcode: '005930',
      name: '삼성전자',
      industry: '전기전자',
      type: 'watchlist',
      avgPrice: 0,
      quantity: 0
    },
    {
      shcode: '000660',
      name: 'SK하이닉스',
      industry: 'IT부품/반도체',
      type: 'watchlist',
      avgPrice: 0,
      quantity: 0
    },
    {
      shcode: '068270',
      name: '셀트리온',
      industry: '바이오/제약',
      type: 'watchlist',
      avgPrice: 0,
      quantity: 0
    }
  ];

  const nowStr = new Date().toLocaleString('ko-KR');

  const insertStmt = sqliteDb.prepare(`
    INSERT OR REPLACE INTO stocks (shcode, name, industry, type, avg_price, quantity, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of initialStocks) {
    insertStmt.run(item.shcode, item.name, item.industry, item.type, item.avgPrice, item.quantity, nowStr);
    console.log(`[Seed Migrated] ${item.name} (${item.shcode}) ➡️ DB stocks 저장 완료`);
  }

  // 매매 변동 로그 기록
  const logStmt = sqliteDb.prepare(`
    INSERT INTO portfolio_logs (shcode, action_type, message, created_at)
    VALUES (?, ?, ?, ?)
  `);
  logStmt.run('SYSTEM', 'MIGRATE', '종목.md 파일 ➡️ SQLite DB stocks 테이블 초기 이관 완료', nowStr);

  console.log('[Seed Completed] SQLite DB stocks 테이블 시딩 성공 완료!');
}

seedStocks().catch(err => {
  console.error('[Seed Error]:', err);
});
