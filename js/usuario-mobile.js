// ══════════════════════════════════════
// SISTEMAIL — usuario-mobile.js
// IA con respuestas predefinidas (sin API key)
// ══════════════════════════════════════

window.toggleSidebar = function() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('show');
};

window.mnAct = function(id) {
  document.querySelectorAll('.mn-item').forEach(x => x.classList.remove('on'));
  const el = document.getElementById(id); if (el) el.classList.add('on');
};

window.confirmarCerrarSesion = function() {
  if (confirm('¿Deseas cerrar sesión?')) { window.cerrarSesion && window.cerrarSesion(); }
};