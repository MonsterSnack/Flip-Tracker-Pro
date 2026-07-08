const FlipTrackerProPurchaseLotService = (() => {
  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function normalizeLot(lot) {
    const storageService = getStorageService();
    return storageService && typeof storageService.normalizePurchaseLot === 'function'
      ? storageService.normalizePurchaseLot(lot)
      : lot;
  }

  function list(storagePrefix) {
    const storageService = getStorageService();
    const data = storageService ? storageService.load(storagePrefix) : { purchaseLots: [] };
    return [...data.purchaseLots].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  }

  function create(storagePrefix, lot) {
    const storageService = getStorageService();
    const nextLot = normalizeLot(lot || {});

    if (!storageService) {
      return nextLot;
    }

    storageService.update(storagePrefix, (data) => ({
      ...data,
      purchaseLots: [nextLot, ...data.purchaseLots]
    }));

    return nextLot;
  }

  function update(storagePrefix, lotId, patch) {
    const storageService = getStorageService();
    let updatedLot = null;

    if (!storageService) {
      return null;
    }

    storageService.update(storagePrefix, (data) => ({
      ...data,
      purchaseLots: data.purchaseLots.map((lot) => {
        if (lot.id !== lotId) {
          return lot;
        }

        updatedLot = normalizeLot({
          ...lot,
          ...(patch || {}),
          id: lot.id,
          createdAt: lot.createdAt,
          updatedAt: new Date().toISOString()
        });

        return updatedLot;
      })
    }));

    return updatedLot;
  }

  function remove(storagePrefix, lotId) {
    const storageService = getStorageService();

    if (!storageService) {
      return [];
    }

    const nextData = storageService.update(storagePrefix, (data) => ({
      ...data,
      purchaseLots: data.purchaseLots.filter((lot) => lot.id !== lotId)
    }));

    return nextData.purchaseLots;
  }

  function find(storagePrefix, lotId) {
    return list(storagePrefix).find((lot) => lot.id === lotId) || null;
  }

  return {
    create,
    delete: remove,
    find,
    list,
    remove,
    update
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProPurchaseLotService = FlipTrackerProPurchaseLotService;
}
