const FlipTrackerProDashboard = (() => {
  function formatMoney(value) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  }

  function createStat(label, value) {
    return `
      <div class="ftp-stat">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `;
  }

  function createRecentFlip(flip) {
    return `
      <li class="ftp-flip-row">
        <span>${flip.itemName || 'Unnamed item'}</span>
        <strong data-profit-state="${flip.profit >= 0 ? 'positive' : 'negative'}">${formatMoney(flip.profit)}</strong>
      </li>
    `;
  }

  function render({ flips = [], summary } = {}) {
    const resolvedSummary = summary || {
      activeFlips: 0,
      successRate: 0,
      totalProfit: 0,
      totalQuantity: 0
    };
    const recentFlips = flips.slice(0, 3);
    const stats = [
      createStat('Total profit', formatMoney(resolvedSummary.totalProfit)),
      createStat('Saved flips', String(resolvedSummary.activeFlips)),
      createStat('Items tracked', String(resolvedSummary.totalQuantity)),
      createStat('Win rate', `${resolvedSummary.successRate.toFixed(0)}%`)
    ].join('');
    const recentHtml = recentFlips.length > 0
      ? `<ul class="ftp-flip-list">${recentFlips.map(createRecentFlip).join('')}</ul>`
      : '<p>No flips saved yet. Add your first flip below.</p>';

    return `
      <section class="ftp-card">
        <h2>Dashboard</h2>
        <p>Your saved flip summary updates when you add entries.</p>
      </section>

      <section class="ftp-stats" aria-label="Trading summary">
        ${stats}
      </section>

      <section class="ftp-card">
        <h2>Recent Flips</h2>
        ${recentHtml}
      </section>
    `;
  }

  return {
    render
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProDashboard = FlipTrackerProDashboard;
}
