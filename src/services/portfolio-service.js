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

  function calculate(lots = [], settings = {}) {
    const resolvedSettings = getSettings(settings);
    const groupedItems = lots.reduce((items, lot) => {
      const itemName = lot.itemName || 'Unnamed item';
      const quantity = Number(lot.quantity) || 0;
      const totalCost = Number(lot.totalCost) || ((Number(lot.unitCost) || 0) * quantity);

      if (!items[itemName]) {
        items[itemName] = {
          itemName,
          quantity: 0,
          totalInvestment: 0
        };
      }

      items[itemName].quantity += quantity;
      items[itemName].totalInvestment += totalCost;
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

        return {
          itemName: item.itemName,
          quantity: item.quantity,
          totalInvestment: roundMoney(item.totalInvestment),
          averageCost: roundMoney(averageCost),
          breakEvenSellPrice: roundMoney(breakEvenSellPrice),
          targetSellPrice: roundMoney(targetSellPrice),
          estimatedProfit: roundMoney(estimatedProfit),
          estimatedROI: roundMoney(estimatedROI)
        };
      })
      .sort((left, right) => right.totalInvestment - left.totalInvestment);
  }

  function summarize(portfolio = []) {
    return portfolio.reduce((summary, item) => ({
      itemCount: summary.itemCount + 1,
      openQuantity: summary.openQuantity + item.quantity,
      totalInvestment: summary.totalInvestment + item.totalInvestment,
      estimatedProfit: summary.estimatedProfit + item.estimatedProfit
    }), {
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
