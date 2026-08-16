/**
 * 주식 관련 공통 유틸리티 함수
 *
 * 목적: Store 간 중복 로직 제거 및 재사용성 향상
 */

import type { HoldingItem, StockItem } from './types/lsSecurities';

/**
 * ETF/ETN 판별 키워드 목록
 */
export const ETF_KEYWORDS = [
  'KODEX',
  'TIGER',
  'ACE',
  'SOL',
  'RISE',
  'KoAct',
  'PLUS',
  'HANARO',
  'WOORI',
  'UNICORN',
  'TIMEFOLIO',
  'HERO',
  'KBSTAR',
  'ARIRANG',
  'ETF',
  'ETN'
] as const;

/**
 * ETF/ETN 여부 판별
 *
 * @param name - 종목명
 * @param industry - 업종 (선택)
 * @returns ETF/ETN이면 true
 */
export function isEtfOrEtn(name: string, industry?: string): boolean {
  if (!name) return false;

  // 업종에 ETF/ETN 포함 여부 체크
  if (industry && (industry.toUpperCase().includes('ETF') || industry.toUpperCase().includes('ETN'))) {
    return true;
  }

  // 종목명에 ETF 키워드 포함 여부 체크 (대소문자 무시)
  const upperName = name.toUpperCase();
  return ETF_KEYWORDS.some(keyword => upperName.includes(keyword.toUpperCase()));
}

/**
 * 실시간 가격 조회 (다단계 Fallback)
 *
 * 우선순위:
 * 1. rawStock.closePrice (실시간가)
 * 2. screenerStock.closePrice (스크리너 캐시)
 * 3. item.closePrice ?? item.currentPrice (현재가)
 * 4. item.avgPrice ?? item.holdingAvgPrice (평균단가)
 */
export function getLivePrice(
  item: HoldingItem | StockItem | any,
  rawStock?: { closePrice?: number } | null,
  screenerStock?: { closePrice?: number } | null
): number {
  if (!item) return 0;

  // 1순위: rawStore 실시간가
  if (rawStock?.closePrice && rawStock.closePrice > 0) {
    return rawStock.closePrice;
  }

  // 2순위: screenerStore 실시간가
  if (screenerStock?.closePrice && screenerStock.closePrice > 0) {
    return screenerStock.closePrice;
  }

  // 3순위: closePrice 또는 currentPrice
  const currentPrice = Number(item.closePrice ?? item.currentPrice);
  if (currentPrice > 0) {
    return currentPrice;
  }

  // 4순위: avgPrice 또는 holdingAvgPrice
  const avgPrice = Number(item.avgPrice ?? item.holdingAvgPrice);
  return avgPrice > 0 ? avgPrice : 0;
}

/**
 * 종목코드 정제 (A 접두사 제거)
 */
export function sanitizeShcode(shcode: string): string {
  if (!shcode) return '';
  return String(shcode).trim().replace(/^A/i, '');
}

/**
 * 배열을 Map으로 변환 (종목코드 기준)
 */
export function arrayToMap<T extends Record<string, any>>(
  items: T[] = [],
  keyField: keyof T = 'shcode' as keyof T
): Map<string, T> {
  if (!Array.isArray(items)) return new Map();
  return new Map(items.map(item => [String(item[keyField]), item]));
}

/**
 * 배열을 Map으로 변환 (인덱스 기준)
 */
export function arrayToIndexMap<T extends Record<string, any>>(
  items: T[] = [],
  keyField: keyof T = 'shcode' as keyof T
): Map<string, number> {
  if (!Array.isArray(items)) return new Map();
  return new Map(items.map((item, idx) => [String(item[keyField]), idx]));
}

/**
 * 수익률 계산
 *
 * @param current - 현재가
 * @param avg - 평균단가
 * @param decimalPlaces - 소수점 자릿수 (기본: 2)
 * @returns 수익률 (%)
 *
 * @example
 * calculateReturnRate(75000, 70000) // 7.14
 * calculateReturnRate(65000, 70000) // -7.14
 * calculateReturnRate(70000, 0)     // 0 (0 나눗셈 방지)
 */
export function calculateReturnRate(
  current: number,
  avg: number,
  decimalPlaces: number = 2
): number {
  if (avg === 0) return 0;
  const rate = ((current - avg) / avg) * 100;
  const multiplier = Math.pow(10, decimalPlaces);
  return Math.round(rate * multiplier) / multiplier;
}

/**
 * 손익 금액 계산
 *
 * @param current - 현재가
 * @param avg - 평균단가
 * @param quantity - 수량
 * @returns 손익 금액
 *
 * @example
 * calculateProfitLoss(75000, 70000, 10) // 50000
 * calculateProfitLoss(65000, 70000, 10) // -50000
 */
export function calculateProfitLoss(
  current: number,
  avg: number,
  quantity: number
): number {
  return (current - avg) * quantity;
}

/**
 * 가격 포맷팅 (천 단위 쉼표)
 *
 * @param price - 가격
 * @param suffix - 접미사 (기본: '원')
 * @returns 포맷팅된 가격 문자열
 *
 * @example
 * formatPrice(70000) // '70,000원'
 * formatPrice(70000, '') // '70,000'
 * formatPrice(-5000) // '-5,000원'
 */
export function formatPrice(price: number, suffix: string = '원'): string {
  const formatted = price.toLocaleString('ko-KR');
  return suffix ? `${formatted}${suffix}` : formatted;
}

/**
 * 퍼센트 포맷팅
 *
 * @param rate - 비율
 * @param includeSign - +/- 기호 포함 여부 (기본: true)
 * @param decimalPlaces - 소수점 자릿수 (기본: 2)
 * @returns 포맷팅된 퍼센트 문자열
 *
 * @example
 * formatPercent(5.77)  // '+5.77%'
 * formatPercent(-3.21) // '-3.21%'
 * formatPercent(0)     // '0.00%'
 * formatPercent(5.77, false) // '5.77%'
 */
export function formatPercent(
  rate: number,
  includeSign: boolean = true,
  decimalPlaces: number = 2
): string {
  const multiplier = Math.pow(10, decimalPlaces);
  const rounded = Math.round(rate * multiplier) / multiplier;
  const sign = includeSign && rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(decimalPlaces)}%`;
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 *
 * @param date - Date 객체 또는 날짜 문자열
 * @returns YYYY-MM-DD 형식 문자열
 *
 * @example
 * formatDate(new Date(2026, 7, 16)) // '2026-08-16'
 * formatDate('20260816') // '2026-08-16'
 */
export function formatDate(date: Date | string): string {
  let d: Date;

  if (typeof date === 'string') {
    const clean = date.replace(/[^0-9]/g, '');
    if (clean.length === 8) {
      const year = parseInt(clean.slice(0, 4), 10);
      const month = parseInt(clean.slice(4, 6), 10) - 1;
      const day = parseInt(clean.slice(6, 8), 10);
      d = new Date(year, month, day);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * LocalStorage 용량 체크
 *
 * @param data - 저장할 데이터
 * @param maxSizeBytes - 최대 크기 (기본: 5MB)
 * @returns 용량 초과 여부
 *
 * @example
 * if (isLocalStorageQuotaExceeded(data)) {
 *   console.warn('LocalStorage 용량 초과');
 * }
 */
export function isLocalStorageQuotaExceeded(
  data: any,
  maxSizeBytes: number = 5_000_000
): boolean {
  const jsonString = JSON.stringify(data);
  return jsonString.length > maxSizeBytes;
}

/**
 * 안전한 LocalStorage 저장
 *
 * @param key - 키
 * @param data - 데이터
 * @returns 성공 여부
 *
 * @example
 * const success = safeLocalStorageSet('cache', largeData);
 * if (!success) {
 *   console.warn('저장 실패 (용량 초과)');
 * }
 */
export function safeLocalStorageSet(key: string, data: any): boolean {
  try {
    if (isLocalStorageQuotaExceeded(data)) {
      console.warn(`[LocalStorage] "${key}" 크기가 5MB를 초과하여 저장하지 않습니다.`);
      return false;
    }

    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e: any) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('[LocalStorage] 용량 초과 오류:', e);
    } else {
      console.error('[LocalStorage] 저장 오류:', e);
    }
    return false;
  }
}

/**
 * 안전한 LocalStorage 읽기
 *
 * @param key - 키
 * @param defaultValue - 기본값 (선택)
 * @returns 데이터 또는 기본값
 *
 * @example
 * const cache = safeLocalStorageGet('cache', {});
 */
export function safeLocalStorageGet<T = any>(key: string, defaultValue?: T): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue ?? null;
    return JSON.parse(item) as T;
  } catch (e: any) {
    console.error('[LocalStorage] 읽기 오류:', e);
    return defaultValue ?? null;
  }
}
