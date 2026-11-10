import { useEffect, type RefObject } from 'react';

// Safari can resize only the visual viewport when its keyboard opens. Keep
// the full-screen picker and confirmation footer above that keyboard. Browsers
// honoring interactive-widget=resizes-content already resize the CSS viewport.
export function useKeyboardViewport(frameRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    function update() {
      const frame = frameRef.current;
      if (!frame || !viewport) return;
      const keyboardVisible = window.innerWidth <= 820 && Math.abs(viewport.scale - 1) < .01 &&
        document.documentElement.clientHeight - viewport.height > 80;
      if (keyboardVisible) {
        frame.style.setProperty('--keyboard-height', `${viewport.height}px`);
        frame.style.setProperty('--keyboard-top', `${viewport.offsetTop}px`);
      } else {
        frame.style.removeProperty('--keyboard-height');
        frame.style.removeProperty('--keyboard-top');
      }
    }
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      frameRef.current?.style.removeProperty('--keyboard-height');
      frameRef.current?.style.removeProperty('--keyboard-top');
    };
  }, [frameRef]);
}
