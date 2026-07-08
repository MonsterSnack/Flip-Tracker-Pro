const FlipTrackerProFlipStore = (() => {
  function getStorageKey(storagePrefix) {
    return `${storagePrefix || 'flipTrackerPro'}:flips`;
  }

  function getOpenPurchasesKey(storagePrefix) {
    return `${storagePrefix || 'flipTrackerPro'}:openPurchases`;
  }

  function readList(storageKey) {
    try {
      const rawItems = window.localStorage.getItem(storageKey);
      const items = rawItems ? JSON.parse(rawItems) : [];
      return Array.isArray(items) ? items : [];
    } catch (error) {
      return [];
    }
  }

  function writeList(storageKey, items) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items));
      return true;
    } catch (error) {
      return false;
    }
  }

  function read(storagePrefix) {
    return readList(getStorageKey(storagePrefix));
  }

  function write(storagePrefix, flips) {
    return writeList(getStorageKey(storagePrefix), flips);
  }

  function readOpenPurchases(storagePrefix) {
    return readList(getOpenPurchasesKey(storagePrefix));
  }

  function writeOpenPurchases(storagePrefix, purchases) {
    return writeList(getOpenPurchasesKey(storagePrefix), purchases);
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

  function addOpenPurchase(storagePrefix, purchase) {
    const purchases = readOpenPurchases(storagePrefix);
    const nextPurchase = {
      ...purchase,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    purchases.unshift(nextPurchase);
    writeOpenPurchases(storagePrefix, purchases);
    return nextPurchase;
  }

  function find(storagePrefix, flipId) {
    return read(storagePrefix).find((flip) => flip.id === flipId) || null;
  }

  function findOpenPurchase(storagePrefix, purchaseId) {
    return readOpenPurchases(storagePrefix).find((purchase) => purchase.id === purchaseId) || null;
  }

  function remove(storagePrefix, flipId) {
    const flips = read(storagePrefix);
    const nextFlips = flips.filter((flip) => flip.id !== flipId);
    write(storagePrefix, nextFlips);
    return nextFlips;
  }

  function removeOpenPurchase(storagePrefix, purchaseId) {
    const purchases = readOpenPurchases(storagePrefix);
    const nextPurchases = purchases.filter((purchase) => purchase.id !== purchaseId);
    writeOpenPurchases(storagePrefix, nextPurchases);
    return nextPurchases;
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

  function summarizeOpenPurchases(purchases) {
    const totalInvested = purchases.reduce((total, purchase) => {
      const buyPrice = Number(purchase.buyPrice) || 0;
      const quantity = Number(purchase.quantity) || 0;
      return total + (buyPrice * quantity);
    }, 0);

    return {
      openCount: purchases.length,
      openQuantity: purchases.reduce((total, purchase) => total + (Number(purchase.quantity) || 0), 0),
      totalInvested
    };
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
    addOpenPurchase,
    find,
    findOpenPurchase,
    read,
    readOpenPurchases,
    remove,
    removeOpenPurchase,
    summarize,
    summarizeOpenPurchases,
    update,
    write,
    writeOpenPurchases
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProFlipStore = FlipTrackerProFlipStore;
}
