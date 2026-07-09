const FlipTrackerProConfig = Object.freeze({
  appName: 'Flip Tracker Pro',
  shortName: 'FT',
  version: '0.7.1',
  rootId: 'flip-tracker-pro-root',
  storagePrefix: 'flipTrackerPro',
  defaultWindow: {
    width: 760,
    height: 560,
    top: 96,
    right: 24
  }
});

if (typeof window !== 'undefined') {
  window.FlipTrackerProConfig = FlipTrackerProConfig;
}
