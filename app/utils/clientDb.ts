export interface LocalStockItem {
  shcode: string;
  name: string;
  industry: string;
  type: 'holding' | 'watchlist';
  quantity?: number;
  avgPrice?: number;
  currentPrice?: number;
  targetPrice?: number;
  stopPrice?: number;
  updatedAt?: string;
}

const STORAGE_KEY = 'user_pc_local_stock_db_v1';

// 최초 접속 시 각 개인 PC에 세팅될 기본 템플릿 종목 (보유 2개 + 관심 8개 = 총 10개)
const INITIAL_DEFAULT_STOCKS: LocalStockItem[] = [
  // 보유 종목 2개
  { shcode: '0186L0', name: 'KoAct 미국로봇피지컬AI액티브', industry: '인공지능/피지컬AI', type: 'holding', avgPrice: 11317, quantity: 1046, targetPrice: 12222, stopPrice: 10808 },
  { shcode: '0167Z0', name: 'KODEX 미국우주항공', industry: '우주항공/방산', type: 'holding', avgPrice: 9206, quantity: 435, targetPrice: 9942, stopPrice: 8792 },
  // 관심 종목 8개
  { shcode: '035420', name: 'NAVER', industry: '빅테크/디지털', type: 'watchlist', avgPrice: 0, quantity: 0 },
  { shcode: '005930', name: '삼성전자', industry: '전기전자', type: 'watchlist', avgPrice: 0, quantity: 0 },
  { shcode: '000660', name: 'SK하이닉스', industry: 'IT부품/반도체', type: 'watchlist', avgPrice: 0, quantity: 0 },
  { shcode: '068270', name: '셀트리온', industry: '바이오/제약', type: 'watchlist', avgPrice: 0, quantity: 0 },
  { shcode: '005380', name: '현대차', industry: '자동차', type: 'watchlist', avgPrice: 0, quantity: 0 },
  { shcode: '475070', name: 'KoAct 글로벌친환경전력인프라액티브', industry: '전력인프라', type: 'watchlist', avgPrice: 0, quantity: 0 },
  { shcode: '481180', name: 'SOL 미국AI소프트웨어', industry: 'AI소프트웨어', type: 'watchlist', avgPrice: 0, quantity: 0 },
  { shcode: '017670', name: 'SK텔레콤', industry: '통신업', type: 'watchlist', avgPrice: 0, quantity: 0 }
];

export class ClientStockDb {
  // 1. 내 PC 브라우저에서 모든 종목 목록 가져오기
  static getAllStocks(): LocalStockItem[] {
    if (typeof window === 'undefined') return INITIAL_DEFAULT_STOCKS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // 최초 접속 시 기본 종목 세팅
        this.saveAllStocks(INITIAL_DEFAULT_STOCKS);
        return INITIAL_DEFAULT_STOCKS;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return this.normalizeStocks(parsed);
      }
      this.saveAllStocks(INITIAL_DEFAULT_STOCKS);
      return INITIAL_DEFAULT_STOCKS;
    } catch (e) {
      console.error('Failed to read client PC stock DB:', e);
      return INITIAL_DEFAULT_STOCKS;
    }
  }

  // 2. 종목 데이터 저장
  static saveAllStocks(stocks: LocalStockItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      const normalized = this.normalizeStocks(stocks);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.error('Failed to save client PC stock DB:', e);
    }
  }

  // 3. 단일 종목 저장/수정 (UPSERT)
  static upsertStock(item: LocalStockItem): LocalStockItem[] {
    const list = this.getAllStocks();
    const cleanCode = item.shcode.trim().replace(/^A/i, '');
    const nowStr = new Date().toLocaleString('ko-KR');

    const index = list.findIndex(s => s.shcode === cleanCode);
    const newItem: LocalStockItem = {
      ...item,
      shcode: cleanCode,
      updatedAt: nowStr
    };

    if (index >= 0) {
      list[index] = { ...list[index], ...newItem };
    } else {
      list.push(newItem);
    }

    this.saveAllStocks(list);
    return this.getAllStocks();
  }

  // 4. 종목 삭제
  static deleteStock(shcode: string): LocalStockItem[] {
    const list = this.getAllStocks();
    const cleanCode = shcode.trim().replace(/^A/i, '');
    const filtered = list.filter(s => s.shcode !== cleanCode);
    this.saveAllStocks(filtered);
    return filtered;
  }

  // 5. 종목 정규화 (보유/관심 구별 및 shcode A 제거, 보유 상단 정렬)
  static normalizeStocks(list: LocalStockItem[]): LocalStockItem[] {
    const map = new Map<string, LocalStockItem>();

    list.forEach(item => {
      if (!item.shcode) return;
      const cleanCode = item.shcode.trim().replace(/^A/i, '');
      const isHolding = item.type === 'holding';

      const entry: LocalStockItem = {
        shcode: cleanCode,
        name: item.name,
        industry: item.industry || '기타',
        type: isHolding ? 'holding' : 'watchlist',
        quantity: item.quantity || 0,
        avgPrice: item.avgPrice || 0,
        targetPrice: item.targetPrice || 0,
        stopPrice: item.stopPrice || 0,
        updatedAt: item.updatedAt || new Date().toLocaleString('ko-KR')
      };

      const existing = map.get(cleanCode);
      if (!existing || isHolding) {
        map.set(cleanCode, entry);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const isHoldingA = a.type === 'holding' ? 1 : 0;
      const isHoldingB = b.type === 'holding' ? 1 : 0;
      if (isHoldingA !== isHoldingB) {
        return isHoldingB - isHoldingA; // 보유종목 상단 배치
      }
      return a.shcode.localeCompare(b.shcode);
    });
  }

  // 6. 포트폴리오 백업 (JSON 다운로드)
  static exportBackupJson(): string {
    const stocks = this.getAllStocks();
    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      stocks
    };
    return JSON.stringify(payload, null, 2);
  }

  // 7. 포트폴리오 복원 (JSON 업로드)
  static importBackupJson(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      const list = parsed.stocks || parsed;
      if (Array.isArray(list) && list.length > 0) {
        this.saveAllStocks(list);
        return true;
      }
    } catch (e) {
      console.error('Failed to import backup JSON:', e);
    }
    return false;
  }
}
