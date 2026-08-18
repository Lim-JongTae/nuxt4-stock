<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
    <div class="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col overflow-hidden">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold text-sm">
            <i class="fas fa-chart-line"></i>
          </div>
          <div>
            <h3 class="text-base font-extrabold text-white flex items-center gap-2">
              <span>{{ stock?.name || '종목' }}</span>
              <span class="text-xs text-slate-400 font-mono">({{ stock?.shcode }})</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                공매도 정량 분석 리포트
              </span>
            </h3>
            <p class="text-[11px] text-slate-400 mt-0.5">
              LS증권 Open API t1927/t1305 Raw Data 4단계 정량 분석 프레임워크
            </p>
          </div>
        </div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white font-bold text-sm px-2.5 py-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors">
          ✕
        </button>
      </div>

      <!-- RED ERROR BANNER (Data Collection Failure Principle) -->
      <div v-if="apiError" class="shrink-0 bg-rose-950/90 border border-rose-500/60 p-4 rounded-xl text-rose-200 text-xs flex items-start gap-2.5 shadow-lg">
        <i class="fas fa-exclamation-triangle text-rose-400 text-base shrink-0 mt-0.5"></i>
        <div class="space-y-1">
          <strong class="font-bold text-rose-300">🚨 [공매도 API 수집 실패 오류]</strong>
          <p class="text-rose-200/90 leading-relaxed">{{ apiError }}</p>
          <p class="text-[10px] text-rose-400/80">무하드코딩 원칙에 따라 대체/가짜 데이터를 생성하지 않고 오류 사유를 명확히 표시합니다.</p>
        </div>
      </div>

      <!-- ETF / ETN NOTICE BANNER -->
      <div v-if="isEtfOrForeign" class="shrink-0 bg-purple-950/90 border border-purple-500/60 p-4 rounded-xl text-purple-200 text-xs flex items-start gap-2.5 shadow-lg">
        <i class="fas fa-info-circle text-purple-400 text-base shrink-0 mt-0.5"></i>
        <div class="space-y-1">
          <strong class="font-bold text-purple-300">ℹ️ [ETF / ETN 수급 안내]</strong>
          <p class="text-purple-200/90 font-semibold">{{ stock?.name }}은(는) ETF/ETN 상품으로 LS증권 Open API (t1927) 공매도 분석 대상 제외 항목입니다.</p>
        </div>
      </div>

      <!-- Main Report Body Scroll Area -->
      <div class="flex-1 overflow-y-auto pr-1 space-y-4 text-xs text-slate-300">
        
        <!-- SECTION 1: KEY METRICS (1단계 핵심 지표) -->
        <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <span class="font-extrabold text-white text-xs flex items-center gap-1.5">
              <i class="fas fa-calculator text-indigo-400"></i>
              <span>1. 핵심 지표 산출</span>
            </span>
            <span class="text-[10px] text-slate-400 font-mono">기준일: {{ reportDate }}</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-slate-900 border border-purple-500/30 p-3 rounded-lg space-y-1">
              <span class="text-[10px] text-slate-400 block">공매도 잔고비율</span>
              <strong class="text-sm font-extrabold font-mono" :class="(shortRatio || 0) > 3 ? 'text-rose-400' : 'text-blue-400'">
                {{ typeof shortRatio === 'number' ? shortRatio.toFixed(2) + '%' : '0.00%' }}
              </strong>
            </div>

            <div class="bg-slate-900 border border-cyan-500/30 p-3 rounded-lg space-y-1">
              <span class="text-[10px] text-slate-400 block">DTC (Days to Cover)</span>
              <strong class="text-sm font-extrabold font-mono" :class="(dtcDays || 0) >= 5 ? 'text-rose-400' : 'text-cyan-300'">
                {{ typeof dtcDays === 'number' ? dtcDays.toFixed(2) + '일' : '0.00일' }}
              </strong>
            </div>

            <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1">
              <span class="text-[10px] text-slate-400 block">공매도 평균단가</span>
              <strong class="text-xs font-bold font-mono text-slate-100">
                {{ shortAvgPriceVal ? Number(shortAvgPriceVal).toLocaleString() + '원' : 'N/A' }}
              </strong>
            </div>

            <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1">
              <span class="text-[10px] text-slate-400 block">최근 공매도 거래량</span>
              <strong class="text-xs font-bold font-mono text-slate-100">
                {{ shortVolumeVal ? Number(shortVolumeVal).toLocaleString() + '주' : 'N/A' }}
              </strong>
            </div>
          </div>
        </div>

        <!-- SECTION 2 & 3: RISK GRADE & BORROWING TREND (2단계 & 3단계) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- 2단계 리스크 등급 -->
          <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="font-extrabold text-white text-xs flex items-center gap-1.5">
                <i class="fas fa-shield-alt text-amber-400"></i>
                <span>2. 리스크 등급</span>
              </span>
              <span class="px-2 py-0.5 rounded text-[10px] font-extrabold" :class="riskGrade.badgeClass">
                {{ riskGrade.label }}
              </span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed font-semibold">
              {{ riskGrade.reason }}
            </p>
            <div class="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/60">
              구간: 정상(3% 이하) / 주의(3%~5%) / 위험(5% 이상)
            </div>
          </div>

          <!-- 3단계 대차잔고 트렌드 -->
          <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="font-extrabold text-white text-xs flex items-center gap-1.5">
                <i class="fas fa-trend-up text-cyan-400"></i>
                <span>3. 대차잔고 트렌드</span>
              </span>
              <span class="px-2 py-0.5 rounded text-[10px] font-extrabold" :class="trendInfo.badgeClass">
                {{ trendInfo.label }}
              </span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed font-semibold">
              {{ trendInfo.reason }}
            </p>
            <div class="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/60">
              판정: 숏커버링 감지 시 상승여력 우세, 대차증가 시 하방압력 우세
            </div>
          </div>
        </div>

        <!-- SECTION 4: SCENARIO DETERMINATION (4단계 시나리오 판정) -->
        <div class="bg-slate-950/90 border border-indigo-500/40 rounded-xl p-4 space-y-3 shadow-lg">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <span class="font-extrabold text-white text-xs flex items-center gap-1.5">
              <i class="fas fa-compass text-rose-400"></i>
              <span>4. 시나리오 판정 & 투자의사결정 행동 권고</span>
            </span>
            <span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold" :class="scenarioInfo.badgeClass">
              {{ scenarioInfo.label }}
            </span>
          </div>

          <div class="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/30 space-y-2">
            <p class="text-xs text-white font-bold leading-relaxed">
              {{ scenarioInfo.description }}
            </p>
            <p class="text-[11px] text-indigo-300/90 leading-relaxed">
              <strong class="text-amber-300">💡 투자자 행동 가이드:</strong> {{ scenarioInfo.actionGuide }}
            </p>
          </div>
        </div>

        <!-- SECTION 5: ADVANCED METRICS & REGULATORY CONTEXT (고급 고도화 지표) -->
        <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <span class="font-extrabold text-white text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <i class="fas fa-lightbulb text-amber-400"></i>
            <span>5. 참고 & 고급 분석 고려사항</span>
          </span>

          <ul class="space-y-2 text-[11px]">
            <li v-if="dtcDays !== null && dtcDays >= 5.0" class="flex items-start gap-2 text-rose-300 bg-rose-950/20 p-2 rounded border border-rose-500/30">
              <i class="fas fa-fire text-rose-400 mt-0.5"></i>
              <span><strong>DTC {{ dtcDays.toFixed(1) }}일 (고지표):</strong> 거래량 대비 공매도 잔고가 많아 탈출구가 좁으므로, 반등 호재 발생 시 숏스퀴즈 폭발 강도가 강력해질 수 있습니다.</span>
            </li>
            <li class="flex items-start gap-2 text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800/60">
              <i class="fas fa-balance-scale text-indigo-400 mt-0.5"></i>
              <span><strong>2026년 NSDS 전산화 규제 환경:</strong> 불법 무차입 공매도 사전 차단 및 기관 상환 기한 최대 12개월 제한 전산화 시스템이 가동 중입니다. 만기 임박 고잔고 종목은 수급 압박 확률이 유의미하게 높아집니다.</span>
            </li>
            <li class="flex items-start gap-2 text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800/60">
              <i class="fas fa-chart-pie text-teal-400 mt-0.5"></i>
              <span><strong>펀더멘털 대조:</strong> 우량 기업(영업이익 성장률 15%+ 또는 ROE 10%+)의 경우 공매도 유입 시에도 강한 바닥 지지선이 형성되어 숏스퀴즈 전환 압력이 가중됩니다.</span>
            </li>
          </ul>
        </div>

        <!-- LS SECURITIES t1927 TIME SERIES TABLE -->
        <div v-if="stock?.shortSellHistory && stock.shortSellHistory.length > 0" class="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <span class="font-extrabold text-white text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <i class="fas fa-table text-cyan-400"></i>
            <span>LS증권 t1927 공매도일별추이 실시간 데이터</span>
          </span>

          <div class="overflow-x-auto border border-slate-800 rounded-lg">
            <table class="w-full text-[11px] text-left text-slate-300 font-mono">
              <thead class="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th class="px-2.5 py-2">일자</th>
                  <th class="px-2.5 py-2">종가</th>
                  <th class="px-2.5 py-2">공매도 수량</th>
                  <th class="px-2.5 py-2">공매도 비중</th>
                  <th class="px-2.5 py-2">공매도 평균가</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                <tr v-for="row in stock.shortSellHistory.slice(0, 5)" :key="row.date" class="hover:bg-slate-900">
                  <td class="px-2.5 py-1.5 text-slate-400">{{ row.date }}</td>
                  <td class="px-2.5 py-1.5 font-bold text-white">{{ Number(row.price).toLocaleString() }}원</td>
                  <td class="px-2.5 py-1.5 text-amber-300">{{ Number(row.volume || 0).toLocaleString() }}주</td>
                  <td class="px-2.5 py-1.5" :class="row.balanceRatio > 3 ? 'text-rose-400 font-bold' : 'text-blue-400'">{{ (row.balanceRatio || 0).toFixed(2) }}%</td>
                  <td class="px-2.5 py-1.5 text-slate-300">{{ row.shortAvgPrice ? Number(row.shortAvgPrice).toLocaleString() + '원' : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Modal Footer (Required Disclaimer & Generated Tag) -->
      <div class="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2 shrink-0">
        <span>본 리포트는 LS증권 API 공매도 데이터 기반 정량적 참고 자료이며 투자 조언이 아닙니다.</span>
        <span class="font-extrabold text-indigo-400 font-mono bg-indigo-950/60 px-2.5 py-1 rounded border border-indigo-500/30">
          [공매도 분석 리포트] 생성
        </span>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ShortSellRecord } from '../../../utils/types/lsSecurities';
import { isEtfOrEtn } from '../../../utils/stockUtils';

const props = defineProps<{
  isOpen: boolean;
  stock?: any | null;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const reportDate = computed(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
});

const isEtfOrForeign = computed(() => {
  if (!props.stock) return false;
  const name = props.stock.name || '';
  const ind = props.stock.industry || '';
  return isEtfOrEtn(name, ind);
});

const validShortRecords = computed(() => {
  if (!props.stock?.shortSellHistory || !Array.isArray(props.stock.shortSellHistory)) return [];
  return props.stock.shortSellHistory.filter((r: ShortSellRecord) => 
    (r.shortVolume && r.shortVolume > 0) || 
    (r.shortAvgPrice && r.shortAvgPrice > 0) || 
    (r.balanceRatio && r.balanceRatio > 0)
  );
});

const latestShortRecord = computed(() => {
  if (validShortRecords.value.length > 0) {
    return validShortRecords.value[0]; // 가장 최근의 유효한 공매도 데이터 레코드
  }
  if (props.stock?.shortSellHistory && props.stock.shortSellHistory.length > 0) {
    return props.stock.shortSellHistory[0];
  }
  return null;
});

const shortVolumeVal = computed(() => {
  if (props.stock?.shortVolume && props.stock.shortVolume > 0) return props.stock.shortVolume;
  if (latestShortRecord.value?.shortVolume && latestShortRecord.value.shortVolume > 0) return latestShortRecord.value.shortVolume;
  return null;
});

const shortAvgPriceVal = computed(() => {
  if (props.stock?.shortAvgPrice && props.stock.shortAvgPrice > 0) return props.stock.shortAvgPrice;
  if (latestShortRecord.value?.shortAvgPrice && latestShortRecord.value.shortAvgPrice > 0) return latestShortRecord.value.shortAvgPrice;
  return null;
});

const missingFields = computed(() => {
  if (!props.stock || isEtfOrForeign.value) return [];
  const list: string[] = [];
  if (shortRatio.value === null) {
    list.push('공매도 순보유잔고 수량/비율(%)');
  }
  if (dtcDays.value === null) {
    list.push('DTC (Days to Cover)');
  }
  return list;
});

const apiError = computed(() => {
  if (!props.stock) return '선택된 종목 수급 데이터가 존재하지 않습니다.';
  if (props.stock.errorMessage) return props.stock.errorMessage;
  return null;
});

// 1단계 핵심 지표 (공매도잔고비율 %, DTC 일수)
const shortRatio = computed(() => {
  if (!props.stock) return null;
  if (typeof props.stock.shortRatio === 'number' && !isNaN(props.stock.shortRatio) && props.stock.shortRatio > 0) {
    return props.stock.shortRatio;
  }
  if (latestShortRecord.value?.balanceRatio !== undefined && !isNaN(latestShortRecord.value.balanceRatio) && latestShortRecord.value.balanceRatio > 0) {
    return latestShortRecord.value.balanceRatio;
  }
  return 0;
});

const dtcDays = computed(() => {
  if (!props.stock) return null;

  // 1. stock.dtc가 있으면 우선 사용
  if (typeof props.stock.dtc === 'number' && !isNaN(props.stock.dtc) && props.stock.dtc > 0) {
    return props.stock.dtc;
  }

  // 2. DTC = 공매도 잔고수량 / 일평균 거래량
  // 일평균 거래량이 없으므로 최근 거래량으로 근사 계산
  if (shortVolumeVal.value && props.stock.volume && props.stock.volume > 0) {
    return Number((shortVolumeVal.value / props.stock.volume).toFixed(2));
  }

  // 3. 계산 불가 시 null 반환 (하드코딩 금지)
  return null;
});

// 2단계 리스크 등급 (정상 <=3%, 주의 3%~5%, 위험 >=5%)
const riskGrade = computed(() => {
  const r = shortRatio.value ?? 0;
  if (r >= 5.0) {
    return {
      label: '위험 (Danger)',
      badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
      reason: `공매도 비중/잔고비율이 ${r.toFixed(2)}%로 5.00%를 초과하여 과도한 하방 베팅 포지션이 누적된 위험 구간입니다.`
    };
  } else if (r > 3.0) {
    return {
      label: '주의 (Caution)',
      badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
      reason: `공매도 비중/잔고비율이 ${r.toFixed(2)}%로 기관/외국인 매도세 유입이 관찰되어 모니터링이 필요한 주의 구간입니다.`
    };
  }
  return {
    label: '정상 (Normal)',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    reason: `공매도 비중/잔고비율이 ${r.toFixed(2)}%로 3.00% 이하를 유지하여 공매도 수급 영향력이 제한적인 안정 구간입니다.`
  };
});

// 3단계 대차잔고 트렌드
const trendInfo = computed(() => {
  const status = props.stock?.shortSellingStatus || '';
  if (status === '숏커버링(환매수) 유력') {
    return {
      label: '상승·반등 여력 우세',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
      reason: '공매도 잔고 수량이 감소하고 숏커버링 매수세가 들어와 수급 반등 여력이 우수합니다.'
    };
  } else if (status === '신규 공매도 유입') {
    return {
      label: '하방 압력 우세',
      badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
      reason: '신규 공매도 출회 및 대차잔고가 증가하여 단기 하방 압력이 우세한 상태입니다.'
    };
  } else if (status === '매수세가 공매도 흡수 중') {
    return {
      label: '수급 흡수 중 (보합)',
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
      reason: '공매도 유입에도 주가 지지 매수세가 단단히 작용하여 수급을 흡수하고 있습니다.'
    };
  }
  return {
    label: '판단 보류 / 관찰',
    badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700',
    reason: '공매도 및 대차잔고 추세가 횡보하거나 유효 수급 데이터가 수집 대기 중입니다.'
  };
});

// 4단계 시나리오 판정
const scenarioInfo = computed(() => {
  const grade = riskGrade.value.label;
  const trend = trendInfo.value.label;

  if ((grade.includes('주의') || grade.includes('위험')) && trend.includes('하방 압력')) {
    return {
      label: '하락 예측 (공매도 심화형)',
      badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-extrabold',
      description: '추가적인 공매도 출회 가능성이 높아 단기적 하락 압력이 지속될 것으로 예상됩니다.',
      actionGuide: '신규 매수 보류, 보유 비중 축소 및 스톱로스 가격 엄수 권고.'
    };
  } else if (grade.includes('위험') && trend.includes('상승')) {
    return {
      label: '상승 예측 (숏스퀴즈 발생형)',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-extrabold',
      description: '과도한 공매도 잔고(5%+)+숏커버링 발생으로 숏스퀴즈에 의한 단기 주가 급등 가능성이 높습니다.',
      actionGuide: '반등 타이밍에 맞춘 숏스퀴즈 모멘텀 매수 및 목표가 분할 청산 전략 수립.'
    };
  }
  return {
    label: '중립 관찰 구간',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-extrabold',
    description: '방향성 시나리오 조건에 명확히 해당하지 않는 중립적 수급 관찰 구간입니다.',
    actionGuide: '지지선 및 기술적 지표(RSI/볼린저밴드) 추가 확인 후 비중 결정.'
  };
});

// 테스트용 브라우저 콘솔 데이터 및 수식 출력
import { watch } from 'vue';
import { logShortSellQuantitativeReport } from '~/utils/shortSellReportLogger';

watch([() => props.isOpen, () => props.stock], ([isOpen, stock]) => {
  if (isOpen && stock) {
    logShortSellQuantitativeReport(stock, '공매도 4단계 분석 모달 열림');
  }
}, { immediate: true });
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
</style>
