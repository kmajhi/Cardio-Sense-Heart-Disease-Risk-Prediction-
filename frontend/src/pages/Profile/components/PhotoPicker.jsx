import { useCallback, useId, useRef, useState } from 'react';
import PhotoCropper from './PhotoCropper';
import { PHOTO_ACCEPT, isPhoto } from '../photo';
import { initials } from '../profileFields';

/**
 * The "Profile photo" field: a round preview, Upload / Change, Adjust and
 * Remove. Also takes a dropped image file. Every new image opens the
 * cropper first, so only the framed square reaches the draft.
 */
export default function PhotoPicker({ value, name, onChange }) {
  const inputId = useId();
  const noteId = useId();
  const fileRef = useRef(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [cropSource, setCropSource] = useState(null); // File | stored photo | null
  const has = isPhoto(value);

  const pick = (file) => {
    if (fileRef.current) fileRef.current.value = ''; // picking the same file again still fires change
    if (!file) return;
    setError('');
    setCropSource(file);
  };

  const onCropError = useCallback((message) => {
    setCropSource(null);
    setError(message);
  }, []);

  return (
    <div className="pc-p-field is-wide">
      <span className="pc-p-label">Profile photo</span>
      <div
        className={`pc-p-photo${over ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        <span className="pc-p-photo-preview" aria-hidden="true">
          {has ? <img src={value} alt="" key={value.length} /> : initials(name) || '?'}
        </span>

        <div className="pc-p-photo-body">
          <p className="pc-p-photo-title">{has ? 'Looking good.' : 'Add a photo'}</p>
          <p id={noteId} className={`pc-p-hint${error ? ' is-error' : ''}`} role={error ? 'alert' : undefined}>
            {error || 'JPG, PNG, WebP or GIF, up to 10 MB. Drop one here or upload, then move and zoom it to fit.'}
          </p>
          <div className="pc-p-photo-actions">
            <input
              ref={fileRef}
              id={inputId}
              type="file"
              accept={PHOTO_ACCEPT}
              className="pc-visually-hidden"
              aria-describedby={noteId}
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <label htmlFor={inputId} className="pc-p-btn pc-p-btn--soft pc-p-btn--sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              {has ? 'Change photo' : 'Upload photo'}
            </label>
            {has && (
              <>
                <button type="button" className="pc-p-btn pc-p-btn--soft pc-p-btn--sm" onClick={() => setCropSource(value)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M7 3v14h14M3 7h14v14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Adjust
                </button>
                <button
                  type="button"
                  className="pc-p-btn pc-p-btn--soft pc-p-btn--sm pc-p-btn--remove"
                  onClick={() => {
                    setError('');
                    onChange('');
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <PhotoCropper
        source={cropSource}
        onCancel={() => setCropSource(null)}
        onError={onCropError}
        onApply={(photo) => {
          onChange(photo);
          setCropSource(null);
        }}
      />
    </div>
  );
}
