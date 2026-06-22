// Switches Google Fonts from print-only (non-blocking fetch) to all media.
// Loaded with defer so it runs after DOM is ready — the link element exists.
// CSP-safe: this file is served from 'self' so script-src 'self' allows it.
(function () {
  var f = document.getElementById('gfonts');
  if (f) { f.media = 'all'; }
}());
