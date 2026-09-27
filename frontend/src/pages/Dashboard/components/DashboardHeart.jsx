import { useEffect, useRef } from 'react';
import { linkProps } from '../../../components/link';
import usePrefersReducedMotion from '../../../hooks/usePrefersReducedMotion';
import heroVideo from '../../../assets/hero-heart.mp4';

/**
 * The Dashboard's heart: the CardioSense hero clip, shown the way the hero
 * mockup (Main.dc.html) shows it. Large, in the clip's own 878 × 790 shape,
 * its light background keyed to the panel, and the edges feathered by a
 * radial mask so the frame never shows. It reaches past its column; the
 * cards on either side sit above it (Dashboard.css, .pc-overview).
 */
export default function DashboardHeart({ LinkComponent = 'a' }) {
  const L = LinkComponent;
  const videoRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.muted = true; // some browsers only autoplay when muted is set as a property
    if (reducedMotion) {
      video.pause();
      return undefined;
    }

    const play = () => video.play()?.catch?.(() => {});
    play();

    // Save battery: pause while the tab is hidden, resume when visible.
    const onVisibility = () => (document.hidden ? video.pause() : play());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [reducedMotion]);

  return (
    <div className="pc-hero pc-hero--clip">
      <div className="pc-clip" style={{ '--d': '240ms' }} aria-hidden="true">
        <video
          ref={videoRef}
          src={heroVideo}
          muted
          loop
          playsInline
          autoPlay={!reducedMotion}
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
        />
      </div>

      <L {...linkProps(L, '/prediction')} className="pc-hero-cta pc-enter" style={{ '--d': '640ms', '--pc-rise': '20px' }}>
        Try a prediction
        <span className="pc-hero-cta-arrow" aria-hidden="true">→</span>
      </L>
    </div>
  );
}
