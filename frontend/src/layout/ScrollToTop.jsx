import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

// Floating "back to top" button. Appears after the user scrolls down and
// shows a ring that fills with how far down the page they are.
const SHOW_AFTER = 400;
const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ScrollToTop = () => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const { pathname } = useLocation();

  // Start each new page at the top instead of keeping the old scroll offset.
  useEffect(() => {
    // 'instant' skips the global smooth scroll-behavior so the jump isn't animated.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setVisible(scrollTop > SHOW_AFTER);
      setProgress(max > 0 ? Math.min(scrollTop / max, 1) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const scrollUp = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      className={`fw-scroll-top ${visible ? 'visible' : ''}`}
      onClick={scrollUp}
      aria-label="Scroll to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      <svg className="fw-scroll-top-ring" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={RADIUS} className="fw-scroll-top-track" />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          className="fw-scroll-top-progress"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        />
      </svg>
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
};

export default ScrollToTop;
