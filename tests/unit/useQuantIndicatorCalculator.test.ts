/**
 * useQuantIndicatorCalculator.ts 단위 테스트
 *
 * 목적: 8대 기술적 지표 계산 로직의 정확성 검증
 */

import { describe, it, expect } from 'vitest';
import { calculateQuantIndicators, BOLLINGER_BAND_TOLERANCE_RATE, SHORT_SIGNAL_CONFIDENCE_SCORE_MAP } from '../../app/composables/useQuantIndicatorCalculator';
import type { RawStockApiData, ShortSellRecord } from '../../utils/types/lsSecurities';

describe('useQuantIndicatorCalculator', () => {

  describe('calculateQuantIndicators - 기본 동작', () => {

    it('모든 지표가 null인 경우 score는 0이어야 함', () => {
      const raw: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        psy: null,
        bbLower: null,
        ma5: null,
        ma20: null,
        ma60: null,
        volumeRatio: null,
        macdHist: null,
        rsi: null,
        bullishDivergence: null,
        shortSellHistory: []
      };

      const result = calculateQuantIndicators(raw);

      expect(result.score).toBe(0);
      expect(result.isFullyMatched).toBe(false);
      expect(result.conditions.cond_psy).toBe(false);
      expect(result.conditions.cond_bb).toBe(false);
      expect(result.conditions.cond_ma_turn).toBe(false);
      expect(result.conditions.cond_volume).toBe(false);
      expect(result.conditions.cond_macd).toBe(false);
      expect(result.conditions.cond_rsi).toBe(false);
      expect(result.conditions.cond_divergence).toBe(false);
      expect(result.conditions.cond_short_signal).toBe(false);
    });

    it('8대 지표가 모두 충족되면 isFullyMatched는 true, score는 100점', () => {
      const shortSellHistory: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 4.8, price: 70500, volume: 1050000 },
        { date: '2026-08-12', balanceRatio: 4.5, price: 71000, volume: 1100000 },
        { date: '2026-08-13', balanceRatio: 4.2, price: 71500, volume: 1150000 },
        { date: '2026-08-14', balanceRatio: 3.8, price: 72000, volume: 1200000 },
        { date: '2026-08-15', balanceRatio: 3.5, price: 72500, volume: 1250000 }
      ];

      const raw: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 72500,
        psy: 20.0,                // ✅ ≤ 25
        bbLower: 72000,           // ✅ 72500 ≤ 72000 × 1.02 = 73440
        ma5: 72000,               // ✅ 72000 ≥ 71000 ≥ 70000 (정배열)
        ma20: 71000,
        ma60: 70000,
        volumeRatio: 125.0,       // ✅ ≥ 120
        macdHist: 5.5,            // ✅ > 0
        rsi: 30.0,                // ✅ ≤ 35
        bullishDivergence: true,  // ✅ true
        shortSellHistory          // ✅ 잔고비율 감소 (5.0 → 3.5) = 숏커버링
      };

      const result = calculateQuantIndicators(raw);

      expect(result.isFullyMatched).toBe(true);
      expect(result.score).toBe(100); // 10+10+15+15+10+10+15+15
      expect(result.conditions.cond_psy).toBe(true);
      expect(result.conditions.cond_bb).toBe(true);
      expect(result.conditions.cond_ma_turn).toBe(true);
      expect(result.conditions.cond_volume).toBe(true);
      expect(result.conditions.cond_macd).toBe(true);
      expect(result.conditions.cond_rsi).toBe(true);
      expect(result.conditions.cond_divergence).toBe(true);
      expect(result.conditions.cond_short_signal).toBe(true);
      expect(result.shortSignal.label).toBe('숏커버링(환매수) 유력');
      expect(result.shortSignal.confidence).toBe('높음');
    });
  });

  describe('개별 지표 조건 검증', () => {

    it('cond_psy: psy ≤ 25% 조건', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        psy: null,
        shortSellHistory: []
      };

      // psy = 25 (경계값)
      let result = calculateQuantIndicators({ ...base, psy: 25.0 });
      expect(result.conditions.cond_psy).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(10);

      // psy = 24.9 (충족)
      result = calculateQuantIndicators({ ...base, psy: 24.9 });
      expect(result.conditions.cond_psy).toBe(true);

      // psy = 25.1 (미충족)
      result = calculateQuantIndicators({ ...base, psy: 25.1 });
      expect(result.conditions.cond_psy).toBe(false);

      // psy = null (미충족)
      result = calculateQuantIndicators({ ...base, psy: null });
      expect(result.conditions.cond_psy).toBe(false);
    });

    it('cond_bb: 종가 ≤ 볼린저밴드 하단 × 1.02 조건', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        bbLower: 69000,  // 하단 × 1.02 = 70380
        shortSellHistory: []
      };

      // 종가 70000 ≤ 70380 (충족)
      let result = calculateQuantIndicators({ ...base, closePrice: 70000, bbLower: 69000 });
      expect(result.conditions.cond_bb).toBe(true);

      // 종가 70380 ≤ 70380 (경계값, 충족)
      result = calculateQuantIndicators({ ...base, closePrice: 70380, bbLower: 69000 });
      expect(result.conditions.cond_bb).toBe(true);

      // 종가 70381 > 70380 (미충족)
      result = calculateQuantIndicators({ ...base, closePrice: 70381, bbLower: 69000 });
      expect(result.conditions.cond_bb).toBe(false);

      // bbLower = null (미충족)
      result = calculateQuantIndicators({ ...base, closePrice: 70000, bbLower: null });
      expect(result.conditions.cond_bb).toBe(false);

      // bbLower = 0 (미충족)
      result = calculateQuantIndicators({ ...base, closePrice: 70000, bbLower: 0 });
      expect(result.conditions.cond_bb).toBe(false);
    });

    it('cond_ma_turn: 이평선 정배열 (5일 ≥ 20일 ≥ 60일) 조건', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        shortSellHistory: []
      };

      // 정배열 (72000 ≥ 71000 ≥ 70000)
      let result = calculateQuantIndicators({ ...base, ma5: 72000, ma20: 71000, ma60: 70000 });
      expect(result.conditions.cond_ma_turn).toBe(true);

      // 동일값 정배열 (70000 ≥ 70000 ≥ 70000)
      result = calculateQuantIndicators({ ...base, ma5: 70000, ma20: 70000, ma60: 70000 });
      expect(result.conditions.cond_ma_turn).toBe(true);

      // 역배열 (70000 < 71000 < 72000)
      result = calculateQuantIndicators({ ...base, ma5: 70000, ma20: 71000, ma60: 72000 });
      expect(result.conditions.cond_ma_turn).toBe(false);

      // 부분 역배열 (72000 ≥ 71000, but 71000 < 72000)
      result = calculateQuantIndicators({ ...base, ma5: 72000, ma20: 71000, ma60: 72000 });
      expect(result.conditions.cond_ma_turn).toBe(false);

      // null 포함 (미충족)
      result = calculateQuantIndicators({ ...base, ma5: 72000, ma20: null, ma60: 70000 });
      expect(result.conditions.cond_ma_turn).toBe(false);

      // 0 포함 (미충족)
      result = calculateQuantIndicators({ ...base, ma5: 72000, ma20: 0, ma60: 70000 });
      expect(result.conditions.cond_ma_turn).toBe(false);
    });

    it('cond_volume: volumeRatio ≥ 120% 조건', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        shortSellHistory: []
      };

      // volumeRatio = 120 (경계값)
      let result = calculateQuantIndicators({ ...base, volumeRatio: 120.0 });
      expect(result.conditions.cond_volume).toBe(true);

      // volumeRatio = 150 (충족)
      result = calculateQuantIndicators({ ...base, volumeRatio: 150.0 });
      expect(result.conditions.cond_volume).toBe(true);

      // volumeRatio = 119.9 (미충족)
      result = calculateQuantIndicators({ ...base, volumeRatio: 119.9 });
      expect(result.conditions.cond_volume).toBe(false);

      // volumeRatio = null (미충족)
      result = calculateQuantIndicators({ ...base, volumeRatio: null });
      expect(result.conditions.cond_volume).toBe(false);
    });

    it('cond_macd: macdHist > 0 조건', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        shortSellHistory: []
      };

      // macdHist = 0.1 (충족)
      let result = calculateQuantIndicators({ ...base, macdHist: 0.1 });
      expect(result.conditions.cond_macd).toBe(true);

      // macdHist = 10 (충족)
      result = calculateQuantIndicators({ ...base, macdHist: 10.0 });
      expect(result.conditions.cond_macd).toBe(true);

      // macdHist = 0 (미충족)
      result = calculateQuantIndicators({ ...base, macdHist: 0 });
      expect(result.conditions.cond_macd).toBe(false);

      // macdHist = -0.1 (미충족)
      result = calculateQuantIndicators({ ...base, macdHist: -0.1 });
      expect(result.conditions.cond_macd).toBe(false);

      // macdHist = null (미충족)
      result = calculateQuantIndicators({ ...base, macdHist: null });
      expect(result.conditions.cond_macd).toBe(false);
    });

    it('cond_rsi: rsi ≤ 35 조건', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        shortSellHistory: []
      };

      // rsi = 35 (경계값)
      let result = calculateQuantIndicators({ ...base, rsi: 35.0 });
      expect(result.conditions.cond_rsi).toBe(true);

      // rsi = 30 (충족)
      result = calculateQuantIndicators({ ...base, rsi: 30.0 });
      expect(result.conditions.cond_rsi).toBe(true);

      // rsi = 35.1 (미충족)
      result = calculateQuantIndicators({ ...base, rsi: 35.1 });
      expect(result.conditions.cond_rsi).toBe(false);

      // rsi = null (미충족)
      result = calculateQuantIndicators({ ...base, rsi: null });
      expect(result.conditions.cond_rsi).toBe(false);
    });

    it('cond_divergence: bullishDivergence === true 조건', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        shortSellHistory: []
      };

      // true (충족)
      let result = calculateQuantIndicators({ ...base, bullishDivergence: true });
      expect(result.conditions.cond_divergence).toBe(true);

      // false (미충족)
      result = calculateQuantIndicators({ ...base, bullishDivergence: false });
      expect(result.conditions.cond_divergence).toBe(false);

      // null (미충족)
      result = calculateQuantIndicators({ ...base, bullishDivergence: null });
      expect(result.conditions.cond_divergence).toBe(false);
    });

    it('cond_short_signal: 숏커버링 또는 매수세 흡수 조건', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 72000
      };

      // 숏커버링(환매수) 유력 (잔고비율 감소)
      let shortSellHistory: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-15', balanceRatio: 3.5, price: 72000, volume: 1200000 }
      ];
      let result = calculateQuantIndicators({ ...base, shortSellHistory });
      expect(result.conditions.cond_short_signal).toBe(true);
      expect(result.shortSignal.label).toBe('숏커버링(환매수) 유력');

      // 매수세가 공매도 흡수 중 (잔고 증가 + 주가 상승)
      shortSellHistory = [
        { date: '2026-08-10', balanceRatio: 3.0, price: 70000, volume: 1000000 },
        { date: '2026-08-15', balanceRatio: 4.0, price: 72000, volume: 1200000 }
      ];
      result = calculateQuantIndicators({ ...base, shortSellHistory });
      expect(result.conditions.cond_short_signal).toBe(true);
      expect(result.shortSignal.label).toBe('매수세가 공매도 흡수 중');

      // 신규 공매도 유입 (잔고 증가 + 주가 하락) - 미충족
      shortSellHistory = [
        { date: '2026-08-10', balanceRatio: 3.0, price: 72000, volume: 1000000 },
        { date: '2026-08-15', balanceRatio: 4.0, price: 70000, volume: 1200000 }
      ];
      result = calculateQuantIndicators({ ...base, shortSellHistory });
      expect(result.conditions.cond_short_signal).toBe(false);
      expect(result.shortSignal.label).toBe('신규 공매도 유입');

      // 판단 보류 (데이터 없음)
      result = calculateQuantIndicators({ ...base, shortSellHistory: [] });
      expect(result.conditions.cond_short_signal).toBe(false);
      expect(result.shortSignal.label).toBe('판단 보류');
    });
  });

  describe('스코어 계산 검증', () => {

    it('각 지표별 배점이 정확한지 확인', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        shortSellHistory: []
      };

      // psy만 충족 (10점)
      let result = calculateQuantIndicators({ ...base, psy: 20.0 });
      expect(result.score).toBe(10);

      // bbLower만 충족 (10점)
      result = calculateQuantIndicators({ ...base, closePrice: 70000, bbLower: 69000 });
      expect(result.score).toBe(10);

      // ma_turn만 충족 (15점)
      result = calculateQuantIndicators({ ...base, ma5: 72000, ma20: 71000, ma60: 70000 });
      expect(result.score).toBe(15);

      // volume만 충족 (15점)
      result = calculateQuantIndicators({ ...base, volumeRatio: 125.0 });
      expect(result.score).toBe(15);

      // macd만 충족 (10점)
      result = calculateQuantIndicators({ ...base, macdHist: 5.0 });
      expect(result.score).toBe(10);

      // rsi만 충족 (10점)
      result = calculateQuantIndicators({ ...base, rsi: 30.0 });
      expect(result.score).toBe(10);

      // divergence만 충족 (15점)
      result = calculateQuantIndicators({ ...base, bullishDivergence: true });
      expect(result.score).toBe(15);
    });

    it('공매도 신호 신뢰도별 스코어 차등 부여', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 72000
      };

      // 높음 (5일 이상) - 15점
      let shortSellHistory: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-11', balanceRatio: 4.8, price: 70500, volume: 1050000 },
        { date: '2026-08-12', balanceRatio: 4.5, price: 71000, volume: 1100000 },
        { date: '2026-08-13', balanceRatio: 4.2, price: 71500, volume: 1150000 },
        { date: '2026-08-14', balanceRatio: 3.8, price: 72000, volume: 1200000 }
      ];
      let result = calculateQuantIndicators({ ...base, shortSellHistory });
      expect(result.shortSignal.confidence).toBe('높음');
      expect(result.score).toBe(SHORT_SIGNAL_CONFIDENCE_SCORE_MAP['높음']);

      // 중간 (3~4일) - 11점
      shortSellHistory = [
        { date: '2026-08-12', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-13', balanceRatio: 4.5, price: 71000, volume: 1100000 },
        { date: '2026-08-14', balanceRatio: 4.0, price: 72000, volume: 1200000 }
      ];
      result = calculateQuantIndicators({ ...base, shortSellHistory });
      expect(result.shortSignal.confidence).toBe('중간');
      expect(result.score).toBe(SHORT_SIGNAL_CONFIDENCE_SCORE_MAP['중간']);

      // 낮음 (2일 이하) - 7점
      shortSellHistory = [
        { date: '2026-08-13', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-14', balanceRatio: 4.0, price: 72000, volume: 1200000 }
      ];
      result = calculateQuantIndicators({ ...base, shortSellHistory });
      expect(result.shortSignal.confidence).toBe('낮음');
      expect(result.score).toBe(SHORT_SIGNAL_CONFIDENCE_SCORE_MAP['낮음']);
    });

    it('복합 조건 스코어 합산 검증', () => {
      const base: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        shortSellHistory: []
      };

      // psy + bbLower (10 + 10 = 20)
      let result = calculateQuantIndicators({
        ...base,
        psy: 20.0,
        closePrice: 70000,
        bbLower: 69000
      });
      expect(result.score).toBe(20);

      // ma_turn + volume + macd (15 + 15 + 10 = 40)
      result = calculateQuantIndicators({
        ...base,
        ma5: 72000,
        ma20: 71000,
        ma60: 70000,
        volumeRatio: 125.0,
        macdHist: 5.0
      });
      expect(result.score).toBe(40);

      // 7개 지표 충족 (공매도 제외) (10+10+15+15+10+10+15 = 85)
      result = calculateQuantIndicators({
        ...base,
        psy: 20.0,
        closePrice: 70000,
        bbLower: 69000,
        ma5: 72000,
        ma20: 71000,
        ma60: 70000,
        volumeRatio: 125.0,
        macdHist: 5.0,
        rsi: 30.0,
        bullishDivergence: true,
        shortSellHistory: [] // 공매도 데이터 없음
      });
      expect(result.score).toBe(85);
    });
  });

  describe('isFullyMatched 판정 검증', () => {

    it('8/8 조건 충족 시에만 true', () => {
      const shortSellHistory: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-15', balanceRatio: 3.5, price: 72000, volume: 1200000 }
      ];

      const fullMatch: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 72000,
        psy: 20.0,
        bbLower: 71000,
        ma5: 72000,
        ma20: 71000,
        ma60: 70000,
        volumeRatio: 125.0,
        macdHist: 5.0,
        rsi: 30.0,
        bullishDivergence: true,
        shortSellHistory
      };

      // 8/8 충족
      let result = calculateQuantIndicators(fullMatch);
      expect(result.isFullyMatched).toBe(true);

      // 7/8 충족 (psy 미충족)
      result = calculateQuantIndicators({ ...fullMatch, psy: 30.0 });
      expect(result.isFullyMatched).toBe(false);

      // 7/8 충족 (bbLower 미충족)
      result = calculateQuantIndicators({ ...fullMatch, bbLower: 70000 });
      expect(result.isFullyMatched).toBe(false);

      // 7/8 충족 (ma_turn 미충족)
      result = calculateQuantIndicators({ ...fullMatch, ma5: 70000, ma20: 71000, ma60: 72000 });
      expect(result.isFullyMatched).toBe(false);

      // 7/8 충족 (volume 미충족)
      result = calculateQuantIndicators({ ...fullMatch, volumeRatio: 100.0 });
      expect(result.isFullyMatched).toBe(false);

      // 7/8 충족 (macd 미충족)
      result = calculateQuantIndicators({ ...fullMatch, macdHist: -1.0 });
      expect(result.isFullyMatched).toBe(false);

      // 7/8 충족 (rsi 미충족)
      result = calculateQuantIndicators({ ...fullMatch, rsi: 40.0 });
      expect(result.isFullyMatched).toBe(false);

      // 7/8 충족 (divergence 미충족)
      result = calculateQuantIndicators({ ...fullMatch, bullishDivergence: false });
      expect(result.isFullyMatched).toBe(false);

      // 7/8 충족 (short_signal 미충족)
      const shortSellHistoryBad: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 3.0, price: 72000, volume: 1000000 },
        { date: '2026-08-15', balanceRatio: 4.0, price: 70000, volume: 1200000 }
      ];
      result = calculateQuantIndicators({ ...fullMatch, shortSellHistory: shortSellHistoryBad });
      expect(result.isFullyMatched).toBe(false);
    });
  });

  describe('엣지 케이스 검증', () => {

    it('closePrice = 0인 경우 볼린저밴드 조건 미충족', () => {
      const raw: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 0,
        bbLower: 69000,
        shortSellHistory: []
      };

      const result = calculateQuantIndicators(raw);
      expect(result.conditions.cond_bb).toBe(false);
    });

    it('음수 값 처리', () => {
      const raw: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        psy: -10,           // 음수
        volumeRatio: -50,   // 음수
        macdHist: -5,       // 음수
        rsi: -20,           // 음수
        shortSellHistory: []
      };

      const result = calculateQuantIndicators(raw);
      expect(result.conditions.cond_psy).toBe(true);  // -10 ≤ 25
      expect(result.conditions.cond_volume).toBe(false); // -50 < 120
      expect(result.conditions.cond_macd).toBe(false);   // -5 < 0
      expect(result.conditions.cond_rsi).toBe(true);     // -20 ≤ 35
    });

    it('매우 큰 값 처리', () => {
      const raw: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 1000000,
        psy: 100,
        volumeRatio: 999999,
        macdHist: 999999,
        rsi: 100,
        shortSellHistory: []
      };

      const result = calculateQuantIndicators(raw);
      expect(result.conditions.cond_psy).toBe(false);    // 100 > 25
      expect(result.conditions.cond_volume).toBe(true);  // 999999 ≥ 120
      expect(result.conditions.cond_macd).toBe(true);    // 999999 > 0
      expect(result.conditions.cond_rsi).toBe(false);    // 100 > 35
    });

    it('소수점 경계값 처리', () => {
      const raw: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        psy: 25.0001,
        volumeRatio: 119.9999,
        macdHist: 0.0001,
        rsi: 35.0001,
        shortSellHistory: []
      };

      const result = calculateQuantIndicators(raw);
      expect(result.conditions.cond_psy).toBe(false);    // 25.0001 > 25
      expect(result.conditions.cond_volume).toBe(false); // 119.9999 < 120
      expect(result.conditions.cond_macd).toBe(true);    // 0.0001 > 0
      expect(result.conditions.cond_rsi).toBe(false);    // 35.0001 > 35
    });
  });

  describe('반환 데이터 무결성 검증', () => {

    it('입력 데이터가 출력에 정확히 반영됨', () => {
      const raw: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        isHolding: true,
        holdingQuantity: 100,
        holdingAvgPrice: 65000,
        closePrice: 70000,
        psy: 20.0,
        bbLower: 69000,
        ma5: 72000,
        ma20: 71000,
        ma60: 70000,
        volumeRatio: 125.0,
        macdHist: 5.0,
        rsi: 30.0,
        bullishDivergence: true,
        shortSellHistory: [],
        dataSource: 'LS증권 Open API',
        errorMessage: null
      };

      const result = calculateQuantIndicators(raw);

      expect(result.shcode).toBe('005930');
      expect(result.name).toBe('삼성전자');
      expect(result.industry).toBe('전기/전자');
      expect(result.isHolding).toBe(true);
      expect(result.holdingQuantity).toBe(100);
      expect(result.holdingAvgPrice).toBe(65000);
      expect(result.closePrice).toBe(70000);
      expect(result.psy).toBe(20.0);
      expect(result.bbLower).toBe(69000);
      expect(result.ma5).toBe(72000);
      expect(result.ma20).toBe(71000);
      expect(result.ma60).toBe(70000);
      expect(result.volumeRatio).toBe(125.0);
      expect(result.macdHist).toBe(5.0);
      expect(result.rsi).toBe(30.0);
      expect(result.bullishDivergence).toBe(true);
      expect(result.dataSource).toBe('LS증권 Open API');
      expect(result.errorMessage).toBe(null);
    });

    it('shortSignal 객체 구조 검증', () => {
      const shortSellHistory: ShortSellRecord[] = [
        { date: '2026-08-10', balanceRatio: 5.0, price: 70000, volume: 1000000 },
        { date: '2026-08-15', balanceRatio: 3.5, price: 72000, volume: 1200000 }
      ];

      const raw: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 72000,
        shortSellHistory
      };

      const result = calculateQuantIndicators(raw);

      expect(result.shortSignal).toHaveProperty('label');
      expect(result.shortSignal).toHaveProperty('confidence');
      expect(result.shortSignal).toHaveProperty('metrics');
      expect(result.shortSignal).toHaveProperty('summary');

      expect(['신규 공매도 유입', '숏커버링(환매수) 유력', '매수세가 공매도 흡수 중', '판단 보류']).toContain(result.shortSignal.label);
      expect(['높음', '중간', '낮음']).toContain(result.shortSignal.confidence);
    });

    it('conditions 객체 구조 검증', () => {
      const raw: RawStockApiData = {
        shcode: '005930',
        name: '삼성전자',
        industry: '전기/전자',
        closePrice: 70000,
        shortSellHistory: []
      };

      const result = calculateQuantIndicators(raw);

      expect(result.conditions).toHaveProperty('cond_psy');
      expect(result.conditions).toHaveProperty('cond_bb');
      expect(result.conditions).toHaveProperty('cond_ma_turn');
      expect(result.conditions).toHaveProperty('cond_volume');
      expect(result.conditions).toHaveProperty('cond_macd');
      expect(result.conditions).toHaveProperty('cond_rsi');
      expect(result.conditions).toHaveProperty('cond_divergence');
      expect(result.conditions).toHaveProperty('cond_short_signal');

      expect(typeof result.conditions.cond_psy).toBe('boolean');
      expect(typeof result.conditions.cond_bb).toBe('boolean');
      expect(typeof result.conditions.cond_ma_turn).toBe('boolean');
      expect(typeof result.conditions.cond_volume).toBe('boolean');
      expect(typeof result.conditions.cond_macd).toBe('boolean');
      expect(typeof result.conditions.cond_rsi).toBe('boolean');
      expect(typeof result.conditions.cond_divergence).toBe('boolean');
      expect(typeof result.conditions.cond_short_signal).toBe('boolean');
    });
  });
});
