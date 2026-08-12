import { defineEventHandler, readBody } from 'h3';
import { classifyShortSellSignal } from '../../utils/shortSellSignal';

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const shortSellData = body.shortSellData;

  const result = classifyShortSellSignal(shortSellData);
  return result;
});
