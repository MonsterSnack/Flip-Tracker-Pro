const FlipTrackerProSavedFlips = (() => {
  const defaultFilters = Object.freeze({
    query: '',
    profit: 'all',
    sort: 'newest'
  });

  let activeFilters = { ...defaultFilters };

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

  function formatDate(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
  }

  function getSaleProfit(sale) {
    return Number(sale.netProfit ?? sale.profit) || 0;
  }

  function getSaleRoi(sale) {
    return Number(sale.roi ?? sale.margin) || 0;
  }

  function getMatchedBuyCost(sale) {
    return Number(sale.matchedBuyCost ?? sale.totalBuy) || 0;
  }

  function getTotalSellPrice(sale) {
    return Number(sale.totalSellPrice ?? sale.totalSell) || ((Number(sale.unitSellPrice ?? sale.sellPrice) || 0) * (Number(sale.quantity) || 1));
  }

  function getCreatedTime(sale) {
    const timestamp = Date.parse(sale.soldAt || sale.createdAt || sale.updatedAt || '');
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function getFilteredSales(sales) {
    const query = activeFilters.query.trim().toLowerCase();

    return sales
      .filter((sale) => {
        const itemName = String(sale.itemName || '').toLowerCase();
        const notes = String(sale.notes || '').toLowerCase();
        const profit = getSaleProfit(sale);
        const matchesQuery = !query || itemName.includes(query) || notes.includes(query);
        const matchesProfit = activeFilters.profit === 'all'
          || (activeFilters.profit === 'profit' && profit >= 0)
          || (activeFilters.profit === 'loss' && profit < 0);

        return matchesQuery && matchesProfit;
      })
      .sort((left, right) => {
        if (activeFilters.sort === 'highest') {
          return getSaleProfit(right) - getSaleProfit(left);
        }

        if (activeFilters.sort === 'lowest') {
          return getSaleProfit(left) - getSaleProfit(right);
        }

        return getCreatedTime(right) - getCreatedTime(left);
      });
  }

  function renderControls() {
    return `
      <div class="ftp-form-grid" data-saved-flips-controls>
        <label class="ftp-field">
          <span>Search</span>
          <input class="ftp-input" type="search" value="${escapeHtml(activeFilters.query)}" placeholder="Item or note" data-saved-search>
        </label>

        <label class="ftp-field">
          <span>Show</span>
          <select class="ftp-input" data-saved-profit-filter>
            <option value="all" ${activeFilters.profit === 'all' ? 'selected' : ''}>All flips</option>
            <option value="profit" ${activeFilters.profit === 'profit' ? 'selected' : ''}>Profit only</option>
            <option value="loss" ${activeFilters.profit === 'loss' ? 'selected' : ''}>Loss only</option>
          </select>
        </label>

        <label class="ftp-field">
          <span>Sort</span>
          <select class="ftp-input" data-saved-sort>
            <option value="newest" ${activeFilters.sort === 'newest' ? 'selected' : ''}>Newest first</option>
            <option value="highest" ${activeFilters.sort === 'highest' ? 'selected' : ''}>Highest profit</option>
            <option value="lowest" ${activeFilters.sort === 'lowest' ? 'selected' : ''}>Lowest profit</option>
          </select>
        </label>
      </div>
    `;
  }

  function renderSale(sale) {
    const profit = getSaleProfit(sale);
    const profitState = profit >= 0 ? 'positive' : 'negative';
    const saleId = escapeHtml(sale.id);
    const itemName = escapeHtml(sale.itemName || 'Unnamed item');
    const notes = escapeHtml(sale.notes || '');
    const soldDate = formatDate(sale.soldAt || sale.createdAt || sale.updatedAt);

    return `
      <li class="ftp-saved-flip" data-flip-id="${saleId}">
        <div class="ftp-saved-flip-main">
          <strong>${itemName}</strong>
          <span>Qty ${sale.quantity || 1} / Buy cost ${formatMoney(getMatchedBuyCost(sale))} / Sell total ${formatMoney(getTotalSellPrice(sale))}</span>
          <span>Net ${formatMoney(profit)} / ROI ${getSaleRoi(sale).toFixed(1)}% / Sold ${escapeHtml(soldDate)}</span>
          ${notes ? `<span>Note: ${notes}</span>` : ''}
        </div>

        <div class="ftp-saved-flip-side">
          <strong data-profit-state="${profitState}">${formatMoney(profit)}</strong>
          <div class="ftp-row-actions">
            <button class="ftp-secondary-button" type="button" data-edit-flip="${saleId}">Edit</button>
            <button class="ftp-danger-button" type="button" data-delete-flip="${saleId}">Delete</button>
          </div>
        </div>
      </li>
    `;
  }

  function renderResults(sales) {
    const filteredSales = getFilteredSales(sales);

    if (sales.length === 0) {
      return '<p>No saved flips yet.</p>';
    }

    if (filteredSales.length === 0) {
      return '<p>No flips match your search.</p>';
    }

    return `<ul class="ftp-saved-flips">${filteredSales.map(renderSale).join('')}</ul>`;
  }

  function render({ flips = [], sales = flips } = {}) {
    return `
      <section class="ftp-card" data-saved-flips-section>
        <h2>Saved Flips</h2>
        ${sales.length > 0 ? renderControls() : ''}
        <div data-saved-flips-results>
          ${renderResults(sales)}
        </div>
      </section>
    `;
  }

  function bind(root, options = {}) {
    const { onDelete, onEdit, storagePrefix, store } = options;
    const searchInput = root.querySelector('[data-saved-search]');
    const profitFilter = root.querySelector('[data-saved-profit-filter]');
    const sortSelect = root.querySelector('[data-saved-sort]');
    const results = root.querySelector('[data-saved-flips-results]');

    const getSales = () => store && typeof store.read === 'function'
      ? store.read(storagePrefix)
      : [];

    const bindResultActions = () => {
      root.querySelectorAll('[data-edit-flip]').forEach((button) => {
        button.addEventListener('click', () => {
          const saleId = button.dataset.editFlip;
          const sale = store && typeof store.find === 'function'
            ? store.find(storagePrefix, saleId)
            : null;

          if (sale && typeof onEdit === 'function') {
            onEdit(sale);
          }
        });
      });

      root.querySelectorAll('[data-delete-flip]').forEach((button) => {
        button.addEventListener('click', () => {
          const saleId = button.dataset.deleteFlip;
          const sale = store && typeof store.find === 'function'
            ? store.find(storagePrefix, saleId)
            : null;
          const itemName = sale && sale.itemName ? sale.itemName : 'this saved flip';

          if (!window.confirm(`Delete ${itemName}? This cannot be undone.`)) {
            return;
          }

          if (store && typeof store.remove === 'function') {
            store.remove(storagePrefix, saleId);
          }

          if (typeof onDelete === 'function') {
            onDelete();
          }
        });
      });
    };

    const updateFilters = () => {
      activeFilters = {
        query: searchInput ? searchInput.value : '',
        profit: profitFilter ? profitFilter.value : defaultFilters.profit,
        sort: sortSelect ? sortSelect.value : defaultFilters.sort
      };

      if (results) {
        results.innerHTML = renderResults(getSales());
        bindResultActions();
      }
    };

    if (searchInput) {
      searchInput.addEventListener('input', updateFilters);
    }

    if (profitFilter) {
      profitFilter.addEventListener('change', updateFilters);
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', updateFilters);
    }

    bindResultActions();
  }

  return {
    bind,
    render
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProSavedFlips = FlipTrackerProSavedFlips;
}
