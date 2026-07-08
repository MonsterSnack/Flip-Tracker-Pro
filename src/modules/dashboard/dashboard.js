const FlipTrackerProDashboard = (() => {
  function formatMoney(value) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  }

  function formatPercent(value) {
    return `${(Number(value) || 0).toFixed(1)}%`;
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

  function renderRecentFlips({ flips = [] } = {}) {
    const recentFlips = flips.slice(0, 3);
    const recentHtml = recentFlips.length > 0
      ? `<ul class="ftp-flip-list">${recentFlips.map(createRecentFlip).join('')}</ul>`
      : '<p>No flips saved yet. Add your first flip below.</p>';

    return `
      <section class="ftp-card">
        <h2>Recent Flips</h2>
        ${recentHtml}
      </section>
    `;
  }

  function render({ openSummary, portfolioSummary, statistics, summary } = {}) {
    const resolvedSummary = summary || {
      activeFlips: 0,
      successRate: 0,
      totalProfit: 0,
      totalQuantity: 0
    };
    const resolvedOpenSummary = openSummary || {
      openCount: 0,
      openQuantity: 0,
      totalInvested: 0
    };
    const resolvedPortfolioSummary = portfolioSummary || {
      estimatedProfit: 0,
      itemCount: 0,
      openQuantity: resolvedOpenSummary.openQuantity,
      totalInvestment: resolvedOpenSummary.totalInvested
    };
    const resolvedStatistics = statistics || {
      averageROI: 0,
      lifetimeProfit: resolvedSummary.totalProfit,
      monthlyProfit: 0,
      todayProfit: 0,
      totalTrades: resolvedSummary.activeFlips,
      weeklyProfit: 0
    };
    const stats = [
      createStat('Lifetime profit', formatMoney(resolvedStatistics.lifetimeProfit)),
      createStat('Today profit', formatMoney(resolvedStatistics.todayProfit)),
      createStat('Open items', String(resolvedPortfolioSummary.openQuantity)),
      createStat('Invested', formatMoney(resolvedPortfolioSummary.totalInvestment)),
      createStat('Trades', String(resolvedStatistics.totalTrades)),
      createStat('Average ROI', formatPercent(resolvedStatistics.averageROI))
    ].join('');

    return `
      <section class="ftp-card">
        <h2>Dashboard</h2>
        <p>Your portfolio, sales, and profit stats update as you add entries.</p>
      </section>

      <section class="ftp-stats" aria-label="Trading summary">
        ${stats}
      </section>

      <section class="ftp-card">
        <h2>This Month</h2>
        <p>Weekly profit ${formatMoney(resolvedStatistics.weeklyProfit)} / Monthly profit ${formatMoney(resolvedStatistics.monthlyProfit)} / Estimated open profit ${formatMoney(resolvedPortfolioSummary.estimatedProfit)}</p>
      </section>
    `;
  }

  return {
    render,
    renderRecentFlips
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProDashboard = FlipTrackerProDashboard;
}
