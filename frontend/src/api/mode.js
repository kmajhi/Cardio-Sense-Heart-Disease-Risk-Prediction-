// One switch for the whole app. Mock unless VITE_USE_MOCK_API=false: the
// in-browser stand-in keeps each account's data in localStorage, and its risk
// scores come from a hand-tuned formula, NOT the trained model. Every page
// that shows an estimate says so while this is on (components/DemoBanner.jsx).
export const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';
