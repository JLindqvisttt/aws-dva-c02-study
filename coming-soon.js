function toggleTheme() {
  var html = document.documentElement;
  var next = (html.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.getElementById('theme-toggle').textContent = next === 'dark' ? '🌙' : '☀️';
}
(function () {
  var t = localStorage.getItem('theme') || 'dark';
  document.getElementById('theme-toggle').textContent = t === 'dark' ? '🌙' : '☀️';
  var p = new URLSearchParams(window.location.search);
  var cert = p.get('cert') || 'Certification';
  document.getElementById('cert-code').textContent = cert.toUpperCase();
})();
