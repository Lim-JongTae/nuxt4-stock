import { defineEventHandler, readBody, createError } from 'h3';
import { loadEnv } from '../../utils/lsApi';

export interface AnthropicApiRequest {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AnthropicApiResponse {
  success: boolean;
  content: string;
  model: string;
  usage?: any;
}

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
  const rawBaseUrl = env.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const defaultModel = env.ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

  if (!apiKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Anthropic Claude API Key (ANTHROPIC_API_KEY)가 .env 파일에 설정되어 있지 않습니다.'
    });
  }

  // ANTHROPIC_BASE_URL 파싱 및 URL endpoint 조립
  let targetUrl = rawBaseUrl.trim();
  if (!targetUrl.endsWith('/v1/messages')) {
    targetUrl = `${targetUrl.replace(/\/+$/, '')}/v1/messages`;
  }

  const model = body.model || defaultModel;
  const temperature = body.temperature ?? 0.2;
  const maxTokens = body.maxTokens || 1000;

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

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'authorization': `Bearer ${apiKey}`, // 일부 커스텀 프록시 지원
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error(`[401 인증 오류 - ${targetUrl}] ANTHROPIC_API_KEY가 유효하지 않거나 백엔드 프록시 인증에 실패했습니다.`);
      }
      throw new Error(`Anthropic Base API (${targetUrl}) HTTP ${response.status}: ${errorText.slice(0, 300)}`);
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
    console.error(`Anthropic API Gateway error [${targetUrl}]:`, err);
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: `Anthropic Base API (${targetUrl}) 호출 실패: ${err.message}`
    });
  }
});
