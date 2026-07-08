const FlipTrackerProFlipStore = (() => {
  function getStorageKey(storagePrefix) {
    return `${storagePrefix || 'flipTrackerPro'}:flips`;
  }

  function read(storagePrefix) {
    try {
      const rawFlips = window.localStorage.getItem(getStorageKey(storagePrefix));
      const flips = rawFlips ? JSON.parse(rawFlips) : [];
      return Array.isArray(flips) ? flips : [];
    } catch (error) {
      return [];
    }
  }

  function write(storagePrefix, flips) {
    try {
      window.localStorage.setItem(getStorageKey(storagePrefix), JSON.stringify(flips));
      return true;
    } catch (error) {
      return false;
    }
  }

  function add(storagePrefix, flip) {
    const flips = read(storagePrefix);
    const nextFlip = {
      ...flip,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    flips.unshift(nextFlip);
    write(storagePrefix, flips);
    return nextFlip;
  }

  function find(storagePrefix, flipId) {
    return read(storagePrefix).find((flip) => flip.id === flipId) || null;
  }

  function remove(storagePrefix, flipId) {
    const flips = read(storagePrefix);
    const nextFlips = flips.filter((flip) => flip.id !== flipId);
    write(storagePrefix, nextFlips);
    return nextFlips;
  }

  function update(storagePrefix, flipId, patch) {
    const flips = read(storagePrefix);
    let updatedFlip = null;
    const nextFlips = flips.map((flip) => {
      if (flip.id !== flipId) {
        return flip;
      }

      updatedFlip = {
        ...flip,
        ...patch,
        id: flip.id,
        createdAt: flip.createdAt,
        updatedAt: new Date().toISOString()
      };

      return updatedFlip;
    });

    write(storagePrefix, nextFlips);
    return updatedFlip;
  }

  function summarize(flips) {
    const summary = flips.reduce((totals, flip) => {
      totals.totalProfit += Number(flip.profit) || 0;
      totals.totalBuy += Number(flip.totalBuy) || 0;
      totals.totalSell += Number(flip.totalSell) || 0;
      totals.totalQuantity += Number(flip.quantity) || 0;

      if ((Number(flip.profit) || 0) >= 0) {
        totals.successfulFlips += 1;
      }

      return totals;
    }, {
      successfulFlips: 0,
      totalBuy: 0,
      totalProfit: 0,
      totalQuantity: 0,
      totalSell: 0
    });

    return {
      ...summary,
      activeFlips: flips.length,
      successRate: flips.length > 0 ? (summary.successfulFlips / flips.length) * 100 : 0
    };
  }

  return {
    add,
    find,
    read,
    remove,
    summarize,
    update
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProFlipStore = FlipTrackerProFlipStore;
}
