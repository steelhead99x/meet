'use client';

import React, { useEffect, useState } from 'react';
import styles from '@/styles/CarouselNavigation.module.css';

/**
 * CarouselNavigation - Adds left/right arrow overlays to navigate the participant carousel
 * during screen share (focus layout mode)
 */
export function CarouselNavigation() {
  const [carousel, setCarousel] = useState<HTMLElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    // Find the carousel element
    const findCarousel = () => {
      const carouselEl = document.querySelector('.lk-carousel[data-lk-orientation="horizontal"]') as HTMLElement;
      setCarousel(carouselEl);
      return carouselEl;
    };

    // Initial search
    let carouselEl = findCarousel();

    // If not found, set up observer to detect when it appears
    if (!carouselEl) {
      const observer = new MutationObserver(() => {
        carouselEl = findCarousel();
        if (carouselEl) {
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      return () => observer.disconnect();
    }
  }, []);

  // Check scroll position and update button states
  const updateScrollButtons = React.useCallback(() => {
    if (!carousel) return;

    const { scrollLeft, scrollWidth, clientWidth } = carousel;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5); // 5px tolerance
  }, [carousel]);

  // Listen for scroll events and resize
  useEffect(() => {
    if (!carousel) return;

    updateScrollButtons();

    carousel.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);

    // Also watch for DOM changes (new participants)
    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(carousel);

    return () => {
      carousel.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
      resizeObserver.disconnect();
    };
  }, [carousel, updateScrollButtons]);

  const scrollLeft = () => {
    if (!carousel) return;
    const scrollAmount = carousel.clientWidth * 0.8; // Scroll 80% of visible width
    carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (!carousel) return;
    const scrollAmount = carousel.clientWidth * 0.8;
    carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  // Don't render if carousel not found or doesn't need scrolling
  if (!carousel || (!canScrollLeft && !canScrollRight)) {
    return null;
  }

  return (
    <>
      {canScrollLeft && (
        <button
          className={`${styles.carouselNavButton} ${styles.carouselNavLeft}`}
          onClick={scrollLeft}
          aria-label="Scroll carousel left"
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 18l-6-6 6-6"
            />
          </svg>
        </button>
      )}
      {canScrollRight && (
        <button
          className={`${styles.carouselNavButton} ${styles.carouselNavRight}`}
          onClick={scrollRight}
          aria-label="Scroll carousel right"
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 18l6-6-6-6"
            />
          </svg>
        </button>
      )}
    </>
  );
}



