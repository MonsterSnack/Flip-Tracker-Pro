const FlipTrackerProDashboard = (() => {
  function createStat(label, value) {
    return `
      <div class="ftp-stat">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `;
  }

  function render() {
    const stats = [
      createStat('Total profit', '$0'),
      createStat('Active flips', '0'),
      createStat('Items tracked', '0'),
      createStat('Success rate', '0%')
    ].join('');

    return `
      <section class="ftp-card">
        <h2>Dashboard</h2>
        <p>Your flip tracking workspace is ready. The next step is adding real flip data and calculations.</p>
      </section>

      <section class="ftp-stats" aria-label="Trading summary">
        ${stats}
      </section>

      <section class="ftp-card">
        <h2>Next Feature</h2>
        <p>Add the first flip entry form so purchases, sale prices, fees, and profit can be tracked.</p>
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
