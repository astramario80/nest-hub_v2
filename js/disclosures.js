// One interaction model for pointer, keyboard, and touch; collapsed links are not tabbable.
document.querySelectorAll('.disclosure').forEach((panel, index) => {
  const button = panel.querySelector(':scope > button');
  const content = button.nextElementSibling;
  if (!content.id) content.id = `disclosure-${index}`;
  button.setAttribute('aria-controls', content.id);
  let pinned = false;
  let pointerDown = false;
  const setOpen = open => {
    panel.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    const indicator = button.querySelector('[aria-hidden]');
    if (indicator) indicator.textContent = open ? '−' : '＋';
    content.hidden = !open;
    if (open) panel.dispatchEvent(new CustomEvent('disclosureopen'));
  };
  setOpen(false);
  button.addEventListener('pointerdown', () => { pointerDown = true; });
  button.addEventListener('click', () => {
    pinned = !pinned;
    setOpen(pinned);
    pointerDown = false;
  });
  panel.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') setOpen(true);
  });
  panel.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse' && !pinned && !panel.contains(document.activeElement)) setOpen(false);
  });
  panel.addEventListener('focusin', () => { if (!pointerDown) setOpen(true); });
  panel.addEventListener('focusout', event => {
    if (!panel.contains(event.relatedTarget)) { pinned = false; setOpen(false); }
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      button.focus();
      pinned = false;
      setOpen(false);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!panel.contains(event.target)) { pinned = false; setOpen(false); }
  });
});
