// Confirm before destructive actions: <a data-confirm="Delete this page?">
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-confirm]');
  if (el && !window.confirm(el.dataset.confirm)) e.preventDefault();
});

// Copy a value: <button data-copy="#some-id">
// navigator.clipboard only works on https:// or localhost, so when the site is opened
// as http://192.168.x.x:8000 we fall back to selecting the text and using execCommand.
function copyText(node) {
  const text = node.textContent.trim();
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const range = document.createRange();
    range.selectNodeContents(node);                 // select the text that is already on screen
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    if (ok) { sel.removeAllRanges(); resolve(); } else { reject(new Error('copy failed')); }
  });
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const src = document.querySelector(btn.dataset.copy);
  if (!src) return;
  const old = btn.dataset.label || btn.textContent;
  btn.dataset.label = old;
  try {
    await copyText(src);
    btn.textContent = 'Copied ♥';
  } catch (_) {
    btn.textContent = 'Press Ctrl+C';               // text is selected, user can copy by hand
  }
  setTimeout(() => { btn.textContent = old; }, 1800);
});

// Dialogs: <button data-open-dialog="#id">, <button data-close-dialog>, click backdrop to close
document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open-dialog]');
  if (open) {
    const d = document.querySelector(open.dataset.openDialog);
    if (d && d.showModal) d.showModal();
    return;
  }
  if (e.target.closest('[data-close-dialog]')) {
    e.target.closest('dialog').close();
    return;
  }
  if (e.target.tagName === 'DIALOG') e.target.close();   // backdrop click
});