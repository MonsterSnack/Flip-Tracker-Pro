const FlipTrackerProConfig = Object.freeze({
  appName: 'Flip Tracker Pro',
  shortName: 'FTP',
  version: '0.1.5',
  rootId: 'flip-tracker-pro-root',
  storagePrefix: 'flipTrackerPro',
  defaultWindow: {
    width: 360,
    height: 480,
    top: 96,
    right: 24
  }
});

if (typeof window !== 'undefined') {
  window.FlipTrackerProConfig = FlipTrackerProConfig;
}
