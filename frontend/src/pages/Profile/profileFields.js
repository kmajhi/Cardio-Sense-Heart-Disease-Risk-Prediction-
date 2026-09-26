// The profile: basic health information the user keeps about themselves.
// Keys that also exist in the /api/predict/ payload use the same names
// (sex, height_cm, weight_kg, hypertension, ...), so a prediction can be
// prefilled from a profile without any mapping.

export const EMPTY_PROFILE = {
  full_name: '',
  photo: '', // small square JPEG data URL (see photo.js), or ''
  email: '',
  phone: '',
  date_of_birth: '',
  sex: '', // 'M' | 'F'
  height_cm: '',
  weight_kg: '',
  blood_group: '',
  hypertension: null, // 0 | 1 | null (not answered)
  diabetes: null,
  family_history: null,
  chest_pain_history: null,
  smoker: '', // never | former | current
  activity: '', // low | moderate | high
  medications: [],
  allergies: [],
  emergency_name: '',
  emergency_phone: '',
  connections: {}, // { gmail: { handle, connected_at }, ... }
};

export const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

export const HISTORY = [
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'family_history', label: 'Family history of heart disease' },
  { key: 'chest_pain_history', label: 'History of chest pain' },
];

export const SMOKER = [
  ['never', 'Never'],
  ['former', 'Former'],
  ['current', 'Current'],
];

export const ACTIVITY = [
  ['low', 'Low'],
  ['moderate', 'Moderate'],
  ['high', 'High'],
];

export const SEX = [
  ['M', 'Male'],
  ['F', 'Female'],
];

const label = (options, value) => options.find(([v]) => v === value)?.[1] ?? '';
export const smokerLabel = (v) => label(SMOKER, v);
export const activityLabel = (v) => label(ACTIVITY, v);
export const sexLabel = (v) => label(SEX, v);

/** Whole years since `dob` (YYYY-MM-DD), or null. */
export function ageFrom(dob, today = new Date()) {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  let age = today.getFullYear() - d.getFullYear();
  const beforeBirthday =
    today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function bmiFrom(heightCm, weightKg) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!(h > 0) || !(w > 0)) return null;
  return w / (h / 100) ** 2;
}

// WHO adult bands.
export function bmiBand(bmi) {
  if (bmi === null) return null;
  if (bmi < 18.5) return { label: 'Underweight', tone: 'low' };
  if (bmi < 25) return { label: 'Healthy range', tone: 'ok' };
  if (bmi < 30) return { label: 'Overweight', tone: 'low' };
  return { label: 'Obese range', tone: 'high' };
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

// What counts towards "profile complete".
const COMPLETENESS = [
  'full_name', 'email', 'phone', 'date_of_birth', 'sex', 'height_cm', 'weight_kg', 'blood_group',
  'hypertension', 'diabetes', 'family_history', 'chest_pain_history', 'smoker', 'activity',
  'emergency_name', 'emergency_phone',
];

export function completeness(p) {
  const filled = COMPLETENESS.filter((k) => p[k] !== '' && p[k] !== null && p[k] !== undefined).length;
  return filled / COMPLETENESS.length;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s().-]{7,20}$/;

/** Field → message for everything that's wrong; empty object when valid. */
export function validate(p, today = new Date()) {
  const errors = {};
  if (!p.full_name.trim()) errors.full_name = 'Enter your name.';
  else if (p.full_name.trim().length > 80) errors.full_name = 'Keep it under 80 characters.';
  if (p.email && !EMAIL.test(p.email.trim())) errors.email = 'Enter an email like name@example.com.';
  if (p.phone && !PHONE.test(p.phone.trim())) errors.phone = 'Use digits, spaces and an optional leading +.';
  if (p.emergency_phone && !PHONE.test(p.emergency_phone.trim())) {
    errors.emergency_phone = 'Use digits, spaces and an optional leading +.';
  }
  if (p.date_of_birth) {
    const age = ageFrom(p.date_of_birth, today);
    if (age === null || new Date(`${p.date_of_birth}T00:00:00`) > today) errors.date_of_birth = 'Pick a date in the past.';
    else if (age > 120) errors.date_of_birth = 'Check the year.';
  }
  if (p.height_cm !== '' && !(Number(p.height_cm) >= 50 && Number(p.height_cm) <= 250)) {
    errors.height_cm = 'Between 50 and 250 cm.';
  }
  if (p.weight_kg !== '' && !(Number(p.weight_kg) >= 2 && Number(p.weight_kg) <= 400)) {
    errors.weight_kg = 'Between 2 and 400 kg.';
  }
  return errors;
}

/** Trimmed copy with numbers as numbers, ready to save. */
export function clean(p) {
  const num = (v) => (v === '' || v === null ? '' : Number(v));
  return {
    ...p,
    full_name: p.full_name.trim(),
    email: p.email.trim(),
    phone: p.phone.trim(),
    emergency_name: p.emergency_name.trim(),
    emergency_phone: p.emergency_phone.trim(),
    height_cm: num(p.height_cm),
    weight_kg: num(p.weight_kg),
  };
}
