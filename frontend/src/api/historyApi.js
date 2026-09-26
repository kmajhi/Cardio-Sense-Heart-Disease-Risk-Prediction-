import { request } from './client';
import { historyMock } from '../pages/History/historyMock';

// Same switch as predictionApi.js: set VITE_USE_MOCK_API=false in .env.local
// to read GET /api/history/ (every saved POST /api/predict/ call).
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

/** [{ id, created_at, inputs, result }], oldest first. */
export function getHistory() {
  return USE_MOCK ? Promise.resolve(historyMock) : request('/history/');
}
