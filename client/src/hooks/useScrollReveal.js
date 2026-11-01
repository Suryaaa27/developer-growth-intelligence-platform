import { useEffect } from 'react';

/**
 * useScrollReveal — Lightweight, zero-dependency scroll-reveal hook using IntersectionObserver.
 * Observes elements with the `.reveal-on-scroll` class within a container.
 * Automatically unobserves elements once revealed, cleans up on unmount,
 * and immediately reveals all elements if reduced motion is preferred or
 * if IntersectionObserver is unsupported in the current browser.
 *
 * @param {React.RefObject} containerRef - Reference to the scrollable container (e.g., <main>)
 */
export function useScrollReveal(containerRef) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Honor accessibility: if user prefers reduced motion, reveal instantly
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const root = containerRef?.current || document;
    const elements = root.querySelectorAll('.reveal-on-scroll');
    if (!elements || elements.length === 0) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: containerRef?.current || null,
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.08,
      }
    );

    elements.forEach((el) => {
      if (!el.classList.contains('is-revealed')) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [containerRef]);
}

export default useScrollReveal;

