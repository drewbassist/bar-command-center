/* Model Essays study guide pop-ups. Independent of existing checkbox and cloud tracking. */
(() => {
  const guides = { 'essay-model-civil-procedure-1': 'study-guides/civil-procedure-1.html', 'essay-model-wills-trusts-1': 'study-guides/wills-trusts-1.html' };
  const modal = document.getElementById('model-essay-guide-modal');
  const frame = document.getElementById('model-essay-guide-frame');
  const empty = document.getElementById('model-essay-guide-empty');
  const title = document.getElementById('model-essay-guide-title');
  const close = document.getElementById('model-essay-guide-close');
  let priorFocus = null;
  function hide() { modal.hidden = true; frame.removeAttribute('src'); document.body.classList.remove('model-essay-modal-open'); if (priorFocus) priorFocus.focus(); }
  document.querySelectorAll('.model-essay-guide-link').forEach(button => {
    button.addEventListener('click', () => {
      priorFocus = button;
      const cell = button.closest('td');
      const subject = cell?.closest('tr')?.querySelector('th')?.textContent?.trim() || 'Essay';
      const number = Array.from(cell?.parentElement?.children || []).indexOf(cell);
      title.textContent = subject + ' · Essay ' + number;
      const path = guides[button.dataset.studyGuide];
      frame.hidden = !path; empty.hidden = !!path;
      if (path) frame.src = path; else frame.removeAttribute('src');
      modal.hidden = false; document.body.classList.add('model-essay-modal-open'); close.focus();
    });
  });
  close.addEventListener('click', hide);
  modal.addEventListener('click', e => { if (e.target === modal) hide(); });
  document.addEventListener('keydown', e => { if (!modal.hidden && e.key === 'Escape') hide(); });
})();
