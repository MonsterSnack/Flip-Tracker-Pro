const FlipTrackerProConfig = Object.freeze({
  appName: 'Flip Tracker Pro',
  shortName: 'FT',
  version: '0.7.5',
  rootId: 'flip-tracker-pro-root',
  storagePrefix: 'flipTrackerPro',
  defaultWindow: {
    width: 760,
    height: 560,
    top: 96,
    right: 24
  },
  requiredApiSelections: Object.freeze([
    'key -> info',
    'user -> log',
    'torn -> items',
    'market -> itemmarket'
  ]),
  requiredLogTypeIds: Object.freeze([1225, 1220, 4201, 1112, 4200, 5927, 5510]),
  requiredLogTypeDescriptions: Object.freeze({
    1225: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    1220: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    4201: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    1112: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    4200: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    5927: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    5510: 'Item buy/sell/trade log type required for Flip Tracker Pro import'
  })
});

if (typeof window !== 'undefined') {
  window.FlipTrackerProConfig = FlipTrackerProConfig;
}
