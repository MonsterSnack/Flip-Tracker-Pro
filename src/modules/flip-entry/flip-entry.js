const FlipTrackerProFlipEntry = (() => {
  function parseMoney(value) {
    const parsedValue = Number.parseFloat(String(value || '').replace(/,/g, ''));
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  function parseQuantity(value) {
    const parsedValue = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 1;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  function calculateProfit(form) {
    const quantity = parseQuantity(form.quantity.value);
    const buyPrice = parseMoney(form.buyPrice.value);
    const sellPrice = parseMoney(form.sellPrice.value);
    const fees = parseMoney(form.fees.value);
    const totalBuy = buyPrice * quantity;
    const totalSell = sellPrice * quantity;
    const profit = totalSell - totalBuy - fees;
    const margin = totalBuy > 0 ? (profit / totalBuy) * 100 : 0;

    return {
      fees,
      margin,
      profit,
      quantity,
      totalBuy,
      totalSell
    };
  }

  function render() {
    return `
      <section class="ftp-card">
        <h2>Add Flip</h2>
        <form class="ftp-form" data-flip-entry-form>
          <label class="ftp-field">
            <span>Item</span>
            <input class="ftp-input" name="itemName" type="text" placeholder="Item name" autocomplete="off">
          </label>

          <div class="ftp-form-grid">
            <label class="ftp-field">
              <span>Buy</span>
              <input class="ftp-input" name="buyPrice" type="number" min="0" step="1" placeholder="0">
            </label>

            <label class="ftp-field">
              <span>Sell</span>
              <input class="ftp-input" name="sellPrice" type="number" min="0" step="1" placeholder="0">
            </label>
          </div>

          <div class="ftp-form-grid">
            <label class="ftp-field">
              <span>Qty</span>
              <input class="ftp-input" name="quantity" type="number" min="1" step="1" value="1">
            </label>

            <label class="ftp-field">
              <span>Fees</span>
              <input class="ftp-input" name="fees" type="number" min="0" step="1" placeholder="0">
            </label>
          </div>

          <div class="ftp-profit-preview" data-profit-preview>
            <span>Estimated profit</span>
            <strong>$0</strong>
            <small>Margin 0%</small>
          </div>

          <button class="ftp-primary-button" type="submit">Add flip</button>
        </form>
      </section>
    `;
  }

  function bind(root) {
    const form = root.querySelector('[data-flip-entry-form]');

    if (!form) {
      return;
    }

    const preview = form.querySelector('[data-profit-preview]');
    const previewValue = preview.querySelector('strong');
    const previewMeta = preview.querySelector('small');

    function updatePreview() {
      const result = calculateProfit(form.elements);
      previewValue.textContent = formatMoney(result.profit);
      previewValue.dataset.profitState = result.profit >= 0 ? 'positive' : 'negative';
      previewMeta.textContent = `Margin ${result.margin.toFixed(1)}%`;
    }

    form.addEventListener('input', updatePreview);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      updatePreview();
    });

    updatePreview();
  }

  return {
    bind,
    render
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProFlipEntry = FlipTrackerProFlipEntry;
}
