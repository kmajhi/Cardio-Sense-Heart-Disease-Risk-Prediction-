import { useEffect, useRef } from 'react';
import { linkProps } from '../link';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import heartWebm from '../assets/heart-loop.webm';
import heartMp4 from '../assets/heart-loop.mp4';
import heartPoster from '../assets/heart-poster.jpg';

/**
 * The glowing heart. The clip is a seamless 3.6 s loop on a black background.
 * `mix-blend-mode: screen` (see .pc-hero-video) drops the black so the heart
 * glows on the dark violet orb behind it. Screen blending only works over a
 * dark backdrop, which is why the light theme needs the orb.
 *
 * Important: no ancestor of this component may create an isolated stacking
 * context (transform, filter, opacity < 1, backdrop-filter, isolation, or
 * position + z-index). Otherwise the black box around the video shows.
 */
export default function HeartHero({ LinkComponent = 'a' }) {
  const L = LinkComponent;
  const videoRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reducedMotion) {
      video.pause();
      return;
    }

    const play = () => video.play().catch(() => {});
    play();

    // Save battery: pause while the tab is hidden, resume when visible.
    const onVisibility = () => (document.hidden ? video.pause() : play());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [reducedMotion]);

  return (
    <div className="pc-hero">
      <span className="pc-hero-ring pc-hero-ring--outer" style={{ '--d': '520ms' }} aria-hidden="true" />
      <span className="pc-hero-orb" style={{ '--d': '240ms' }} aria-hidden="true" />
      <span className="pc-hero-ring pc-hero-ring--inner" style={{ '--d': '640ms' }} aria-hidden="true" />
      <span className="pc-hero-glow" style={{ '--d': '700ms' }} aria-hidden="true" />
      <video
        aria-hidden="true"
        ref={videoRef}
        className="pc-hero-video"
        style={{ '--d': '760ms' }}
        poster={heartPoster}
        muted
        loop
        playsInline
        autoPlay={!reducedMotion}
        preload="auto"
        disablePictureInPicture
        tabIndex={-1}
      >
        <source src={heartWebm} type="video/webm" />
        <source src={heartMp4} type="video/mp4" />
      </video>

      <L {...linkProps(L, '/prediction')} className="pc-hero-cta pc-enter" style={{ '--d': '640ms', '--pc-rise': '20px' }}>
        Try a prediction
        <span className="pc-hero-cta-arrow" aria-hidden="true">→</span>
      </L>
    </div>
  );
}
