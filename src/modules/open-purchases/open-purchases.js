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

  function normalizePurchaseLot(purchaseLot) {
    const unitCost = Number(purchaseLot.unitCost ?? purchaseLot.buyPrice) || 0;
    const quantity = Number(purchaseLot.quantity) || 1;

    return {
      ...purchaseLot,
      buyPrice: unitCost,
      quantity,
      totalCost: Number(purchaseLot.totalCost) || unitCost * quantity,
      unitCost
    };
  }

  function calculateSoldFlip(purchaseLot, sellPrice, fees) {
    const normalizedLot = normalizePurchaseLot(purchaseLot);
    const quantity = Number(normalizedLot.quantity) || 1;
    const buyPrice = Number(normalizedLot.unitCost) || 0;
    const totalBuy = buyPrice * quantity;
    const totalSell = sellPrice * quantity;
    const profit = totalSell - totalBuy - fees;
    const margin = totalBuy > 0 ? (profit / totalBuy) * 100 : 0;

    return {
      buyPrice,
      fees,
      itemName: normalizedLot.itemName || 'Unnamed item',
      margin,
      notes: normalizedLot.notes || '',
      openedAt: normalizedLot.createdAt,
      profit,
      quantity,
      sellPrice,
      totalBuy,
      totalSell
    };
  }

  function renderPurchase(purchaseLot) {
    const normalizedLot = normalizePurchaseLot(purchaseLot);
    const quantity = Number(normalizedLot.quantity) || 1;
    const unitCost = Number(normalizedLot.unitCost) || 0;
    const totalCost = Number(normalizedLot.totalCost) || unitCost * quantity;
    const purchaseId = escapeHtml(normalizedLot.id);
    const itemName = escapeHtml(normalizedLot.itemName || 'Unnamed item');
    const notes = escapeHtml(normalizedLot.notes || '');

    return `
      <li class="ftp-saved-flip" data-open-purchase-id="${purchaseId}">
        <div class="ftp-saved-flip-main">
          <strong>${itemName}</strong>
          <span>Buy ${formatMoney(unitCost)} / Qty ${quantity} / Invested ${formatMoney(totalCost)}</span>
          ${notes ? `<span>${notes}</span>` : ''}
        </div>

        <div class="ftp-saved-flip-side">
          <strong>${formatMoney(totalCost)}</strong>
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

    return `
      <form class="ftp-form" data-open-purchase-sell-form data-purchase-id="${escapeHtml(purchaseLot.id)}">
        <h2>Mark Sold: ${escapeHtml(purchaseLot.itemName || 'Unnamed item')}</h2>

        <div class="ftp-form-grid">
          <label class="ftp-field">
            <span>Sell</span>
            <input class="ftp-input" name="sellPrice" type="number" min="0" step="1" placeholder="0" required>
          </label>

          <label class="ftp-field">
            <span>Fees</span>
            <input class="ftp-input" name="fees" type="number" min="0" step="1" placeholder="0">
          </label>
        </div>

        <div class="ftp-profit-preview" data-open-sell-preview>
          <span>Estimated profit</span>
          <strong>$0</strong>
          <small>Margin 0%</small>
        </div>

        <div class="ftp-form-actions">
          <button class="ftp-primary-button" type="submit">Save sold flip</button>
          <button class="ftp-secondary-button" type="button" data-cancel-sell-purchase>Cancel</button>
        </div>
      </form>
    `;
  }

  function render({ purchaseLots, purchases = purchaseLots || [], selectedPurchaseId = '' } = {}) {
    const lots = purchases.map(normalizePurchaseLot);
    const selectedPurchase = lots.find((purchase) => purchase.id === selectedPurchaseId) || null;
    const listHtml = lots.length > 0
      ? `<ul class="ftp-saved-flips">${lots.map(renderPurchase).join('')}</ul>`
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

  function bind(root, { onChange, storagePrefix, store } = {}) {
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
        selectedPurchaseId
      });
      bind(root, { onChange, storagePrefix, store });
    }

    const addForm = section.querySelector('[data-open-purchase-form]');
    const sellForm = section.querySelector('[data-open-purchase-sell-form]');

    if (addForm) {
      addForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!addForm.reportValidity()) {
          return;
        }

        const purchaseLot = {
          itemName: addForm.elements.itemName.value.trim(),
          notes: addForm.elements.notes.value.trim(),
          quantity: parseQuantity(addForm.elements.quantity.value),
          source: 'manual',
          unitCost: parseMoney(addForm.elements.buyPrice.value)
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
          parseMoney(sellForm.elements.fees.value)
        );

        previewValue.textContent = formatMoney(result.profit);
        previewValue.dataset.profitState = result.profit >= 0 ? 'positive' : 'negative';
        previewMeta.textContent = `Margin ${result.margin.toFixed(1)}%`;
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

        removePurchaseLot(purchase.id);

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
