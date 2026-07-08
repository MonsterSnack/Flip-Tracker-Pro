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
      buyPrice,
      fees,
      margin,
      profit,
      quantity,
      sellPrice,
      totalBuy,
      totalSell
    };
  }

  function render() {
    return `
      <section class="ftp-card">
        <h2 data-flip-entry-title>Add Flip</h2>
        <form class="ftp-form" data-flip-entry-form>
          <input name="flipId" type="hidden">

          <label class="ftp-field">
            <span>Item</span>
            <input class="ftp-input" name="itemName" type="text" placeholder="Item name" autocomplete="off" required>
          </label>

          <div class="ftp-form-grid">
            <label class="ftp-field">
              <span>Buy</span>
              <input class="ftp-input" name="buyPrice" type="number" min="0" step="1" placeholder="0" required>
            </label>

            <label class="ftp-field">
              <span>Sell</span>
              <input class="ftp-input" name="sellPrice" type="number" min="0" step="1" placeholder="0" required>
            </label>
          </div>

          <div class="ftp-form-grid">
            <label class="ftp-field">
              <span>Qty</span>
              <input class="ftp-input" name="quantity" type="number" min="1" step="1" value="1" required>
            </label>

            <label class="ftp-field">
              <span>Fees</span>
              <input class="ftp-input" name="fees" type="number" min="0" step="1" placeholder="0">
            </label>
          </div>

          <label class="ftp-field">
            <span>Notes</span>
            <input class="ftp-input" name="notes" type="text" placeholder="Optional notes" autocomplete="off">
          </label>

          <div class="ftp-profit-preview" data-profit-preview>
            <span>Estimated profit</span>
            <strong>$0</strong>
            <small>Margin 0%</small>
          </div>

          <div class="ftp-form-actions">
            <button class="ftp-primary-button" type="submit" data-flip-submit-button>Add flip</button>
            <button class="ftp-secondary-button" type="button" data-flip-cancel-edit hidden>Cancel</button>
          </div>
        </form>
      </section>
    `;
  }

  function bind(root, { onSave, storagePrefix, store } = {}) {
    const form = root.querySelector('[data-flip-entry-form]');

    if (!form) {
      return;
    }

    const card = form.closest('.ftp-card');
    const title = card.querySelector('[data-flip-entry-title]');
    const submitButton = form.querySelector('[data-flip-submit-button]');
    const cancelEditButton = form.querySelector('[data-flip-cancel-edit]');
    const preview = form.querySelector('[data-profit-preview]');
    const previewValue = preview.querySelector('strong');
    const previewMeta = preview.querySelector('small');

    function resetFormMode() {
      form.reset();
      form.elements.flipId.value = '';
      form.elements.quantity.value = '1';
      title.textContent = 'Add Flip';
      submitButton.textContent = 'Add flip';
      cancelEditButton.hidden = true;
      updatePreview();
    }

    function updatePreview() {
      const result = calculateProfit(form.elements);
      previewValue.textContent = formatMoney(result.profit);
      previewValue.dataset.profitState = result.profit >= 0 ? 'positive' : 'negative';
      previewMeta.textContent = `Margin ${result.margin.toFixed(1)}%`;
      return result;
    }

    form.loadFlip = (flip) => {
      form.elements.flipId.value = flip.id;
      form.elements.itemName.value = flip.itemName || '';
      form.elements.buyPrice.value = flip.buyPrice || 0;
      form.elements.sellPrice.value = flip.sellPrice || 0;
      form.elements.quantity.value = flip.quantity || 1;
      form.elements.fees.value = flip.fees || 0;
      form.elements.notes.value = flip.notes || '';
      title.textContent = 'Edit Flip';
      submitButton.textContent = 'Update flip';
      cancelEditButton.hidden = false;
      updatePreview();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    cancelEditButton.addEventListener('click', resetFormMode);
    form.addEventListener('input', updatePreview);
    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      const result = updatePreview();
      const flip = {
        ...result,
        itemName: form.elements.itemName.value.trim(),
        notes: form.elements.notes.value.trim()
      };
      const flipId = form.elements.flipId.value;

      if (flipId && store && typeof store.update === 'function') {
        store.update(storagePrefix, flipId, flip);
      } else if (store && typeof store.add === 'function') {
        store.add(storagePrefix, flip);
      }

      resetFormMode();

      if (typeof onSave === 'function') {
        onSave();
      }
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
