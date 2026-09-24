// Copy and figures for the About page. Model numbers come from
// ml/artifacts/model_metadata.json (training run of 2026-09-24); update them
// here if the model is retrained.

export const DISCLAIMER = 'Research prototype. Not externally validated, not approved for clinical use.';

export const HERO = {
  lines: [
    { text: 'Heart risk,', weight: 'thin' },
    { text: 'estimated early,', weight: 'bold' },
    { text: 'explained clearly.', weight: 'bold' },
  ],
  lead:
    'Cardio Sense is a clinical decision-support prototype. It turns routine measurements (blood pressure, ' +
    'lipids, a basic blood panel and Troponin-I) into an explained estimate of heart disease risk, built ' +
    'for clinics where specialist tests are hard to reach.',
};

export const FACTS = [
  { value: 1035, label: 'adult patient records' },
  { value: 21, label: 'routine measurements' },
  { value: 4, label: 'models compared' },
  { value: 5, label: 'fold cross-validation' },
  { value: 5, label: 'factors explained per estimate' },
];

export const STEPS = [
  {
    title: 'Enter routine values',
    text:
      'Age, sex, height and weight; four yes/no history questions; blood pressure and blood sugar; a lipid ' +
      'panel; a basic blood panel; and Troponin-I with its assay type. BMI and max heart rate are calculated for you.',
  },
  {
    title: 'The model estimates',
    text:
      'A Random Forest trained on hospital records from Northern Bangladesh returns the probability of heart ' +
      'disease, shown as a low, moderate or high band.',
  },
  {
    title: 'See what moved it',
    text:
      'Every estimate lists the five inputs that pushed it up or down most, in percentage points (a SHAP ' +
      'explanation), so the number is never a black box.',
  },
];

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
  { name: 'Blood pressure', unit: 'mmHg', group: 'Vitals' },
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
    note: 'Assay type required; the units are not interchangeable',
  },
];

export const FEATURES = [
  {
    icon: 'spark',
    title: 'Explains every estimate',
    text: 'The top five contributing inputs are shown with each result, in percentage points up or down.',
  },
  {
    icon: 'flask',
    title: 'Unit-safe Troponin-I',
    text: 'Quantitative (ng/mL) and high-sensitivity (ng/L) results are kept apart, converted correctly and never compared.',
  },
  {
    icon: 'puzzle',
    title: 'Works with missing labs',
    text: 'A test that wasn’t done can be left blank. The model fills it the same way it was trained to.',
  },
  {
    icon: 'shield',
    title: 'Honest by design',
    text: 'Results are always labelled as estimates, with typical ranges and a research disclaimer. Never a diagnosis.',
  },
];

export const METHOD = [
  ['Dataset', 'Hospital-sourced records from Northern Bangladesh: 1,048 rows, 13 under-18 records excluded, leaving 1,035 adults (56.5% with heart disease).'],
  ['Leakage controls', 'Patient IDs, ward (CCU vs general) and troponin assay type are excluded, because they give away the outcome instead of predicting it.'],
  ['Training', 'Stratified 80/20 split. Imputation and scaling are fitted inside each pipeline, so the test set is never seen during training.'],
  ['Model choice', 'Logistic regression, decision tree, SVM and random forest, each tuned with 5-fold cross-validation. The random forest ranked first on ROC-AUC, then recall, then F1.'],
];

// Held-out test set (207 patients, same hospital dataset).
export const METRICS = [
  { value: 0.992, label: 'ROC-AUC', digits: 3 },
  { value: 95.7, label: 'Accuracy', suffix: '%', digits: 1 },
  { value: 94.9, label: 'Recall', suffix: '%', digits: 1 },
  { value: 97.4, label: 'Precision', suffix: '%', digits: 1 },
];

export const LIMITATIONS = [
  'Trained and tested on a single hospital’s records, so these scores are not proof it works elsewhere.',
  'Not externally validated, and not approved for clinical use.',
  'Some fields in the source data follow recording patterns rather than physiology (for example, Troponin-I), and the model can inherit them.',
  'It estimates probability. It does not diagnose, and it doesn’t replace a clinician’s judgement or an ECG.',
];
