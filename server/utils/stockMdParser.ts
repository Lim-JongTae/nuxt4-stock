import fs from 'fs';
import path from 'path';

export interface HoldingStockInfo {
  name: string;
  avgPrice: number;
  quantity: number;
  shcode: string;
  industry: string;
}

export interface WatchlistStockInfo {
  name: string;
  shcode: string;
  industry: string;
}

export interface ParsedStockMd {
  holdings: HoldingStockInfo[];
  watchlist: WatchlistStockInfo[];
}

export function parseStockMd(): ParsedStockMd {
  const mdPath = path.resolve(process.cwd(), '종목.md');
  const result: ParsedStockMd = {
    holdings: [],
    watchlist: []
  };

  if (!fs.existsSync(mdPath)) {
    return result;
  }

  const content = fs.readFileSync(mdPath, 'utf-8');
  const lines = content.split('\n');

  let currentSection: 'holdings' | 'watchlist' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# 보유종목')) {
      currentSection = 'holdings';
      continue;
    } else if (trimmed.startsWith('# 관심종목')) {
      currentSection = 'watchlist';
      continue;
    }

    if (trimmed.startsWith('-')) {
      const rawText = trimmed.replace(/^-/, '').trim();
      const parts = rawText.split(',').map(p => p.trim());

      if (currentSection === 'holdings') {
        // 예: KoAct 미국로봇피지컬AI액티브, 11317, 1046, A0186L0
        if (parts.length >= 4) {
          const name = parts[0] || '';
          const avgPrice = parseFloat(parts[1] || '0') || 0;
          const quantity = parseInt(parts[2] || '0', 10) || 0;
          const shcode = parts[3] || '';
          result.holdings.push({
            name,
            avgPrice,
            quantity,
            shcode,
            industry: getIndustryByName(name)
          });
        }
      } else if (currentSection === 'watchlist') {
        // 예: KoAct 글로벌친환경전력인프라액티브, A475070 또는 스페이스X (종목코드 없음)
        const name = parts[0] || '';
        const shcode = parts[1] || '';
        result.watchlist.push({
          name,
          shcode,
          industry: getIndustryByName(name)
        });
      }
    }
  }

  return result;
}

function getIndustryByName(name: string): string {
  if (name.includes('로봇') || name.includes('AI')) return '인공지능/피지컬AI';
  if (name.includes('우주') || name.includes('항공')) return '우주항공/방산';
  if (name.includes('전력') || name.includes('친환경')) return '전력인프라';
  if (name.includes('소프트웨어')) return 'AI소프트웨어';
  if (name.includes('삼성') || name.includes('하이닉스')) return 'IT부품/반도체';
  if (name.includes('셀트리온')) return '바이오/제약';
  if (name.includes('NAVER') || name.includes('네이버')) return '빅테크/디지털';
  if (name.includes('현대')) return '자동차/모빌리티';
  return '주요업종';
}
