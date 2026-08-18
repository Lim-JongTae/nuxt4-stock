import { db } from '../../db';
import { holdings } from '../../db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { loadEnv, getLSToken } from '../../utils/ls/lsAuth';
import { fetchLSPrice, fetchLST1305Prices } from '../../utils/ls/lsQuotes';

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

export default defineEventHandler(async () => {
  const env = loadEnv();
  const tokenRes = await getLSToken(env.LS_APP_KEY || '', env.LS_SECRET || '');
  const token = tokenRes.token;

  // 1. Initial Sync from report JSON if DB empty
  try {
    const existingHoldings = await db.select().from(holdings).all();
    if (!existingHoldings || existingHoldings.length === 0) {
      const reportDir = path.resolve(process.cwd(), 'report');
      if (fs.existsSync(reportDir)) {
        const files = fs.readdirSync(reportDir)
          .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
          .sort()
          .reverse();

        if (files.length > 0 && files[0]) {
          const latestFile = path.join(reportDir, files[0]);
          const content = fs.readFileSync(latestFile, 'utf-8');
          const json = JSON.parse(content);

          if (json && Array.isArray(json.holdings) && json.holdings.length > 0) {
            const localTime = new Date().toLocaleString('ko-KR');

            for (const item of json.holdings) {
              const shcode = (item.shcode || item.code || '').replace(/^A/i, '').trim();
              if (!shcode) continue;

              const name = item.name || shcode;
              const industry = item.industry || '보유종목';
              const avgPrice = parseNumber(item.avg_price || item.avgPrice);
              const currentPrice = parseNumber(item.current_price || item.currentPrice || avgPrice);
              const quantity = parseNumber(item.quantity);

              db.insert(holdings).values({
                shcode,
                name,
                industry,
                quantity,
                avgPrice,
                currentPrice,
                targetPrice: parseNumber(item.targetPrice || item.target_price) || 0,
                stopLossPrice: parseNumber(item.stopLossPrice || item.stop_loss_price) || 0,
                updatedAt: localTime
              }).run();
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('⚠️ [보유종목 DB 동기화 실패]:', err.message || String(err));
  }

  // 2. Real-time Price Update & Candle Data via LS Securities Open API (Promise.allSettled 병렬 처리)
  const items = await db.select().from(holdings).all();
  const localTime = new Date().toLocaleString('ko-KR');

  // 병렬로 시세 + 캔들 데이터 수집
  const candleDataMap = new Map<string, any[]>();
  const indicatorsMap = new Map<string, any>();

  if (token && items.length > 0) {
    await Promise.allSettled(
      items.map(async (item) => {
        try {
          // 실시간 시세 조회
          const t1102Price = await fetchLSPrice(token, item.shcode);
          const livePrice = t1102Price || null;

          if (livePrice && livePrice > 0) {
            item.currentPrice = livePrice;
            item.updatedAt = localTime;

            try {
              await db.update(holdings)
                .set({ currentPrice: livePrice, updatedAt: localTime })
                .where(eq(holdings.shcode, item.shcode))
                .run();
            } catch {}
          }

          // LS증권 t1305 캔들 데이터 조회 (40일치)
          const candleMap = await fetchLST1305Prices(token, item.shcode);
          if (candleMap && candleMap.size > 0) {
            const candleArray = Array.from(candleMap.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([date, c]) => ({
                date,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
              }));
            candleDataMap.set(item.shcode, candleArray);

            // 기술적 지표 계산
            const { calculateTechnicalIndicators } = await import('../../utils/ls/lsIndicators');
            const indicators = calculateTechnicalIndicators(candleMap);
            indicatorsMap.set(item.shcode, indicators);
          }
        } catch (e: any) {
          console.warn(`⚠️ [LS증권 보유종목 데이터 수신 실패 - ${item.shcode}]:`, e.message || String(e));
        }
      })
    );
  }

  // 3. Calculate Dynamic Target/StopLoss Prices from Real Technical Indicators
  const resultWithCandles = items.map(item => {
    const candles = candleDataMap.get(item.shcode) || [];
    const indicators = indicatorsMap.get(item.shcode);
    const curPrice = item.currentPrice || item.avgPrice || 0;

    // 볼린저 밴드 기반 목표가/손절가 계산 (실제 LS증권 데이터 기반)
    let dynamicTargetPrice = item.targetPrice ?? 0;
    let dynamicStopLossPrice = item.stopLossPrice ?? 0;

    if (indicators) {
      // bbUpper 계산 (ma20 + 2 * stdDev)
      const bbUpper = indicators.ma20 && indicators.bbLower
        ? Math.round(indicators.ma20 + (indicators.ma20 - indicators.bbLower))
        : null;

      // DB에 저장된 값이 없으면 실제 지표값 사용
      if (dynamicTargetPrice === 0 && bbUpper && bbUpper > 0) {
        dynamicTargetPrice = bbUpper;
      } else if (dynamicTargetPrice === 0) {
        dynamicTargetPrice = Math.round(curPrice * 1.1); // 최후 폴백
      }

      if (dynamicStopLossPrice === 0 && indicators.bbLower && indicators.bbLower > 0) {
        dynamicStopLossPrice = indicators.bbLower;
      } else if (dynamicStopLossPrice === 0) {
        dynamicStopLossPrice = Math.round(item.avgPrice * 0.95); // 최후 폴백
      }
    } else {
      // 지표 계산 실패 시 최후 폴백
      if (dynamicTargetPrice === 0) dynamicTargetPrice = Math.round(curPrice * 1.1);
      if (dynamicStopLossPrice === 0) dynamicStopLossPrice = Math.round(item.avgPrice * 0.95);
    }

    const dynamicTrailingRate = 2.5;

    return {
      ...item,
      targetPrice: dynamicTargetPrice,
      stopLossPrice: dynamicStopLossPrice,
      trailingRate: dynamicTrailingRate,
      candles
    };
  });

  return resultWithCandles;
});
