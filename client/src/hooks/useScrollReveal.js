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

    const revealElement = (el) => {
      if (el && !el.classList.contains('is-revealed')) {
        el.classList.add('is-revealed');
      }
    };

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      root.querySelectorAll('.reveal-on-scroll').forEach(revealElement);
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

    const observeUnrevealed = () => {
      const elements = root.querySelectorAll('.reveal-on-scroll');
      elements.forEach((el) => {
        if (!el.classList.contains('is-revealed')) {
          observer.observe(el);
        }
      });
    };

    observeUnrevealed();

    // Observe newly added DOM nodes dynamically (e.g. after async fetch or tab switch)
    let mutationObserver = null;
    if ('MutationObserver' in window) {
      mutationObserver = new MutationObserver(() => {
        observeUnrevealed();
      });
      mutationObserver.observe(root, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    };
  }, [containerRef]);
}

export default useScrollReveal;

