const FlipTrackerProFlipStore = (() => {
  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function getPurchaseLotService() {
    return window.FlipTrackerProPurchaseLotService;
  }

  function getPortfolioService() {
    return window.FlipTrackerProPortfolioService;
  }

  function getStatisticsService() {
    return window.FlipTrackerProStatisticsService;
  }

  function getAccountingService() {
    return window.FlipTrackerProTradeAccountingService;
  }

  function getData(storagePrefix) {
    const storageService = getStorageService();
    return storageService ? storageService.load(storagePrefix) : { purchaseLots: [], sales: [], settings: {}, itemPriceSnapshots: [] };
  }

  function normalizeSale(sale) {
    const storageService = getStorageService();
    return storageService && typeof storageService.normalizeSale === 'function'
      ? storageService.normalizeSale(sale)
      : sale;
  }

  function normalizeOpenPurchase(purchaseLot) {
    const storageService = getStorageService();
    const normalizedLot = storageService && typeof storageService.normalizePurchaseLot === 'function'
      ? storageService.normalizePurchaseLot(purchaseLot)
      : purchaseLot;

    return {
      ...normalizedLot,
      buyPrice: normalizedLot.unitBuyPrice ?? normalizedLot.unitCost,
      unitCost: normalizedLot.unitBuyPrice ?? normalizedLot.unitCost,
      totalCost: normalizedLot.totalBuyPrice ?? normalizedLot.totalCost
    };
  }

  function read(storagePrefix) {
    return getData(storagePrefix).sales;
  }

  function write(storagePrefix, sales) {
    const storageService = getStorageService();

    if (!storageService) {
      return false;
    }

    storageService.update(storagePrefix, (data) => ({
      ...data,
      sales: Array.isArray(sales) ? sales.map(normalizeSale) : []
    }));

    return true;
  }

  function readOpenPurchases(storagePrefix) {
    return getData(storagePrefix).purchaseLots.map(normalizeOpenPurchase);
  }

  function writeOpenPurchases(storagePrefix, purchaseLots) {
    const storageService = getStorageService();

    if (!storageService) {
      return false;
    }

    storageService.update(storagePrefix, (data) => ({
      ...data,
      purchaseLots: Array.isArray(purchaseLots) ? purchaseLots.map((purchaseLot) => storageService.normalizePurchaseLot(purchaseLot)) : []
    }));

    return true;
  }

  function add(storagePrefix, sale) {
    const storageService = getStorageService();
    const accountingService = getAccountingService();
    let nextSale = normalizeSale(sale || {});

    if (storageService) {
      storageService.update(storagePrefix, (data) => {
        if (accountingService && typeof accountingService.recordSale === 'function') {
          const result = accountingService.recordSale({
            purchaseLots: data.purchaseLots,
            sale,
            settings: data.settings
          });
          nextSale = normalizeSale(result.saleRecord);

          return {
            ...data,
            purchaseLots: result.purchaseLots,
            sales: [nextSale, ...data.sales]
          };
        }

        return {
          ...data,
          sales: [nextSale, ...data.sales]
        };
      });
    }

    return nextSale;
  }

  function addOpenPurchase(storagePrefix, purchaseLot) {
    const purchaseLotService = getPurchaseLotService();
    const lot = purchaseLotService && typeof purchaseLotService.create === 'function'
      ? purchaseLotService.create(storagePrefix, purchaseLot)
      : normalizeOpenPurchase(purchaseLot || {});

    return normalizeOpenPurchase(lot);
  }

  function find(storagePrefix, saleId) {
    return read(storagePrefix).find((sale) => sale.id === saleId) || null;
  }

  function findOpenPurchase(storagePrefix, purchaseLotId) {
    return readOpenPurchases(storagePrefix).find((purchaseLot) => purchaseLot.id === purchaseLotId) || null;
  }

  function remove(storagePrefix, saleId) {
    const storageService = getStorageService();

    if (!storageService) {
      return [];
    }

    const nextData = storageService.update(storagePrefix, (data) => ({
      ...data,
      sales: data.sales.filter((sale) => sale.id !== saleId)
    }));

    return nextData.sales;
  }

  function removeOpenPurchase(storagePrefix, purchaseLotId) {
    const purchaseLotService = getPurchaseLotService();

    if (purchaseLotService && typeof purchaseLotService.remove === 'function') {
      return purchaseLotService.remove(storagePrefix, purchaseLotId).map(normalizeOpenPurchase);
    }

    return [];
  }

  function update(storagePrefix, saleId, patch) {
    const storageService = getStorageService();
    let updatedSale = null;

    if (!storageService) {
      return null;
    }

    storageService.update(storagePrefix, (data) => ({
      ...data,
      sales: data.sales.map((sale) => {
        if (sale.id !== saleId) {
          return sale;
        }

        updatedSale = normalizeSale({
          ...sale,
          ...(patch || {}),
          id: sale.id,
          createdAt: sale.createdAt,
          updatedAt: new Date().toISOString()
        });

        return updatedSale;
      })
    }));

    return updatedSale;
  }

  function summarizeOpenPurchases(purchases, storagePrefix) {
    const portfolioService = getPortfolioService();
    const data = getData(storagePrefix);
    const portfolio = portfolioService && typeof portfolioService.calculate === 'function'
      ? portfolioService.calculate(data.purchaseLots, data.settings, data.itemPriceSnapshots)
      : [];
    const summary = portfolioService && typeof portfolioService.summarize === 'function'
      ? portfolioService.summarize(portfolio)
      : { itemCount: 0, openQuantity: 0, totalInvestment: 0 };

    return {
      openCount: summary.itemCount,
      openQuantity: summary.openQuantity,
      totalInvested: summary.totalInvestment
    };
  }

  function summarize(sales, storagePrefix) {
    const statisticsService = getStatisticsService();
    const data = getData(storagePrefix);
    const resolvedSales = Array.isArray(sales) ? sales : data.sales;
    const statistics = statisticsService && typeof statisticsService.calculate === 'function'
      ? statisticsService.calculate(resolvedSales, data.purchaseLots)
      : { averageROI: 0, lifetimeProfit: 0, totalTrades: resolvedSales.length };

    return {
      activeFlips: statistics.totalTrades,
      successRate: resolvedSales.length > 0 ? (resolvedSales.filter((sale) => (Number(sale.netProfit ?? sale.profit) || 0) >= 0).length / resolvedSales.length) * 100 : 0,
      totalProfit: statistics.lifetimeProfit,
      totalQuantity: resolvedSales.reduce((total, sale) => total + (Number(sale.quantity) || 0), 0)
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
