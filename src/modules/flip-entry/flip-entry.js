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
    }).format(value || 0);
  }

  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function getAccountingService() {
    return window.FlipTrackerProTradeAccountingService;
  }

  function getAppData(storagePrefix) {
    const storageService = getStorageService();
    return storageService && typeof storageService.load === 'function'
      ? storageService.load(storagePrefix)
      : { purchaseLots: [], settings: {} };
  }

  function getRemainingQuantity(lot) {
    const quantity = Number(lot.quantity) || 0;
    const remainingQuantity = lot.remainingQuantity === undefined ? quantity : Number(lot.remainingQuantity);
    return Math.max(0, Number.isFinite(remainingQuantity) ? remainingQuantity : quantity);
  }

  function getOpenHoldingQuantity(purchaseLots, itemName) {
    const targetName = String(itemName || '').trim().toLowerCase();

    if (!targetName) {
      return 0;
    }

    return purchaseLots.reduce((total, lot) => {
      const lotName = String(lot.itemName || '').trim().toLowerCase();
      return lotName === targetName ? total + getRemainingQuantity(lot) : total;
    }, 0);
  }

  function buildSaleDraft(form) {
    const feesValue = form.fees.value;
    const buyPrice = parseMoney(form.buyPrice.value);

    return {
      itemName: form.itemName.value.trim(),
      quantity: parseQuantity(form.quantity.value),
      unitSellPrice: parseMoney(form.sellPrice.value),
      fees: feesValue === '' ? undefined : parseMoney(feesValue),
      manualBuyCostOverride: Boolean(form.manualBuyCostOverride && form.manualBuyCostOverride.checked),
      buyPrice,
      source: 'manual',
      notes: form.notes.value.trim(),
      soldAt: new Date().toISOString()
    };
  }

  function createFallbackPreview(sale) {
    const totalSellPrice = sale.unitSellPrice * sale.quantity;
    return {
      ...sale,
      totalSellPrice,
      matchedQuantity: 0,
      unmatchedQuantity: sale.quantity,
      fifoBuyCost: 0,
      manualBuyCost: 0,
      matchedBuyCost: 0,
      grossProfit: totalSellPrice,
      fees: Number(sale.fees) || 0,
      netProfit: totalSellPrice - (Number(sale.fees) || 0),
      roi: 0,
      matchedLots: []
    };
  }

  function getSalePreview(storagePrefix, sale) {
    const accountingService = getAccountingService();
    const data = getAppData(storagePrefix);

    if (!accountingService || typeof accountingService.matchSale !== 'function') {
      return {
        holdingQuantity: getOpenHoldingQuantity(data.purchaseLots, sale.itemName),
        preview: createFallbackPreview(sale)
      };
    }

    return {
      holdingQuantity: getOpenHoldingQuantity(data.purchaseLots, sale.itemName),
      preview: accountingService.matchSale({
        purchaseLots: data.purchaseLots,
        sale,
        settings: data.settings
      })
    };
  }

  function render() {
    return `
      <section class="ftp-card">
        <h2 data-flip-entry-title>Record Sale</h2>
        <form class="ftp-form" data-flip-entry-form>
          <input name="flipId" type="hidden">

          <label class="ftp-field">
            <span>Item</span>
            <input class="ftp-input" name="itemName" type="text" placeholder="Item name" autocomplete="off" required>
          </label>

          <div class="ftp-form-grid">
            <label class="ftp-field">
              <span>Sell price</span>
              <input class="ftp-input" name="sellPrice" type="number" min="0" step="1" placeholder="0" required>
            </label>

            <label class="ftp-field">
              <span>Qty sold</span>
              <input class="ftp-input" name="quantity" type="number" min="1" step="1" value="1" required>
            </label>
          </div>

          <div class="ftp-form-grid">
            <label class="ftp-field">
              <span>Manual buy cost each</span>
              <input class="ftp-input" name="buyPrice" type="number" min="0" step="1" placeholder="Only for unmatched sales">
            </label>

            <label class="ftp-field">
              <span>Fees</span>
              <input class="ftp-input" name="fees" type="number" min="0" step="1" placeholder="Auto bazaar fee if blank">
            </label>
          </div>

          <label class="ftp-field">
            <span>Manual mode</span>
            <label><input name="manualBuyCostOverride" type="checkbox"> Use manual buy cost for any unmatched quantity</label>
          </label>

          <label class="ftp-field">
            <span>Notes</span>
            <input class="ftp-input" name="notes" type="text" placeholder="Optional notes" autocomplete="off">
          </label>

          <div class="ftp-profit-preview" data-profit-preview>
            <span>Sale preview</span>
            <strong>$0</strong>
            <small data-profit-preview-meta>ROI 0%</small>
            <small data-profit-preview-detail>Enter an item, quantity, and sell price.</small>
            <small data-profit-preview-warning></small>
          </div>

          <div class="ftp-form-actions">
            <button class="ftp-primary-button" type="submit" data-flip-submit-button>Record sale</button>
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
    const previewMeta = preview.querySelector('[data-profit-preview-meta]');
    const previewDetail = preview.querySelector('[data-profit-preview-detail]');
    const previewWarning = preview.querySelector('[data-profit-preview-warning]');

    function resetFormMode() {
      form.reset();
      form.elements.flipId.value = '';
      form.elements.quantity.value = '1';
      title.textContent = 'Record Sale';
      submitButton.textContent = 'Record sale';
      cancelEditButton.hidden = true;
      updatePreview();
    }

    function updatePreview() {
      const sale = buildSaleDraft(form.elements);
      const result = getSalePreview(storagePrefix, sale);
      const salePreview = result.preview;
      const remainingAfterSale = Math.max(0, result.holdingQuantity - salePreview.matchedQuantity);
      const warning = salePreview.unmatchedQuantity > 0
        ? `Warning: ${salePreview.unmatchedQuantity} item(s) are not covered by open purchases. Select manual mode and enter a buy cost to save this sale.`
        : '';

      previewValue.textContent = formatMoney(salePreview.netProfit);
      previewValue.dataset.profitState = salePreview.netProfit >= 0 ? 'positive' : 'negative';
      previewMeta.textContent = `ROI ${salePreview.roi.toFixed(1)}%`;
      previewDetail.textContent = `Matched ${salePreview.matchedQuantity} / Unmatched ${salePreview.unmatchedQuantity} / Buy cost ${formatMoney(salePreview.matchedBuyCost)} / Gross ${formatMoney(salePreview.grossProfit)} / Fees ${formatMoney(salePreview.fees)} / Remaining held ${remainingAfterSale}`;
      previewWarning.textContent = warning;
      previewWarning.dataset.status = warning ? 'error' : 'success';
      return salePreview;
    }

    form.loadFlip = (flip) => {
      form.elements.flipId.value = flip.id;
      form.elements.itemName.value = flip.itemName || '';
      form.elements.buyPrice.value = flip.buyPrice || (flip.quantity ? (Number(flip.manualBuyCost || flip.matchedBuyCost) || 0) / flip.quantity : 0);
      form.elements.sellPrice.value = flip.sellPrice || flip.unitSellPrice || 0;
      form.elements.quantity.value = flip.quantity || 1;
      form.elements.fees.value = flip.fees || '';
      form.elements.manualBuyCostOverride.checked = Boolean(flip.manualBuyCostOverride || flip.unmatchedQuantity > 0);
      form.elements.notes.value = flip.notes || '';
      title.textContent = 'Edit Sale';
      submitButton.textContent = 'Update sale';
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

      const salePreview = updatePreview();
      const hasUnmatchedQuantity = salePreview.unmatchedQuantity > 0;
      const manualOverrideEnabled = Boolean(form.elements.manualBuyCostOverride.checked);
      const manualBuyPrice = parseMoney(form.elements.buyPrice.value);

      if (hasUnmatchedQuantity && !manualOverrideEnabled) {
        window.alert('This sale is larger than your open holdings. Turn on manual mode and enter the buy cost for the unmatched quantity before saving.');
        return;
      }

      if (hasUnmatchedQuantity && manualBuyPrice <= 0) {
        window.alert('Enter a manual buy cost for the unmatched quantity before saving this sale.');
        return;
      }

      const flipId = form.elements.flipId.value;

      if (flipId && store && typeof store.update === 'function') {
        store.update(storagePrefix, flipId, salePreview);
      } else if (store && typeof store.add === 'function') {
        store.add(storagePrefix, buildSaleDraft(form.elements));
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
