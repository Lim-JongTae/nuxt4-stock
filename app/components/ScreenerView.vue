<template>
  <div class="space-y-6">
    <!-- Screener Header & Controls -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold text-xs">
              <i class="fas fa-search-dollar mr-1"></i> LS증권 API 퀀트 스크리너
            </span>
            <span class="text-xs text-slate-400">상위 3대 유망업종 & 8대 종합 지표 (공매도 + 선물/옵션 시장 방향성)</span>
          </div>
          <h2 class="text-xl font-extrabold text-white">
            상위 3대 유망업종 보유/관심종목 8대 지표 정밀 검증 (`종목.md` 실시간 연동)
          </h2>
          <p class="text-xs text-emerald-400 mt-1 bg-slate-950/70 border border-emerald-500/30 p-2 rounded-lg">
            심리선 + 볼린저하단 + 이평선정배열 + 거래량 + MACD + RSI + 공매도/숏커버링 + KOSPI200 선물 베이시스 8가지 지표를 종합 판단합니다.
          </p>
        </div>

        <button 
          @click="screenerStore.loadInitial(true)" 
          :disabled="screenerStore.isRefreshing"
          class="px-5 py-2.5 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <i class="fas" :class="screenerStore.isRefreshing ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
          <span>{{ screenerStore.isRefreshing ? 'LS증권 API 시세 분석 중...' : '실시간 8대 지표 데이터 갱신' }}</span>
        </button>
      </div>

      <!-- 8 Technical & Market Criteria Cards Summary -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-2 border-t border-slate-800">
        <div class="bg-slate-950/70 border border-purple-500/30 p-2 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-purple-400 flex items-center justify-between">
            <span>1. 심리선(PSY)</span>
            <span class="px-1 py-0.5 rounded bg-purple-500/20 text-[9px]">25% 이하</span>
          </div>
          <p class="text-[10px] text-slate-400">12일 침체 과매도</p>
        </div>

        <div class="bg-slate-950/70 border border-blue-500/30 p-2 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-blue-400 flex items-center justify-between">
            <span>2. 볼린저 하단</span>
            <span class="px-1 py-0.5 rounded bg-blue-500/20 text-[9px]">102% 이내</span>
          </div>
          <p class="text-[10px] text-slate-400">20일 2SD 하단 지지</p>
        </div>

        <div class="bg-slate-950/70 border border-emerald-500/30 p-2 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-emerald-400 flex items-center justify-between">
            <span>3. 이평선 전환</span>
            <span class="px-1 py-0.5 rounded bg-emerald-500/20 text-[9px]">5/20/60일</span>
          </div>
          <p class="text-[10px] text-slate-400">단기 정배열 초기</p>
        </div>

        <div class="bg-slate-950/70 border border-amber-500/30 p-2 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-amber-400 flex items-center justify-between">
            <span>4. 거래량 수급</span>
            <span class="px-1 py-0.5 rounded bg-amber-500/20 text-[9px]">120% 이상</span>
          </div>
          <p class="text-[10px] text-slate-400">전일 대비 수급 급증</p>
        </div>

        <div class="bg-slate-950/70 border border-pink-500/30 p-2 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-pink-400 flex items-center justify-between">
            <span>5. MACD 반전</span>
            <span class="px-1 py-0.5 rounded bg-pink-500/20 text-[9px]">양전/골든</span>
          </div>
          <p class="text-[10px] text-slate-400">오실레이터 상승</p>
        </div>

        <div class="bg-slate-950/70 border border-cyan-500/30 p-2 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-cyan-400 flex items-center justify-between">
            <span>6. RSI 탈출</span>
            <span class="px-1 py-0.5 rounded bg-cyan-500/20 text-[9px]">30선 돌파</span>
          </div>
          <p class="text-[10px] text-slate-400">RSI(14일) 반등</p>
        </div>

        <div class="bg-slate-950/70 border border-rose-500/30 p-2 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-rose-400 flex items-center justify-between">
            <span>7. 공매도 분석</span>
            <span class="px-1 py-0.5 rounded bg-rose-500/20 text-[9px]">t1927</span>
          </div>
          <p class="text-[10px] text-slate-400">숏커버링 vs 경계</p>
        </div>

        <div class="bg-slate-950/70 border border-indigo-500/30 p-2 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-indigo-400 flex items-center justify-between">
            <span>8. 시장 방향성</span>
            <span 
              class="px-1 py-0.5 rounded text-[9px] font-mono font-bold"
              :class="screenerStore.marketBasis && screenerStore.marketBasis.basis >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'"
            >
              {{ screenerStore.marketBasis ? (screenerStore.marketBasis.basis >= 0 ? '+' : '') + screenerStore.marketBasis.basis + 'pt' : 't2111' }}
            </span>
          </div>
          <p class="text-[10px] text-slate-300 font-semibold truncate">
            {{ screenerStore.marketBasis ? screenerStore.marketBasis.basisStatus : '베이시스/OI/프로그램' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Dedicated LS Securities Market Basis & Futures Direction Summary Banner -->
    <div class="bg-linear-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
          <i class="fas fa-chart-line text-lg"></i>
        </div>
        <div>
          <div class="flex items-center gap-2.5">
            <h4 class="text-xs font-extrabold text-white flex items-center gap-1.5">
              <span>LS증권 KOSPI200 선물 시장 베이시스</span>
              <span class="text-[10px] text-indigo-400 font-mono font-normal bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">t2111 / t2424</span>
            </h4>
            <template v-if="screenerStore.marketBasis">
              <span 
                class="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold flex items-center gap-1 border shadow-xs"
                :class="screenerStore.marketBasis.basis >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border-rose-500/40'"
              >
                <i class="fas" :class="screenerStore.marketBasis.basis >= 0 ? 'fa-arrow-up text-emerald-400' : 'fa-arrow-down text-rose-400'"></i>
                <span>{{ screenerStore.marketBasis.basis >= 0 ? '+' : '' }}{{ screenerStore.marketBasis.basis }}pt</span>
                <span class="text-[10px] font-bold opacity-90">({{ screenerStore.marketBasis.basisStatus }})</span>
              </span>
            </template>
          </div>
          <p class="text-[11px] text-slate-400 mt-0.5">
            KOSPI200 선물과 현물 지수의 수급 격차를 실시간 측정하여 증시 전체 프로그램 매수/매도 우위를 판단합니다.
          </p>
        </div>
      </div>

      <div v-if="screenerStore.marketBasis" class="flex flex-wrap items-center gap-3 text-xs">
        <div class="bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl font-mono shadow-inner">
          <span class="text-slate-400 text-[10px] block font-semibold">선물 현재가</span>
          <strong class="text-white text-xs">{{ screenerStore.marketBasis.futuresPrice }}pt</strong>
        </div>
        <div class="bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl font-mono shadow-inner">
          <span class="text-slate-400 text-[10px] block font-semibold">현물 지수</span>
          <strong class="text-white text-xs">{{ screenerStore.marketBasis.kospi200Index }}pt</strong>
        </div>
        <div class="bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl font-mono shadow-inner">
          <span class="text-slate-400 text-[10px] block font-semibold">미결제약정 (OI)</span>
          <strong class="text-cyan-400 text-xs">{{ Number(screenerStore.marketBasis.oi).toLocaleString() }}계약</strong>
        </div>
        <div class="bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl font-mono shadow-inner">
          <span class="text-slate-400 text-[10px] block font-semibold">프로그램 순매수</span>
          <strong :class="screenerStore.marketBasis.programNetBuy >= 0 ? 'text-rose-400' : 'text-cyan-400'" class="text-xs">
            {{ screenerStore.marketBasis.programNetBuy >= 0 ? '+' : '' }}{{ Number(screenerStore.marketBasis.programNetBuy).toLocaleString() }}억원
          </strong>
        </div>
        <div class="bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl font-mono shadow-inner">
          <span class="text-slate-400 text-[10px] block font-semibold">VKOSPI 변동성</span>
          <strong class="text-amber-400 text-xs">{{ screenerStore.marketBasis.vkospi }}</strong>
        </div>
      </div>
    </div>

    <!-- Error Alert Banner -->
    <div v-if="screenerStore.errorMessage" class="bg-rose-950/80 border border-rose-500/50 p-4 rounded-xl flex items-center justify-between text-rose-300 text-xs shadow-lg">
      <div class="flex items-center gap-2">
        <i class="fas fa-exclamation-triangle text-rose-400 text-sm"></i>
        <span><strong>LS증권 API 연동 상태 경고:</strong> {{ screenerStore.errorMessage }}</span>
      </div>
      <button @click="screenerStore.errorMessage = null" class="text-rose-400 hover:text-rose-200 font-bold px-2">✕</button>
    </div>

    <!-- Dual Comparison Layout: OLD (Top) vs NEW (Bottom) -->
    <div class="space-y-6">
       <!-- 1. NEW Section (Bottom): 실시간 8대 지표 포착 관심종목 -->
      <div class="bg-slate-900/70 border border-indigo-500/40 rounded-2xl p-4 space-y-3 shadow-xl relative overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/30 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
              <i class="fas fa-bolt text-emerald-400"></i> 실시간 갱신 (NEW)
            </span>
            <h3 class="text-sm font-bold text-white">상위 3대 유망업종 & 8대 지표 포착 관심종목</h3>
            <span class="text-xs text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 ml-2">
              총 {{ screenerStore.newData.length }}개 중 <strong class="text-emerald-400 font-bold">{{ screenerStore.matchedCount }}개 종목 85점+ 매수포착</strong>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-4 text-xs">
            <span class="text-slate-300 flex items-center gap-1.5 bg-slate-950/80 px-3 py-1 rounded-lg border border-indigo-500/40 shadow-sm">
              <i class="far fa-clock text-indigo-400"></i> 자료 갱신 일시: <strong class="text-emerald-400 font-mono">{{ screenerStore.lastUpdated || '실시간' }}</strong>
            </span>
            <span class="text-slate-300 flex items-center gap-1.5 bg-slate-950/80 px-3 py-1 rounded-lg border border-indigo-500/40 shadow-sm">
              <i class="fas fa-database text-indigo-400"></i> 자료수집처: <strong class="text-indigo-400">{{ screenerStore.sourceProvider }}</strong>
            </span>
          </div>
        </div>

        <div class="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90 shadow-md">
          <table class="w-full text-xs text-left text-slate-300">
            <thead class="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[11px]">
              <tr>
                <th class="px-3 py-3">업종</th>
                <th class="px-3 py-3">종목코드</th>
                <th class="px-3 py-3">종목명</th>
                <th class="px-3 py-3">최신 현재가 (변동)</th>
                <th class="px-3 py-3">심리선(12일)</th>
                <th class="px-3 py-3">볼린저 하단</th>
                <th class="px-3 py-3">이평선 상태</th>
                <th class="px-3 py-3">거래량(수급)</th>
                <th class="px-3 py-3">MACD</th>
                <th class="px-3 py-3">RSI(14일)</th>
                <th class="px-3 py-3">공매도 분석 (t1927)</th>
                <th class="px-3 py-3 text-center">8대 지표 퀀트 스코어</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr 
                v-for="item in screenerStore.newData" 
                :key="item.shcode"
                :class="item.score >= 85 ? 'bg-emerald-950/30 hover:bg-emerald-900/40 border-l-4 border-l-emerald-500' : 'hover:bg-slate-900/80'"
                class="transition-all border-b border-slate-800/40"
              >
                <td class="px-3 py-3"><span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold text-[10px]">{{ item.industry }}</span></td>
                <td class="px-3 py-3 font-mono text-slate-400">{{ item.shcode }}</td>
                <td class="px-3 py-3 font-bold text-white">
                  <NuxtLink 
                    :to="'/stock/' + item.shcode" 
                    class="text-indigo-300 hover:text-white hover:underline flex items-center gap-1 group transition-colors"
                    :title="item.name + ' 실시간 AI 상세 정밀 분석 보기'"
                  >
                    <span>{{ item.name }}</span>
                    <i class="fas fa-external-link-alt text-[9px] text-indigo-400 opacity-60 group-hover:opacity-100"></i>
                  </NuxtLink>
                </td>
                
                <!-- Price Display with Delta -->
                <td class="px-3 py-3 font-extrabold text-slate-100">
                  <div>{{ Number(item.closePrice).toLocaleString() }}원</div>
                  <template v-if="getPriceDelta(item)">
                    <div class="text-[10px] font-bold" :class="getPriceDelta(item)?.class">
                      {{ getPriceDelta(item)?.text }}
                    </div>
                  </template>
                </td>

                <td class="px-3 py-3" :class="typeof item.psy === 'number' && item.psy <= 25 ? 'text-emerald-400 font-extrabold' : 'text-slate-300'">
                  {{ typeof item.psy === 'number' ? item.psy + '%' + (item.psy <= 25 ? ' (과매도)' : '') : 'N/A' }}
                </td>
                <td class="px-3 py-3 font-mono text-slate-300 text-[11px]">
                  {{ typeof item.bbLower === 'number' && item.bbLower > 0 ? Number(item.bbLower).toLocaleString() + '원' : 'N/A' }}
                </td>
                <td class="px-3 py-3 text-emerald-400 font-semibold text-[11px]">
                  <span v-if="item.ma5 && item.ma20 && item.ma60 && item.ma5 >= item.ma20 && item.ma20 >= item.ma60"><i class="fas fa-chart-line text-[10px] mr-1"></i> 정배열 지지</span>
                  <span v-else class="text-slate-400 font-normal">미달성/N/A</span>
                </td>
                <td class="px-3 py-3 font-bold" :class="typeof item.volumeRatio === 'number' && item.volumeRatio >= 120 ? 'text-amber-400 font-extrabold' : 'text-slate-300'">
                  <div>{{ typeof item.volumeRatio === 'number' ? item.volumeRatio + '%' : 'N/A' }}</div>
                  <div v-if="typeof item.volumeRatio === 'number' && item.volumeRatio >= 120" class="text-[9px] text-amber-400/80 font-normal">전일대비 급증</div>
                </td>
                <td class="px-3 py-3 text-pink-400 font-bold">
                  {{ typeof item.macdHist === 'number' ? (item.macdHist > 0 ? '+' + item.macdHist : item.macdHist) : 'N/A' }}
                </td>
                <td class="px-3 py-3 text-cyan-400 font-bold">
                  {{ typeof item.rsi === 'number' ? item.rsi : 'N/A' }}
                </td>
                <td class="px-3 py-3 font-bold" :title="item.shortSellingSummary || ''">
                  <div class="flex flex-col gap-1 items-start">
                    <span 
                      class="px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1"
                      :class="{
                        'bg-red-500/20 text-red-400 border border-red-500/40': item.shortSellingStatus === '숏커버링(환매수) 유력',
                        'bg-blue-500/20 text-blue-400 border border-blue-500/40': item.shortSellingStatus === '신규 공매도 유입',
                        'bg-pink-500/20 text-pink-400 border border-pink-500/40': item.shortSellingStatus === '매수세가 공매도 흡수 중',
                        'bg-slate-900 text-white border border-slate-400/50': !['숏커버링(환매수) 유력', '신규 공매도 유입', '매수세가 공매도 흡수 중'].includes(item.shortSellingStatus || '')
                      }"
                    >
                      <i v-if="item.shortSellingStatus === '숏커버링(환매수) 유력'" class="fas fa-arrow-up text-[9px] text-red-400"></i>
                      <i v-else-if="item.shortSellingStatus === '신규 공매도 유입'" class="fas fa-arrow-down text-[9px] text-blue-400"></i>
                      <span>{{ item.shortSellingStatus || '숏커버링(환매수) 유력' }}</span>
                    </span>
                    <div class="text-[9px] text-rose-300 font-mono flex items-center gap-1" v-if="item.shortAvgPrice && item.shortAvgPrice > 0">
                      <span>평단가: {{ Number(item.shortAvgPrice).toLocaleString() }}원</span>
                    </div>
                    <div class="text-[9px] text-amber-300/90 font-mono" v-if="item.shortVolume && item.shortVolume > 0">
                      <span>매도량: {{ Number(item.shortVolume).toLocaleString() }}주</span>
                    </div>
                  </div>
                </td>
                
                <td class="px-3 py-3 text-center">
                  <span 
                    v-if="item.score >= 85" 
                    class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 inline-flex items-center gap-1 shadow-sm"
                  >
                    <i class="fas fa-check-circle"></i> 🎯 8대 지표 우수 ({{ item.score }}점)
                  </span>
                  <span 
                    v-else-if="item.score >= 70" 
                    class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 inline-flex items-center gap-1"
                  >
                    👀 관심 관찰 ({{ item.score }}점)
                  </span>
                  <span v-else class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                    일부 매칭 ({{ item.score }}점)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 2. OLD Section (Top): 이전 분석 기록 -->
      <div class="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/40 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
              <i class="fas fa-history text-amber-400"></i> 이전 거래분석 기록 (OLD)
            </span>
            <h3 class="text-sm font-bold text-slate-200">이전 기술적 관심종목 리스트</h3>
          </div>
          <div class="flex flex-wrap items-center gap-4 text-xs">
            <span class="text-slate-300 flex items-center gap-1.5 bg-slate-950/80 px-3 py-1 rounded-lg border border-amber-500/40 shadow-sm">
              <i class="far fa-clock text-amber-400"></i> 이전 기록 작성 시간: <strong class="text-amber-300 font-mono">{{ screenerStore.oldRecordTime }}</strong>
            </span>
            <span class="text-slate-400 flex items-center gap-1.5 bg-slate-950/60 px-3 py-1 rounded-lg border border-slate-800">
              <i class="fas fa-server text-amber-400"></i> 자료수집처: <strong class="text-slate-200">{{ screenerStore.sourceProvider }}</strong>
            </span>
          </div>
        </div>

        <div class="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/80">
          <table class="w-full text-xs text-left text-slate-300">
            <thead class="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[11px]">
              <tr>
                <th class="px-3 py-3">업종</th>
                <th class="px-3 py-3">종목코드</th>
                <th class="px-3 py-3">종목명</th>
                <th class="px-3 py-3">이전 현재가</th>
                <th class="px-3 py-3">심리선(12일)</th>
                <th class="px-3 py-3">볼린저 하단</th>
                <th class="px-3 py-3">이평선 상태</th>
                <th class="px-3 py-3">거래량(수급)</th>
                <th class="px-3 py-3">MACD</th>
                <th class="px-3 py-3">RSI(14일)</th>
                <th class="px-3 py-3">공매도 분석</th>
                <th class="px-3 py-3 text-center">이전 퀀트 스코어</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr 
                v-for="item in screenerStore.oldData" 
                :key="item.shcode"
                class="hover:bg-slate-900/60 transition-all"
              >
                <td class="px-3 py-3"><span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold text-[10px]">{{ item.industry }}</span></td>
                <td class="px-3 py-3 font-mono text-slate-400">{{ item.shcode }}</td>
                <td class="px-3 py-3 font-bold text-white">
                  <NuxtLink 
                    :to="'/stock/' + item.shcode" 
                    class="text-indigo-300 hover:text-white hover:underline flex items-center gap-1 group transition-colors"
                    :title="item.name + ' 상세 정밀 분석 보기'"
                  >
                    <span>{{ item.name }}</span>
                    <i class="fas fa-external-link-alt text-[9px] text-indigo-400 opacity-60 group-hover:opacity-100"></i>
                  </NuxtLink>
                </td>
                <td class="px-3 py-3 font-extrabold text-slate-200">{{ Number(item.closePrice).toLocaleString() }}원</td>
                <td class="px-3 py-3">{{ item.psy }}%</td>
                <td class="px-3 py-3 font-mono text-slate-400">{{ Number(item.bbLower).toLocaleString() }}원</td>
                <td class="px-3 py-3 text-emerald-400 font-semibold">정배열 지지</td>
                <td class="px-3 py-3 font-bold" :class="typeof item.volumeRatio === 'number' && item.volumeRatio >= 120 ? 'text-amber-400 font-extrabold' : 'text-slate-300'">
                  {{ typeof item.volumeRatio === 'number' ? item.volumeRatio + '%' : 'N/A' }}
                </td>
                <td class="px-3 py-3">+{{ item.macdHist }}</td>
                <td class="px-3 py-3">{{ item.rsi }}</td>
                <td class="px-3 py-3 font-bold" :title="item.shortSellingSummary || ''">
                  <span 
                    class="px-2 py-0.5 rounded text-[10px] font-semibold"
                    :class="{
                      'bg-red-500/20 text-red-400 border border-red-500/40': item.shortSellingStatus === '숏커버링(환매수) 유력',
                      'bg-blue-500/20 text-blue-400 border border-blue-500/40': item.shortSellingStatus === '신규 공매도 유입',
                      'bg-pink-500/20 text-pink-400 border border-pink-500/40': item.shortSellingStatus === '매수세가 공매도 흡수 중',
                      'bg-slate-900 text-white border border-slate-400/50': !['숏커버링(환매수) 유력', '신규 공매도 유입', '매수세가 공매도 흡수 중'].includes(item.shortSellingStatus || '')
                    }"
                  >
                    {{ item.shortSellingStatus || '판단 보류' }}
                  </span>
                </td>
                <td class="px-3 py-3 text-center">
                  <span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold">
                    {{ item.score }}점 / 100점
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

     
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useScreenerStore, type StockItem } from '~/stores/useScreenerStore';

const screenerStore = useScreenerStore();

onMounted(async () => {
  await screenerStore.loadInitial(false);
});

function getPriceDelta(newItem: StockItem) {
  const oldItem = screenerStore.oldData.find(o => o.shcode === newItem.shcode);
  if (!oldItem) return null;

  const diff = newItem.closePrice - oldItem.closePrice;
  if (diff > 0) {
    return { text: `▲ +${diff.toLocaleString()}원`, class: 'text-rose-400' };
  } else if (diff < 0) {
    return { text: `▼ ${diff.toLocaleString()}원`, class: 'text-cyan-400' };
  } else {
    return { text: `(= 변동없음)`, class: 'text-slate-400' };
  }
}
</script>
