const FlipTrackerProOpenPurchases = (() => {
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

  function calculateSoldFlip(purchase, sellPrice, fees) {
    const quantity = Number(purchase.quantity) || 1;
    const buyPrice = Number(purchase.buyPrice) || 0;
    const totalBuy = buyPrice * quantity;
    const totalSell = sellPrice * quantity;
    const profit = totalSell - totalBuy - fees;
    const margin = totalBuy > 0 ? (profit / totalBuy) * 100 : 0;

    return {
      buyPrice,
      fees,
      itemName: purchase.itemName || 'Unnamed item',
      margin,
      notes: purchase.notes || '',
      openedAt: purchase.createdAt,
      profit,
      quantity,
      sellPrice,
      totalBuy,
      totalSell
    };
  }

  function renderPurchase(purchase) {
    const quantity = Number(purchase.quantity) || 1;
    const buyPrice = Number(purchase.buyPrice) || 0;
    const totalBuy = buyPrice * quantity;

    return `
      <li class="ftp-saved-flip" data-open-purchase-id="${purchase.id}">
        <div class="ftp-saved-flip-main">
          <strong>${purchase.itemName || 'Unnamed item'}</strong>
          <span>Buy ${formatMoney(buyPrice)} / Qty ${quantity} / Invested ${formatMoney(totalBuy)}</span>
          ${purchase.notes ? `<span>${purchase.notes}</span>` : ''}
        </div>

        <div class="ftp-saved-flip-side">
          <strong>${formatMoney(totalBuy)}</strong>
          <div class="ftp-row-actions">
            <button class="ftp-secondary-button" type="button" data-sell-purchase="${purchase.id}">Mark sold</button>
            <button class="ftp-danger-button" type="button" data-delete-purchase="${purchase.id}">Delete</button>
          </div>
        </div>
      </li>
    `;
  }

  function renderSellForm(purchase) {
    if (!purchase) {
      return '';
    }

    return `
      <form class="ftp-form" data-open-purchase-sell-form data-purchase-id="${purchase.id}">
        <h2>Mark Sold: ${purchase.itemName || 'Unnamed item'}</h2>

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

  function render({ purchases = [], selectedPurchaseId = '' } = {}) {
    const selectedPurchase = purchases.find((purchase) => purchase.id === selectedPurchaseId) || null;
    const listHtml = purchases.length > 0
      ? `<ul class="ftp-saved-flips">${purchases.map(renderPurchase).join('')}</ul>`
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

    if (!section) {
      return;
    }

    function getPurchases() {
      return store && typeof store.readOpenPurchases === 'function'
        ? store.readOpenPurchases(storagePrefix)
        : [];
    }

    function renderSection(selectedPurchaseId = '') {
      section.outerHTML = render({
        purchases: getPurchases(),
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

        if (store && typeof store.addOpenPurchase === 'function') {
          store.addOpenPurchase(storagePrefix, {
            buyPrice: parseMoney(addForm.elements.buyPrice.value),
            itemName: addForm.elements.itemName.value.trim(),
            notes: addForm.elements.notes.value.trim(),
            quantity: parseQuantity(addForm.elements.quantity.value)
          });
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
        if (store && typeof store.removeOpenPurchase === 'function') {
          store.removeOpenPurchase(storagePrefix, button.dataset.deletePurchase);
        }

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
      const purchase = store && typeof store.findOpenPurchase === 'function'
        ? store.findOpenPurchase(storagePrefix, sellForm.dataset.purchaseId)
        : null;
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

        if (store && typeof store.removeOpenPurchase === 'function') {
          store.removeOpenPurchase(storagePrefix, purchase.id);
        }

        if (typeof onChange === 'function') {
          onChange();
        }
      });

      updatePreview();
      sellForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
