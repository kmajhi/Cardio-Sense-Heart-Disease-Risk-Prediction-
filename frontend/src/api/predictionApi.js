import { request } from './client';
import { saveMockRecord } from './historyApi';
import { mockPredict } from '../pages/Prediction/predictionMock';

// Mock by default. Set VITE_USE_MOCK_API=false in .env.local to call Django's
// POST /api/predict/, which also saves the assessment to the user's History.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

/** POST /api/predict/ → { probability, risk_level, top_factors: [{ name, contribution }] } */
export async function predict(payload) {
  if (!USE_MOCK) return request('/predict/', { method: 'POST', body: payload });
  const result = await mockPredict(payload);
  saveMockRecord(payload, result);
  return result;
}
