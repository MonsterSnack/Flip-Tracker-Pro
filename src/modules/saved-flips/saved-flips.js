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
        const profit = Number(flip.profit) || 0;
        const matchesQuery = !query || itemName.includes(query);
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
          <input class="ftp-input" type="search" value="${activeFilters.query}" placeholder="Item name" data-saved-search>
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

  function render({ flips = [] } = {}) {
    const filteredFlips = getFilteredFlips(flips);
    const listHtml = filteredFlips.length > 0
      ? `<ul class="ftp-saved-flips">${filteredFlips.map(renderFlip).join('')}</ul>`
      : '<p>No flips match your search.</p>';
    const emptyHtml = flips.length > 0 ? listHtml : '<p>No saved flips yet.</p>';

    return `
      <section class="ftp-card" data-saved-flips-section>
        <h2>Saved Flips</h2>
        ${flips.length > 0 ? renderControls() : ''}
        ${emptyHtml}
      </section>
    `;
  }

  function bind(root, options = {}) {
    const { onDelete, onEdit, onFilterChange, storagePrefix, store } = options;
    const searchInput = root.querySelector('[data-saved-search]');
    const profitFilter = root.querySelector('[data-saved-profit-filter]');
    const sortSelect = root.querySelector('[data-saved-sort]');

    const rerenderSavedFlips = () => {
      const section = root.querySelector('[data-saved-flips-section]');
      const flips = store && typeof store.read === 'function'
        ? store.read(storagePrefix)
        : [];

      if (!section) {
        return;
      }

      section.outerHTML = render({ flips });
      bind(root, options);
    };

    const updateFilters = () => {
      activeFilters = {
        query: searchInput ? searchInput.value : '',
        profit: profitFilter ? profitFilter.value : defaultFilters.profit,
        sort: sortSelect ? sortSelect.value : defaultFilters.sort
      };

      if (typeof onFilterChange === 'function') {
        onFilterChange();
        return;
      }

      rerenderSavedFlips();
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
