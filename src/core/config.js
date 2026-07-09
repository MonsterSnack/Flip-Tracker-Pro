const FlipTrackerProConfig = Object.freeze({
  appName: 'Flip Tracker Pro',
  shortName: 'FT',
  version: '0.8.6-debug',
  rootId: 'flip-tracker-pro-root',
  storagePrefix: 'flipTrackerPro',
  defaultWindow: {
    width: 760,
    height: 560,
    top: 96,
    right: 24
  },
  buyLogIds: Object.freeze([1225, 1220, 4201, 1112, 1103, 4200, 5927, 5510]),
  sellLogIds: Object.freeze([1226, 1221, 1113, 1104, 4210, 5928, 5511]),
  requiredLogTypeIds: Object.freeze([1225, 1220, 4201, 1112, 1103, 4200, 5927, 5510, 1226, 1221, 1113, 1104, 4210, 5928, 5511])
});

if (typeof window !== 'undefined') {
  window.FlipTrackerProConfig = FlipTrackerProConfig;
}