// Copy and figures for the About page. Everything here must stay true of the
// app as built: model numbers come from ml/artifacts/model_metadata.json
// (training run of 2026-10-01), features from the pages they describe, dates
// from the git history. Update them here if the model is retrained.

export const DISCLAIMER = 'Research prototype. Not externally validated, not approved for clinical use.';

export const HERO = {
  badge: 'Final-year CSE capstone · Research prototype',
  lines: [
    { text: 'Heart risk,', weight: 'thin' },
    { text: 'estimated early,', weight: 'bold' },
    { text: 'explained clearly.', weight: 'bold' },
  ],
  lead:
    'Cardio Sense turns the routine measurements a clinic already takes (blood pressure, lipids and a basic ' +
    'blood panel) into a calibrated, explained estimate of heart disease risk, checks every value against ' +
    'clinical reference ranges, and keeps the history so change is easy to see.',
};

export const FACTS = [
  { value: 1035, label: 'adult patient records' }, // Home.jsx looks this label up
  { value: 21, label: 'routine measurements' }, // and this one
  { value: 5, label: 'factors explained with every estimate' },
  { value: 3, label: 'risk bands: low, moderate, high' },
  { value: 60, prefix: '<', suffix: ' s', label: 'from values to an explained result' },
];

// The Home page's three-step summary (pages/Home/Home.jsx).
export const STEPS = [
  {
    title: 'Enter routine values',
    text:
      'Age, sex, height and weight; four yes/no history questions; systolic blood pressure and blood sugar; a lipid ' +
      'panel; a basic blood panel; and Troponin-I with its assay type. BMI and max heart rate are calculated for you. ' +
      'Labs you don’t have can be marked “not measured”.',
  },
  {
    title: 'The model estimates',
    text:
      'A calibrated Random Forest trained on hospital records from Northern Bangladesh returns the probability of ' +
      'heart disease, shown as a low, moderate or high band.',
  },
  {
    title: 'See what moved it',
    text:
      'Every estimate lists the five inputs that pushed it up or down most, in percentage points (a SHAP ' +
      'explanation), so the number is never a black box.',
  },
];

// ---------- Mission ----------

export const MISSION = {
  statement: 'Specialist heart tests aren’t everywhere. Routine blood work is.',
  text:
    'Cardiovascular disease is the world’s leading cause of death (WHO). Many clinics can measure blood ' +
    'pressure and run a basic blood panel, but can’t easily reach angiography or a cardiologist. Cardio Sense ' +
    'asks what those routine numbers already say, and shows its reasoning so a health worker can question it.',
  contrasts: [
    { problem: 'A risk score nobody can question', answer: 'Every estimate names the five inputs that moved it, in percentage points.' },
    { problem: 'Labs that weren’t run', answer: 'Mark a test “not measured”: the model fills the gap and says so, and flags the result when too much is missing.' },
    { problem: 'Numbers without context', answer: 'Each value is checked against published clinical ranges, separately from the model, with urgent findings first.' },
  ],
};

export const PRINCIPLES = [
  { icon: 'spark', title: 'Explain, don’t dictate', text: 'An estimate is only useful if you can see why. Explanations are part of every result, not an add-on.' },
  { icon: 'shield', title: 'Honest about limits', text: 'Internal validation only, said plainly. Results are labelled as estimates, never diagnoses.' },
  { icon: 'pin', title: 'Built for where it’s needed', text: 'Designed around the tests a district hospital already runs, and around the gaps in them.' },
  { icon: 'lock', title: 'Private by default', text: 'Your records are visible to your account only, exportable at any time, and deletable for good.' },
];

// ---------- Product tour (how it works) ----------

export const TOUR = [
  {
    key: 'enter',
    title: 'Enter routine values',
    text: 'Age, sex, height and weight, four yes/no history questions, blood pressure, blood sugar, a lipid panel and a basic blood panel. BMI is calculated for you, and any lab you don’t have can be marked “not measured”.',
    time: '~40 s',
  },
  {
    key: 'check',
    title: 'Check against clinical ranges',
    text: 'Every value is compared with published reference ranges (NCEP ATP III, ACC/AHA), separately from the model. Urgent findings are listed first.',
    time: 'instant',
  },
  {
    key: 'estimate',
    title: 'Get a calibrated estimate',
    text: 'A calibrated Random Forest returns the probability of heart disease and its band: low under 35%, moderate 35–65%, high 65% and above. Calibrated means a 30% estimate behaves like 3 in 10.',
    time: '< 1 s',
  },
  {
    key: 'explain',
    title: 'See why, then follow up',
    text: 'The five inputs that pushed the estimate up or down most, saved to your History with personalised guidance on diet, activity and when to see a doctor.',
    time: 'saved',
  },
];

// ---------- Platform (every part of the app) ----------

export const PLATFORM = [
  {
    key: 'prediction',
    to: '/prediction',
    icon: 'pulse',
    title: 'Prediction',
    text: 'The 21-value form with sample patients, unit-safe inputs and “not measured” for missing labs. Results arrive with their band, confidence and top factors.',
  },
  { key: 'dashboard', to: '/dashboard', icon: 'grid', title: 'Dashboard', text: 'Your latest estimate, risk over time, check-ups and a guided 4-7-8 breathing exercise.' },
  { key: 'history', to: '/history', icon: 'clock', title: 'History', text: 'Every assessment, with lab trends, the change since last time and sparklines per test.' },
  { key: 'guidance', to: '/guidance', icon: 'leaf', title: 'Guidance', text: 'Rule-based diet, activity and habit suggestions, each showing what triggered it and the guideline behind it.' },
  { key: 'profile', to: '/profile', icon: 'user', title: 'Profile & reports', text: 'Your details, a printable health report, sharing that includes only what you tick, and Google or X sign-in.' },
  { key: 'alerts', to: '/dashboard', cta: 'See them on the Dashboard', icon: 'bell', title: 'Notifications', text: 'Out-of-range values grouped by topic, most serious first, plus a note when a new estimate lands.' },
  {
    key: 'admin',
    to: '/console',
    cta: 'Open the console',
    icon: 'console',
    title: 'Admin console',
    text: 'For clinic staff: users, assessments, a model card with health checks, security monitoring, an audit log and site-wide controls.',
    staff: true,
  },
];

// ---------- Audiences ----------

export const AUDIENCES = [
  {
    icon: 'stethoscope',
    who: 'Clinics & health workers',
    text: 'A second look at routine results, with the reasoning shown, for triage and for deciding who needs a specialist referral first.',
    points: ['No imaging or specialist tests', 'Works with missing labs', 'Staff console for oversight'],
  },
  {
    icon: 'heart',
    who: 'Patients & families',
    text: 'Understand what your numbers mean, track them over time and take practical, guideline-based steps between visits.',
    points: ['Plain-language results', 'History and trends', 'Personal guidance'],
  },
  {
    icon: 'book',
    who: 'Students & researchers',
    text: 'An end-to-end, documented example of clinical ML: leakage controls, calibration, explanations and an honest validation story.',
    points: ['Research notebook', 'Model card and metrics', 'QA traced to requirements'],
  },
];

// ---------- Inputs ----------

export const INPUT_GROUPS = ['All', 'Profile', 'History', 'Vitals', 'Lipids', 'Blood panel', 'Cardiac marker'];

// kind: 'measure' | 'yesno' | 'derived' | 'marker'
export const INPUTS = [
  { name: 'Age', unit: 'years', group: 'Profile', note: 'Adults only (18+)' },
  { name: 'Sex', unit: 'M / F', group: 'Profile', kind: 'yesno' },
  { name: 'Height', unit: 'cm', group: 'Profile' },
  { name: 'Weight', unit: 'kg', group: 'Profile' },
  { name: 'BMI', unit: 'kg/m²', group: 'Profile', kind: 'derived', note: 'From height and weight' },
  { name: 'Max heart rate', unit: 'bpm', group: 'Profile', kind: 'derived', note: 'From age and sex, never typed in' },
  { name: 'Family history', unit: 'yes / no', group: 'History', kind: 'yesno' },
  { name: 'Hypertension', unit: 'yes / no', group: 'History', kind: 'yesno' },
  { name: 'Diabetes', unit: 'yes / no', group: 'History', kind: 'yesno' },
  { name: 'Chest pain history', unit: 'yes / no', group: 'History', kind: 'yesno' },
  { name: 'Systolic blood pressure', unit: 'mmHg', group: 'Vitals' },
  { name: 'Random blood sugar', unit: 'mmol/L', group: 'Vitals' },
  { name: 'Total cholesterol', unit: 'mg/dL', group: 'Lipids' },
  { name: 'HDL', unit: 'mg/dL', group: 'Lipids' },
  { name: 'LDL', unit: 'mg/dL', group: 'Lipids' },
  { name: 'Triglycerides', unit: 'mg/dL', group: 'Lipids' },
  { name: 'Hemoglobin', unit: 'g/dL', group: 'Blood panel' },
  { name: 'Creatinine', unit: 'mg/dL', group: 'Blood panel' },
  { name: 'Platelets', unit: '×10³/µL', group: 'Blood panel' },
  { name: 'Sodium', unit: 'mmol/L', group: 'Blood panel' },
  { name: 'Potassium', unit: 'mmol/L', group: 'Blood panel' },
  { name: 'Chloride', unit: 'mmol/L', group: 'Blood panel' },
  {
    name: 'Troponin-I',
    unit: 'ng/mL or ng/L',
    group: 'Cardiac marker',
    kind: 'marker',
    note: 'Checked against clinical limits, not used by the model. Assay type required.',
  },
];

// ---------- The science ----------

export const PIPELINE = [
  { title: 'Records', value: '1,035', text: 'Adult hospital records from Northern Bangladesh' },
  { title: 'Split', value: '80 / 20', text: 'Stratified; the test set is locked away' },
  { title: 'Compare', value: '4 models', text: 'Each tuned with 5-fold cross-validation' },
  { title: 'Calibrate', value: 'Platt', text: 'So probabilities mean what they say' },
  { title: 'Explain', value: 'SHAP', text: 'Top five factors for every estimate' },
];

export const METHOD = [
  ['Dataset', 'Hospital-sourced records from Northern Bangladesh: 1,048 rows, 13 under-18 records excluded, leaving 1,035 adults (56.5% with heart disease).'],
  ['Leakage controls', 'Patient IDs, ward (CCU vs general) and troponin assay type are excluded, because they give away the outcome instead of predicting it.'],
  ['Training', 'Stratified 80/20 split. Imputation and scaling are fitted inside each pipeline, so the test set is never seen during training.'],
  ['Model choice', 'Logistic regression, decision tree, SVM and random forest, each tuned with 5-fold cross-validation. The random forest ranked first on cross-validated ROC-AUC, then recall, F1 and Brier score; the test set played no part in the choice.'],
  ['Calibration', 'The chosen forest is calibrated (Platt scaling, fitted on the training folds), so a 30% estimate means roughly 3 in 10 similar patients had heart disease. Held-out Brier score 0.043.'],
  ['Troponin-I', 'Left out of the model: in this dataset normal troponin values were almost all heart disease cases, the reverse of clinical reality. The app still checks your troponin against clinical limits.'],
];

// Held-out test set (207 patients, same hospital dataset), deployed calibrated
// model. From ml/artifacts/model_metadata.json → selected_model_metrics.
export const METRICS = [
  { value: 0.987, label: 'ROC-AUC', digits: 3 },
  { value: 95.7, label: 'Accuracy', suffix: '%', digits: 1 },
  { value: 95.7, label: 'Recall', suffix: '%', digits: 1 },
  { value: 96.6, label: 'Precision', suffix: '%', digits: 1 },
];

export const LIMITATIONS = [
  'Trained and tested on a single hospital’s records, so these scores are not proof it works elsewhere.',
  'Not externally validated, and not approved for clinical use.',
  'Some fields in the source data follow recording patterns rather than physiology. Troponin-I ran backwards and is left out; LDL almost separates the two groups on its own, so the model leans on it heavily.',
  'Adults only. The data’s 13 children were all heart-disease cases, so there is nothing to learn a child’s risk from; the app explains this instead of estimating.',
  'Trained on ages 18–97, weights 38–101 kg and heights 141–186 cm. Values beyond that are accepted, but those estimates are flagged as less reliable.',
  'It estimates probability. It does not diagnose, and it doesn’t replace a clinician’s judgement or an ECG.',
];

// ---------- Trust & privacy (each line is enforced in backend/predictor) ----------

export const TRUST = [
  { icon: 'lock', title: 'Only you see your records', text: 'Every profile and assessment belongs to one account. The API checks ownership on every request.' },
  { icon: 'download', title: 'Export whenever you like', text: 'Download everything stored about you, from your Profile, as one JSON file.' },
  { icon: 'trash', title: 'Delete for good', text: 'Deleting your account removes it, your profile and every assessment at once. The audit log keeps only a note that it happened.' },
  { icon: 'key', title: 'Passwords stay secret', text: 'Passwords are stored only as salted hashes, and are never included in exports or staff backups.' },
  { icon: 'eye', title: 'Staff actions are audited', text: 'Every change made in the admin console is written to an activity log, kept for 180 days.' },
  { icon: 'share', title: 'You choose what’s shared', text: 'Sharing a result includes just the risk level unless you tick more, and the text stays editable.' },
];

export const STACK = ['React', 'Vite', 'Django REST Framework', 'scikit-learn', 'SHAP', 'pandas', 'Open-Meteo'];

// ---------- Journey (from the git history) ----------

export const JOURNEY = [
  { date: '2026-09-24', title: 'Model trained, first release', text: 'Four models compared on the Northern Bangladesh dataset; the calibrated Random Forest is saved as one pipeline.' },
  { date: '2026-09-26', title: 'Django API and Profile', text: 'A real backend for predictions and history, a redesigned History page and the Profile page.' },
  { date: '2026-09-27', title: 'Accounts, alerts and guidance', text: 'Per-user data, risk notifications, personalised health guidance and a responsive pass across every page.' },
  { date: '2026-10-01', title: 'QA review and retraining', text: '114 test cases traced to 24 requirements. Fixes applied, Troponin-I left out of the model, Google and X sign-in added.' },
  { date: '2026-10-02', title: 'Admin console', text: 'A staff console with site controls, security monitoring, an audit log and model health checks.' },
  { date: null, title: 'Next', text: 'Move the hosted site from demo mode onto the API. Before any clinical use, the model needs external validation on another hospital’s data.' },
];

// ---------- FAQ ----------

export const FAQ = [
  {
    q: 'Is this a diagnosis?',
    a: 'No. Cardio Sense estimates a probability from routine values. It doesn’t diagnose heart disease and it doesn’t replace a clinician, an ECG or specialist tests. It’s a research prototype that hasn’t been externally validated or approved for clinical use.',
  },
  {
    q: 'How accurate is it?',
    a: 'On 207 held-out patients from the same hospital, ROC-AUC was 0.987 and accuracy 95.7%. Scores that high on one hospital’s data very likely overstate real-world performance, so treat them as dataset-specific, not as clinical accuracy.',
  },
  {
    q: 'What if some lab results are missing?',
    a: 'Blood sugar and the blood-panel labs can be marked “not measured”. The model fills the gap the way it was trained to, names each filled value in the result, and flags the estimate as low confidence when three or more are missing. Age, sex, height, weight, history, blood pressure and the lipid panel are required.',
  },
  {
    q: 'Why isn’t Troponin-I used by the model?',
    a: 'In this dataset troponin ran backwards: normal values were almost all heart disease cases, the reverse of clinical reality. Learning from it would teach the model something false, so it’s left out. Your troponin is still checked against its assay’s clinical limit and flagged when raised.',
  },
  {
    q: 'Can I use it for children?',
    a: 'No. The dataset’s 13 under-18 records were all heart disease cases, so there is nothing to learn a child’s risk from. The app explains this instead of estimating.',
  },
  {
    q: 'Who can see my data?',
    a: 'Only your account sees your profile and assessments. Clinic staff with admin access can review records for oversight, and every change they make is logged. You can export or delete everything from your Profile.',
  },
  {
    q: 'What do the risk bands mean?',
    a: 'Low is under 35%, moderate 35–65% and high 65% or above. Because the model is calibrated, a 30% estimate means roughly 3 in 10 similar patients in the data had heart disease.',
  },
  {
    q: 'Does it cost anything?',
    a: 'No. It’s a free research prototype built as a final-year Computer Science and Engineering capstone project.',
  },
];
