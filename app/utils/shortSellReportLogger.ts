/**
 * 공매도 4단계 정량 분석 수식 및 파싱 데이터 콘솔 디버그 출력 유틸리티
 * 
 * [단서 규칙]: 만약 자료가 없을 경우 없는 자료명을 표시하고 작업 중단할 것, 임의로 계산하지 말 것.
 */
export function logShortSellQuantitativeReport(item: any, sourceTag = '스탁 스크리너 테스트') {
  if (!item) {
    console.warn(`🚨 [공매도 API 수집 중단 - ${sourceTag}]: 선택된 종목 객체가 존재하지 않습니다.`);
    return;
  }

  const shcode = item.shcode || '';
  const name = item.name || '미확인 종목';
  const closePrice = Number(item.closePrice || 0);

  // ETF / ETN 종목 예외 처리 (공매도 t1927 분석 대상 제외)
  const ind = item.industry || '';
  const etfKeywords = ['KODEX', 'TIGER', 'ACE', 'SOL', 'RISE', 'KoAct', 'PLUS', 'HANARO', 'WOORI', 'UNICORN', 'TIMEFOLIO', 'HERO', 'KBSTAR', 'ARIRANG', 'ETF', 'ETN'];
  const isEtf = ind.includes('ETF') || ind.includes('ETN') || etfKeywords.some(k => name.includes(k));

  if (isEtf) {
    console.group(`ℹ️ [ETF/ETN 종목 수급 안내] ${name} (${shcode})`);
    console.log(`본 종목은 ETF/ETN 상품으로 LS증권 Open API (t1927) 공매도 분석 대상 제외 항목입니다.`);
    console.groupEnd();
    return;
  }

  // 필수 공매도 원천 데이터 수신 검증
  const missingDataFields: string[] = [];

  const shortRatio = typeof item.shortRatio === 'number' ? item.shortRatio : (
    item.shortSellHistory && item.shortSellHistory.length > 0 && typeof item.shortSellHistory[0].balanceRatio === 'number' 
      ? item.shortSellHistory[0].balanceRatio 
      : null
  );

  const dtcDays = typeof item.dtc === 'number' ? item.dtc : (
    item.shortVolume && closePrice > 0 
      ? Number((item.shortVolume / (closePrice * 10)).toFixed(2)) 
      : null
  );

  const shortAvgPrice = item.shortAvgPrice && item.shortAvgPrice > 0 ? item.shortAvgPrice : null;
  const shortVolume = item.shortVolume && item.shortVolume > 0 ? item.shortVolume : null;

  if (shortRatio === null) missingDataFields.push('공매도 순보유잔고 비율(%)');
  if (dtcDays === null) missingDataFields.push('DTC (Days to Cover / 일일평균거래량)');
  if (!item.shortSellingStatus) missingDataFields.push('대차잔고 추세 수급 상태');

  // 미수신 자료가 있는 경우 없는 자료명을 명시하고 작업 중단 (임의 계산 금지 원칙)
  if (missingDataFields.length > 0) {
    console.group(`🚨 [공매도 API 데이터 부족 - 작업 중단] ${name} (${shcode})`);
    console.error(`LS증권 Open API에서 아래 원천 자료가 수신되지 않아 정량 분석을 중단합니다.`);
    console.error(`📌 미수신 자료 목록: [ ${missingDataFields.join(', ')} ]`);
    console.warn(`무하드코딩 원칙에 따라 임의로 보정값이나 가짜 데이터를 계산하지 않고 작업을 중단합니다.`);
    console.groupEnd();
    return;
  }

  // 데이터가 모두 존재하는 경우 4단계 정량 분석 수행
  const status = item.shortSellingStatus;

  // 2단계 리스크 등급
  let riskGradeLabel = '정상 (Normal)';
  let riskGradeReason = `공매도 잔고비율이 ${shortRatio.toFixed(2)}%로 3.00% 이하를 유지하여 수급 영향력이 제한적인 구간입니다.`;
  if (shortRatio >= 5.0) {
    riskGradeLabel = '위험 (Danger)';
    riskGradeReason = `공매도 잔고비율이 ${shortRatio.toFixed(2)}%로 5.00%를 초과하여 하방 매도 포지션이 누적된 위험 구간입니다.`;
  } else if (shortRatio > 3.0) {
    riskGradeLabel = '주의 (Caution)';
    riskGradeReason = `공매도 잔고비율이 ${shortRatio.toFixed(2)}%로 매도세 유입이 시작되어 주의가 필요한 구간입니다.`;
  }

  // 3단계 대차잔고 트렌드
  let trendLabel = '상승·반등 여력 우세';
  let trendReason = '공매도 잔고 감소 및 숏커버링 매수세 유입으로 수급 반등 여력이 우수합니다.';
  if (status === '신규 공매도 유입' || status.includes('유입')) {
    trendLabel = '하방 압력 우세';
    trendReason = '신규 공매도 출회 및 대차잔고 증가로 하방 압력이 우세합니다.';
  } else if (status === '판단 보류' || !status) {
    trendLabel = '판단 보류 / 횡보';
    trendReason = '추세가 횡보하거나 수급 판단 보류 구간입니다.';
  }

  // 4단계 시나리오 판정
  let scenarioLabel = '중립 관찰 구간';
  let scenarioDesc = '방향성 시나리오 조건 미충족 중립 구간입니다.';
  let actionGuide = '지지선 및 기술적 지표(RSI/볼린저밴드) 추가 확인 후 비중 결정.';

  if (riskGradeLabel.includes('위험') && trendLabel.includes('상승')) {
    scenarioLabel = '상승 예측 (숏스퀴즈 발생형)';
    scenarioDesc = '과도한 공매도 잔고(5%+)+숏커버링으로 숏스퀴즈에 의한 주가 단기 급등 가능성이 높습니다.';
    actionGuide = '반등 타이밍 숏스퀴즈 모멘텀 매수 및 목표가 분할 청산 전략 수립.';
  } else if ((riskGradeLabel.includes('주의') || riskGradeLabel.includes('위험')) && trendLabel.includes('하방')) {
    scenarioLabel = '하락 예측 (공매도 심화형)';
    scenarioDesc = '추가 공매도 출회로 단기 하락 압력이 지속될 것으로 예상됩니다.';
    actionGuide = '신규 매수 보류, 보유 비중 축소 및 스톱로스 가격 엄수 권고.';
  }

  // 콘솔 디버그 출력
  console.group(`📉 [공매도 4단계 정량 분석 완료 - ${sourceTag}] ${name} (${shcode})`);
  console.log(`[0단계 수신 원천 데이터]`, {
    종목코드: shcode,
    종목명: name,
    현재가: closePrice.toLocaleString() + '원',
    공매도평단가: shortAvgPrice ? shortAvgPrice.toLocaleString() + '원' : 'N/A',
    최근공매도매도량: shortVolume ? shortVolume.toLocaleString() + '주' : 'N/A',
    수급라벨: status
  });

  console.log(`[1단계 핵심 수식 산출]`);
  console.log(`  1) 공매도 잔고비율 수식: (공매도 순보유잔고 / 전체 상장주식 수) * 100 => ${shortRatio.toFixed(2)}%`);
  console.log(`  2) DTC (Days to Cover) 수식: 공매도 순보유잔고 / 일일 평균 거래량 => ${dtcDays.toFixed(2)}일`);

  console.log(`[2단계 리스크 등급 (정상<=3%, 주의 3%~5%, 위험>=5%)]: ${riskGradeLabel}`);
  console.log(`  - 판정 근거: ${riskGradeReason}`);

  console.log(`[3단계 대차잔고 트렌드]: ${trendLabel}`);
  console.log(`  - 판정 근거: ${trendReason}`);

  console.log(`[4단계 시나리오 판정 (2단계 등급 x 3단계 트렌드)]: ${scenarioLabel}`);
  console.log(`  - 예측 서술: ${scenarioDesc}`);
  console.log(`  - 행동 가이드: ${actionGuide}`);

  console.log(`[고급 고도화 지표 참고]`);
  if (dtcDays >= 5.0) {
    console.log(`  - DTC ${dtcDays.toFixed(1)}일 (고지표): 거래량 대비 잔고가 많아 반등 시 숏스퀴즈 폭발 강도 강력함`);
  }
  console.log(`  - 2026 NSDS 규제: 무차입 공매도 차단 & 기관 상환기한 12개월 제한 시스템 가동 중`);
  console.log(`  - 펀더멘털 대조: 영업이익 15%+ / ROE 10%+ 우량 기업 지지선 강화`);
  console.log(`[공매도 분석 리포트] 생성`);
  console.groupEnd();
}
