const FlipTrackerProAnalytics = (() => {
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

  function getDateKey(flip) {
    const date = new Date(flip.updatedAt || flip.createdAt || Date.now());
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toISOString().slice(0, 10);
  }

  function groupProfitByDay(flips) {
    const grouped = flips.reduce((totals, flip) => {
      const dateKey = getDateKey(flip);
      totals[dateKey] = (totals[dateKey] || 0) + (Number(flip.profit) || 0);
      return totals;
    }, {});

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => left.label.localeCompare(right.label))
      .slice(-7);
  }

  function groupProfitByItem(flips) {
    const grouped = flips.reduce((totals, flip) => {
      const itemName = flip.itemName || 'Unnamed item';

      if (!totals[itemName]) {
        totals[itemName] = 0;
      }

      totals[itemName] += Number(flip.profit) || 0;
      return totals;
    }, {});

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);
  }

  function getBestFlip(flips) {
    return flips.reduce((best, flip) => {
      if (!best || (Number(flip.profit) || 0) > (Number(best.profit) || 0)) {
        return flip;
      }

      return best;
    }, null);
  }

  function getWorstFlip(flips) {
    return flips.reduce((worst, flip) => {
      if (!worst || (Number(flip.profit) || 0) < (Number(worst.profit) || 0)) {
        return flip;
      }

      return worst;
    }, null);
  }

  function getAverageProfit(flips) {
    if (flips.length === 0) {
      return 0;
    }

    return flips.reduce((total, flip) => total + (Number(flip.profit) || 0), 0) / flips.length;
  }

  function getAverageMargin(flips) {
    if (flips.length === 0) {
      return 0;
    }

    return flips.reduce((total, flip) => total + (Number(flip.margin) || 0), 0) / flips.length;
  }

  function renderStat(label, value) {
    return `
      <div class="ftp-stat">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `;
  }

  function renderBarGraph(title, rows) {
    if (rows.length === 0) {
      return `
        <section class="ftp-card">
          <h2>${title}</h2>
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
            <span>${row.label}</span>
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
        <h2>${title}</h2>
        <ul class="ftp-chart-list">
          ${bars}
        </ul>
      </section>
    `;
  }

  function render({ flips = [] } = {}) {
    const bestFlip = getBestFlip(flips);
    const worstFlip = getWorstFlip(flips);
    const bestItem = groupProfitByItem(flips)[0] || null;
    const stats = [
      renderStat('Average profit', formatMoney(getAverageProfit(flips))),
      renderStat('Average margin', formatPercent(getAverageMargin(flips))),
      renderStat('Best flip', bestFlip ? `${bestFlip.itemName || 'Unnamed'} ${formatMoney(bestFlip.profit)}` : '$0'),
      renderStat('Worst flip', worstFlip ? `${worstFlip.itemName || 'Unnamed'} ${formatMoney(worstFlip.profit)}` : '$0'),
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

      ${renderBarGraph('Profit By Day', groupProfitByDay(flips))}
      ${renderBarGraph('Best Items', groupProfitByItem(flips))}
    `;
  }

  return {
    render
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProAnalytics = FlipTrackerProAnalytics;
}
