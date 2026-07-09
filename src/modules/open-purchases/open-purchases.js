const FlipTrackerProOpenPurchases = (() => {
  function escapeHtml(value) {
    return window.FlipTrackerProHtml && typeof window.FlipTrackerProHtml.escapeHtml === 'function'
      ? window.FlipTrackerProHtml.escapeHtml(value)
      : String(value ?? '');
  }

  function getPurchaseLotService() {
    return window.FlipTrackerProPurchaseLotService;
  }

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

  function formatPercent(value) {
    return `${(Number(value) || 0).toFixed(1)}%`;
  }

  function formatDateTime(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }

  function normalizePurchaseLot(purchaseLot) {
    const unitBuyPrice = Number(purchaseLot.unitBuyPrice ?? purchaseLot.unitCost ?? purchaseLot.buyPrice) || 0;
    const quantity = Number(purchaseLot.quantity) || 1;
    const remainingQuantity = purchaseLot.remainingQuantity === undefined
      ? quantity
      : Math.max(0, Number(purchaseLot.remainingQuantity) || 0);

    return {
      ...purchaseLot,
      buyPrice: unitBuyPrice,
      quantity,
      remainingQuantity,
      totalBuyPrice: Number(purchaseLot.totalBuyPrice ?? purchaseLot.totalCost) || unitBuyPrice * quantity,
      totalCost: Number(purchaseLot.totalBuyPrice ?? purchaseLot.totalCost) || unitBuyPrice * quantity,
      unitBuyPrice,
      unitCost: unitBuyPrice
    };
  }

  function getSnapshotKey(snapshot) {
    return snapshot.itemId ? `id:${snapshot.itemId}` : `name:${String(snapshot.itemName || '').toLowerCase()}`;
  }

  function createSnapshotMap(priceSnapshots = []) {
    return priceSnapshots.reduce((snapshots, snapshot) => {
      const key = getSnapshotKey(snapshot);
      const current = snapshots[key];
      const currentTime = current ? Date.parse(current.timestamp || '') : 0;
      const nextTime = Date.parse(snapshot.timestamp || '') || 0;

      if (!current || nextTime >= currentTime) {
        snapshots[key] = snapshot;
      }

      return snapshots;
    }, {});
  }

  function findSnapshot(purchaseLot, snapshotMap) {
    return snapshotMap[`id:${purchaseLot.itemId}`] || snapshotMap[`name:${String(purchaseLot.itemName || '').toLowerCase()}`] || null;
  }

  function calculateSoldFlip(purchaseLot, sellPrice, quantity, fees) {
    const normalizedLot = normalizePurchaseLot(purchaseLot);
    const soldQuantity = Math.min(parseQuantity(quantity), normalizedLot.remainingQuantity || normalizedLot.quantity || 1);
    const buyPrice = Number(normalizedLot.unitBuyPrice) || 0;
    const totalBuy = buyPrice * soldQuantity;
    const totalSell = sellPrice * soldQuantity;
    const profit = totalSell - totalBuy - fees;
    const margin = totalBuy > 0 ? (profit / totalBuy) * 100 : 0;

    return {
      itemId: normalizedLot.itemId,
      itemName: normalizedLot.itemName || 'Unnamed item',
      quantity: soldQuantity,
      unitSellPrice: sellPrice,
      totalSellPrice: totalSell,
      matchedBuyCost: totalBuy,
      grossProfit: totalSell - totalBuy,
      netProfit: profit,
      roi: margin,
      fees,
      source: 'manual',
      notes: normalizedLot.notes || '',
      soldAt: new Date().toISOString(),
      buyPrice,
      sellPrice,
      totalBuy,
      totalSell,
      profit,
      margin
    };
  }

  function renderPriceEstimate(normalizedLot, snapshotMap) {
    const snapshot = findSnapshot(normalizedLot, snapshotMap);

    if (!snapshot) {
      return '';
    }

    const currentSellPrice = Number(snapshot.bazaarPrice ?? snapshot.marketPrice) || 0;
    const openInvestment = normalizedLot.unitBuyPrice * normalizedLot.remainingQuantity;
    const estimatedProfit = (currentSellPrice * normalizedLot.remainingQuantity) - openInvestment;
    const estimatedROI = openInvestment > 0 ? (estimatedProfit / openInvestment) * 100 : 0;
    const updatedAt = formatDateTime(snapshot.timestamp);

    return `
      <span>Live estimate ${formatMoney(currentSellPrice)} each / P/L <strong data-profit-state="${estimatedProfit >= 0 ? 'positive' : 'negative'}">${formatMoney(estimatedProfit)}</strong> (${formatPercent(estimatedROI)})</span>
      ${updatedAt ? `<span>Prices updated ${escapeHtml(updatedAt)}</span>` : ''}
    `;
  }

  function renderPurchase(purchaseLot, snapshotMap = {}) {
    const normalizedLot = normalizePurchaseLot(purchaseLot);
    const quantity = Number(normalizedLot.quantity) || 1;
    const remainingQuantity = Number(normalizedLot.remainingQuantity) || 0;
    const unitBuyPrice = Number(normalizedLot.unitBuyPrice) || 0;
    const openInvestment = unitBuyPrice * remainingQuantity;
    const purchaseId = escapeHtml(normalizedLot.id);
    const itemName = escapeHtml(normalizedLot.itemName || 'Unnamed item');
    const notes = escapeHtml(normalizedLot.notes || '');

    return `
      <li class="ftp-saved-flip" data-open-purchase-id="${purchaseId}">
        <div class="ftp-saved-flip-main">
          <strong>${itemName}</strong>
          <span>Buy ${formatMoney(unitBuyPrice)} / Open ${remainingQuantity} of ${quantity} / Invested ${formatMoney(openInvestment)}</span>
          ${renderPriceEstimate(normalizedLot, snapshotMap)}
          ${notes ? `<span>${notes}</span>` : ''}
        </div>

        <div class="ftp-saved-flip-side">
          <strong>${formatMoney(openInvestment)}</strong>
          <div class="ftp-row-actions">
            <button class="ftp-secondary-button" type="button" data-sell-purchase="${purchaseId}">Mark sold</button>
            <button class="ftp-danger-button" type="button" data-delete-purchase="${purchaseId}">Delete</button>
          </div>
        </div>
      </li>
    `;
  }

  function renderSellForm(purchaseLot) {
    if (!purchaseLot) {
      return '';
    }

    const normalizedLot = normalizePurchaseLot(purchaseLot);
    const remainingQuantity = Number(normalizedLot.remainingQuantity) || 1;

    return `
      <form class="ftp-form" data-open-purchase-sell-form data-purchase-id="${escapeHtml(normalizedLot.id)}">
        <h2>Mark Sold: ${escapeHtml(normalizedLot.itemName || 'Unnamed item')}</h2>

        <div class="ftp-form-grid">
          <label class="ftp-field">
            <span>Sell</span>
            <input class="ftp-input" name="sellPrice" type="number" min="0" step="1" placeholder="0" required>
          </label>

          <label class="ftp-field">
            <span>Qty</span>
            <input class="ftp-input" name="quantity" type="number" min="1" max="${remainingQuantity}" step="1" value="${remainingQuantity}" required>
          </label>
        </div>

        <label class="ftp-field">
          <span>Fees</span>
          <input class="ftp-input" name="fees" type="number" min="0" step="1" placeholder="0">
        </label>

        <div class="ftp-profit-preview" data-open-sell-preview>
          <span>Estimated profit</span>
          <strong>$0</strong>
          <small>ROI 0%</small>
        </div>

        <div class="ftp-form-actions">
          <button class="ftp-primary-button" type="submit">Save sold flip</button>
          <button class="ftp-secondary-button" type="button" data-cancel-sell-purchase>Cancel</button>
        </div>
      </form>
    `;
  }

  function render({ purchaseLots, purchases = purchaseLots || [], selectedPurchaseId = '', priceSnapshots = [] } = {}) {
    const lots = purchases.map(normalizePurchaseLot).filter((purchase) => (Number(purchase.remainingQuantity) || 0) > 0);
    const snapshotMap = createSnapshotMap(priceSnapshots);
    const selectedPurchase = lots.find((purchase) => purchase.id === selectedPurchaseId) || null;
    const listHtml = lots.length > 0
      ? `<ul class="ftp-saved-flips">${lots.map((purchase) => renderPurchase(purchase, snapshotMap)).join('')}</ul>`
      : '<p>No open purchases yet.</p>';

    return `
      <section class="ftp-card" data-open-purchases-section>
        <h2>Open Purchases</h2>
        <p>Track items you bought but have not sold yet.</p>

        <form class="ftp-form" data-open-purchase-form>
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
              <span>Qty</span>
              <input class="ftp-input" name="quantity" type="number" min="1" step="1" value="1" required>
            </label>
          </div>

          <label class="ftp-field">
            <span>Notes</span>
            <input class="ftp-input" name="notes" type="text" placeholder="Optional notes" autocomplete="off">
          </label>

          <button class="ftp-primary-button" type="submit">Add open purchase</button>
        </form>

        ${renderSellForm(selectedPurchase)}

        <h2 class="ftp-subheading">Currently Holding</h2>
        ${listHtml}
      </section>
    `;
  }

  function bind(root, { onChange, storagePrefix, store, priceSnapshots = [] } = {}) {
    const section = root.querySelector('[data-open-purchases-section]');
    const purchaseLotService = getPurchaseLotService();

    if (!section) {
      return;
    }

    function getPurchaseLots() {
      if (purchaseLotService && typeof purchaseLotService.list === 'function') {
        return purchaseLotService.list(storagePrefix).map(normalizePurchaseLot);
      }

      return store && typeof store.readOpenPurchases === 'function'
        ? store.readOpenPurchases(storagePrefix).map(normalizePurchaseLot)
        : [];
    }

    function findPurchaseLot(purchaseId) {
      if (purchaseLotService && typeof purchaseLotService.find === 'function') {
        const purchaseLot = purchaseLotService.find(storagePrefix, purchaseId);
        return purchaseLot ? normalizePurchaseLot(purchaseLot) : null;
      }

      if (store && typeof store.findOpenPurchase === 'function') {
        const purchaseLot = store.findOpenPurchase(storagePrefix, purchaseId);
        return purchaseLot ? normalizePurchaseLot(purchaseLot) : null;
      }

      return null;
    }

    function removePurchaseLot(purchaseId) {
      if (purchaseLotService && typeof purchaseLotService.remove === 'function') {
        purchaseLotService.remove(storagePrefix, purchaseId);
        return;
      }

      if (store && typeof store.removeOpenPurchase === 'function') {
        store.removeOpenPurchase(storagePrefix, purchaseId);
      }
    }

    function renderSection(selectedPurchaseId = '') {
      section.outerHTML = render({
        purchases: getPurchaseLots(),
        priceSnapshots,
        selectedPurchaseId
      });
      bind(root, { onChange, priceSnapshots, storagePrefix, store });
    }

    const addForm = section.querySelector('[data-open-purchase-form]');
    const sellForm = section.querySelector('[data-open-purchase-sell-form]');

    if (addForm) {
      addForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!addForm.reportValidity()) {
          return;
        }

        const quantity = parseQuantity(addForm.elements.quantity.value);
        const unitBuyPrice = parseMoney(addForm.elements.buyPrice.value);
        const purchaseLot = {
          itemName: addForm.elements.itemName.value.trim(),
          notes: addForm.elements.notes.value.trim(),
          quantity,
          remainingQuantity: quantity,
          source: 'manual',
          totalBuyPrice: unitBuyPrice * quantity,
          unitBuyPrice
        };

        if (purchaseLotService && typeof purchaseLotService.create === 'function') {
          purchaseLotService.create(storagePrefix, purchaseLot);
        } else if (store && typeof store.addOpenPurchase === 'function') {
          store.addOpenPurchase(storagePrefix, purchaseLot);
        }

        if (typeof onChange === 'function') {
          onChange();
        }
      });
    }

    section.querySelectorAll('[data-sell-purchase]').forEach((button) => {
      button.addEventListener('click', () => renderSection(button.dataset.sellPurchase));
    });

    section.querySelectorAll('[data-delete-purchase]').forEach((button) => {
      button.addEventListener('click', () => {
        const purchase = findPurchaseLot(button.dataset.deletePurchase);
        const itemName = purchase && purchase.itemName ? purchase.itemName : 'this open purchase';

        if (!window.confirm(`Delete ${itemName}? This cannot be undone.`)) {
          return;
        }

        removePurchaseLot(button.dataset.deletePurchase);

        if (typeof onChange === 'function') {
          onChange();
        }
      });
    });

    const cancelSellButton = section.querySelector('[data-cancel-sell-purchase]');

    if (cancelSellButton) {
      cancelSellButton.addEventListener('click', () => renderSection());
    }

    if (sellForm) {
      const purchase = findPurchaseLot(sellForm.dataset.purchaseId);
      const preview = sellForm.querySelector('[data-open-sell-preview]');
      const previewValue = preview.querySelector('strong');
      const previewMeta = preview.querySelector('small');

      function updatePreview() {
        const result = calculateSoldFlip(
          purchase,
          parseMoney(sellForm.elements.sellPrice.value),
          sellForm.elements.quantity.value,
          parseMoney(sellForm.elements.fees.value)
        );

        previewValue.textContent = formatMoney(result.netProfit);
        previewValue.dataset.profitState = result.netProfit >= 0 ? 'positive' : 'negative';
        previewMeta.textContent = `ROI ${result.roi.toFixed(1)}%`;
        return result;
      }

      sellForm.addEventListener('input', updatePreview);
      sellForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!purchase || !sellForm.reportValidity()) {
          return;
        }

        if (store && typeof store.add === 'function') {
          store.add(storagePrefix, updatePreview());
        }

        if (typeof onChange === 'function') {
          onChange();
        }
      });

      if (purchase) {
        updatePreview();
        sellForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  return {
    bind,
    render
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProOpenPurchases = FlipTrackerProOpenPurchases;
}
