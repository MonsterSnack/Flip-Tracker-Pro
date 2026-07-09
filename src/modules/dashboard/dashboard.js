const FlipTrackerProDashboard = (() => {
  function escapeHtml(value) {
    return window.FlipTrackerProHtml && typeof window.FlipTrackerProHtml.escapeHtml === 'function'
      ? window.FlipTrackerProHtml.escapeHtml(value)
      : String(value ?? '');
  }

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

  function getSaleProfit(sale) {
    return Number(sale.netProfit ?? sale.profit) || 0;
  }

  function createStat(label, value) {
    return `
      <div class="ftp-stat">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function createRecentSale(sale) {
    const profit = getSaleProfit(sale);

    return `
      <li class="ftp-flip-row">
        <span>${escapeHtml(sale.itemName || 'Unnamed item')}</span>
        <strong data-profit-state="${profit >= 0 ? 'positive' : 'negative'}">${formatMoney(profit)}</strong>
      </li>
    `;
  }

  function renderRecentFlips({ flips = [], sales = flips } = {}) {
    const recentSales = sales.slice(0, 3);
    const recentHtml = recentSales.length > 0
      ? `<ul class="ftp-flip-list">${recentSales.map(createRecentSale).join('')}</ul>`
      : '<p>No flips saved yet. Add your first flip below.</p>';

    return `
      <section class="ftp-card">
        <h2>Recent Flips</h2>
        ${recentHtml}
      </section>
    `;
  }

  function render({ openSummary, portfolioSummary, settings = {}, statistics, summary } = {}) {
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
      currentEstimatedProfit: 0,
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
    const apiImportWarning = settings.apiEnabled && !settings.logImportLastRunAt
      ? '<section class="ftp-card"><h2>Import Reminder</h2><p>API connected. Run log import to automatically add purchases and sales.</p></section>'
      : '';
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

      ${apiImportWarning}

      <section class="ftp-stats" aria-label="Trading summary">
        ${stats}
      </section>

      <section class="ftp-card">
        <h2>This Month</h2>
        <p>Weekly profit ${formatMoney(resolvedStatistics.weeklyProfit)} / Monthly profit ${formatMoney(resolvedStatistics.monthlyProfit)} / Estimated open profit ${formatMoney(resolvedPortfolioSummary.estimatedProfit)} / Live estimate ${formatMoney(resolvedPortfolioSummary.currentEstimatedProfit)}</p>
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
