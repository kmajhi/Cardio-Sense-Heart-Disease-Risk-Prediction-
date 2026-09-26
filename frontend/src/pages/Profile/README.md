# Cardio Sense Profile page

The user's basic health information, their downloadable health report, sharing, and linked
accounts. Routed at `/profile`; the nav avatar links here and shows the saved name's initials.

## Data

`src/api/profileApi.js` has `getProfile()`, `saveProfile(profile)` and `deleteProfile()`.
In mock mode (the default) the profile lives in this browser's `localStorage`
(`cardio-sense:profile`). With `VITE_USE_MOCK_API=false` it calls:

| Method | Path | Returns |
|---|---|---|
| GET | `/api/profile/` | the profile, or 404 when there isn't one |
| PUT | `/api/profile/` | the saved profile |
| DELETE | `/api/profile/` | 204 |

The shape is `EMPTY_PROFILE` in `profileFields.js`. Keys shared with `/api/predict/` use the same
names (`sex`, `height_cm`, `weight_kg`, `hypertension`, `diabetes`, `family_history`,
`chest_pain_history`), so a prediction can be prefilled from a profile without mapping.

## What's on the page

- **ID card:** avatar, name, age · sex · blood group, a completeness ring, and Age / BMI / Blood
  stats. While editing it previews the draft live, and it sticks beside the long form.
- **Tiles (view mode):** Body (with a BMI gauge on the WHO bands), Medical history, Lifestyle &
  medications, Emergency contact (with a call button).
- **Profile photo:** set it in the form (upload, drag and drop, change, adjust, remove) or with the
  camera button on the ID card, which saves straight away. Every new image opens **Adjust your
  photo** (`PhotoCropper`): drag to move it (mouse, touch or arrow keys), zoom with the slider,
  +/− buttons, mouse wheel, pinch or +/− keys, and **Fit** to reset. A round mask shows exactly what
  the avatar will show, with live previews at card and nav size. The image always covers the frame
  (no empty edges), and zoom stops before the framed area drops below ~96 source px.
  `photo.js` accepts JPG, PNG, WebP or GIF up to 10 MB and stores the framed square as a 320 px JPEG
  data URL (roughly 20–40 KB) in the profile's `photo` field. It shows on the ID card, the nav avatar
  and the report, never in shared text. Only data URLs made by `photo.js` are rendered.
- **Form (create / edit):** only the name is required. Email, phones, date of birth, height and
  weight are validated; errors show on save and clear as they're fixed. Medications and allergies
  are tag lists (Enter to add, × or Backspace to remove). The save bar sticks to the bottom.
- **Delete:** a confirm dialog, then a toast with **Undo** for 7 seconds.
- **Health report:** `report.js` builds a self-contained HTML page (profile, latest estimate, its
  factors, estimate history, disclaimer). *Download report* saves it as
  `cardio-sense-report-YYYY-MM-DD.html`; *Save as PDF* opens it and calls the browser's print dialog.
- **Share:** a dialog where the user picks what to include (only the risk level by default) and
  can edit the text. It uses each network's public share link (X, Facebook, LinkedIn, WhatsApp,
  Gmail compose, email), plus Copy and the device share sheet (with the report file attached where
  the device supports it). Facebook and LinkedIn only accept a URL, so the text is copied first.
  Name, lab values and contacts are never added to shared text.
- **Connected accounts:** Gmail, X, Facebook, LinkedIn. **Connecting is simulated** and labelled so
  on the page: real sign-in needs OAuth on the Django side (it holds the app keys and tokens).
  The connect dialog lists the permissions the real flow would ask for.

## Files

- `Profile.jsx`: page state (load, edit, save, delete + undo, report, dialogs, toasts).
- `profileFields.js`: empty profile, options, age / BMI / completeness helpers, validation.
- `report.js`: report HTML and share text.
- `photo.js`: image checks, the framing model (zoom + offset, clamped to cover), and the final crop.
- `brands.jsx`: small monochrome service glyphs.
- `components/`: `IdentityCard`, `HealthTiles`, `ProfileForm`, `PhotoPicker`, `PhotoCropper`, `ReportCard`, `ShareDialog`,
  `ConnectionsCard`, `Modal` (native `<dialog>`), `Toast`.
- `Profile.css`: page styles, prefixed `pc-p-`. Every animation is off under `prefers-reduced-motion`.
