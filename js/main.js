// ══════════════════════════════════════════
// MAIN — Boot · Navigation · Gestures
// ══════════════════════════════════════════

const TABS = ['run', 'drills', 'build'];

function switchTab(name) {
  TABS.forEach(t => {
    const view = document.getElementById('view' + cap(t));
    const tab  = document.getElementById('tab-' + t);
    if (view) view.classList.remove('active');
    if (tab)  tab.classList.remove('active');
  });

  const view = document.getElementById('view' + cap(name));
  const tab  = document.getElementById('tab-' + name);
  if (view) view.classList.add('active');
  if (tab)  tab.classList.add('active');

  if (name === 'drills') renderDrillList();
  if (name === 'build')  renderBuild();
  if (name === 'run')    refreshRunUI();
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Swipe-to-change-tab ───────────────────
(function initSwipe() {
  const main = document.getElementById('appMain');
  if (!main) return;

  let startX = 0;
  let startY = 0;
  let moved  = false;

  main.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved  = false;
  }, { passive: true });

  main.addEventListener('touchmove', e => {
    moved = true;
  }, { passive: true });

  main.addEventListener('touchend', e => {
    if (!moved) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // Only handle horizontal swipes
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;

    // Find current tab index
    const activeTab = TABS.findIndex(t =>
      document.getElementById('tab-' + t)?.classList.contains('active')
    );
    if (activeTab === -1) return;

    const next = dx < 0
      ? Math.min(activeTab + 1, TABS.length - 1)
      : Math.max(activeTab - 1, 0);

    if (next !== activeTab) switchTab(TABS[next]);
  }, { passive: true });
})();

// ── Boot ──────────────────────────────────
loadData();
refreshRunUI();
