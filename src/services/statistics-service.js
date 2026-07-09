const FlipTrackerProStatisticsService = (() => {
  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function startOfWeek(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return startOfDay(new Date(date.getFullYear(), date.getMonth(), diff));
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function getSaleProfit(sale) {
    return Number(sale.netProfit ?? sale.profit) || 0;
  }

  function getSaleBuyCost(sale) {
    return Number(sale.matchedBuyCost ?? sale.totalBuy) || 0;
  }

  function getSaleTime(sale) {
    const timestamp = Date.parse(sale.soldAt || sale.updatedAt || sale.createdAt || '');
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function getLotOpenInvestment(lot) {
    const quantity = Number(lot.quantity) || 0;
    const remainingQuantity = lot.remainingQuantity === undefined ? quantity : Number(lot.remainingQuantity);
    const unitBuyPrice = Number(lot.unitBuyPrice ?? lot.unitCost ?? lot.buyPrice) || 0;
    return Math.max(0, remainingQuantity) * unitBuyPrice;
  }

  function sumProfitSince(sales, startDate) {
    const startTime = startDate.getTime();
    return sales.reduce((total, sale) => getSaleTime(sale) >= startTime ? total + getSaleProfit(sale) : total, 0);
  }

  function getBestSale(sales) {
    return sales.reduce((best, sale) => !best || getSaleProfit(sale) > getSaleProfit(best) ? sale : best, null);
  }

  function getWorstSale(sales) {
    return sales.reduce((worst, sale) => !worst || getSaleProfit(sale) < getSaleProfit(worst) ? sale : worst, null);
  }

  function calculate(sales = [], purchaseLots = []) {
    const safeSales = Array.isArray(sales) ? sales : [];
    const safeLots = Array.isArray(purchaseLots) ? purchaseLots : [];
    const now = new Date();
    const totalInvestment = safeLots.reduce((total, lot) => total + getLotOpenInvestment(lot), 0);
    const lifetimeProfit = safeSales.reduce((total, sale) => total + getSaleProfit(sale), 0);
    const totalBuy = safeSales.reduce((total, sale) => total + getSaleBuyCost(sale), 0);
    const averageROI = totalBuy > 0 ? (lifetimeProfit / totalBuy) * 100 : 0;

    return {
      totalTrades: safeSales.length,
      totalInvestment,
      lifetimeProfit,
      todayProfit: sumProfitSince(safeSales, startOfDay(now)),
      weeklyProfit: sumProfitSince(safeSales, startOfWeek(now)),
      monthlyProfit: sumProfitSince(safeSales, startOfMonth(now)),
      bestFlip: getBestSale(safeSales),
      worstFlip: getWorstSale(safeSales),
      averageROI
    };
  }

  return {
    calculate
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProStatisticsService = FlipTrackerProStatisticsService;
}
