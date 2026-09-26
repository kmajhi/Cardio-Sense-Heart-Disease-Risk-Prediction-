import { request } from './client';
import { mockPredict } from '../pages/Prediction/predictionMock';

// Mock by default. Set VITE_USE_MOCK_API=false in .env.local to call Django's
// POST /api/predict/, which also saves the assessment for the History page.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

/** POST /api/predict/ → { probability, risk_level, top_factors: [{ name, contribution }] } */
export function predict(payload) {
  return USE_MOCK ? mockPredict(payload) : request('/predict/', { method: 'POST', body: payload });
}
