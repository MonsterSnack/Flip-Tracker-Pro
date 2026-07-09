const FlipTrackerProTradeAccountingService = (() => {
  function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function getUnitBuyPrice(lot) {
    return toNumber(lot.unitBuyPrice, toNumber(lot.unitCost, toNumber(lot.buyPrice)));
  }

  function getRemainingQuantity(lot) {
    return Math.max(0, toNumber(lot.remainingQuantity, toNumber(lot.quantity)));
  }

  function getBazaarFeeRate(settings = {}) {
    return toNumber(settings.bazaarFeeRate, 0.03);
  }

  function createSaleId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getOpenLotsForItem(purchaseLots, sale) {
    return purchaseLots
      .filter((lot) => {
        const remainingQuantity = getRemainingQuantity(lot);
        const sameItemId = sale.itemId && lot.itemId && String(lot.itemId) === String(sale.itemId);
        const sameItemName = String(lot.itemName || '').toLowerCase() === String(sale.itemName || '').toLowerCase();
        return remainingQuantity > 0 && (sameItemId || sameItemName);
      })
      .sort((left, right) => String(left.createdAt || '').localeCompare(String(right.createdAt || '')));
  }

  function matchSale({ purchaseLots = [], sale = {}, settings = {} } = {}) {
    const quantity = Math.max(1, toNumber(sale.quantity, 1));
    const unitSellPrice = toNumber(sale.unitSellPrice, toNumber(sale.sellPrice));
    const totalSellPrice = roundMoney(toNumber(sale.totalSellPrice, unitSellPrice * quantity));
    const feeRate = getBazaarFeeRate(settings);
    const explicitBuyCost = toNumber(sale.matchedBuyCost, toNumber(sale.totalBuy));
    let remainingToMatch = quantity;
    let matchedBuyCost = 0;
    const matchedLots = [];

    getOpenLotsForItem(purchaseLots, sale).forEach((lot) => {
      if (remainingToMatch <= 0) {
        return;
      }

      const availableQuantity = getRemainingQuantity(lot);
      const matchedQuantity = Math.min(availableQuantity, remainingToMatch);
      const unitBuyPrice = getUnitBuyPrice(lot);
      const lotCost = roundMoney(unitBuyPrice * matchedQuantity);

      matchedBuyCost += lotCost;
      remainingToMatch -= matchedQuantity;
      matchedLots.push({
        lotId: lot.id,
        quantity: matchedQuantity,
        unitBuyPrice,
        totalBuyPrice: lotCost
      });
    });

    if (remainingToMatch > 0 && explicitBuyCost > 0) {
      matchedBuyCost += explicitBuyCost;
      remainingToMatch = 0;
    }

    const bazaarFee = roundMoney(totalSellPrice * feeRate);
    const grossProfit = roundMoney(totalSellPrice - matchedBuyCost);
    const netProfit = roundMoney(grossProfit - bazaarFee);
    const roi = matchedBuyCost > 0 ? (netProfit / matchedBuyCost) * 100 : 0;

    return {
      id: sale.id || createSaleId(),
      itemId: sale.itemId || undefined,
      itemName: String(sale.itemName || 'Unnamed item'),
      quantity,
      unitSellPrice,
      totalSellPrice,
      matchedBuyCost: roundMoney(matchedBuyCost),
      grossProfit,
      netProfit,
      roi,
      soldAt: sale.soldAt || sale.updatedAt || sale.createdAt || new Date().toISOString(),
      source: sale.source || 'manual',
      notes: String(sale.notes || ''),
      matchedLots
    };
  }

  function applySaleToLots(purchaseLots = [], saleRecord = {}) {
    const remainingByLotId = (saleRecord.matchedLots || []).reduce((map, match) => {
      map[match.lotId] = (map[match.lotId] || 0) + (Number(match.quantity) || 0);
      return map;
    }, {});

    return purchaseLots.map((lot) => {
      const matchedQuantity = remainingByLotId[lot.id] || 0;

      if (matchedQuantity <= 0) {
        return lot;
      }

      return {
        ...lot,
        remainingQuantity: Math.max(0, getRemainingQuantity(lot) - matchedQuantity),
        updatedAt: new Date().toISOString()
      };
    });
  }

  function recordSale({ purchaseLots = [], sale = {}, settings = {} } = {}) {
    const saleRecord = matchSale({ purchaseLots, sale, settings });

    return {
      purchaseLots: applySaleToLots(purchaseLots, saleRecord),
      saleRecord
    };
  }

  return {
    applySaleToLots,
    matchSale,
    recordSale
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProTradeAccountingService = FlipTrackerProTradeAccountingService;
}
