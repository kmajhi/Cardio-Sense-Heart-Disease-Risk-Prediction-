import { request } from './client';
import { saveMockRecord } from './historyApi';
import { USE_MOCK } from './mode';

// Mock by default. Set VITE_USE_MOCK_API=false in .env.local to call Django's
// POST /api/predict/, which also saves the assessment to the user's History.
// The mock is only downloaded in mock mode.

/**
 * POST /api/predict/ →
 * { probability, risk_level, top_factors: [{ name, contribution }], missing_fields: [label], low_confidence }
 */
export async function predict(payload) {
  if (!USE_MOCK) return request('/predict/', { method: 'POST', body: payload });
  const { mockPredict } = await import('../pages/Prediction/predictionMock');
  const result = await mockPredict(payload);
  saveMockRecord(payload, result);
  return result;
}
