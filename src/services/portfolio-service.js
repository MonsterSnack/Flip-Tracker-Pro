const FlipTrackerProPortfolioService = (() => {
  function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function getSettings(settings) {
    return {
      bazaarFeeRate: Number(settings && settings.bazaarFeeRate) || 0,
      targetRoi: Number(settings && settings.targetRoi) || 0
    };
  }

  function getLotUnitBuyPrice(lot) {
    return Number(lot.unitBuyPrice ?? lot.unitCost ?? lot.buyPrice) || 0;
  }

  function getRemainingQuantity(lot) {
    const quantity = Number(lot.quantity) || 0;
    const remainingQuantity = lot.remainingQuantity === undefined ? quantity : Number(lot.remainingQuantity);
    return Math.max(0, Number.isFinite(remainingQuantity) ? remainingQuantity : quantity);
  }

  function getSnapshotKey(snapshot) {
    return snapshot.itemId ? `id:${snapshot.itemId}` : `name:${String(snapshot.itemName || '').toLowerCase()}`;
  }

  function createSnapshotMap(priceSnapshots = []) {
    return priceSnapshots.reduce((snapshots, snapshot) => {
      const key = getSnapshotKey(snapshot);
      const current = snapshots[key];
      const currentTime = current ? Date.parse(current.timestamp || '') : 0;
      const nextTime = Date.parse(snapshot.timestamp || '') || 0;

      if (!current || nextTime >= currentTime) {
        snapshots[key] = snapshot;
      }

      return snapshots;
    }, {});
  }

  function findSnapshot(item, snapshotMap) {
    return snapshotMap[`id:${item.itemId}`] || snapshotMap[`name:${String(item.itemName || '').toLowerCase()}`] || null;
  }

  function calculate(lots = [], settings = {}, priceSnapshots = []) {
    const resolvedSettings = getSettings(settings);
    const snapshotMap = createSnapshotMap(priceSnapshots);
    const groupedItems = lots.reduce((items, lot) => {
      const itemName = lot.itemName || 'Unnamed item';
      const itemId = lot.itemId || '';
      const quantity = getRemainingQuantity(lot);
      const unitBuyPrice = getLotUnitBuyPrice(lot);
      const openInvestment = unitBuyPrice * quantity;
      const key = itemId ? `id:${itemId}` : `name:${String(itemName).toLowerCase()}`;

      if (quantity <= 0) {
        return items;
      }

      if (!items[key]) {
        items[key] = {
          itemId,
          itemName,
          quantity: 0,
          totalInvestment: 0
        };
      }

      items[key].quantity += quantity;
      items[key].totalInvestment += openInvestment;
      return items;
    }, {});

    return Object.values(groupedItems)
      .map((item) => {
        const averageCost = item.quantity > 0 ? item.totalInvestment / item.quantity : 0;
        const feeMultiplier = Math.max(0.0001, 1 - resolvedSettings.bazaarFeeRate);
        const breakEvenSellPrice = averageCost / feeMultiplier;
        const targetSellPrice = (averageCost * (1 + (resolvedSettings.targetRoi / 100))) / feeMultiplier;
        const netTargetRevenue = targetSellPrice * item.quantity * feeMultiplier;
        const estimatedProfit = netTargetRevenue - item.totalInvestment;
        const estimatedROI = item.totalInvestment > 0 ? (estimatedProfit / item.totalInvestment) * 100 : 0;
        const snapshot = findSnapshot(item, snapshotMap);
        const currentSellPrice = snapshot ? Number(snapshot.bazaarPrice ?? snapshot.marketPrice) || 0 : 0;
        const currentNetRevenue = currentSellPrice * item.quantity * feeMultiplier;
        const currentEstimatedProfit = snapshot ? currentNetRevenue - item.totalInvestment : 0;
        const currentEstimatedROI = item.totalInvestment > 0 && snapshot ? (currentEstimatedProfit / item.totalInvestment) * 100 : 0;

        return {
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: item.quantity,
          totalInvestment: roundMoney(item.totalInvestment),
          averageCost: roundMoney(averageCost),
          breakEvenSellPrice: roundMoney(breakEvenSellPrice),
          targetSellPrice: roundMoney(targetSellPrice),
          estimatedProfit: roundMoney(estimatedProfit),
          estimatedROI: roundMoney(estimatedROI),
          currentSellPrice: roundMoney(currentSellPrice),
          currentEstimatedProfit: roundMoney(currentEstimatedProfit),
          currentEstimatedROI: roundMoney(currentEstimatedROI),
          priceUpdatedAt: snapshot ? snapshot.timestamp : ''
        };
      })
      .sort((left, right) => right.totalInvestment - left.totalInvestment);
  }

  function summarize(portfolio = []) {
    return portfolio.reduce((summary, item) => ({
      itemCount: summary.itemCount + 1,
      openQuantity: summary.openQuantity + item.quantity,
      totalInvestment: summary.totalInvestment + item.totalInvestment,
      estimatedProfit: summary.estimatedProfit + item.estimatedProfit,
      currentEstimatedProfit: summary.currentEstimatedProfit + item.currentEstimatedProfit
    }), {
      currentEstimatedProfit: 0,
      estimatedProfit: 0,
      itemCount: 0,
      openQuantity: 0,
      totalInvestment: 0
    });
  }

  return {
    calculate,
    summarize
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProPortfolioService = FlipTrackerProPortfolioService;
}
