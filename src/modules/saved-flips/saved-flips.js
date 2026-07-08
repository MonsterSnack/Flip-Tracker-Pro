const FlipTrackerProSavedFlips = (() => {
  const defaultFilters = Object.freeze({
    query: '',
    profit: 'all',
    sort: 'newest'
  });

  let activeFilters = { ...defaultFilters };

  function formatMoney(value) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  }

  function getCreatedTime(flip) {
    const timestamp = Date.parse(flip.createdAt || flip.updatedAt || '');
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function getFilteredFlips(flips) {
    const query = activeFilters.query.trim().toLowerCase();

    return flips
      .filter((flip) => {
        const itemName = String(flip.itemName || '').toLowerCase();
        const notes = String(flip.notes || '').toLowerCase();
        const profit = Number(flip.profit) || 0;
        const matchesQuery = !query || itemName.includes(query) || notes.includes(query);
        const matchesProfit = activeFilters.profit === 'all'
          || (activeFilters.profit === 'profit' && profit >= 0)
          || (activeFilters.profit === 'loss' && profit < 0);

        return matchesQuery && matchesProfit;
      })
      .sort((left, right) => {
        if (activeFilters.sort === 'highest') {
          return (Number(right.profit) || 0) - (Number(left.profit) || 0);
        }

        if (activeFilters.sort === 'lowest') {
          return (Number(left.profit) || 0) - (Number(right.profit) || 0);
        }

        return getCreatedTime(right) - getCreatedTime(left);
      });
  }

  function renderControls() {
    return `
      <div class="ftp-form-grid" data-saved-flips-controls>
        <label class="ftp-field">
          <span>Search</span>
          <input class="ftp-input" type="search" value="${activeFilters.query}" placeholder="Item or note" data-saved-search>
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

  function renderFlip(flip) {
    const profitState = flip.profit >= 0 ? 'positive' : 'negative';

    return `
      <li class="ftp-saved-flip" data-flip-id="${flip.id}">
        <div class="ftp-saved-flip-main">
          <strong>${flip.itemName || 'Unnamed item'}</strong>
          <span>Buy ${formatMoney(flip.buyPrice)} / Sell ${formatMoney(flip.sellPrice)} / Qty ${flip.quantity || 1}</span>
          <span>Fees ${formatMoney(flip.fees)} / Margin ${(Number(flip.margin) || 0).toFixed(1)}%</span>
          ${flip.notes ? `<span>Note: ${flip.notes}</span>` : ''}
        </div>

        <div class="ftp-saved-flip-side">
          <strong data-profit-state="${profitState}">${formatMoney(flip.profit)}</strong>
          <div class="ftp-row-actions">
            <button class="ftp-secondary-button" type="button" data-edit-flip="${flip.id}">Edit</button>
            <button class="ftp-danger-button" type="button" data-delete-flip="${flip.id}">Delete</button>
          </div>
        </div>
      </li>
    `;
  }

  function renderResults(flips) {
    const filteredFlips = getFilteredFlips(flips);

    if (flips.length === 0) {
      return '<p>No saved flips yet.</p>';
    }

    if (filteredFlips.length === 0) {
      return '<p>No flips match your search.</p>';
    }

    return `<ul class="ftp-saved-flips">${filteredFlips.map(renderFlip).join('')}</ul>`;
  }

  function render({ flips = [] } = {}) {
    return `
      <section class="ftp-card" data-saved-flips-section>
        <h2>Saved Flips</h2>
        ${flips.length > 0 ? renderControls() : ''}
        <div data-saved-flips-results>
          ${renderResults(flips)}
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

    const getFlips = () => store && typeof store.read === 'function'
      ? store.read(storagePrefix)
      : [];

    const bindResultActions = () => {
      root.querySelectorAll('[data-edit-flip]').forEach((button) => {
        button.addEventListener('click', () => {
          const flipId = button.dataset.editFlip;
          const flip = store && typeof store.find === 'function'
            ? store.find(storagePrefix, flipId)
            : null;

          if (flip && typeof onEdit === 'function') {
            onEdit(flip);
          }
        });
      });

      root.querySelectorAll('[data-delete-flip]').forEach((button) => {
        button.addEventListener('click', () => {
          const flipId = button.dataset.deleteFlip;
          const flip = store && typeof store.find === 'function'
            ? store.find(storagePrefix, flipId)
            : null;
          const itemName = flip && flip.itemName ? flip.itemName : 'this saved flip';

          if (!window.confirm(`Delete ${itemName}? This cannot be undone.`)) {
            return;
          }

          if (store && typeof store.remove === 'function') {
            store.remove(storagePrefix, flipId);
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
        results.innerHTML = renderResults(getFlips());
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
