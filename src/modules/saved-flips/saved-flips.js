const FlipTrackerProSavedFlips = (() => {
  function formatMoney(value) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  }

  function renderFlip(flip) {
    const profitState = flip.profit >= 0 ? 'positive' : 'negative';

    return `
      <li class="ftp-saved-flip" data-flip-id="${flip.id}">
        <div class="ftp-saved-flip-main">
          <strong>${flip.itemName || 'Unnamed item'}</strong>
          <span>Buy ${formatMoney(flip.buyPrice)} / Sell ${formatMoney(flip.sellPrice)} / Qty ${flip.quantity || 1}</span>
          <span>Fees ${formatMoney(flip.fees)} / Margin ${(Number(flip.margin) || 0).toFixed(1)}%</span>
        </div>

        <div class="ftp-saved-flip-side">
          <strong data-profit-state="${profitState}">${formatMoney(flip.profit)}</strong>
          <button class="ftp-danger-button" type="button" data-delete-flip="${flip.id}">Delete</button>
        </div>
      </li>
    `;
  }

  function render({ flips = [] } = {}) {
    const listHtml = flips.length > 0
      ? `<ul class="ftp-saved-flips">${flips.map(renderFlip).join('')}</ul>`
      : '<p>No saved flips yet.</p>';

    return `
      <section class="ftp-card">
        <h2>Saved Flips</h2>
        ${listHtml}
      </section>
    `;
  }

  function bind(root, { onDelete, storagePrefix, store } = {}) {
    root.querySelectorAll('[data-delete-flip]').forEach((button) => {
      button.addEventListener('click', () => {
        const flipId = button.dataset.deleteFlip;

        if (store && typeof store.remove === 'function') {
          store.remove(storagePrefix, flipId);
        }

        if (typeof onDelete === 'function') {
          onDelete();
        }
      });
    });
  }

  return {
    bind,
    render
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProSavedFlips = FlipTrackerProSavedFlips;
}
