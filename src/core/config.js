const FlipTrackerProConfig = Object.freeze({
  appName: 'Flip Tracker Pro',
  version: '0.1.1',
  rootId: 'flip-tracker-pro-root',
  storagePrefix: 'flipTrackerPro',
  defaultWindow: {
    width: 420,
    height: 520,
    top: 96,
    right: 24
  }
});

if (typeof window !== 'undefined') {
  window.FlipTrackerProConfig = FlipTrackerProConfig;
}
