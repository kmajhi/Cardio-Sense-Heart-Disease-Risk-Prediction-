import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Modal from './Modal';
import { MIN_ZOOM, clampFrame, coverSize, loadPhotoSource, maxZoom, renderFrame } from '../photo';

const CENTRED = { zoom: 1, x: 0, y: 0 };
const KEY_STEP = 0.02; // frame units per arrow press (Shift = 4×)
const ZOOM_STEP = 1.1;

/** Size and position of the image for a square viewport `size` px wide. */
function imageStyle(img, { zoom, x, y }, size) {
  const { w, h } = coverSize(img, zoom);
  return {
    width: `${w * size}px`,
    height: `${h * size}px`,
    transform: `translate(-50%, -50%) translate(${x * size}px, ${y * size}px)`,
  };
}

/**
 * "Adjust your photo": drag to move, pinch / scroll / slider / +− to zoom,
 * Fit to start over. The round mask shows exactly what the avatar will show.
 * `source` is a File (new upload) or the stored photo (re-framing it).
 */
export default function PhotoCropper({ source, onApply, onCancel, onError }) {
  const [photo, setPhoto] = useState(null); // { img, src, release }
  const [frame, setFrame] = useState(CENTRED);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState(320);
  const stageRef = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const helpId = useId();

  // Load whatever was picked; report problems to the parent and close.
  useEffect(() => {
    if (!source) return undefined;
    let alive = true;
    let loaded = null;
    setPhoto(null);
    setFrame(CENTRED);
    loadPhotoSource(source)
      .then((p) => {
        loaded = p;
        if (alive) setPhoto(p);
        else p.release();
      })
      .catch((err) => alive && onError(err.message));
    return () => {
      alive = false;
      loaded?.release();
    };
  }, [source, onError]);

  // Track the stage's rendered width (it shrinks on phones).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setSize(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [photo]);

  const update = useCallback(
    (fn) => setFrame((f) => (photo ? clampFrame(photo.img, fn(f)) : f)),
    [photo],
  );

  // Zooming keeps the point under the frame's centre where it is:
  // offsets are in frame units, so they scale with the zoom.
  const zoomTo = useCallback(
    (next) =>
      update((f) => {
        const z = Math.min(Math.max(next(f.zoom), MIN_ZOOM), maxZoom(photo.img));
        return { zoom: z, x: (f.x * z) / f.zoom, y: (f.y * z) / f.zoom };
      }),
    [update, photo],
  );

  // Wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !photo) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      zoomTo((z) => z * Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [photo, zoomTo]);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    if (pointers.current.size === 2) pinch.current = { dist: distance(), zoom: frame.zoom };
  };

  const onPointerMove = (e) => {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);

    if (pointers.current.size >= 2 && pinch.current) {
      const { dist, zoom } = pinch.current;
      zoomTo(() => zoom * (distance() / Math.max(dist, 1)));
    } else if (pointers.current.size === 1) {
      const dx = (now.x - last.x) / size;
      const dy = (now.y - last.y) / size;
      update((f) => ({ ...f, x: f.x + dx, y: f.y + dy }));
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setDragging(false);
  };

  const onKeyDown = (e) => {
    const step = e.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      const [dx, dy] = moves[e.key];
      update((f) => ({ ...f, x: f.x + dx, y: f.y + dy }));
    } else if (e.key === '+' || e.key === '=') zoomTo((z) => z * ZOOM_STEP);
    else if (e.key === '-' || e.key === '_') zoomTo((z) => z / ZOOM_STEP);
    else if (e.key === '0') setFrame(CENTRED);
    else return;
    e.preventDefault();
  };

  const max = photo ? maxZoom(photo.img) : 1;
  const pct = Math.round(((frame.zoom - MIN_ZOOM) / Math.max(max - MIN_ZOOM, 0.001)) * 100);
  const centred = frame.zoom === 1 && frame.x === 0 && frame.y === 0;

  return (
    <Modal
      open={source !== null}
      onClose={onCancel}
      title="Adjust your photo"
      subtitle="Drag to move it. Pinch, scroll or use the slider to zoom."
    >
      <div className="pc-p-crop">
        <div className="pc-p-crop-main">
          <div
            ref={stageRef}
            className={`pc-p-crop-stage${dragging ? ' is-dragging' : ''}${photo ? '' : ' is-loading'}`}
            tabIndex={photo ? 0 : -1}
            role="group"
            aria-label="Photo position"
            aria-describedby={helpId}
            onPointerDown={photo ? onPointerDown : undefined}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={photo ? onKeyDown : undefined}
          >
            {photo && (
              <img src={photo.src} alt="" draggable="false" className="pc-p-crop-img" style={imageStyle(photo.img, frame, size)} />
            )}
            <span className="pc-p-crop-mask" aria-hidden="true" />
            <span className="pc-p-crop-grid" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          <p id={helpId} className="pc-p-hint pc-p-crop-help">
            Keyboard: arrow keys move, + and − zoom, 0 fits. The circle shows what your avatar shows.
          </p>
        </div>

        <aside className="pc-p-crop-side">
          <span className="pc-p-eyebrow">Preview</span>
          <div className="pc-p-crop-previews" aria-hidden="true">
            {[88, 44].map((s) => (
              <span key={s} className="pc-p-crop-preview" style={{ width: s, height: s }}>
                {photo && <img src={photo.src} alt="" style={imageStyle(photo.img, frame, s)} />}
              </span>
            ))}
          </div>
          <span className="pc-p-crop-caption">Profile card · Nav bar</span>
        </aside>
      </div>

      <div className="pc-p-crop-controls">
        <button type="button" className="pc-p-icon-btn" onClick={() => zoomTo((z) => z / ZOOM_STEP)} disabled={!photo || frame.zoom <= MIN_ZOOM} aria-label="Zoom out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 12h12" strokeLinecap="round" />
          </svg>
        </button>
        <input
          type="range"
          className="pc-p-crop-zoom"
          min={MIN_ZOOM}
          max={max}
          step="0.01"
          value={frame.zoom}
          onChange={(e) => {
            const z = Number(e.target.value);
            zoomTo(() => z);
          }}
          style={{ '--fill': `${pct}%` }}
          aria-label="Zoom"
          aria-valuetext={`${Math.round(frame.zoom * 100)}%`}
          disabled={!photo || max <= MIN_ZOOM}
        />
        <button type="button" className="pc-p-icon-btn" onClick={() => zoomTo((z) => z * ZOOM_STEP)} disabled={!photo || frame.zoom >= max} aria-label="Zoom in">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 12h12M12 6v12" strokeLinecap="round" />
          </svg>
        </button>
        <span className="pc-p-crop-pct" aria-hidden="true">
          {Math.round(frame.zoom * 100)}%
        </span>
        <button type="button" className="pc-p-btn pc-p-btn--soft pc-p-btn--sm" onClick={() => setFrame(CENTRED)} disabled={!photo || centred}>
          Fit
        </button>
      </div>

      <div className="pc-p-modal-foot">
        <button type="button" className="pc-p-btn pc-p-btn--soft" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="pc-p-btn pc-p-btn--primary" onClick={() => onApply(renderFrame(photo.img, frame))} disabled={!photo}>
          Use this photo
        </button>
      </div>
    </Modal>
  );
}
