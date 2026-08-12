import fs from 'fs';
import path from 'path';
import { defineEventHandler } from 'h3';

// Reads watchlist data from JSON file in the project root "data" folder.
export default defineEventHandler(() => {
  const dataPath = path.resolve(process.cwd(), 'data', 'watchlist.json');
  if (!fs.existsSync(dataPath)) {
    return { holdings: [], watchlist: [] };
  }
  const raw = fs.readFileSync(dataPath, 'utf-8');
  try {
    const json = JSON.parse(raw);
    return {
      holdings: json.holdings ?? [],
      watchlist: json.watchlist ?? []
    };
  } catch (e) {
    console.error('Failed to parse watchlist.json', e);
    return { holdings: [], watchlist: [] };
  }
});
