import { useLayoutEffect, type RefObject } from 'react';

export function useModalFocus(panelRef: RefObject<HTMLElement | null>, isOpen: boolean, initialFocus = '.close', returnFocus?: string) {
  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(initialFocus)?.focus({ preventScroll: true });
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !panel) return;
      const controls = Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), select:not(:disabled), textarea:not(:disabled), input:not(:disabled), summary, [tabindex="0"]'))
        .filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); first?.focus();
      }
    }
    panel?.addEventListener('keydown', trapFocus);
    return () => {
      panel?.removeEventListener('keydown', trapFocus);
      // An unmount cleanup runs before React removes inert from the app.
      // Restore after the commit, and avoid stealing focus from another modal.
      queueMicrotask(() => {
        const target = returnFocus ? document.querySelector<HTMLElement>(returnFocus) : trigger?.isConnected ? trigger : document.querySelector<HTMLElement>('.view');
        if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
      });
    };
  }, [isOpen, panelRef, initialFocus, returnFocus]);
}
