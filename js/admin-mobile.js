// ══════════════════════════════════════
// SISTEMAIL — admin-mobile.js
// IA con respuestas predefinidas (sin API key)
// ══════════════════════════════════════

window.toggleSidebar = function() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('show');
};

// Cierra el sidebar en móvil
window.cerrarSidebarMovil = function() {
  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('show');
  }
};

window.mnAct = function(id) {
  document.querySelectorAll('.mn-item').forEach(x => x.classList.remove('on'));
  const el = document.getElementById(id); if (el) el.classList.add('on');
};

window.confirmarCerrarSesion = function() {
  if (confirm('¿Deseas cerrar sesión?')) { window.cerrarSesion && window.cerrarSesion(); }
};

// Mostrar selector de sucursales en móvil cuando se abre el chat
async function actualizarSelectorMovil() {
  const esMobil = window.innerWidth <= 768;
  const selector = document.getElementById('chat-mobile-selector');
  const panelLateral = document.getElementById('chat-panel-lateral');
  if (!selector) return;

  if (esMobil) {
    selector.style.display = 'block';
    if (panelLateral) panelLateral.style.display = 'none';

    const cont = document.getElementById('chat-contactos-movil');
    if (!cont) return;
    cont.innerHTML = ''; // Siempre refrescar

    // Encabezado sucursales
    const hSuc = document.createElement('div');
    hSuc.style.cssText = 'width:100%;font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;padding:4px 2px 6px;letter-spacing:.05em';
    hSuc.textContent = 'Sucursales';
    cont.appendChild(hSuc);

    const SUCURSALES_MOVIL = ["Pan Pa Ya Sucursal Chapinero 58","Pan Pa Ya Sucursal Mazuren","Pan Pa Ya Sucursal Multiplaza","Pan Pa Ya Sucursal Pepe Sierra","Pan Pa Ya Sucursal 32","Pan Pa Ya Sucursal Bulevar 52","Pan Pa Ya Sucursal 96","Pan Pa Ya Sucursal 98","Pan Pa Ya Sucursal 100","Pan Pa Ya Sucursal 103","Pan Pa Ya Sucursal 106","Pan Pa Ya Sucursal 138","Pan Pa Ya Sucursal Alkosto 68","Pan Pa Ya Sucursal Alkosto 170","Pan Pa Ya Sucursal Avenida 19","Pan Pa Ya Sucursal Batan 125","Pan Pa Ya Sucursal Bella Suiza 127","Pan Pa Ya Sucursal Bosque","Pan Pa Ya Sucursal Cafe 98","Pan Pa Ya Sucursal Calleja","Pan Pa Ya Sucursal Cedritos 147","Pan Pa Ya Sucursal Chia","Pan Pa Ya Sucursal Cota","Pan Pa Ya Sucursal Home Center 80","Pan Pa Ya Sucursal Home Center 170","Pan Pa Ya Sucursal Home Center Cajica","Pan Pa Ya Sucursal Home Center Dorado","Pan Pa Ya Sucursal Retiro 82","Pan Pa Ya Sucursal Rosales","Pan Pa Ya Sucursal Salitre","Pan Pa Ya Sucursal Santa Fe","Pan Pa Ya Sucursal Sarmiento","Pan Pa Ya Sucursal Suba","Pan Pa Ya Sucursal Unicentro","Pan Pa Ya Sucursal Calle 80"];

    SUCURSALES_MOVIL.forEach(s => {
      const btn = document.createElement('button');
      btn.textContent = s.replace('Pan Pa Ya Sucursal ','');
      btn.style.cssText = 'padding:6px 11px;border-radius:100px;border:1px solid rgba(0,0,0,.12);background:#fff;font-size:11px;font-family:"Outfit",sans-serif;cursor:pointer;color:var(--charcoal);white-space:nowrap';
      btn.onclick = () => {
        cont.querySelectorAll('button').forEach(b=>{b.style.background='#fff';b.style.color='var(--charcoal)';});
        btn.style.background='var(--bread)';btn.style.color='#fff';
        window.seleccionarChatAdmin && window.seleccionarChatAdmin(s);
      };
      cont.appendChild(btn);
    });

    // Encabezado Oficina Central
    const hOf = document.createElement('div');
    hOf.style.cssText = 'width:100%;font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;padding:8px 2px 6px;letter-spacing:.05em;border-top:1px solid rgba(0,0,0,.08);margin-top:4px';
    hOf.textContent = 'Oficina Central — Individual';
    cont.appendChild(hOf);

    // Cargar personas de Oficina Central
    if (window._usuariosOficinaMovil && window._usuariosOficinaMovil.length > 0) {
      window._usuariosOficinaMovil.forEach(u => {
        const chatId = 'oficina_' + u.id;
        const btn = document.createElement('button');
        btn.textContent = (u.nombre||'Sin nombre') + (u.cargo?' ('+u.cargo+')':'');
        btn.style.cssText = 'padding:6px 11px;border-radius:100px;border:1px solid rgba(22,80,160,.3);background:var(--info-bg);font-size:11px;font-family:"Outfit",sans-serif;cursor:pointer;color:var(--info);white-space:nowrap';
        btn.onclick = () => {
          cont.querySelectorAll('button').forEach(b=>{b.style.background='var(--info-bg)';b.style.color='var(--info)';});
          btn.style.background='var(--info)';btn.style.color='#fff';
          window.seleccionarChatAdmin && window.seleccionarChatAdmin(chatId, true, u.nombre);
        };
        cont.appendChild(btn);
      });
    } else {
      const vacio = document.createElement('span');
      vacio.style.cssText = 'font-size:11px;color:var(--gray);padding:4px 8px';
      vacio.textContent = 'Sin usuarios registrados';
      cont.appendChild(vacio);
    }

  } else {
    selector.style.display = 'none';
    if (panelLateral) panelLateral.style.display = 'flex';
  }
}

// Exponer función para que admin-app.js la llame
window.actualizarSelectorMovilChat = actualizarSelectorMovil;