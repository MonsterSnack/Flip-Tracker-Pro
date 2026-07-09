const FlipTrackerProAnalytics = (() => {
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

  function getSaleRoi(sale) {
    return Number(sale.roi ?? sale.margin) || 0;
  }

  function getDateKey(sale) {
    const date = new Date(sale.soldAt || sale.updatedAt || sale.createdAt || Date.now());
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toISOString().slice(0, 10);
  }

  function groupProfitByDay(sales) {
    const grouped = sales.reduce((totals, sale) => {
      const dateKey = getDateKey(sale);
      totals[dateKey] = (totals[dateKey] || 0) + getSaleProfit(sale);
      return totals;
    }, {});

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => left.label.localeCompare(right.label))
      .slice(-7);
  }

  function groupProfitByItem(sales) {
    const grouped = sales.reduce((totals, sale) => {
      const itemName = sale.itemName || 'Unnamed item';

      if (!totals[itemName]) {
        totals[itemName] = 0;
      }

      totals[itemName] += getSaleProfit(sale);
      return totals;
    }, {});

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);
  }

  function getAverageProfit(sales) {
    if (sales.length === 0) {
      return 0;
    }

    return sales.reduce((total, sale) => total + getSaleProfit(sale), 0) / sales.length;
  }

  function getAverageMargin(sales) {
    if (sales.length === 0) {
      return 0;
    }

    return sales.reduce((total, sale) => total + getSaleRoi(sale), 0) / sales.length;
  }

  function renderStat(label, value) {
    return `
      <div class="ftp-stat">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderBarGraph(title, rows) {
    if (rows.length === 0) {
      return `
        <section class="ftp-card">
          <h2>${escapeHtml(title)}</h2>
          <p>No completed flips yet.</p>
        </section>
      `;
    }

    const maxValue = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
    const bars = rows.map((row) => {
      const width = Math.max((Math.abs(row.value) / maxValue) * 100, 4);
      const state = row.value >= 0 ? 'positive' : 'negative';

      return `
        <li class="ftp-chart-row">
          <div class="ftp-chart-label">
            <span>${escapeHtml(row.label)}</span>
            <strong data-profit-state="${state}">${formatMoney(row.value)}</strong>
          </div>
          <div class="ftp-chart-track">
            <span class="ftp-chart-bar" data-profit-state="${state}" style="width: ${width}%"></span>
          </div>
        </li>
      `;
    }).join('');

    return `
      <section class="ftp-card">
        <h2>${escapeHtml(title)}</h2>
        <ul class="ftp-chart-list">
          ${bars}
        </ul>
      </section>
    `;
  }

  function render({ flips = [], sales = flips, statistics } = {}) {
    const bestFlip = statistics && statistics.bestFlip ? statistics.bestFlip : null;
    const worstFlip = statistics && statistics.worstFlip ? statistics.worstFlip : null;
    const bestItem = groupProfitByItem(sales)[0] || null;
    const stats = [
      renderStat('Average profit', formatMoney(getAverageProfit(sales))),
      renderStat('Average ROI', formatPercent(getAverageMargin(sales))),
      renderStat('Overall ROI', formatPercent(statistics ? statistics.averageROI : 0)),
      renderStat('Best flip', bestFlip ? `${bestFlip.itemName || 'Unnamed'} ${formatMoney(getSaleProfit(bestFlip))}` : '$0'),
      renderStat('Worst flip', worstFlip ? `${worstFlip.itemName || 'Unnamed'} ${formatMoney(getSaleProfit(worstFlip))}` : '$0'),
      renderStat('Best item', bestItem ? `${bestItem.label} ${formatMoney(bestItem.value)}` : '$0')
    ].join('');

    return `
      <section class="ftp-card">
        <h2>Analytics</h2>
        <p>Graphs and averages from your completed flips.</p>
      </section>

      <section class="ftp-stats ftp-analytics-stats" aria-label="Analytics summary">
        ${stats}
      </section>

      ${renderBarGraph('Profit By Day', groupProfitByDay(sales))}
      ${renderBarGraph('Best Items', groupProfitByItem(sales))}
    `;
  }

  return {
    render
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProAnalytics = FlipTrackerProAnalytics;
}
