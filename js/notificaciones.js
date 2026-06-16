// ══════════════════════════════════════
// SISTEMAIL — notificaciones.js
// Push notifications con Service Worker
// Funciona en celular y PC aunque el navegador esté cerrado
// ══════════════════════════════════════

const corrieosCriticosVistos = new Set();
let swRegistrado = false;

// ── REGISTRAR SERVICE WORKER ──
async function registrarSW() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    swRegistrado = true;
    // Escuchar mensajes del SW (cuando se hace clic en notificación)
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.action === 'irACorreos' && window.sv) window.sv('correos');
    });
    return reg;
  } catch(e) {
    console.log('SW no disponible:', e.message);
    return false;
  }
}

// ── SOLICITAR PERMISO ──
async function solicitarPermiso() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

// ── MOSTRAR NOTIFICACIÓN ──
async function mostrarNotificacion(titulo, cuerpo, tag, correoId) {
  if (Notification.permission !== 'granted') return;

  const opciones = {
    body: cuerpo,
    icon: 'https://img.icons8.com/color/96/bread.png',
    badge: 'https://img.icons8.com/color/96/bread.png',
    tag: tag || correoId,
    requireInteraction: true,  // No desaparece sola
    silent: false,             // Sí hace sonido del sistema
    vibrate: [300, 100, 300, 100, 300],
    data: { correoId, url: window.location.origin + '/admin.html' }
  };

  try {
    // Intentar con Service Worker primero (mejor en móvil)
    if (swRegistrado) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(titulo, opciones);
    } else {
      // Notificación directa del navegador
      throw new Error('usar fallback');
    }
  } catch(e) {
    // Fallback — funciona en PC siempre
    try {
      const notif = new Notification(titulo, opciones);
      notif.onclick = () => {
        window.focus();
        notif.close();
        if (window.sv) window.sv('correos');
      };
    } catch(e2) {
      console.log('Notificación no disponible:', e2.message);
    }
  }
}

// ── SONAR ALARMA ──
function sonarAlarma(veces = 3) {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < veces; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'square'; o.frequency.value = 660;
      g.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.28);
      o.start(ctx.currentTime + i * 0.35);
      o.stop(ctx.currentTime + i * 0.35 + 0.28);
    }
  } catch(e) {}
}

// ── BANNER ROJO EN PANTALLA ──
function mostrarBanner(titulo, asunto, correoId) {
  document.getElementById('notif-banner-critico')?.remove();
  const banner = document.createElement('div');
  banner.id = 'notif-banner-critico';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#C0392B,#8B1A1A);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px;z-index:99999;font-family:"Outfit",sans-serif;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,.4);animation:slideDownBanner .3s ease';
  banner.innerHTML = `
    <span style="font-size:22px;flex-shrink:0">🚨</span>
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:13px">${titulo}</div>
      <div style="font-size:12px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${asunto}</div>
    </div>
    <button onclick="if(window.sv)window.sv('correos');this.parentElement.remove()"
      style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:6px 14px;border-radius:100px;cursor:pointer;font-weight:700;font-size:12px;white-space:nowrap;flex-shrink:0">Ver →</button>
    <button onclick="this.parentElement.remove()"
      style="background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:20px;padding:0 4px;flex-shrink:0">✕</button>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner?.remove(), 20000);
}

// Inyectar CSS animación
if (!document.getElementById('notif-css')) {
  const s = document.createElement('style');
  s.id = 'notif-css';
  s.textContent = '@keyframes slideDownBanner{from{transform:translateY(-100%)}to{transform:translateY(0)}}';
  document.head.appendChild(s);
}

// ── MONITOR EN TIEMPO REAL ──
function iniciarMonitor(db, onSnapshot, collection, query, where) {
  // Solo por urgencia critico — sin != para evitar índice compuesto
  const q = query(collection(db,'correos'), where('urgencia','==','critico'));

  onSnapshot(q, snap => {
    snap.docChanges().forEach(change => {
      if (change.type !== 'added') return;
      const c = { id: change.doc.id, ...change.doc.data() };

      // Ignorar resueltos
      if (c.estado === 'resuelto') return;

      // No repetir
      if (corrieosCriticosVistos.has(c.id)) return;
      corrieosCriticosVistos.add(c.id);

      // Solo correos recientes (últimos 60 segundos)
      const ahora = Date.now();
      const creado = c.creadoEn?.seconds ? c.creadoEn.seconds * 1000 : 0;
      if (ahora - creado > 60000) return;

      const sucursal = (c.sucursal||'').replace('Pan Pa Ya Sucursal ','');
      const titulo = '🚨 Reporte CRÍTICO — ' + sucursal;
      const cuerpo = (c.asunto||'Sin asunto') + '\n' + (c.remitenteNombre||'') + (c.cargo?' · '+c.cargo:'');

      mostrarNotificacion(titulo, cuerpo, c.id, c.id);
      mostrarBanner(titulo, cuerpo, c.id);
      sonarAlarma(3);

      document.title = '🚨 CRÍTICO — SisteMail';
      setTimeout(() => { document.title = 'SisteMail — Panel Sistemas'; }, 10000);
    });
  });
}

// ── INICIALIZAR ──
async function inicializarNotificaciones(db, onSnapshot, collection, query, where) {
  await registrarSW();
  const ok = await solicitarPermiso();
  if (ok) {
    iniciarMonitor(db, onSnapshot, collection, query, where);
    return true;
  }
  return false;
}

window.SisteMailNotif = {
  inicializar: inicializarNotificaciones,
  banner: mostrarBanner,
  sonar: sonarAlarma
};