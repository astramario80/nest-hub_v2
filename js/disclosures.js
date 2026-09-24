// One interaction model for pointer, keyboard, and touch; collapsed links are not tabbable.
document.querySelectorAll('.disclosure').forEach((panel, index) => {
  const button = panel.querySelector(':scope > button');
  const content = button.nextElementSibling;
  if (!content.id) content.id = `disclosure-${index}`;
  button.setAttribute('aria-controls', content.id);
  const gear = panel.closest('.gear-panel');
  let closeTimer, motion;
  const cancelClose = () => clearTimeout(closeTimer);
  let pinned = false;
  let pointerDown = false;
  const setOpen = open => {
    cancelClose();
    const changed = panel.classList.contains('is-open') !== open;
    const fromHeight = content.hidden ? 0 : content.getBoundingClientRect().height;
    if (motion) { motion.cancel(); motion = null; }
    panel.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    const indicator = button.querySelector('[aria-hidden]');
    if (indicator) indicator.textContent = open ? '−' : '＋';
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (gear && changed && content.animate && !reduced) {
      content.hidden = false;
      content.inert = !open;
      content.style.overflow = 'hidden';
      const animation = content.animate([{height:fromHeight+'px',opacity:open?0:1},{height:(open?content.scrollHeight:0)+'px',opacity:open?1:0}],{duration:750,easing:'ease-in-out'});
      motion = animation;
      animation.finished.then(() => {
        if (motion !== animation) return;
        motion = null; content.hidden = !open; content.style.overflow = '';
      }).catch(() => {});
    } else { content.hidden = !open; content.inert = !open; content.style.overflow = ''; }
    if (open) panel.dispatchEvent(new CustomEvent('disclosureopen'));
    else if (panel === gear) panel.querySelectorAll('.disclosure').forEach(child => child.dispatchEvent(new CustomEvent('disclosurecollapse')));
  };
  panel.addEventListener('disclosurecollapse', () => { pinned = false; setOpen(false); });
  setOpen(false);
  button.addEventListener('pointerdown', () => { pointerDown = true; });
  button.addEventListener('click', () => {
    pinned = !pinned;
    setOpen(pinned);
    pointerDown = false;
  });
  panel.addEventListener('pointerenter', event => {
    if (gear && panel !== gear) return;
    if (event.pointerType === 'mouse') { cancelClose(); setOpen(true); }
  });
  panel.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse' || pinned || panel.contains(document.activeElement)) return;
    // Keep expanded submenus stable while moving anywhere within their gear.
    if (gear && panel !== gear) return;
    if (gear) closeTimer = setTimeout(() => { if (!pinned && !panel.contains(document.activeElement)) setOpen(false); }, 1100);
    else setOpen(false);
  });
  panel.addEventListener('focusin', () => { if (!pointerDown && (!gear || panel === gear)) setOpen(true); });
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
