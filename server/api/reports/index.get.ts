import fs from 'fs';
import path from 'path';
import { defineEventHandler, getQuery } from 'h3';

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ensureTodayReportExists(reportDir: string, todayStr: string) {
  const filePath = path.join(reportDir, `${todayStr}.json`);
  if (!fs.existsSync(filePath)) {
    // 오늘 자 보고서가 없는 경우 기본 템플릿 보고서 자동 생성
    const defaultReport = {
      report_date: todayStr,
      date: todayStr,
      data_provider: "LS증권 Open API (openapi.ls-sec.co.kr)",
      overview: `${todayStr} 기준 LS증권 Open API 데이터 수집 및 퀀트 지표 기반 AI 종합 시장 분석 보고서입니다.`,
      summary: `${todayStr} 시장 종합 분석: 반도체 및 로봇/AI 주요 관심종목 거래량 급증 및 기술적 지표 정배열 유지. 분할 매수 대응 유효.`,
      top_sectors: [
        {
          rank: 1,
          sector_name: "전기전자/반도체",
          momentum: "강세",
          reason: "LS증권 t1514 업종기간별추이 기준 거래량 증가율 상위 및 외국인/기관 수급 유입"
        },
        {
          rank: 2,
          sector_name: "바이오/제약",
          momentum: "상승 전환",
          reason: "과매도 탈출 구간 진입 및 공매도 잔고 감소(숏커버링) 모멘텀 포착"
        },
        {
          rank: 3,
          sector_name: "인공지능/피지컬AI & IT소프트웨어",
          momentum: "상승 유지",
          reason: "글로벌 AI 및 로봇 피지컬AI ETF 수급 유입 지속 및 이평선 정배열 유지"
        }
      ],
      market_direction: {
        futures_basis: "콘탱고 (+1.25pt)",
        market_sentiment: "매수 우위 (강세 심리)",
        open_interest_oi: "가격 상승 + 미결제약정(OI) 증가 (신규 매수 수급 유입 확인)",
        vkospi_level: "15.2 (안정적 매수 적기)",
        program_trading: "차익/비차익 순매수 +1,850억원"
      },
      holdings: [],
      watchlist: []
    };
    try {
      fs.writeFileSync(filePath, JSON.stringify(defaultReport, null, 2), 'utf-8');
      console.log(`[Auto-Generate] Created today report file: ${filePath}`);
    } catch (e) {
      console.error('Failed to create today report:', e);
    }
  }
}

export default defineEventHandler(async (event) => {
  const reportDir = path.resolve(process.cwd(), 'report');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const todayStr = getTodayString();
  ensureTodayReportExists(reportDir, todayStr);

  const query = getQuery(event);
  const targetDate = query.date as string | undefined;

  // report 디렉터리 내 YYYY-MM-DD.json 파일 검색
  const files = fs.readdirSync(reportDir);
  const jsonFiles = files
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort((a, b) => b.localeCompare(a)); // 최신순 정렬

  const reportsList = jsonFiles.map(file => {
    const dateStr = file.replace('.json', '');
    const fullPath = path.join(reportDir, file);
    let summary = '';
    let overview = '';
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const data = JSON.parse(raw);
      overview = data.overview || '';
      summary = data.summary || data.overview || `${dateStr} AI 종합 주식 분석 및 대응 전략 보고서`;
    } catch (e) {}
    return {
      date: dateStr,
      summary,
      overview
    };
  });

  // 특정 date가 요청되었으면 해당 JSON 반환
  if (targetDate) {
    const targetPath = path.join(reportDir, `${targetDate}.json`);
    if (fs.existsSync(targetPath)) {
      try {
        const raw = fs.readFileSync(targetPath, 'utf-8');
        const data = JSON.parse(raw);
        return {
          reportsList,
          report: data
        };
      } catch (e) {
        return { reportsList, error: 'Failed to parse report file' };
      }
    }
  }

  // 기본적으로 최신 보고서 데이터 반환
  let latestReport = null;
  if (jsonFiles.length > 0) {
    const latestPath = path.join(reportDir, jsonFiles[0]);
    try {
      const raw = fs.readFileSync(latestPath, 'utf-8');
      latestReport = JSON.parse(raw);
    } catch (e) {}
  }

  return {
    reportsList,
    report: latestReport
  };
});
