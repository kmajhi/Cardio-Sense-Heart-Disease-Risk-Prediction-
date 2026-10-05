import { useEffect, useId, useRef, useState } from 'react';
import { MIN_ZOOM, clampFrame, coverSize, loadPhotoSource, maxZoom, renderFrame } from '../../Profile/photo';

const STAGE = 240; // px, the square the doctor frames the photo in
const CENTRED = { zoom: 1, x: 0, y: 0 };

/**
 * "Profile photo": frame the chosen file in a circle (drag to move, slider or
 * arrow keys to zoom/move), then save a 320 px JPEG. Uses the same image code as
 * the patient Profile page (pages/Profile/photo.js), so the stored format is the same.
 *
 * file: the File picked, or null when closed.
 */
export default function PhotoDialog({ file, busy, onSave, onCancel }) {
  const titleId = useId();
  const zoomId = useId();
  const [photo, setPhoto] = useState(null); // { img, src, release }
  const [frame, setFrame] = useState(CENTRED);
  const [error, setError] = useState('');
  const drag = useRef(null);

  useEffect(() => {
    if (!file) return undefined;
    let alive = true;
    let loaded = null;
    setError('');
    setPhoto(null);
    setFrame(CENTRED);
    loadPhotoSource(file)
      .then((p) => {
        loaded = p;
        if (alive) setPhoto(p);
        else p.release();
      })
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
      loaded?.release();
    };
  }, [file]);

  useEffect(() => {
    if (!file) return undefined;
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, busy, onCancel]);

  if (!file) return null;
  const update = (fn) => setFrame((f) => (photo ? clampFrame(photo.img, fn(f)) : f));
  const max = photo ? maxZoom(photo.img) : 1;
  const size = photo ? coverSize(photo.img, frame.zoom) : null;

  const onPointerDown = (e) => {
    if (!photo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.x) / STAGE;
    const dy = (e.clientY - drag.current.y) / STAGE;
    drag.current = { x: e.clientX, y: e.clientY };
    update((f) => ({ ...f, x: f.x + dx, y: f.y + dy }));
  };
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 0.08 : 0.02;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) update((f) => ({ ...f, x: f.x + moves[e.key][0], y: f.y + moves[e.key][1] }));
    else if (e.key === '+' || e.key === '=') update((f) => ({ ...f, zoom: f.zoom * 1.1 }));
    else if (e.key === '-') update((f) => ({ ...f, zoom: f.zoom / 1.1 }));
    else return;
    e.preventDefault();
  };

  return (
    <div className="dr-dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="dr-dialog dr-photo-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>Profile photo</h2>
        <p>Drag to position your face in the circle, and zoom if needed. Use a clear, professional photo.</p>
        {error ? (
          <p className="dr-field-error" role="alert">
            {error}
          </p>
        ) : (
          <>
            <div
              className={`dr-photo-stage${photo ? '' : ' is-loading'}`}
              style={{ width: STAGE, height: STAGE }}
              tabIndex={0}
              role="img"
              aria-label="Photo framing area. Arrow keys move the photo, plus and minus zoom."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={onKeyDown}
            >
              {photo && (
                <img
                  src={photo.src}
                  alt=""
                  draggable="false"
                  style={{
                    width: size.w * STAGE,
                    height: size.h * STAGE,
                    transform: `translate(-50%, -50%) translate(${frame.x * STAGE}px, ${frame.y * STAGE}px)`,
                  }}
                />
              )}
              <span className="dr-photo-mask" aria-hidden="true" />
            </div>
            <div className="dr-photo-zoom">
              <label htmlFor={zoomId} className="dr-label">
                Zoom
              </label>
              <input
                id={zoomId}
                type="range"
                min={MIN_ZOOM}
                max={max}
                step={0.01}
                value={frame.zoom}
                disabled={!photo}
                onChange={(e) => update((f) => ({ ...f, zoom: Number(e.target.value) }))}
              />
            </div>
          </>
        )}
        <div className="dr-dialog-actions">
          <button type="button" className="dr-btn is-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="dr-btn is-primary" disabled={!photo || busy} onClick={() => onSave(renderFrame(photo.img, frame))}>
            {busy ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
