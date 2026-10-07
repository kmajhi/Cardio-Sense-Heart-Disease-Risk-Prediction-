/** The Doctor's Prescription: limits, suggestions and row helpers (Prescription.jsx draws it). */

// Must match MEDICATION_LIMITS and MAX_MEDICATIONS (backend/predictor/doctor_api.py).
export const MED_LIMITS = { name: 120, strength: 60, frequency: 60, timing: 60, duration: 60, instructions: 200 };
export const MAX_MEDICATIONS = 12;
export const REMARKS_LIMIT = 5000;

// Suggestions only: the doctor can type anything. Common cardiovascular medicines first.
export const MEDICINES = [
  'Aspirin', 'Clopidogrel', 'Atorvastatin', 'Rosuvastatin', 'Amlodipine', 'Losartan', 'Telmisartan', 'Ramipril',
  'Enalapril', 'Bisoprolol', 'Metoprolol succinate', 'Carvedilol', 'Hydrochlorothiazide', 'Indapamide', 'Furosemide',
  'Spironolactone', 'Isosorbide mononitrate', 'Glyceryl trinitrate (sublingual)', 'Metformin', 'Omeprazole',
];
export const FREQUENCIES = [
  'Once daily, morning (1-0-0)', 'Once daily, night (0-0-1)', 'Twice daily (1-0-1)', 'Three times daily (1-1-1)',
  'Every 8 hours', 'As needed (SOS)', 'Once weekly',
];
export const TIMINGS = ['Before meals', 'After meals', 'With meals', 'On an empty stomach', 'At bedtime', 'Any time'];
export const DURATIONS = ['5 days', '7 days', '14 days', '1 month', '3 months', '6 months', 'Until the next review', 'Long term'];

let nextKey = 0;
/** A blank medicine row; `key` is for React only and never sent to the server. */
export const blankMedicine = () => ({ key: `m${(nextKey += 1)}`, name: '', strength: '', frequency: '', timing: '', duration: '', instructions: '' });
export const withKeys = (meds) => (meds || []).map((m) => ({ ...blankMedicine(), ...m }));
export const withoutKeys = (meds) => meds.map(({ key, ...m }) => m);
