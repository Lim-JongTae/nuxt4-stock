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
  const model = env.ANTHROPIC_MODEL || body.model || 'claude-sonnet-4-6';
  const prompt: string = body.prompt || '안녕하세요';

    if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'ANTHROPIC_API_KEY가 .env 파일에 없습니다.'
    });
  }

  let lastErrorMsg = '';

  // Attempt 1: Oneprovider /v1/messages (90s timeout to cover proxy 57s generation time)
  try {
    const endpoint1 = `${baseUrl}/v1/messages`;
    console.log(`[Attempt 1] Fetching ${endpoint1}...`);
    const startTime1 = Date.now();

    const res1 = await fetch(endpoint1, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: body.max_tokens || 550,
        system:
          '당신은 주식 퀀트 전문 AI 분석가입니다. 장황한 인사말이나 보고서 생성 시각 문구를 절대 작성하지 마시고, 핵심 퀀트 분석 마크다운 보고서만 작성하세요. 목표가와 손절가는 동적으로 제시하세요.',
        messages: body.messages || [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(90000) as any
    });

    console.log(`[Attempt 1 Done] Status: ${res1.status} (${Date.now() - startTime1}ms)`);
    if (res1.ok) {
      const data1 = await res1.json();
      if (data1?.content && Array.isArray(data1.content)) {
        return data1;
      }
    } else {
      const text1 = await res1.text().catch(() => '');
      lastErrorMsg = `[Attempt 1 HTTP ${res1.status}]: ${text1.slice(0, 200)}`;
    }
  } catch (err1: any) {
    lastErrorMsg = `[Attempt 1 Exception]: ${err1.message || String(err1)}`;
    console.warn(lastErrorMsg);
  }

  // Attempt 2: Oneprovider /v1/chat/completions (90s timeout)
  try {
    const endpoint2 = `${baseUrl}/v1/chat/completions`;
    console.log(`[Attempt 2] Fetching ${endpoint2}...`);
    const startTime2 = Date.now();

    const res2 = await fetch(endpoint2, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: body.max_tokens || 550,
        messages: [
          {
            role: 'system',
            content:
              '당신은 주식 퀀트 전문 AI 분석가입니다. 장황한 인사말이나 보고서 생성 시각 문구를 절대 작성하지 마시고, 핵심 퀀트 분석 마크다운 보고서만 작성하세요. 목표가와 손절가는 동적으로 제시하세요.'
          },
          { role: 'user', content: prompt }
        ]
      }),
      signal: AbortSignal.timeout(90000) as any
    });

    console.log(`[Attempt 2 Done] Status: ${res2.status} (${Date.now() - startTime2}ms)`);
    if (res2.ok) {
      const data2 = await res2.json();
      const text2 = data2?.choices?.[0]?.message?.content;
      if (text2) {
        return { content: [{ type: 'text', text: text2 }] };
      }
    } else {
      const text2 = await res2.text().catch(() => '');
      lastErrorMsg += ` | [Attempt 2 HTTP ${res2.status}]: ${text2.slice(0, 200)}`;
    }
  } catch (err2: any) {
    lastErrorMsg += ` | [Attempt 2 Exception]: ${err2.message || String(err2)}`;
    console.warn(lastErrorMsg);
  }

  console.error('[AI API FINAL FAIL]:', lastErrorMsg);

  throw createError({
    statusCode: 502,
    statusMessage: `Claude API 연동 실패 (상세 사유: ${lastErrorMsg})`
  });
});