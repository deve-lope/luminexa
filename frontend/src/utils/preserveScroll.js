/**
 * Capture / restore window (and nested) scroll so month changes don't jump the page.
 */

export function captureScrollSnapshot(rootEl) {
  const modalSheet = document.querySelector('.lx-modal-sheet');
  let scrollParent = rootEl;
  while (scrollParent && scrollParent !== document.body && scrollParent !== document.documentElement) {
    const style = window.getComputedStyle(scrollParent);
    const scrollable =
      (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') &&
      scrollParent.scrollHeight > scrollParent.clientHeight + 1;
    if (scrollable) break;
    scrollParent = scrollParent.parentElement;
  }
  if (
    !scrollParent ||
    scrollParent === document.body ||
    scrollParent === document.documentElement
  ) {
    scrollParent = null;
  }
  return {
    windowY: window.scrollY || document.documentElement.scrollTop || 0,
    modalSheetTop: modalSheet?.scrollTop ?? null,
    parent: scrollParent,
    parentTop: scrollParent?.scrollTop ?? null,
  };
}

export function restoreScrollSnapshot(snapshot) {
  if (!snapshot) return;
  window.scrollTo({ top: snapshot.windowY, left: 0, behavior: 'auto' });
  if (snapshot.modalSheetTop != null) {
    const modalSheet = document.querySelector('.lx-modal-sheet');
    if (modalSheet) modalSheet.scrollTop = snapshot.modalSheetTop;
  }
  if (snapshot.parent && snapshot.parentTop != null) {
    snapshot.parent.scrollTop = snapshot.parentTop;
  }
}
