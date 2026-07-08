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

  function getSaleTime(sale) {
    const timestamp = Date.parse(sale.updatedAt || sale.createdAt || '');
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function sumProfitSince(sales, startDate) {
    const startTime = startDate.getTime();
    return sales.reduce((total, sale) => getSaleTime(sale) >= startTime ? total + (Number(sale.profit) || 0) : total, 0);
  }

  function getBestSale(sales) {
    return sales.reduce((best, sale) => !best || (Number(sale.profit) || 0) > (Number(best.profit) || 0) ? sale : best, null);
  }

  function getWorstSale(sales) {
    return sales.reduce((worst, sale) => !worst || (Number(sale.profit) || 0) < (Number(worst.profit) || 0) ? sale : worst, null);
  }

  function calculate(sales = [], purchaseLots = []) {
    const safeSales = Array.isArray(sales) ? sales : [];
    const safeLots = Array.isArray(purchaseLots) ? purchaseLots : [];
    const now = new Date();
    const totalInvestment = safeLots.reduce((total, lot) => total + (Number(lot.totalCost) || 0), 0);
    const lifetimeProfit = safeSales.reduce((total, sale) => total + (Number(sale.profit) || 0), 0);
    const totalBuy = safeSales.reduce((total, sale) => total + (Number(sale.totalBuy) || 0), 0);
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
