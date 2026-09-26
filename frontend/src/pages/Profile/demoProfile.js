// A made-up demo profile, so the site isn't empty before accounts exist.
// Same person as the backend's seed (backend/predictor/migrations/0002_demo_profile.py);
// keep the two in step.
import { EMPTY_PROFILE } from './profileFields';
import avatarUrl from './assets/demo-avatar.jpg';

export const DEMO_PROFILE = {
  ...EMPTY_PROFILE,
  full_name: 'Nadia Rahman',
  email: 'nadia.rahman@example.com',
  phone: '+880 1700 000000',
  date_of_birth: '1989-05-14',
  sex: 'F',
  height_cm: 162,
  weight_kg: 61,
  blood_group: 'B+',
  city: 'Dhaka',
  state: 'Dhaka Division',
  country: 'Bangladesh',
  country_code: 'BD',
  timezone: 'Asia/Dhaka',
  latitude: 23.7104,
  longitude: 90.40744,
  hypertension: 0,
  diabetes: 0,
  family_history: 1,
  chest_pain_history: 0,
  smoker: 'never',
  activity: 'moderate',
  medications: ['Vitamin D3 1000 IU daily'],
  allergies: ['Penicillin'],
  emergency_name: 'Karim Rahman',
  emergency_phone: '+880 1800 000000',
};

/** The demo profile with its photo as the data URL profiles store (see photo.js). */
export async function demoProfile() {
  let photo = '';
  try {
    const blob = await (await fetch(avatarUrl)).blob();
    photo = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    /* no photo is fine: the card shows initials */
  }
  const now = new Date().toISOString();
  return { ...DEMO_PROFILE, photo, created_at: now, updated_at: now };
}
