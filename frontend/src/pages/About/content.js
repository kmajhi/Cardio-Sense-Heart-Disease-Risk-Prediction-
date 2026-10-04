// Copy and figures for the About page. Everything here must stay true of the
// app as built: model numbers come from ml/artifacts/model_metadata.json
// (training run of 2026-10-01), features from the pages they describe, dates
// from the git history. Update them here if the model is retrained.

export const DISCLAIMER = 'Research prototype. Not externally validated, not approved for clinical use.';

export const HERO = {
  badge: 'PDF health reports · Doctor review coming next',
  lines: [
    { text: 'Your heart check,', weight: 'thin' },
    { text: 'ready for a', weight: 'bold' },
    // `accent`: set in the display serif (About.css .pc-a-accent).
    { text: 'doctor’s eyes.', weight: 'bold', accent: 'doctor’s' },
  ],
  lead:
    'Routine check-up numbers in, an explained heart-risk estimate out, with every value checked against ' +
    'clinical ranges and a report ready for your doctor.',
  // What is true today, and what comes next. The review is never shown as done.
  points: [
    { icon: 'check', text: 'Every value checked against published reference ranges' },
    { icon: 'download', text: 'A clinical PDF report for any saved assessment' },
    { icon: 'stethoscope', text: 'Doctor review is next: shown as pending until a verified doctor signs' },
  ],
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
    'Many clinics can measure blood pressure and run a blood panel, but can’t easily reach a cardiologist. ' +
    'Cardio Sense asks what those numbers already say, and shows its reasoning.',
  contrasts: [
    { problem: 'A risk score nobody can question', answer: 'Every estimate names the five inputs that moved it.' },
    { problem: 'Labs that weren’t run', answer: 'Mark a lab “not measured”: the estimate says what it filled in.' },
    { problem: 'Numbers without context', answer: 'Every value is checked against clinical ranges, urgent ones first.' },
  ],
};

export const PRINCIPLES = [
  { icon: 'spark', title: 'Explain, don’t dictate', text: 'Every result shows why.' },
  { icon: 'shield', title: 'Honest about limits', text: 'Estimates, never diagnoses.' },
  { icon: 'pin', title: 'Built for where it’s needed', text: 'Built on the tests clinics already run.' },
  { icon: 'lock', title: 'Private by default', text: 'Yours only, exportable, deletable.' },
];

// ---------- Product tour (how it works) ----------

export const TOUR = [
  {
    key: 'enter',
    title: 'Enter routine values',
    text: 'Vitals, history and routine labs. Missing a lab? Mark it “not measured”.',
    time: '~40 s',
  },
  {
    key: 'check',
    title: 'Check against clinical ranges',
    text: 'Each value against published reference ranges, urgent ones first.',
    time: 'instant',
  },
  {
    key: 'estimate',
    title: 'Get a calibrated estimate',
    text: 'A calibrated Random Forest returns a probability and its band.',
    time: '< 1 s',
  },
  {
    key: 'explain',
    title: 'See why, then follow up',
    text: 'Top five factors, personal guidance and a PDF report for your doctor.',
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
    text: '21 values, sample patients and unit-safe inputs. Every result downloads as a PDF.',
  },
  { key: 'dashboard', to: '/dashboard', icon: 'grid', title: 'Dashboard', text: 'Latest estimate, risk over time, guided breathing.' },
  { key: 'history', to: '/history', icon: 'clock', title: 'History', text: 'Every assessment and lab trend, each with its own PDF.' },
  { key: 'guidance', to: '/guidance', icon: 'leaf', title: 'Guidance', text: 'Diet, activity and habits, each with its reason.' },
  { key: 'profile', to: '/profile', icon: 'user', title: 'Profile & reports', text: 'Your details, a printable summary, selective sharing.' },
  { key: 'alerts', to: '/dashboard', cta: 'See them on the Dashboard', icon: 'bell', title: 'Notifications', text: 'Out-of-range values by topic, most serious first.' },
  {
    key: 'admin',
    to: '/console',
    cta: 'Open the console',
    icon: 'console',
    title: 'Admin console',
    text: 'Users, assessments, model health, security and an audit log.',
    staff: true,
  },
];

// ---------- Audiences ----------

export const AUDIENCES = [
  {
    icon: 'stethoscope',
    who: 'Clinics & health workers',
    text: 'A second look at routine results, for triage and referral.',
    points: ['No imaging or specialist tests', 'Works with missing labs', 'Staff console for oversight'],
  },
  {
    icon: 'heart',
    who: 'Patients & families',
    text: 'Understand your numbers and track them between visits.',
    points: ['Plain-language results', 'History and trends', 'Personal guidance'],
  },
  {
    icon: 'book',
    who: 'Students & researchers',
    text: 'A documented, end-to-end example of clinical ML.',
    points: ['Research notebook', 'Model card and metrics', 'QA traced to requirements'],
  },
];

// ---------- Get your numbers (for people in Bangladesh) ----------
// What someone needs before they can run a prediction, and where to get it.
// Required/optional matches the backend's REQUIRED_FIELDS / OPTIONAL_FIELDS.

export const GET_NUMBERS = {
  intro: 'One blood-pressure reading and one blood test. Units match Bangladeshi lab reports.',
  minimum: 'Minimum to get an estimate: height, weight, blood pressure and a Lipid profile.',
  steps: [
    {
      n: 1,
      title: 'Measure yourself',
      where: 'Home, pharmacy or community clinic.',
      items: [
        { name: 'Height and weight', detail: 'Without shoes.' },
        {
          name: 'Blood pressure (systolic)',
          detail: 'The top number (130 in 130/85), after 5 minutes’ rest.',
        },
        {
          name: 'Your medical history',
          detail: 'Four yes/no questions.',
        },
      ],
    },
    {
      n: 2,
      title: 'Get a blood test',
      where: 'Any diagnostic centre or hospital lab. One sample covers it all.',
      items: [],
    },
    {
      n: 3,
      title: 'Enter your report',
      where: 'Copy the numbers into Prediction.',
      items: [
        {
          name: 'Use the (?) beside each field',
          detail: 'Report names, healthy ranges, unit conversions.',
        },
        {
          name: 'Missing a test?',
          detail: 'Tick “Not measured”.',
        },
      ],
    },
  ],
  // What to ask the lab for, as Bangladeshi reports name them.
  tests: [
    {
      ask: 'Lipid profile',
      required: true,
      fields: 'Total cholesterol, HDL, LDL, Triglycerides',
      prep: 'Fast 10–12 hours before (water is fine). Go in the morning.',
      report: 'Usually reported in mg/dL, which is what the app uses. If yours says mmol/L, switch the unit beside the value.',
    },
    {
      ask: 'Blood glucose (random) — RBS',
      required: false,
      fields: 'Random blood sugar',
      prep: 'No fasting: taken any time after eating. A home glucometer reading also works.',
      report:
        'Reported in mmol/L in Bangladesh. If you gave blood fasting, the lab reports fasting sugar (FBS) instead, which ' +
        'is a different test: leave this “Not measured” or use a glucometer later.',
    },
    {
      ask: 'CBC (complete blood count)',
      required: false,
      fields: 'Hemoglobin (Hb), Platelets',
      prep: 'No preparation needed.',
      report: 'Platelets are often written per cumm, e.g. 2,50,000 /cumm: enter 250.',
    },
    {
      ask: 'Serum creatinine',
      required: false,
      fields: 'Creatinine (kidney function)',
      prep: 'No preparation needed.',
      report: 'In mg/dL. If your report gives µmol/L, switch the unit beside the value.',
    },
    {
      ask: 'Serum electrolytes',
      required: false,
      fields: 'Sodium (Na⁺), Potassium (K⁺), Chloride (Cl⁻)',
      prep: 'No preparation needed.',
      report: 'In mmol/L, as the app uses.',
    },
    {
      ask: 'Troponin I',
      required: false,
      fields: 'Troponin-I (heart muscle marker)',
      prep: 'Only if a doctor has ordered it, usually for chest pain. Not needed for a routine check.',
      report: 'Note whether it says ng/mL or ng/L: the app asks which assay it was.',
    },
  ],
  askFor: 'Lipid profile (fasting), RBS, CBC, Serum creatinine, Serum electrolytes',
  safety:
    'Chest pain, pressure or breathlessness right now is an emergency: call 999 or go to the nearest hospital. ' +
    'Do not wait for a test or an estimate.',
  note: 'Prices and names vary between centres: show this list at the counter and ask for these tests by name.',
};

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
  'One hospital’s records: the scores aren’t proof it works elsewhere.',
  'Not externally validated or approved for clinical use.',
  'Data quirks: Troponin-I ran backwards (left out); the model leans on LDL.',
  'Adults only: the data had no healthy children.',
  'Trained on ages 18–97 and 38–101 kg; values beyond are flagged.',
  'Estimates probability; it doesn’t diagnose or replace an ECG.',
];

// ---------- Trust & privacy (each line is enforced in backend/predictor) ----------

export const TRUST = [
  { icon: 'lock', title: 'Only you see your records', text: 'Ownership checked on every request; reports never stored.' },
  { icon: 'download', title: 'Export whenever you like', text: 'Everything about you, as one JSON file.' },
  { icon: 'trash', title: 'Delete for good', text: 'Account, profile and assessments, gone at once.' },
  { icon: 'key', title: 'Passwords stay secret', text: 'Salted hashes only, never in exports.' },
  { icon: 'eye', title: 'Staff actions are audited', text: 'Every admin change logged for 180 days.' },
  { icon: 'share', title: 'You choose what’s shared', text: 'Just the risk level, unless you tick more.' },
];

export const STACK = ['React', 'Vite', 'Django REST Framework', 'scikit-learn', 'SHAP', 'pandas', 'Open-Meteo'];

// ---------- Journey (from the git history) ----------

export const JOURNEY = [
  { date: '2026-09-24', title: 'Model trained, first release', text: 'Four models compared; calibrated Random Forest chosen.' },
  { date: '2026-09-26', title: 'Django API and Profile', text: 'A real backend, History and Profile pages.' },
  { date: '2026-09-27', title: 'Accounts, alerts and guidance', text: 'Per-user data, alerts and personal guidance.' },
  { date: '2026-10-01', title: 'QA review and retraining', text: '114 test cases; Troponin-I left out of the model.' },
  { date: '2026-10-02', title: 'Admin console', text: 'Site controls, security and model health.' },
  { date: '2026-10-04', title: 'PDF health reports', text: 'Clinical PDF for any saved assessment.' },
  { date: null, title: 'Next', text: 'Verified doctor review, then external validation.' },
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
    q: 'Can I take my results to a doctor?',
    a: 'Yes. After a prediction, or from any record in your History, choose “Download PDF Health Report”. It lists the values you entered, the saved estimate, values outside their healthy range and the app’s recommendations. Its “Doctor’s Clinical Review” section stays pending: no doctor reviews reports in the app yet, and the report never says one did.',
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
