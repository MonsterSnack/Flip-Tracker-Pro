const FlipTrackerProFlipStore = (() => {
  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function getPurchaseLotService() {
    return window.FlipTrackerProPurchaseLotService;
  }

  function getData(storagePrefix) {
    const storageService = getStorageService();
    return storageService ? storageService.load(storagePrefix) : { purchaseLots: [], sales: [] };
  }

  function normalizeSale(sale) {
    const storageService = getStorageService();
    return storageService && typeof storageService.normalizeSale === 'function'
      ? storageService.normalizeSale(sale)
      : sale;
  }

  function normalizeOpenPurchase(purchase) {
    const storageService = getStorageService();
    const normalizedLot = storageService && typeof storageService.normalizePurchaseLot === 'function'
      ? storageService.normalizePurchaseLot(purchase)
      : purchase;

    return {
      ...normalizedLot,
      buyPrice: normalizedLot.unitCost
    };
  }

  function read(storagePrefix) {
    return getData(storagePrefix).sales;
  }

  function write(storagePrefix, flips) {
    const storageService = getStorageService();

    if (!storageService) {
      return false;
    }

    storageService.update(storagePrefix, (data) => ({
      ...data,
      sales: Array.isArray(flips) ? flips.map(normalizeSale) : []
    }));

    return true;
  }

  function readOpenPurchases(storagePrefix) {
    return getData(storagePrefix).purchaseLots.map(normalizeOpenPurchase);
  }

  function writeOpenPurchases(storagePrefix, purchases) {
    const storageService = getStorageService();

    if (!storageService) {
      return false;
    }

    storageService.update(storagePrefix, (data) => ({
      ...data,
      purchaseLots: Array.isArray(purchases) ? purchases.map((purchase) => storageService.normalizePurchaseLot(purchase)) : []
    }));

    return true;
  }

  function add(storagePrefix, flip) {
    const storageService = getStorageService();
    const nextFlip = normalizeSale(flip || {});

    if (storageService) {
      storageService.update(storagePrefix, (data) => ({
        ...data,
        sales: [nextFlip, ...data.sales]
      }));
    }

    return nextFlip;
  }

  function addOpenPurchase(storagePrefix, purchase) {
    const purchaseLotService = getPurchaseLotService();
    const lot = purchaseLotService && typeof purchaseLotService.create === 'function'
      ? purchaseLotService.create(storagePrefix, purchase)
      : normalizeOpenPurchase(purchase || {});

    return normalizeOpenPurchase(lot);
  }

  function find(storagePrefix, flipId) {
    return read(storagePrefix).find((flip) => flip.id === flipId) || null;
  }

  function findOpenPurchase(storagePrefix, purchaseId) {
    return readOpenPurchases(storagePrefix).find((purchase) => purchase.id === purchaseId) || null;
  }

  function remove(storagePrefix, flipId) {
    const storageService = getStorageService();

    if (!storageService) {
      return [];
    }

    const nextData = storageService.update(storagePrefix, (data) => ({
      ...data,
      sales: data.sales.filter((flip) => flip.id !== flipId)
    }));

    return nextData.sales;
  }

  function removeOpenPurchase(storagePrefix, purchaseId) {
    const purchaseLotService = getPurchaseLotService();

    if (purchaseLotService && typeof purchaseLotService.remove === 'function') {
      return purchaseLotService.remove(storagePrefix, purchaseId).map(normalizeOpenPurchase);
    }

    return [];
  }

  function update(storagePrefix, flipId, patch) {
    const storageService = getStorageService();
    let updatedFlip = null;

    if (!storageService) {
      return null;
    }

    storageService.update(storagePrefix, (data) => ({
      ...data,
      sales: data.sales.map((flip) => {
        if (flip.id !== flipId) {
          return flip;
        }

        updatedFlip = normalizeSale({
          ...flip,
          ...(patch || {}),
          id: flip.id,
          createdAt: flip.createdAt,
          updatedAt: new Date().toISOString()
        });

        return updatedFlip;
      })
    }));

    return updatedFlip;
  }

  function summarizeOpenPurchases(purchases) {
    const totalInvested = purchases.reduce((total, purchase) => {
      const buyPrice = Number(purchase.buyPrice || purchase.unitCost) || 0;
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
