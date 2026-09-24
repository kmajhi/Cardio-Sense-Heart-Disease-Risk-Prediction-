import { request } from './client';
import { mockPredict } from '../pages/Prediction/predictionMock';

// Mocked until the Django endpoint is wired up. Set VITE_USE_MOCK_API=false
// in .env.local to call the real POST /api/predict/.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

/** POST /api/predict/ → { probability, risk_level, top_factors: [{ name, contribution }] } */
export function predict(payload) {
  return USE_MOCK ? mockPredict(payload) : request('/predict/', { method: 'POST', body: payload });
}
