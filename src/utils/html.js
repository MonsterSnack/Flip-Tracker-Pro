const FlipTrackerProHtml = (() => {
  const entities = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
  }

  return {
    escapeHtml
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProHtml = FlipTrackerProHtml;
}
