import { defineEventHandler, readBody, createError } from 'h3';
import { loadEnv } from '../../utils/lsApi';

import type { AnthropicApiRequest, AnthropicApiResponse } from '../../../utils/types/claudeApi';
export type { AnthropicApiRequest, AnthropicApiResponse };

export default defineEventHandler(async (event): Promise<AnthropicApiResponse> => {
  const body: AnthropicApiRequest = await readBody(event);

  if (!body || !body.prompt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Claude API에 전달할 프롬프트(prompt) 내용이 필요합니다.'
    });
  }

  const env = loadEnv();
  const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  const rawBaseUrl = env.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL || 'https://aiapiflow.com';
  const defaultModel = (env.ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5').trim();

  if (!apiKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Anthropic Claude API Key (ANTHROPIC_API_KEY)가 .env 파일에 설정되어 있지 않습니다.'
    });
  }

  let model = (body.model || defaultModel).trim();
  const temperature = body.temperature ?? 0.2;
  const maxTokens = body.maxTokens || 1000;

  // API 게이트웨이 유효 모델 방어 로직
  const validModels = [
    'claude-haiku-4-5', 'claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5',
    'claude-opus-4-8', 'claude-opus-4-8-thinking', 'claude-fable-5'
  ];

  if (!model || !validModels.includes(model)) {
    model = 'claude-sonnet-5';
  }

  const payload: any = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: 'user', content: body.prompt }
    ]
  };

  if (body.system) {
    payload.system = body.system;
  }

  // 게이트웨이 도메인 후보군 (기존 URL -> fallback 후보순)
  const cleanRawUrl = rawBaseUrl.trim().replace(/\/+$/, '');
  const candidateBaseUrls = [
    cleanRawUrl,
    'https://aiapiflow.com',
    'https://api.oneprovider.dev'
  ];

  // 중복 제거
  const uniqueBaseUrls = Array.from(new Set(candidateBaseUrls.filter(Boolean)));

  let lastError: any = null;

  for (const baseUrl of uniqueBaseUrls) {
    const targetUrl = `${baseUrl}/v1/messages`;
    try {
      console.log(`[Claude API 요청 시도] Target: ${targetUrl}, Model: ${model}`);
      const startTime = Date.now();

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'authorization': `Bearer ${apiKey}`,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000) // LLM 딥리프닝 생성 시간 감안 90초 타임아웃 설정
      });

      console.log(`[Claude API 응답 완료] Target: ${targetUrl}, Status: ${response.status} (${Date.now() - startTime}ms)`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        if (response.status === 401) {
          throw new Error(`[401 인증 오류 - ${targetUrl}] ANTHROPIC_API_KEY가 유효하지 않거나 프록시 인증에 실패했습니다.`);
        }
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 300)}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || data.text || (typeof data === 'string' ? data : '');

      return {
        success: true,
        content,
        model: data.model || model,
        usage: data.usage
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`[Claude API 시도 실패 - ${targetUrl}]: ${err.message || String(err)}`);
    }
  }

  console.error(`[Claude API 최종 실패]:`, lastError);
  throw createError({
    statusCode: 500,
    statusMessage: `Anthropic Base API 호출 실패 (타임아웃 또는 도메인 응답 불가): ${lastError?.message || 'Timeout'}`
  });
});
