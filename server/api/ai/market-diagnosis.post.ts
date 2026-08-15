import { defineEventHandler, readBody, createError } from 'h3';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (key) env[key] = val;
        }
      }
    });
  }
  return env;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const env = loadEnv();

  const apiKey = env.ANTHROPIC_API_KEY;
  const baseUrl = (env.ANTHROPIC_BASE_URL || 'https://api.oneprovider.dev').replace(/\/$/, '');
  let model = String(env.ANTHROPIC_MODEL || 'claude-sonnet-5').trim();

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'ANTHROPIC_API_KEY가 .env 파일에 존재하지 않습니다.'
    });
  }

  const marketBasis = body.marketBasis || {};
  const topSectors = body.topSectors || [];
  const matchedCount = body.matchedCount || 0;

  const topSectorsText = Array.isArray(topSectors) && topSectors.length > 0
    ? topSectors.slice(0, 5).map((s: any) => `${s.name}(+${s.rate}%)`).join(', ')
    : '전기전자/AI, 전력인프라, 바이오/제약';

  const systemPrompt = `당신은 대한민국 주식 시장 퀀트 수급 및 시장 방향성 분석 최고 전문가(AI 수석 분석가)입니다.
수신된 LS증권 KOSPI200 선물 베이시스 지표, 당일 상위 상승 유망 업종, 8대 기술지표 포착 종목 정보를 바탕으로 
투자자를 위한 3문장 분량의 '종합 시장 관점 및 리스크 관리 전략'을 전문적이고 명확하게 작성해 주세요.
반드시 한국어로 답변하고, 숫자와 퍼센트 수치, 업종명을 정확하게 언급하세요.`;

  const userPrompt = `[실시간 수급 및 증시 지표 데이터]
1. KOSPI200 선물 베이시스: ${marketBasis.basis >= 0 ? '+' : ''}${marketBasis.basis ?? 0.45}pt (${marketBasis.basisStatus || '콘탱고 (매수 우위)'})
2. 선물/현물 지수: 선물 ${marketBasis.futuresPrice ?? 365.20}pt / 현물 ${marketBasis.kospi200Index ?? 364.75}pt
3. 미결제약정 (OI): ${marketBasis.oi ? Number(marketBasis.oi).toLocaleString() : '315,400'}계약
4. 프로그램 순매수: ${marketBasis.programNetBuy >= 0 ? '+' : ''}${marketBasis.programNetBuy ?? 1245}억원
5. VKOSPI 변동성: ${marketBasis.vkospi ?? 18.2}
6. LS증권 실시간 상위 5대 유망 업종: ${topSectorsText}
7. 8대 기술지표 85점+ 포착 종목 수: ${matchedCount}개 종목

위 데이터를 바탕으로 종합 시장 관점 1문장, 핵심 수급/업종 포인트 1문장, 리스크 관리 및 대응 가이드 1문장으로 총 3문장의 정밀 시장 보고서를 작성해 주세요.`;

  let lastErrorMsg = '';

  // Attempt 1: Messages API
  try {
    const res1 = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
      signal: AbortSignal.timeout(60000) as any
    });

    if (res1.ok) {
      const data1 = await res1.json();
      const text = data1?.content?.[0]?.text;
      if (text) {
        return {
          success: true,
          content: text.trim(),
          createdAt: new Date().toLocaleString('ko-KR')
        };
      }
    } else {
      const text1 = await res1.text().catch(() => '');
      lastErrorMsg = `HTTP ${res1.status}: ${text1.slice(0, 200)}`;
    }
  } catch (err: any) {
    lastErrorMsg = err.message || String(err);
  }

  // Fallback: Chat Completions API
  try {
    const res2 = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: AbortSignal.timeout(60000) as any
    });

    if (res2.ok) {
      const data2 = await res2.json();
      const text2 = data2?.choices?.[0]?.message?.content;
      if (text2) {
        return {
          success: true,
          content: text2.trim(),
          createdAt: new Date().toLocaleString('ko-KR')
        };
      }
    }
  } catch (err: any) {}

  throw createError({
    statusCode: 502,
    statusMessage: `Claude AI 정밀 진단 생성 실패 (${lastErrorMsg})`
  });
});
