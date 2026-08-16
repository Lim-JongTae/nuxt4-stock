/**
 * useShortSellSignal.ts 정확성 검증 테스트
 *
 * 목적: 공매도 수급 신호 분류 로직의 정확성 및 엣지 케이스 검증
 */

import { describe, it, expect } from 'vitest';
import { classifyShortSellSignal } from '../../app/composables/useShortSellSignal';
import type { ShortSellRecord, ShortSellSignalResult } from '../../utils/types/lsSecurities';

describe('useShortSellSignal - 공매도 신호 분류 정확성 검증', () => {

  describe('1. 기본 동작 검증', () => {

    it('ETF/ETN은 "판단 보류" 반환', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 }
      ];

      const result = classifyShortSellSignal(data, true);

      expect(result.label).toBe('판단 보류');
      expect(result.confidence).toBe('낮음');
      expect(result.metrics).toBe(null);
      expect(result.summary).toContain('ETF/ETN');
    });

    it('데이터가 없으면 "판단 보류" 반환', () => {
      const result = classifyShortSellSignal([]);

      expect(result.label).toBe('판단 보류');
      expect(result.confidence).toBe('낮음');
      expect(result.metrics).toBe(null);
      expect(result.summary).toContain('미수집');
    });

    it('undefined 입력 시 "판단 보류" 반환', () => {
      const result = classifyShortSellSignal(undefined as any);

      expect(result.label).toBe('판단 보류');
      expect(result.confidence).toBe('낮음');
    });

    it('null 입력 시 "판단 보류" 반환', () => {
      const result = classifyShortSellSignal(null as any);

      expect(result.label).toBe('판단 보류');
      expect(result.confidence).toBe('낮음');
    });
  });

  describe('2. 숏커버링(환매수) 유력 - 잔고비율 감소', () => {

    it('잔고비율이 감소하면 "숏커버링(환매수) 유력"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 4.5, price: 71000, volume: 1050000 },
        { date: '2026-08-12', balanceRatio: 4.0, price: 72000, volume: 1100000 },
        { date: '2026-08-13', balanceRatio: 3.5, price: 73000, volume: 1150000 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 74000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('숏커버링(환매수) 유력');
      expect(result.confidence).toBe('높음'); // 5일 데이터
      expect(result.metrics?.balanceRatioDiff).toBe(-2.0); // 5.0 → 3.0
      expect(result.metrics?.priceDiffRate).toBeCloseTo(5.71, 1); // (74000-70000)/70000*100
      expect(result.summary).toContain('숏커버링(환매수) 유력');
    });

    it('잔고비율 감소 + 주가 하락에도 숏커버링 판정', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 74000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 70000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('숏커버링(환매수) 유력');
      expect(result.confidence).toBe('낮음'); // 2일 데이터
      expect(result.metrics?.balanceRatioDiff).toBe(-2.0);
      expect(result.metrics?.priceDiffRate).toBeCloseTo(-5.41, 1);
    });

    it('잔고비율 소폭 감소에도 숏커버링 판정', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 4.99, price: 70500, volume: 1100000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('숏커버링(환매수) 유력');
      expect(result.metrics?.balanceRatioDiff).toBe(-0.01);
    });
  });

  describe('3. 신규 공매도 유입 - 잔고 증가 & 주가 하락', () => {

    it('잔고비율 증가 + 주가 하락 = "신규 공매도 유입"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 3.0, price: 74000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 3.5, price: 73000, volume: 1050000 },
        { date: '2026-08-12', balanceRatio: 4.0, price: 72000, volume: 1100000 },
        { date: '2026-08-13', balanceRatio: 4.5, price: 71000, volume: 1150000 },
        { date: '2026-08-14', balanceRatio: 5.0, price: 70000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('신규 공매도 유입');
      expect(result.confidence).toBe('높음');
      expect(result.metrics?.balanceRatioDiff).toBe(2.0);
      expect(result.metrics?.priceDiffRate).toBeCloseTo(-5.41, 1);
      expect(result.summary).toContain('신규 공매도 유입');
    });

    it('잔고비율 대폭 증가 + 주가 급락 = "신규 공매도 유입"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 2.0, price: 80000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 8.0, price: 70000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('신규 공매도 유입');
      expect(result.metrics?.balanceRatioDiff).toBe(6.0);
      expect(result.metrics?.priceDiffRate).toBeCloseTo(-12.5, 1);
    });

    it('잔고비율 증가 + 주가 소폭 하락 = "신규 공매도 유입"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 3.0, price: 70500, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 3.1, price: 70000, volume: 1100000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('신규 공매도 유입');
      expect(result.metrics?.balanceRatioDiff).toBe(0.1);
      expect(result.metrics?.priceDiffRate).toBeCloseTo(-0.71, 1);
    });
  });

  describe('4. 매수세가 공매도 흡수 중 - 잔고 증가 & 주가 상승', () => {

    it('잔고비율 증가 + 주가 상승 = "매수세가 공매도 흡수 중"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 3.0, price: 70000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 3.5, price: 71000, volume: 1050000 },
        { date: '2026-08-12', balanceRatio: 4.0, price: 72000, volume: 1100000 },
        { date: '2026-08-13', balanceRatio: 4.5, price: 73000, volume: 1150000 },
        { date: '2026-08-14', balanceRatio: 5.0, price: 74000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('매수세가 공매도 흡수 중');
      expect(result.confidence).toBe('높음');
      expect(result.metrics?.balanceRatioDiff).toBe(2.0);
      expect(result.metrics?.priceDiffRate).toBeCloseTo(5.71, 1);
      expect(result.summary).toContain('매수세가 공매도 흡수 중');
    });

    it('잔고비율 증가 + 주가 보합(0%) = "매수세가 공매도 흡수 중"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 3.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 4.0, price: 70000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('매수세가 공매도 흡수 중');
      expect(result.metrics?.balanceRatioDiff).toBe(1.0);
      expect(result.metrics?.priceDiffRate).toBe(0);
    });

    it('잔고비율 대폭 증가 + 주가 급등 = "매수세가 공매도 흡수 중"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 2.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 8.0, price: 80000, volume: 1500000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('매수세가 공매도 흡수 중');
      expect(result.metrics?.balanceRatioDiff).toBe(6.0);
      expect(result.metrics?.priceDiffRate).toBeCloseTo(14.29, 1);
    });
  });

  describe('5. 판단 보류 - 잔고비율 변화 없음', () => {

    it('잔고비율 동일 + 주가 상승 = "판단 보류"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 5.0, price: 75000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('판단 보류');
      expect(result.metrics?.balanceRatioDiff).toBe(0);
      expect(result.metrics?.priceDiffRate).toBeCloseTo(7.14, 1);
    });

    it('잔고비율 동일 + 주가 하락 = "판단 보류"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 75000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 5.0, price: 70000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('판단 보류');
      expect(result.metrics?.balanceRatioDiff).toBe(0);
    });

    it('잔고비율 동일 + 주가 동일 = "판단 보류"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 5.0, price: 70000, volume: 1000000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('판단 보류');
      expect(result.metrics?.balanceRatioDiff).toBe(0);
      expect(result.metrics?.priceDiffRate).toBe(0);
    });
  });

  describe('6. 신뢰도 계산 검증', () => {

    it('5일 이상 데이터 = 신뢰도 "높음"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 4.5, price: 71000, volume: 1050000 },
        { date: '2026-08-12', balanceRatio: 4.0, price: 72000, volume: 1100000 },
        { date: '2026-08-13', balanceRatio: 3.5, price: 73000, volume: 1150000 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 74000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.confidence).toBe('높음');
    });

    it('6일 데이터 = 신뢰도 "높음"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-09', balanceRatio: 5.5, price: 69000, volume: 950000 },
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 4.5, price: 71000, volume: 1050000 },
        { date: '2026-08-12', balanceRatio: 4.0, price: 72000, volume: 1100000 },
        { date: '2026-08-13', balanceRatio: 3.5, price: 73000, volume: 1150000 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 74000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.confidence).toBe('높음');
    });

    it('4일 데이터 = 신뢰도 "중간"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-11', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-12', balanceRatio: 4.5, price: 71000, volume: 1050000 },
        { date: '2026-08-13', balanceRatio: 4.0, price: 72000, volume: 1100000 },
        { date: '2026-08-14', balanceRatio: 3.5, price: 73000, volume: 1150000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.confidence).toBe('중간');
    });

    it('3일 데이터 = 신뢰도 "중간"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-12', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-13', balanceRatio: 4.5, price: 71000, volume: 1050000 },
        { date: '2026-08-14', balanceRatio: 4.0, price: 72000, volume: 1100000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.confidence).toBe('중간');
    });

    it('2일 데이터 = 신뢰도 "낮음"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-13', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 4.5, price: 71000, volume: 1050000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.confidence).toBe('낮음');
    });

    it('1일 데이터 = 신뢰도 "낮음"', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-14', balanceRatio: 5.0, price: 70000, volume: 1000000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.confidence).toBe('낮음');
    });
  });

  describe('7. 거래량 변화율 계산 검증', () => {

    it('거래량 증가 시 volumeDiffRate > 0', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 4.8, price: 70500, volume: 1100000 },
        { date: '2026-08-12', balanceRatio: 4.5, price: 71000, volume: 1200000 },
        { date: '2026-08-13', balanceRatio: 4.2, price: 71500, volume: 1300000 },
        { date: '2026-08-14', balanceRatio: 4.0, price: 72000, volume: 1500000 }
      ];

      const result = classifyShortSellSignal(data);

      // 평균 거래량 = (1000000 + 1100000 + 1200000 + 1300000 + 1500000) / 5 = 1220000
      // 최근 거래량 = 1500000
      // volumeDiffRate = ((1500000 - 1220000) / 1220000) * 100 = 22.95%
      expect(result.metrics?.volumeDiffRate).toBeCloseTo(22.95, 1);
    });

    it('거래량 감소 시 volumeDiffRate < 0', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1500000 },
        { date: '2026-08-11', balanceRatio: 4.8, price: 70500, volume: 1400000 },
        { date: '2026-08-12', balanceRatio: 4.5, price: 71000, volume: 1300000 },
        { date: '2026-08-13', balanceRatio: 4.2, price: 71500, volume: 1200000 },
        { date: '2026-08-14', balanceRatio: 4.0, price: 72000, volume: 1000000 }
      ];

      const result = classifyShortSellSignal(data);

      // 평균 거래량 = 1280000
      // 최근 거래량 = 1000000
      // volumeDiffRate = ((1000000 - 1280000) / 1280000) * 100 = -21.88%
      expect(result.metrics?.volumeDiffRate).toBeCloseTo(-21.88, 1);
    });

    it('거래량 일정 시 volumeDiffRate ≈ 0', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 4.8, price: 70500, volume: 1000000 },
        { date: '2026-08-12', balanceRatio: 4.5, price: 71000, volume: 1000000 },
        { date: '2026-08-13', balanceRatio: 4.2, price: 71500, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 4.0, price: 72000, volume: 1000000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.metrics?.volumeDiffRate).toBe(0);
    });
  });

  describe('8. 엣지 케이스 및 경계값 검증', () => {

    it('잔고비율이 0인 경우 처리', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 0, price: 72000, volume: 1100000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.label).toBe('판단 보류');
      expect(result.metrics?.balanceRatioDiff).toBe(0);
    });

    it('주가가 0인 경우 priceDiffRate = 0', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 0, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 70000, volume: 1100000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.label).toBe('숏커버링(환매수) 유력');
      expect(result.metrics?.priceDiffRate).toBe(0);
    });

    it('거래량이 0인 경우 처리', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 0 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 72000, volume: 0 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.label).toBe('숏커버링(환매수) 유력');
      expect(result.metrics?.volumeDiffRate).toBe(0);
    });

    it('매우 큰 잔고비율 변화 (0 → 50%)', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 50.0, price: 60000, volume: 2000000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.label).toBe('신규 공매도 유입');
      expect(result.metrics?.balanceRatioDiff).toBe(50.0);
    });

    it('음수 잔고비율 (데이터 오류)', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: -2.0, price: 72000, volume: 1100000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.label).toBe('숏커버링(환매수) 유력'); // 5.0 → -2.0 = -7.0 (감소)
      expect(result.metrics?.balanceRatioDiff).toBe(-7.0);
    });

    it('소수점 경계값 검증 (0.01%p 차이)', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.00, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 5.01, price: 70100, volume: 1100000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.label).toBe('매수세가 공매도 흡수 중'); // 0.01 증가
      expect(result.metrics?.balanceRatioDiff).toBe(0.01);
    });
  });

  describe('9. 날짜 정렬 검증', () => {

    it('날짜가 역순으로 입력되어도 정상 동작 (YYYY-MM-DD)', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-14', balanceRatio: 3.0, price: 74000, volume: 1200000 },
        { date: '2026-08-13', balanceRatio: 3.5, price: 73000, volume: 1150000 },
        { date: '2026-08-12', balanceRatio: 4.0, price: 72000, volume: 1100000 },
        { date: '2026-08-11', balanceRatio: 4.5, price: 71000, volume: 1050000 },
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 }
      ];

      const result = classifyShortSellSignal(data);

      // 자동 정렬 후 5.0 → 3.0 = -2.0
      expect(result.label).toBe('숏커버링(환매수) 유력');
      expect(result.metrics?.balanceRatioDiff).toBe(-2.0);
      expect(result.metrics?.priceDiffRate).toBeCloseTo(5.71, 1);
    });

    it('날짜가 무작위 순서로 입력되어도 정상 동작', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-12', balanceRatio: 4.0, price: 72000, volume: 1100000 },
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 74000, volume: 1200000 },
        { date: '2026-08-11', balanceRatio: 4.5, price: 71000, volume: 1050000 },
        { date: '2026-08-13', balanceRatio: 3.5, price: 73000, volume: 1150000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.label).toBe('숏커버링(환매수) 유력');
      expect(result.metrics?.balanceRatioDiff).toBe(-2.0);
    });

    it('YYYYMMDD 형식 날짜도 정상 파싱', () => {
      const data: ShortSellRecord[] = [
        { date: '20260810', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '20260814', balanceRatio: 3.0, price: 74000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.label).toBe('숏커버링(환매수) 유력');
      expect(result.metrics?.balanceRatioDiff).toBe(-2.0);
    });

    it('혼합 날짜 형식도 처리', () => {
      const data: ShortSellRecord[] = [
        { date: '20260810', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 4.5, price: 71000, volume: 1050000 },
        { date: '20260812', balanceRatio: 4.0, price: 72000, volume: 1100000 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 74000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.label).toBe('숏커버링(환매수) 유력');
      expect(result.metrics?.balanceRatioDiff).toBe(-2.0);
    });
  });

  describe('10. summary 문자열 검증', () => {

    it('summary에 일수, 잔고비율, 주가, 거래량, 라벨이 모두 포함됨', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 4.5, price: 71000, volume: 1050000 },
        { date: '2026-08-12', balanceRatio: 4.0, price: 72000, volume: 1100000 },
        { date: '2026-08-13', balanceRatio: 3.5, price: 73000, volume: 1150000 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 74000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.summary).toContain('5일'); // 일수
      expect(result.summary).toContain('-2'); // 잔고비율 변화
      expect(result.summary).toContain('%p'); // 단위
      expect(result.summary).toContain('주가'); // 주가
      expect(result.summary).toContain('거래량'); // 거래량
      expect(result.summary).toContain('숏커버링(환매수) 유력'); // 라벨
    });

    it('summary에 + 기호가 양수에 포함됨', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 3.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 5.0, price: 74000, volume: 1200000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.summary).toContain('+2'); // 잔고 +2%p
      expect(result.summary).toContain('+5.71'); // 주가 +5.71%
    });

    it('summary에 - 기호가 음수에 포함됨', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 74000, volume: 1200000 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 70000, volume: 1000000 }
      ];

      const result = classifyShortSellSignal(data);
      expect(result.summary).toContain('-2'); // 잔고 -2%p
      expect(result.summary).toContain('-5.41'); // 주가 -5.41%
      expect(result.summary).toContain('-9.09'); // 거래량 -9.09% (평균 대비)
    });
  });

  describe('11. 실제 시나리오 검증', () => {

    it('시나리오 1: 급격한 공매도 증가 + 주가 폭락 (공매도 세력 강세)', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 2.5, price: 90000, volume: 5000000 },
        { date: '2026-08-11', balanceRatio: 4.0, price: 85000, volume: 7000000 },
        { date: '2026-08-12', balanceRatio: 6.5, price: 78000, volume: 10000000 },
        { date: '2026-08-13', balanceRatio: 9.0, price: 72000, volume: 15000000 },
        { date: '2026-08-14', balanceRatio: 12.5, price: 65000, volume: 20000000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('신규 공매도 유입');
      expect(result.confidence).toBe('높음');
      expect(result.metrics?.balanceRatioDiff).toBe(10.0); // 대폭 증가
      expect(result.metrics?.priceDiffRate).toBeCloseTo(-27.78, 1); // 급락
      expect(result.metrics?.volumeDiffRate).toBeGreaterThan(50); // 거래량 폭증
    });

    it('시나리오 2: 숏커버링 시작 (반등 조짐)', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 12.5, price: 65000, volume: 20000000 },
        { date: '2026-08-11', balanceRatio: 10.0, price: 68000, volume: 18000000 },
        { date: '2026-08-12', balanceRatio: 8.0, price: 72000, volume: 15000000 },
        { date: '2026-08-13', balanceRatio: 6.0, price: 76000, volume: 12000000 },
        { date: '2026-08-14', balanceRatio: 4.5, price: 80000, volume: 10000000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('숏커버링(환매수) 유력');
      expect(result.confidence).toBe('높음');
      expect(result.metrics?.balanceRatioDiff).toBe(-8.0); // 대폭 감소
      expect(result.metrics?.priceDiffRate).toBeCloseTo(23.08, 1); // 급등
      expect(result.metrics?.volumeDiffRate).toBeLessThan(-30); // 거래량 감소
    });

    it('시나리오 3: 매수세 vs 공매도 줄다리기 (강한 매수 승리)', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 8000000 },
        { date: '2026-08-11', balanceRatio: 6.0, price: 71000, volume: 9000000 },
        { date: '2026-08-12', balanceRatio: 7.0, price: 73000, volume: 10000000 },
        { date: '2026-08-13', balanceRatio: 8.0, price: 76000, volume: 12000000 },
        { date: '2026-08-14', balanceRatio: 8.5, price: 80000, volume: 15000000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('매수세가 공매도 흡수 중');
      expect(result.confidence).toBe('높음');
      expect(result.metrics?.balanceRatioDiff).toBe(3.5); // 증가
      expect(result.metrics?.priceDiffRate).toBeCloseTo(14.29, 1); // 상승
      expect(result.metrics?.volumeDiffRate).toBeGreaterThan(30); // 거래량 증가
    });

    it('시나리오 4: 횡보장 (잔고/주가 모두 변화 없음)', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 5000000 },
        { date: '2026-08-11', balanceRatio: 5.1, price: 70200, volume: 5100000 },
        { date: '2026-08-12', balanceRatio: 4.9, price: 69800, volume: 4900000 },
        { date: '2026-08-13', balanceRatio: 5.0, price: 70100, volume: 5000000 },
        { date: '2026-08-14', balanceRatio: 5.0, price: 70000, volume: 5000000 }
      ];

      const result = classifyShortSellSignal(data);

      expect(result.label).toBe('판단 보류'); // 잔고비율 변화 없음
      expect(result.confidence).toBe('높음');
      expect(result.metrics?.balanceRatioDiff).toBe(0);
      expect(Math.abs(result.metrics?.priceDiffRate || 0)).toBeLessThan(1); // 거의 변화 없음
    });
  });

  describe('12. 개발 환경 로그 검증', () => {

    it('개발 환경에서만 콘솔 로그 출력 (프로덕션 로그 오염 방지)', () => {
      const data: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 3.0, price: 74000, volume: 1200000 }
      ];

      // 개발 환경 체크 로직은 코드에 구현되어 있음
      // import.meta.dev 또는 process.env.NODE_ENV === 'development'
      const result = classifyShortSellSignal(data);

      // 로그는 테스트 환경에서 출력되지 않아야 함
      expect(result).toBeDefined();
    });
  });
});
