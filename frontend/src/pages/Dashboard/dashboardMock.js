// Sample data for the Dashboard. Replace with a fetch from the Django REST API.
// Keep the same shape and every component will keep working.

const at = (daysFromToday, hours, minutes = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

// A slot later today (next half hour, 2 h from now) so the "Today" filter has something to show.
const laterToday = () => {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d.toISOString();
};

export const dashboardMock = {
  user: { name: 'Demo User' },
  hasNotifications: true,

  // Small indicator pill above the panel. Bars are 0–1.
  recovery: {
    label: 'Cardiac indicators',
    value: 'Recovery',
    bars: [0.45, 0.65, 0.55, 0.85, 0.75, 1],
  },

  // Output of the prediction endpoint.
  // probability: model output 0–1, level: 'low' | 'moderate' | 'high',
  // factors: top contributors (e.g. from the SHAP explanation).
  risk: {
    probability: 0.18,
    level: 'low',
    confidence: 0.94,
    updatedLabel: '2 min ago',
    factors: ['Cholesterol', 'Blood pressure'],
  },

  appointments: [
    { id: 1, specialty: 'Cardiologist', doctor: 'Dr. A. Karim', start: laterToday(), minutes: 30 },
    { id: 2, specialty: 'Lipid panel', doctor: 'City Diagnostics', start: at(1, 9, 0), minutes: 15 },
    { id: 3, specialty: 'ECG follow-up', doctor: 'Dr. S. Hossain', start: at(5, 16, 0), minutes: 20 },
    { id: 4, specialty: 'Nutritionist', doctor: 'Dr. R. Akter', start: at(18, 11, 0), minutes: 45 },
  ],

  // Resting heart rate, one point per hour for the last 24 hours.
  heartRate: {
    points: [
      68, 66, 64, 63, 62, 63, 66, 71, 76, 74, 72, 70,
      71, 73, 75, 72, 69, 68, 70, 74, 78, 75, 73, 72,
    ].map((bpm, i) => ({ time: `${String(i).padStart(2, '0')}:00`, bpm })),
  },

  alert: {
    title: 'Cholesterol is above the normal range',
    href: '/history',
  },
};
