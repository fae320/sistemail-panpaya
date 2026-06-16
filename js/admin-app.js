import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, where,
         onSnapshot, getDocs, doc, getDoc, updateDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const CLOUD_NAME="dasj362le", UPLOAD_PRESET="sistemail_panpaya";
const firebaseConfig={apiKey:"AIzaSyD0E16pOxUHE4RvJhO83LY2CAXXyGpMp2s",authDomain:"sistemail-panpaya2.firebaseapp.com",projectId:"sistemail-panpaya2",storageBucket:"sistemail-panpaya2.firebasestorage.app",messagingSenderId:"449058639435",appId:"1:449058639435:web:06b9b0b6cd3ba193e4c7ce"};

const SUCURSALES=["Pan Pa Ya Sucursal Chapinero 58","Pan Pa Ya Sucursal Mazuren","Pan Pa Ya Sucursal Multiplaza","Pan Pa Ya Sucursal Pepe Sierra","Pan Pa Ya Sucursal 32","Pan Pa Ya Sucursal Bulevar 52","Pan Pa Ya Sucursal 96","Pan Pa Ya Sucursal 98","Pan Pa Ya Sucursal 100","Pan Pa Ya Sucursal 103","Pan Pa Ya Sucursal 106","Pan Pa Ya Sucursal 138","Pan Pa Ya Sucursal Alkosto 68","Pan Pa Ya Sucursal Alkosto 170","Pan Pa Ya Sucursal Avenida 19","Pan Pa Ya Sucursal Batan 125","Pan Pa Ya Sucursal Bella Suiza 127","Pan Pa Ya Sucursal Bosque","Pan Pa Ya Sucursal Cafe 98","Pan Pa Ya Sucursal Calleja","Pan Pa Ya Sucursal Cedritos 147","Pan Pa Ya Sucursal Chia","Pan Pa Ya Sucursal Cota","Pan Pa Ya Sucursal Home Center 80","Pan Pa Ya Sucursal Home Center 170","Pan Pa Ya Sucursal Home Center Cajica","Pan Pa Ya Sucursal Home Center Dorado","Pan Pa Ya Sucursal Retiro 82","Pan Pa Ya Sucursal Rosales","Pan Pa Ya Sucursal Salitre","Pan Pa Ya Sucursal Santa Fe","Pan Pa Ya Sucursal Sarmiento","Pan Pa Ya Sucursal Suba","Pan Pa Ya Sucursal Unicentro","Pan Pa Ya Sucursal Calle 80"];

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
window._firebaseApp=app;

let adminActual=null,perfilAdmin=null,sucursalChatActual=null;
let mediaRecorder=null,audioChunks=[],recInterval=null,recSegs=0;
let todosLosCorreos=[],reunionesActuales=[];
// Variables legacy — evitan errores si el servidor tiene código viejo
let _chatYaCargo=false,_chatEnProceso=false,chatCargando=false;
let alertaActivaId=null,alertaPostpuesta=false;
let chatUnsubscribe=null;
let cerrando=false; // bandera cerrar sesión

// -- AUTH CON PERSISTENCIA --
setPersistence(auth, browserLocalPersistence).then(() => {
  onAuthStateChanged(auth, async(user) => {
    if (cerrando) return; // bloquear si estamos cerrando
    if (!user) { window.location.href='index.html'; return; }
    try {
      const snap = await getDoc(doc(db,'usuarios',user.uid));
      if (!snap.exists()) { window.location.href='index.html'; return; }
      const perfil = snap.data();
      if (perfil.rol !== 'admin') { window.location.href='usuario.html'; return; }
      adminActual=user; perfilAdmin=perfil;
      const esTecnico = perfil.subrol === 'tecnico';
      const ini=perfilAdmin.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      document.getElementById('adm-av').textContent=ini;
      document.getElementById('top-av').textContent=ini;
      document.getElementById('adm-nombre').textContent=perfilAdmin.nombre;
      // Mostrar rol en sidebar
      const roleEl = document.querySelector('.u-role');
      if (roleEl) roleEl.textContent = esTecnico ? 'Técnico · Sistemas' : 'Administrador · Sistemas';
      // Ocultar secciones restringidas para técnicos
      if (esTecnico) {
        const perms = perfil.permisos || {};
        // Si tiene acceso total — ve todo igual que el admin
        if(perms.accesoTotal){
          // Solo ocultar gestión de usuarios (crear/eliminar) — puede ver lista
          const navUsuarios = document.getElementById('nav-usuarios');
          // Acceso total: puede ver usuarios pero no crear ni eliminar (eso se bloquea en las funciones)
          // Mostrar todo el menú
          mostrarToast('👑 Bienvenido — tienes acceso total');
        } else {
          // Permisos individuales
          const mapa = {
            'nav-correos':     perms.correos     !== false,
            'nav-criticos':    perms.correos     !== false,
            'nav-compose':     perms.redactar    !== false,
            'nav-chat':        perms.chat        !== false,
            'nav-reuniones':   perms.reuniones   !== false,
            'nav-solicitudes': perms.solicitudes !== false,
            'nav-mapa':        perms.mapa        !== false,
            'nav-reportes':    perms.estadisticas!== false,
            'nav-usuarios':    false,
            'nav-sucursales':  false,
          };
          Object.entries(mapa).forEach(([id, visible]) => {
            const el = document.getElementById(id);
            if(el) el.style.display = visible ? '' : 'none';
          });
        }
        const avEl = document.getElementById('adm-av');
        if(avEl) avEl.title = perms.accesoTotal ? 'Técnico — Acceso total' : 'Técnico';
      }
      cargarTodosCorreos();
      cargarReuniones();
      cargarSolicitudes();
      cargarUsuarios();
      setInterval(verificarReunion,30000);
      setTimeout(iniciarNotificaciones, 2000);
      setTimeout(iniciarMonitorChatNoLeidos, 3000);
      setTimeout(iniciarMonitorCriticos, 4000);
    } catch(e) { console.error('Auth error:', e); }
  });
});

// -- CERRAR SESIÓN --
// -- BADGES DE CHAT NO LEIDOS --
// Guarda en localStorage cuando el admin abre cada chat
window._chatVisto = {};
function marcarChatVisto(chatId){
  const ahora = Date.now();
  window._chatVisto[chatId] = ahora;
  try{ localStorage.setItem('sv_'+chatId, ahora); } catch(e){}
  actualizarBadgesChat();
}
function getChatVisto(chatId){
  if(window._chatVisto[chatId]) return window._chatVisto[chatId];
  try{ return parseInt(localStorage.getItem('sv_'+chatId)||'0'); } catch(e){ return 0; }
}

// Todos los mensajes de chat en memoria
window._todosLosMensajesChat = [];

function iniciarMonitorChatNoLeidos(){
  // Query simple sin indices
  onSnapshot(collection(db,'chat'), snap => {
    window._todosLosMensajesChat = [];
    snap.forEach(d => {
      const m = d.data();
      if(m.esAdmin === true) return; // solo de sucursales
      const ts = m.creadoEn?.seconds ? m.creadoEn.seconds*1000 : 0;
      const key = m.chatId || m.sucursal || '';
      if(key) window._todosLosMensajesChat.push({key, ts});
    });
    actualizarBadgesChat();
  });
}

function actualizarBadgesChat(){
  const conteo = {};
  window._todosLosMensajesChat.forEach(({key, ts}) => {
    const visto = getChatVisto(key);
    if(ts > visto) conteo[key] = (conteo[key]||0) + 1;
  });
  const total = Object.values(conteo).reduce((a,b)=>a+b, 0);

  const bc = document.getElementById('badge-chat-admin');
  if(bc){ bc.textContent = total > 99 ? '99+' : total; bc.style.display = total > 0 ? 'inline' : 'none'; }

  const noLeidosCorreos = document.querySelectorAll('.ei.unread').length;
  const totalCampana = total + noLeidosCorreos;
  const nb = document.getElementById('notif-count');
  if(nb){ nb.textContent = totalCampana > 99 ? '99+' : totalCampana; nb.style.display = totalCampana > 0 ? 'inline' : 'none'; }
  const dot = document.getElementById('notif-dot');
  if(dot) dot.style.display = totalCampana > 0 ? 'block' : 'none';

  setTimeout(() => {
    const cont = document.getElementById('chat-contactos-admin');
    if(!cont) return;
    cont.querySelectorAll('.ci').forEach(item => {
      const nombre = (item.querySelector('.ci-name')?.textContent||'').trim();
      // Buscar por chatId guardado en el elemento o por nombre
      const chatIdEl = item.dataset.chatId || '';
      let n = 0;
      Object.entries(conteo).forEach(([key, cnt]) => {
        // Coincide por chatId exacto o por nombre de sucursal
        if(chatIdEl && key === chatIdEl){ n += cnt; return; }
        const kn = key.replace('Pan Pa Ya Sucursal ','').trim();
        if(nombre === kn || nombre.includes(kn) || kn.includes(nombre)) n += cnt;
      });
      let badge = item.querySelector('.chat-nb');
      if(n > 0){
        if(!badge){
          badge = document.createElement('span');
          badge.className = 'chat-nb';
          badge.style.cssText = 'background:#E53935;color:#fff;border-radius:50px;font-size:10px;font-weight:700;padding:1px 7px;margin-left:auto;min-width:18px;text-align:center';
          item.style.cssText += ';display:flex;align-items:center;gap:6px';
          item.appendChild(badge);
        }
        badge.textContent = n > 99 ? '99+' : n;
        badge.style.display = 'inline';
      } else if(badge){ badge.style.display = 'none'; }
    });
  }, 200);
}

function actualizarPanelNotif(){
  const lista=document.getElementById('notif-lista');
  if(!lista)return;
  const criticos=todosLosCorreos.filter(c=>c.urgencia==='critico'&&c.estado!=='resuelto');
  const recientes=[...todosLosCorreos].sort((a,b)=>(b.creadoEn?.seconds||0)-(a.creadoEn?.seconds||0)).slice(0,5);
  if(!criticos.length&&!recientes.length){
    lista.innerHTML='<div style="padding:2rem;text-align:center"><div style="font-size:32px;margin-bottom:.5rem">🔔</div><div style="font-size:13px;color:var(--gray)">Sin notificaciones</div></div>';
    return;
  }
  lista.innerHTML='';
  if(criticos.length){
    const hdr=document.createElement('div');
    hdr.style.cssText='padding:.5rem 1rem;font-size:10px;font-weight:700;color:#fff;background:var(--danger);letter-spacing:.05em';
    hdr.innerHTML='🚨 ALERTAS CRÍTICAS ('+criticos.length+')';
    lista.appendChild(hdr);
    criticos.forEach(c=>{
      const hora=c.creadoEn?new Date(c.creadoEn.seconds*1000).toLocaleString('es-CO',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      const div=document.createElement('div');
      div.style.cssText='padding:.8rem 1rem;border-bottom:1px solid rgba(200,32,26,.12);cursor:pointer;display:flex;gap:10px;align-items:flex-start;background:#FFF8F8';
      div.onmouseenter=()=>div.style.background='#FFE8E8';
      div.onmouseleave=()=>div.style.background='#FFF8F8';
      div.onclick=()=>{abrirCorreo&&abrirCorreo(c);document.getElementById('notif-panel').style.display='none';sv('correos');};
      div.innerHTML='<div style="width:36px;height:36px;border-radius:10px;background:var(--danger);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">🚨</div>'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:12px;font-weight:700;color:var(--danger);margin-bottom:2px">🔴 '+(c.sucursal||'').replace('Pan Pa Ya Sucursal ','')+'</div>'
        +'<div style="font-size:12px;font-weight:600;color:var(--charcoal);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(c.asunto||'Sin asunto')+'</div>'
        +'<div style="font-size:11px;color:var(--gray);margin-top:2px">👤 '+(c.remitenteNombre||'')+' · '+hora+'</div>'
        +'</div><div style="font-size:10px;color:var(--danger);font-weight:600">Ver →</div>';
      lista.appendChild(div);
    });
  }
  if(recientes.length){
    const sep=document.createElement('div');
    sep.style.cssText='padding:.4rem 1rem;font-size:10px;font-weight:700;color:var(--gray);background:var(--cream);letter-spacing:.05em';
    sep.textContent='📬 RECIENTES';lista.appendChild(sep);
    recientes.forEach(c=>{
      const hora=c.creadoEn?new Date(c.creadoEn.seconds*1000).toLocaleString('es-CO',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      const esC=c.urgencia==='critico',esI=c.urgencia==='importante';
      const bgIco=esC?'var(--danger)':esI?'#D4860C':'var(--success)';
      const icono=esC?'🔴':esI?'🟡':'🟢';
      const div=document.createElement('div');
      div.style.cssText='padding:.7rem 1rem;border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer;display:flex;gap:10px;align-items:flex-start';
      div.onmouseenter=()=>div.style.background='var(--cream)';
      div.onmouseleave=()=>div.style.background='';
      div.onclick=()=>{abrirCorreo&&abrirCorreo(c);sv('correos');document.getElementById('notif-panel').style.display='none';};
      div.innerHTML='<div style="width:34px;height:34px;border-radius:9px;background:'+bgIco+';display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">'+icono+'</div>'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:12px;font-weight:600;color:var(--charcoal);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(c.asunto||'Sin asunto')+'</div>'
        +'<div style="font-size:11px;color:var(--gray);margin-top:2px">📍 '+(c.sucursal||'').replace('Pan Pa Ya Sucursal ','')+(hora?' · '+hora:'')+'</div>'
        +'</div>';
      lista.appendChild(div);
    });
  }
  const dot=document.getElementById('notif-dot');
  if(dot)dot.style.display=criticos.length>0?'block':'none';
}

window.cerrarSesion = async function() {
  cerrando = true; // bloquear onAuthStateChanged
  try { await signOut(auth); } catch(e) {}
  sessionStorage.clear();
  window.location.replace('index.html'); // replace evita el historial
};

// -- INICIAR NOTIFICACIONES --
async function iniciarNotificaciones() {
  // Registrar service worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch(e) {}
  }

  // Pedir permiso de notificaciones
  if ('Notification' in window && Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      mostrarToast('🔔 Notificaciones activadas');
      return;
    }
  }

  if (Notification.permission === 'granted') {
    if (window.SisteMailNotif) {
      await window.SisteMailNotif.inicializar(db, onSnapshot, collection, query, where);
    }
    return;
  }

  // Si no hay permiso — mostrar botón para activar
  if (Notification.permission === 'denied' || Notification.permission === 'default') {
    const btn = document.getElementById('btn-activar-notif');
    if (btn) btn.style.display = 'flex';
  }
}

// Monitor de correos críticos — funciona sin permisos (alerta visual + sonido)
function iniciarMonitorCriticos() {
  onSnapshot(
    query(collection(db,'correos'), where('urgencia','==','critico'), where('estado','!=','resuelto')),
    snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const c = change.doc.data();
          const key = 'crit_' + change.doc.id;
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, '1');
          // Alerta visual siempre
          mostrarToast('🚨 CRÍTICO: ' + (c.asunto||'Nuevo reporte') + ' — ' + (c.sucursal||'').replace('Pan Pa Ya Sucursal ',''));
          sonarAlarma(3);
          // Notificación push si hay permiso
          if (Notification.permission === 'granted') {
            new Notification('🚨 Reporte Crítico — SisteMail', {
              body: (c.asunto||'Nuevo reporte') + '\n' + (c.sucursal||'').replace('Pan Pa Ya Sucursal ',''),
              icon: 'img/logo.png',
              tag: change.doc.id,
              requireInteraction: true,
              vibrate: [300,100,300,100,300]
            });
          }
        }
      });
    }
  );
}

// -- MONITOR REUNIONES — 3 alarmas --
const alertasDisparadas = new Set();

function verificarReunion(){
  const ahora = new Date();
  reunionesActuales.forEach(r=>{
    // Ignorar reuniones sin datos completos
    if(!r.fecha || !r.hora || !r.titulo) return;
    const[a,m,d] = r.fecha.split('-').map(Number);
    const[hh,mm] = r.hora.split(':').map(Number);
    if(isNaN(a)||isNaN(hh)) return;
    const fR = new Date(a,m-1,d,hh,mm,0);
    const diffMin = Math.round((fR-ahora)/60000);
    // Solo alertar reuniones futuras próximas (no pasadas de más de 15 min)
    if(diffMin < -15) return;

    if(diffMin===5&&!alertasDisparadas.has(r.id+'_antes')){
      alertasDisparadas.add(r.id+'_antes');
      mostrarAlertaReunion(r,'Faltan 5 minutos');
      sonarAlarma(1);
      setTimeout(()=>cerrarAlerta(),60000);
    }
    if(diffMin===0&&!alertasDisparadas.has(r.id+'_ahora')){
      alertasDisparadas.add(r.id+'_ahora');
      mostrarAlertaReunion(r,'Es la hora!');
      sonarAlarma(3);
      setTimeout(()=>cerrarAlerta(),120000);
    }
    if(diffMin===-5&&!alertasDisparadas.has(r.id+'_despues')){
      alertasDisparadas.add(r.id+'_despues');
      mostrarAlertaReunion(r,'Empezo hace 5 min');
      sonarAlarma(1);
      setTimeout(()=>cerrarAlerta(),60000);
    }
    if(alertaActivaId===r.id){
      const el=document.getElementById('ra-countdown');
      if(el) el.textContent = diffMin>0?'Faltan '+diffMin+' min':diffMin===0?'AHORA!':'Empezo hace '+Math.abs(diffMin)+' min';
    }
  });
}

function sonarAlarma(veces){
  try{
    const ctx=new AudioContext();
    for(let i=0;i<veces;i++){
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.value=880;
      g.gain.setValueAtTime(.3,ctx.currentTime+i*.4);
      g.gain.exponentialRampToValueAtTime(.01,ctx.currentTime+i*.4+.35);
      o.start(ctx.currentTime+i*.4);o.stop(ctx.currentTime+i*.4+.35);
    }
  }catch(e){}
}

function mostrarAlertaReunion(r, mensaje){
  // No mostrar si no hay datos válidos
  if(!r.titulo && !r.persona && !r.hora) return;
  alertaActivaId = r.id;
  document.getElementById('ra-titulo').textContent = r.titulo||'Reunión';
  const persona = (r.persona||'').replace('Pan Pa Ya Sucursal ','');
  document.getElementById('ra-detalle').textContent = mensaje + (persona?' · Con: '+persona:'') + (r.hora?' · '+r.hora:'');
  const linkEl = document.getElementById('ra-link');
  if(r.link){ linkEl.href=r.link; linkEl.style.display='flex'; }
  else linkEl.style.display='none';
  document.getElementById('ra-countdown').textContent='';
  document.getElementById('reunion-alert').classList.add('show');
}
window.cerrarAlerta=function(){document.getElementById('reunion-alert').classList.remove('show');alertaActivaId=null;};
window.posponerReunion=function(){alertaPostpuesta=true;document.getElementById('reunion-alert').classList.remove('show');alertaActivaId=null;mostrarToast('⏰ Pospuesto 5 min');setTimeout(()=>{alertaPostpuesta=false;},5*60*1000);};

// -- REUNIONES --
function cargarReuniones(){
  const q=query(collection(db,'reuniones'),orderBy('creadoEn','desc'));
  onSnapshot(q,snap=>{
    reunionesActuales=[];
    const cont=document.getElementById('lista-reuniones');
    if(snap.empty){cont.innerHTML='<div style="padding:2rem;text-align:center;color:var(--gray);font-size:13px">No hay reuniones.</div>';return;}
    cont.innerHTML='';const ahora=new Date();let proxima=null;
    snap.forEach(d=>{
      const r={id:d.id,...d.data()};reunionesActuales.push(r);
      if(r.fecha&&r.hora){const[a,m,di]=r.fecha.split('-').map(Number);const[hh,mm]=r.hora.split(':').map(Number);const fR=new Date(a,m-1,di,hh,mm);if(fR>=ahora&&(!proxima||fR<new Date(proxima._ts))){proxima=r;proxima._ts=fR.getTime();}}
      cont.appendChild(crearTarjetaReunion(r));
    });
    if(proxima){
      const[a,m,d]=proxima.fecha.split('-').map(Number);const[hh,mm]=proxima.hora.split(':').map(Number);
      const fR=new Date(a,m-1,d,hh,mm);const diffMin=Math.round((fR-ahora)/60000);
      const txt=diffMin<60?'en '+diffMin+' min':'el '+fR.toLocaleDateString('es-CO',{day:'2-digit',month:'long'});
      const texto='"'+proxima.titulo+'" con '+(proxima.persona||'').replace('Pan Pa Ya Sucursal ','')+' — '+txt;
      const pt=document.getElementById('prox-reunion-texto');if(pt)pt.textContent=texto;
      const rt=document.getElementById('reminder-texto');if(rt)rt.textContent='📅 '+texto;
      const pr=document.getElementById('prox-reunion');if(pr)pr.style.display='flex';
      const rr=document.getElementById('reminder-reunion');if(rr)rr.style.display='flex';
      if(diffMin<=30){const br=document.getElementById('badge-reuniones');if(br)br.style.display='inline';}
    }
    verificarReunion();
  });
}

function crearTarjetaReunion(r){
  const ahora = new Date();
  let pasada = false;
  if(r.fecha && r.hora){
    const[a,m,d]=r.fecha.split('-').map(Number);
    const[hh,mm]=r.hora.split(':').map(Number);
    pasada = new Date(a,m-1,d,hh,mm) < ahora;
  }
  // Formatear fecha legible
  let fechaLabel = '—';
  if(r.fecha){
    try{
      const f = new Date(r.fecha+'T12:00:00');
      fechaLabel = f.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      fechaLabel = fechaLabel.charAt(0).toUpperCase()+fechaLabel.slice(1);
    }catch(e){ fechaLabel = r.fecha; }
  }
  const persona = (r.persona||'—').replace('Pan Pa Ya Sucursal ','');
  const div = document.createElement('div');
  div.className = 'meeting-card';
  div.style.cssText = 'background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.07);border:1px solid rgba(0,0,0,.06);overflow:hidden;margin-bottom:12px';

  // Header con estado
  const estadoColor = pasada ? 'var(--success)' : 'var(--info)';
  const estadoBg = pasada ? 'var(--success-bg)' : 'var(--info-bg)';
  const estadoTxt = pasada ? 'Completada' : 'Próxima';

  div.innerHTML =
    // Header
    '<div style="padding:.8rem 1rem;background:'+(pasada?'var(--cream)':'var(--info-bg)')+';border-bottom:1px solid rgba(0,0,0,.06);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">'
    +'<div style="display:flex;align-items:center;gap:8px">'
    +'<span style="font-size:20px">'+(pasada?'✅':'📅')+'</span>'
    +'<div>'
    +'<div style="font-size:14px;font-weight:700;color:var(--charcoal)">'+(r.titulo||'Sin título')+'</div>'
    +'<div style="font-size:11px;color:var(--gray);margin-top:1px">'+fechaLabel+(r.hora?' a las '+r.hora:'')+'</div>'
    +'</div>'
    +'</div>'
    +'<span style="background:'+estadoBg+';color:'+estadoColor+';padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700">'+estadoTxt+'</span>'
    +'</div>'
    // Detalles
    +'<div style="padding:.8rem 1rem">'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:.7rem">'
    +'<div style="font-size:12px"><span style="color:var(--gray);font-weight:600">👤 Con:</span> <span style="color:var(--charcoal)">'+persona+'</span></div>'
    +(r.hora?'<div style="font-size:12px"><span style="color:var(--gray);font-weight:600">🕐 Hora:</span> <span style="color:var(--charcoal)">'+r.hora+'</span></div>':'')
    +(r.notas?'<div style="font-size:12px;grid-column:1/-1"><span style="color:var(--gray);font-weight:600">📝 Notas:</span> <span style="color:var(--charcoal)">'+r.notas+'</span></div>':'')
    +(r.correoInv?'<div style="font-size:12px;grid-column:1/-1"><span style="color:var(--gray);font-weight:600">👥 Invitados:</span> <span style="color:var(--charcoal)">'+r.correoInv+'</span></div>':'')
    +'</div>'
    // Link
    +(r.link
      ?'<a href="'+r.link+'" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:var(--info);color:#fff;padding:6px 16px;border-radius:100px;font-size:12px;font-weight:600;text-decoration:none;margin-bottom:.5rem">🔗 Unirse a la reunión</a>'
      :'<div style="font-size:12px;color:var(--warning);margin-bottom:.5rem">⏳ Link pendiente</div>'
    )
    // Acciones
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:.4rem">'
    +(!pasada?'<button class="btn bp" style="font-size:11px" onclick="enviarRecordatorio(\''+r.id+'\')">📨 Recordatorio</button>':'')
    +'<button class="btn bg-d" style="font-size:11px" onclick="eliminarReunion(\''+r.id+'\')">🗑 Eliminar</button>'
    +'</div>'
    +'</div>';

  return div;
}
window.guardarReunion=async function(){
  const titulo=document.getElementById('re-titulo').value.trim();
  let persona=document.getElementById('re-persona').value;
  if(persona==='externo')persona=document.getElementById('re-externo').value.trim();
  const fecha=document.getElementById('re-fecha').value;
  const hora=document.getElementById('re-hora').value;
  const link=document.getElementById('re-link').value.trim();
  const notas=document.getElementById('re-notas').value.trim();
  const correoInv=document.getElementById('re-correo-inv').value.trim();
  if(!titulo||!persona||!fecha){mostrarToast('Completa titulo, persona y fecha');return;}

  await addDoc(collection(db,'reuniones'),{titulo,persona,fecha,hora,link,notas,correoInv,creadoEn:serverTimestamp()});

  const sucDestino = SUCURSALES.includes(persona)||persona==='Oficina Central' ? persona : null;
  const datosReunion = {
    estado:'aprobada', reunionTitulo:titulo, reunionFecha:fecha, reunionHora:hora,
    reunionLink:link||'', reunionParticipantes:correoInv||'', reunionNotas:notas||''
  };

  // 1. Si viene de solicitud específica — actualizarla
  if(window._solicitudPendienteId){
    await updateDoc(doc(db,'solicitudes_reunion',window._solicitudPendienteId), datosReunion);
    window._solicitudPendienteId=null;
  }
  // 2. Buscar solicitudes pendientes de esa sucursal y aprobarlas
  else if(sucDestino){
    try{
      const qSol=query(collection(db,'solicitudes_reunion'),
        where('sucursal','==',sucDestino), where('estado','==','pendiente'));
      const solSnap=await getDocs(qSol);
      if(solSnap.empty){
        // No hay solicitud previa — crear una nueva para que el usuario la vea
        await addDoc(collection(db,'solicitudes_reunion'),{
          sucursal:sucDestino, nombre:persona, motivo:titulo,
          esDeAdmin:true, ...datosReunion, creadoEn:serverTimestamp()
        });
      } else {
        solSnap.forEach(async d=>{ await updateDoc(doc(db,'solicitudes_reunion',d.id), datosReunion); });
      }
    }catch(e){}
  }

  // 3. Enviar por chat
  if(sucDestino){
    const msg='🗓 REUNIÓN PROGRAMADA: '+titulo
      +'\n📅 Fecha: '+fecha+' a las '+hora
      +(notas?'\n📝 Tema: '+notas:'')
      +(correoInv?'\n👥 Participantes: '+correoInv:'')
      +(link?'\n🔗 Link: '+link:'');
    await addDoc(collection(db,'chat'),{
      tipo:'texto',texto:msg,esAdmin:true,
      nombre:perfilAdmin.nombre,sucursal:sucDestino,
      creadoEn:serverTimestamp()
    });
  }

  mostrarToast('✅ Reunión creada — usuario notificado');
  toggleFormReunion();
  ['re-titulo','re-fecha','re-notas','re-link','re-correo-inv'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const rp=document.getElementById('re-persona');if(rp)rp.value='';
  const re=document.getElementById('re-externo');if(re)re.value='';
  const cf=document.getElementById('cf-externo');if(cf)cf.style.display='none';
};
window.enviarRecordatorio=async function(id){
  const r=reunionesActuales.find(x=>x.id===id);if(!r)return;
  const sucDestino=r.persona;
  const msg='📅 Recordatorio: "'+r.titulo+'" — '+r.fecha+' a las '+r.hora+(r.link?'\n🔗 Link: '+r.link:'');

  // 1. Enviar al chat
  await addDoc(collection(db,'chat'),{
    tipo:'texto',texto:msg,esAdmin:true,
    nombre:perfilAdmin.nombre,sucursal:sucDestino,
    creadoEn:serverTimestamp()
  });

  // 2. Actualizar la solicitud con recordatorio
  try{
    const qSol=query(collection(db,'solicitudes_reunion'),
      where('reunionTitulo','==',r.titulo),
      where('estado','==','aprobada'));
    const snap=await getDocs(qSol);
    snap.forEach(async d=>{
      await updateDoc(doc(db,'solicitudes_reunion',d.id),{
        ultimoRecordatorio: new Date().toLocaleString('es-CO'),
        recordatorioMsg: msg
      });
    });
  }catch(e){}

  mostrarToast('🔔 Recordatorio enviado');
};
window.eliminarReunion=async function(id){
  const{deleteDoc}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  // Buscar y marcar la solicitud relacionada como 'eliminada'
  const r = reunionesActuales.find(x=>x.id===id);
  if(r){
    try{
      const qSol = query(collection(db,'solicitudes_reunion'),
        where('reunionTitulo','==',r.titulo), where('estado','==','aprobada'));
      const snap = await getDocs(qSol);
      snap.forEach(async d => {
        await updateDoc(doc(db,'solicitudes_reunion',d.id),{estado:'eliminada'});
      });
    }catch(e){}
  }
  await deleteDoc(doc(db,'reuniones',id));
  mostrarToast('🗑 Reunión eliminada');
};

// -- SOLICITUDES --
function cargarSolicitudes(){
  const q=query(collection(db,'solicitudes_reunion'),orderBy('creadoEn','desc'));
  onSnapshot(q,snap=>{
    const cont=document.getElementById('lista-solicitudes');
    if(!cont)return;

    // Solo mostrar PENDIENTES — las atendidas desaparecen del listado
    const pendientes=[];
    snap.forEach(d=>{
      const s={id:d.id,...d.data()};
      if(s.estado==='pendiente') pendientes.push(s);
    });

    const bs=document.getElementById('badge-solicitudes');
    if(bs){bs.textContent=pendientes.length;bs.style.display=pendientes.length>0?'inline':'none';}

    if(!pendientes.length){
      cont.innerHTML='<div style="padding:2rem;text-align:center;color:var(--success);font-size:13px">✅ No hay solicitudes pendientes.</div>';
      return;
    }

    cont.innerHTML='';
    pendientes.forEach(s=>{
      const div=document.createElement('div');
      div.style.cssText='background:#fff;border-radius:var(--r);box-shadow:var(--shadow);border:1px solid rgba(0,0,0,.04);margin-bottom:10px;overflow:hidden';
      const fecha=s.creadoEn?new Date(s.creadoEn.seconds*1000).toLocaleString('es-CO'):'';
      const cargoHtml=s.cargo?'<span style="font-size:10px;background:var(--info-bg);color:var(--info);padding:1px 7px;border-radius:100px;margin-left:5px">'+s.cargo+'</span>':'';
      const sid=s.id;
      const sp=(s.sucursal||s.nombre||'').replace(/['"]/g,' ');
      const sm=(s.motivo||'').replace(/['"]/g,' ');
      const sf=(s.fechaSugerida||'').replace(/['"]/g,'');
      const sh=(s.horaSugerida||'').replace(/['"]/g,'');
      div.innerHTML=
        '<div style="background:var(--warning-bg);border-left:4px solid var(--warning);padding:.8rem 1rem;display:flex;align-items:center;gap:10px">'
        +'<span style="font-size:20px">🙋</span>'
        +'<div style="flex:1">'
        +'<div style="font-weight:600;font-size:13px;color:var(--charcoal)">'+(s.nombre||s.sucursal||'Desconocido')+cargoHtml+'</div>'
        +'<div style="font-size:12px;color:var(--gray)">'+(s.sucursal||'').replace('Pan Pa Ya Sucursal ','')+' · '+fecha+'</div>'
        +'</div>'
        +'<span style="font-size:11px;font-weight:700;color:var(--warning);background:var(--warning-bg);padding:3px 10px;border-radius:100px">⏳ Pendiente</span>'
        +'</div>'
        +'<div style="padding:.9rem 1rem">'
        +'<div style="font-size:13px;color:var(--charcoal);margin-bottom:.5rem"><strong>Motivo:</strong> '+(s.motivo||'Sin motivo')+'</div>'
        +(s.fechaSugerida?'<div style="font-size:12px;color:var(--gray);margin-bottom:.3rem">📅 '+s.fechaSugerida+' '+s.horaSugerida+'</div>':'')
        +(s.correo?'<div style="font-size:12px;color:var(--gray);margin-bottom:.5rem">📧 '+s.correo+'</div>':'')
        +'<div style="display:flex;gap:8px;margin-top:.6rem;flex-wrap:wrap">'
        +'<button class="btn bp" onclick="aceptarSolicitud(\''+sid+'\',\''+sp+'\',\''+sm+'\',\''+sf+'\',\''+sh+'\')">✅ Aceptar y programar</button>'
        +'<button class="btn bo" onclick="marcarAtendida(\''+sid+'\')">Marcar atendida</button>'
        +'</div></div>';
      cont.appendChild(div);
    });
  });
}
window.aceptarSolicitud=async function(id,persona,motivo,fechaSug,horaSug){
  sv('reuniones');
  setTimeout(()=>{
    toggleFormReunion();
    const rt=document.getElementById('re-titulo');if(rt)rt.value='Reunión: '+motivo.slice(0,50);
    // Pre-llenar fecha y hora sugerida por el usuario
    const rf=document.getElementById('re-fecha');if(rf&&fechaSug)rf.value=fechaSug;
    const rh=document.getElementById('re-hora');if(rh&&horaSug)rh.value=horaSug;
    const suc=SUCURSALES.find(s=>s.includes(persona)||persona.includes(s));
    const rp=document.getElementById('re-persona');const re=document.getElementById('re-externo');const cf=document.getElementById('cf-externo');
    if(suc){if(rp)rp.value=suc;}
    else{if(rp)rp.value='externo';if(cf)cf.style.display='flex';if(re)re.value=persona;}
    window._solicitudPendienteId = id;
    mostrarToast('📅 Fecha y hora del usuario precargadas — ajusta si es necesario');
  },300);
};
window.marcarAtendida=async function(id){
  const link = prompt('Link de la reunión (Meet, Zoom, Teams):','');
  const fecha = prompt('Fecha confirmada (YYYY-MM-DD):','');
  const hora  = prompt('Hora confirmada (HH:MM):','');
  await updateDoc(doc(db,'solicitudes_reunion',id),{
    estado:'aprobada',
    reunionLink: link||'',
    reunionFecha: fecha||'',
    reunionHora: hora||''
  });
  mostrarToast('✅ Reunión aprobada — el usuario recibirá la notificación');
};

// -- CORREOS --
function cargarTodosCorreos(){
  const q=query(collection(db,'correos'),orderBy('creadoEn','desc'));
  onSnapshot(q,snap=>{
    todosLosCorreos=[];
    snap.forEach(d=>todosLosCorreos.push({id:d.id,...d.data()}));
    renderCorreos(todosLosCorreos);
    actualizarEstadisticas(todosLosCorreos);
    renderCriticos(todosLosCorreos);
    renderMapa(todosLosCorreos);
    actualizarPanelNotif();
  });
}
function renderCorreos(correos){
  const lista=document.getElementById('lista-correos-admin');
  if(!correos.length){lista.innerHTML='<li style="padding:2rem;text-align:center;color:var(--gray);font-size:13px">No hay correos.</li>';return;}
  lista.innerHTML='';let noLeidos=0;
  correos.forEach(c=>{if(!c.leidoPorAdmin)noLeidos++;lista.appendChild(crearItemAdmin(c));});
  const bc=document.getElementById('badge-correos');if(bc){bc.textContent=noLeidos;bc.style.display=noLeidos>0?'inline':'none';}
  const nd=document.getElementById('notif-dot');if(nd)nd.style.display=noLeidos>0?'block':'none';
  const mb=document.getElementById('mn-b-correos');if(mb){mb.textContent=noLeidos;mb.style.display=noLeidos>0?'inline':'none';}
}
function crearItemAdmin(c){
  const li=document.createElement('li');li.className='ei'+(!c.leidoPorAdmin?' unread':'');
  const color=c.urgencia==='critico'?'var(--danger)':c.urgencia==='importante'?'#D4860C':'var(--success)';
  const urgClass=c.urgencia==='critico'?'uc':c.urgencia==='importante'?'ui':'un';
  const urgLabel=c.urgencia==='critico'?'🔴':c.urgencia==='importante'?'🟡':'🟢';
  const ini=(c.sucursal||'SU').replace('Pan Pa Ya Sucursal ','').slice(0,3).toUpperCase();
  const fecha=c.creadoEn?new Date(c.creadoEn.seconds*1000).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):'—';
  const estado=c.estado==='resuelto'?'✅':c.estado==='en_proceso'?'🔄':'📬';
  li.innerHTML='<div class="ea" style="background:'+color+'">'+ini+'</div><div class="eb"><div class="ef">'+(c.sucursal||'').replace('Pan Pa Ya Sucursal ','')+(c.remitenteNombre?' — '+c.remitenteNombre:'')+(c.cargo?' · '+c.cargo:'')+'</div><div class="es">'+estado+' '+(c.asunto||'Sin asunto')+'</div><div style="font-size:10px;color:var(--gray)">🏷️ '+(c.categoria||'')+(c.respuestas&&c.respuestas.length>0?' · 💬 '+c.respuestas.length+' resp.':'')+(c.archivos&&c.archivos.length>0?' · [IMG] '+c.archivos.length:'')+'</div></div><div class="em"><div class="et">'+fecha+'</div><div class="urg '+urgClass+'">'+urgLabel+'</div></div>';
  li.onclick=()=>abrirCorreo(c);
  return li;
}
let _correoActualRef = null;

async function abrirCorreo(c){
  if(!c.leidoPorAdmin) await updateDoc(doc(db,'correos',c.id),{leidoPorAdmin:true});

  const panel = document.getElementById('mail-detail');
  if(!panel) return;

  // Escuchar cambios en tiempo real para el correo abierto
  if(_correoActualRef){ _correoActualRef(); _correoActualRef=null; }
  _correoActualRef = onSnapshot(doc(db,'correos',c.id), snap => {
    if(!snap.exists()) return;
    const data = snap.data();
    renderHiloCorreo({id:snap.id, ...data}, panel);
  });
}

function renderHiloCorreo(c, panel){
  const urgLabel = c.urgencia==='critico'?'🔴 Crítico':c.urgencia==='importante'?'🟡 Importante':'🟢 Normal';
  const urgClass = c.urgencia==='critico'?'sb-crit':c.urgencia==='importante'?'sb-open':'sb-res';
  const estadoLabel = c.estado==='resuelto'?'✅ Resuelto':c.estado==='en_proceso'?'🔄 En proceso':'📬 Abierto';
  const estadoClass = c.estado==='resuelto'?'sb-res':'sb-open';
  const fecha = c.creadoEn ? new Date(c.creadoEn.seconds*1000).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'}) : '';

  // ── HILO DE MENSAJES ──
  // 1. Mensaje original
  let hiloHtml = '<div style="margin-bottom:1rem">';

  // Archivos adjuntos del mensaje original
  let adjuntosHtml = '';
  if(c.archivos && c.archivos.length > 0){
    adjuntosHtml += '<div style="margin-top:.8rem;padding:.8rem;background:var(--cream);border-radius:8px">'
      +'<div style="font-size:11px;font-weight:700;color:var(--gray);margin-bottom:6px">📎 Imágenes adjuntas</div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + c.archivos.map(url=>'<img src="'+url+'" style="width:110px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.open(\''+url+'\')" onerror="this.style.display=\'none\'">').join('')
      +'</div></div>';
  }
  if(c.documentos && c.documentos.length > 0){
    adjuntosHtml += '<div style="margin-top:.6rem">'
      + c.documentos.map(d=>{
          const ext=(d.nombre||'').split('.').pop().toUpperCase()||'DOC';
          return '<div style="display:inline-flex;align-items:center;gap:8px;background:var(--info-bg);border-radius:8px;padding:6px 12px;margin:3px;cursor:pointer" onclick="window.open(\''+d.url+'\')">'
            +'<span style="background:var(--info);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700">'+ext+'</span>'
            +'<span style="font-size:12px;color:var(--info);font-weight:600">'+(d.nombre||'Documento')+'</span>'
            +'<span style="font-size:11px;color:var(--gray)">'+(d.tamano||'')+'</span>'
            +'</div>';
        }).join('')
      +'</div>';
  }

  hiloHtml +=
    // Burbuja mensaje original (sucursal)
    '<div style="display:flex;gap:10px;align-items:flex-start">'
    +'<div style="width:36px;height:36px;border-radius:50%;background:var(--bread);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;flex-shrink:0">'
    +(c.remitenteNombre||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
    +'</div>'
    +'<div style="flex:1">'
    +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">'
    +'<span style="font-size:13px;font-weight:700;color:var(--charcoal)">'+(c.remitenteNombre||'Desconocido')+'</span>'
    +'<span style="font-size:11px;color:var(--gray)">'+(c.sucursal||'').replace('Pan Pa Ya Sucursal ','')+(c.cargo?' · '+c.cargo:'')+'</span>'
    +'<span style="font-size:11px;color:var(--gray);margin-left:auto">'+fecha+'</span>'
    +'</div>'
    +'<div style="background:#F8F4EF;border-radius:0 12px 12px 12px;padding:.8rem 1rem;font-size:14px;line-height:1.6;color:var(--charcoal);white-space:pre-wrap;border:1px solid rgba(200,83,26,.1)">'
    +(c.cuerpo||'')
    +'</div>'
    + adjuntosHtml
    +'</div>'
    +'</div>'
    +'</div>';

  // 2. Respuestas en hilo
  if(c.respuestas && c.respuestas.length > 0){
    hiloHtml += '<div style="margin-top:.5rem;border-left:2px solid var(--bread);padding-left:1rem">'
      +'<div style="font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:.8rem;letter-spacing:.05em">Conversación ('+c.respuestas.length+')</div>';
    c.respuestas.forEach((r,i) => {
      const esAdminResp = r.esAdmin !== false;
      const bgColor = esAdminResp ? 'var(--info)' : 'var(--bread)';
      const bubbleStyle = esAdminResp
        ? 'background:rgba(22,80,160,.06);border:1px solid rgba(22,80,160,.12)'
        : 'background:rgba(200,32,26,.05);border:1px solid rgba(200,32,26,.12)';

      // Contenido: texto y/o adjunto
      let contenido = r.texto||'';
      if(r.url){
        const ext=(r.nombre_archivo||'').split('.').pop().toLowerCase();
        const esImg=['jpg','jpeg','png','gif','webp'].includes(ext);
        if(esImg){
          contenido += (contenido?'<br>':'')+'<img src="'+r.url+'" style="max-width:220px;border-radius:8px;margin-top:6px;display:block;cursor:pointer" onclick="window.open(\''+r.url+'\',\'_blank\')">';
        } else {
          const extUp=ext.toUpperCase()||'DOC';
          contenido += (contenido?'<br>':'')
            +'<a href="'+r.url+'" target="_blank" download="'+(r.nombre_archivo||'documento')+'" '
            +'style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:var(--info-bg);color:var(--info);border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;margin-top:4px">'
            +'<span style="background:var(--info);color:#fff;padding:1px 6px;border-radius:4px;font-size:10px">'+extUp+'</span>'
            +(r.nombre_archivo||'Descargar')+'</a>';
        }
      }

      hiloHtml +=
        '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:.8rem">'
        +'<div style="width:32px;height:32px;border-radius:50%;background:'+bgColor+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;flex-shrink:0">'
        +(r.nombre||'SI').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
        +'</div>'
        +'<div style="flex:1">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
        +'<span style="font-size:12px;font-weight:700;color:'+(esAdminResp?'var(--info)':'var(--bread)')+';">'
        +(esAdminResp?'Sistemas · ':'')+(r.nombre||'')+'</span>'
        +'<span style="font-size:11px;color:var(--gray);margin-left:auto">'+(r.fecha||'')+'</span>'
        +'</div>'
        +'<div style="'+bubbleStyle+';border-radius:0 12px 12px 12px;padding:.7rem .9rem;font-size:13px;line-height:1.6;color:var(--charcoal);white-space:pre-wrap">'
        +contenido
        +'</div>'
        +'</div>'
        +'</div>';
    });
    hiloHtml += '</div>';
  }

  panel.innerHTML =
    // ── HEADER fijo arriba ──
    '<div style="padding:.8rem 1rem;border-bottom:2px solid rgba(0,0,0,.06);flex-shrink:0;background:#fff">'
    +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:.5rem">'
    +'<span class="sbadge '+urgClass+'">'+urgLabel+'</span>'
    +'<span class="sbadge '+estadoClass+'">'+estadoLabel+'</span>'
    +'<span style="font-size:11px;color:var(--gray)">🏷️ '+(c.categoria||'general')+'</span>'
    +'<span style="font-size:11px;color:var(--gray);margin-left:auto">'+fecha+'</span>'
    +'</div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--charcoal);margin-bottom:.5rem;line-height:1.3">'+(c.asunto||'Sin asunto')+'</div>'
    +'<div style="display:flex;gap:5px;flex-wrap:wrap">'
    +'<button class="btn bp" onclick="window._responderFocus()" style="font-size:12px;padding:5px 12px">↩ Responder</button>'
    +'<button class="btn bg-s" onclick="window._resolver()" style="font-size:12px;padding:5px 12px">✓ Resuelto</button>'
    +'<button class="btn bo" onclick="window._reenviar()" style="font-size:12px;padding:5px 12px">↪ Reenviar</button>'
    +'<button class="btn bo" onclick="window._proceso()" style="font-size:12px;padding:5px 12px">🔄 En proceso</button>'
    +'</div>'
    +'</div>'
    // ── HILO scrolleable ──
    +'<div id="hilo-scroll" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.8rem;-webkit-overflow-scrolling:touch">'
    + hiloHtml
    +'</div>'
    // ── BARRA DE RESPUESTA fija abajo tipo chat ──
    +'<div style="flex-shrink:0;border-top:2px solid rgba(0,0,0,.07);background:#fff;padding:.6rem .8rem">'
    +'<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:.4rem">'
    +'<span style="font-size:11px;color:var(--gray);align-self:center">Plantillas:</span>'
    +'<button class="tpl" onclick="document.getElementById(\'reply-txt\').value=\'Gracias por el reporte. Ya estamos revisando. Tiempo estimado: 2 horas.\'">⏳ Revisando</button>'
    +'<button class="tpl" onclick="document.getElementById(\'reply-txt\').value=\'El problema fue resuelto. El equipo opera con normalidad.\'">✅ Resuelto</button>'
    +'<button class="tpl" onclick="document.getElementById(\'reply-txt\').value=\'Se requiere visita técnica. La programaremos a la brevedad.\'">🔧 Visita</button>'
    +'<button class="tpl" onclick="document.getElementById(\'reply-txt\').value=\'Estamos trabajando en ello. Te informaremos pronto.\'">🔄 Proceso</button>'
    +'</div>'
    +'<div style="display:flex;gap:6px;align-items:flex-end">'
    +'<textarea id="reply-txt" rows="2" placeholder="Escribe tu respuesta... (Enter envía, Shift+Enter nueva línea)" '
    +'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();window._responder();}" '
    +'style="flex:1;border:1.5px solid rgba(0,0,0,.12);border-radius:10px;padding:.6rem .8rem;font-family:Outfit,sans-serif;font-size:13px;resize:none;outline:none;line-height:1.5;box-sizing:border-box;transition:border-color .2s" '
    +'onfocus="this.style.borderColor=\'var(--bread)\'" onblur="this.style.borderColor=\'rgba(0,0,0,.12)\'"></textarea>'
    +'<button onclick="window._responder()" style="background:var(--bread);border:none;border-radius:10px;width:42px;height:42px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;color:#fff">&#9658;</button>'
    +'<button onclick="window._resolverConResp()" style="background:var(--success);border:none;border-radius:10px;padding:0 10px;height:42px;cursor:pointer;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">✓ Resolver</button>'
    +'</div>'
    +'</div>';

  // Funciones de acción
  window._responder = async()=>{
    const t=document.getElementById('reply-txt')?.value.trim();
    if(!t){mostrarToast('⚠ Escribe una respuesta');return;}
    const btn=document.querySelector('#mail-detail .btn.bp');
    if(btn){btn.disabled=true;btn.textContent='Enviando...';}
    const ref=doc(db,'correos',c.id);
    const sn=await getDoc(ref);
    const resp=sn.data().respuestas||[];
    resp.push({texto:t,nombre:perfilAdmin.nombre,fecha:new Date().toLocaleString('es-CO'),archivos:[]});
    await updateDoc(ref,{respuestas:resp,leidoPorUsuario:false,estado:'en_proceso'});
    document.getElementById('reply-txt').value='';
    // Scroll al final
    const hilo = document.getElementById('hilo-scroll');
    if(hilo) setTimeout(()=>{ hilo.scrollTop=hilo.scrollHeight; },200);
    mostrarToast('✅ Respuesta enviada');
    if(btn){btn.disabled=false;btn.textContent='📤 Enviar respuesta';}
  };
  window._responderFocus = function(){ const rt=document.getElementById('reply-txt'); if(rt) rt.focus(); };
  window._resolver=async()=>{await updateDoc(doc(db,'correos',c.id),{estado:'resuelto'});mostrarToast('✅ Resuelto');};
  window._proceso=async()=>{await updateDoc(doc(db,'correos',c.id),{estado:'en_proceso'});mostrarToast('🔄 En proceso');};
  window._resolverConResp=async()=>{ await window._responder(); await window._resolver(); };
  window._reenviar=function(){
    const rt=document.getElementById('reply-txt');
    if(rt){
      rt.value='--- Reenviado ---\nDe: '+(c.remitenteNombre||'')+' ('+(c.sucursal||'').replace('Pan Pa Ya Sucursal ','')+') · '+(c.cargo||'')+'\nFecha: '+(c.creadoEn?new Date(c.creadoEn.seconds*1000).toLocaleString('es-CO'):'')+'\n\n'+(c.cuerpo||'');
      rt.focus();
      mostrarToast('Reenviado listo para editar');
    }
  };
}
function actualizarEstadisticas(correos){
  const criticos=correos.filter(c=>c.urgencia==='critico'&&c.estado!=='resuelto').length;
  const proceso=correos.filter(c=>c.estado!=='resuelto').length;
  const resueltos=correos.filter(c=>c.estado==='resuelto').length;
  ['stat-criticos','stat-proceso','stat-resueltos','stat-total'].forEach((id,i)=>{const el=document.getElementById(id);if(el)el.textContent=[criticos,proceso,resueltos,correos.length][i];});
  const sc=document.getElementById('stat-criticos-sub');if(sc)sc.textContent=criticos>0?criticos+' sin atender':'Sin alertas';
  const lc=document.getElementById('label-criticos');if(lc)lc.textContent=criticos+' sin resolver';
  const bc=document.getElementById('badge-criticos');if(bc){bc.textContent=criticos;bc.style.display=criticos>0?'inline':'none';}
  const tasa=correos.length>0?Math.round((resueltos/correos.length)*100):0;
  ['met-tasa','met-total','met-res','met-pend'].forEach((id,i)=>{const el=document.getElementById(id);if(el)el.textContent=[tasa+'%',correos.length,resueltos,proceso][i];});
  renderActividad(correos);renderChart(correos);renderCategorias(correos);
}
function renderCriticos(correos){
  const criticos=correos.filter(c=>c.urgencia==='critico'&&c.estado!=='resuelto');
  ['lista-criticos-dash','lista-criticos-view'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    if(!criticos.length){el.innerHTML='<li style="padding:1.5rem;text-align:center;color:var(--gray);font-size:13px">Sin alertas 🎉</li>';return;}
    el.innerHTML='';criticos.forEach(c=>el.appendChild(crearItemAdmin(c)));
  });
}
function renderActividad(correos){
  const cont=document.getElementById('actividad-admin');if(!cont||!correos.length)return;
  cont.innerHTML='';
  correos.slice(0,5).forEach(c=>{
    const li=document.createElement('li');li.className='act-i';
    const color=c.urgencia==='critico'?'var(--danger)':c.urgencia==='importante'?'#D4860C':'var(--success)';
    const fecha=c.creadoEn?new Date(c.creadoEn.seconds*1000).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    li.innerHTML='<div class="act-dot" style="background:'+color+'"></div><div><div class="act-txt">'+(c.sucursal||'').replace('Pan Pa Ya Sucursal ','')+': <strong>'+(c.asunto||'Sin asunto')+'</strong></div><div class="act-time">'+fecha+'</div></div>';
    cont.appendChild(li);
  });
}
function renderChart(correos){
  const SUCURSALES_SET = new Set(SUCURSALES.map(s=>s.replace(/Pan Pa.?Ya Sucursal /,'')));
  let totalSucursales=0, totalOficina=0;
  const conteoPorSuc={};

  correos.forEach(c=>{
    const s = c.sucursal||'';
    if(s==='Oficina Central'){
      totalOficina++;
    } else {
      const label = s.replace(/Pan Pa.?Ya Sucursal /,'');
      conteoPorSuc[label]=(conteoPorSuc[label]||0)+1;
    }
  });

  // Construir datos para la gráfica — top sucursales + Oficina Central
  const entries = Object.entries(conteoPorSuc).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(totalOficina>0) entries.push(['Oficina Central', totalOficina]);

  const max=Math.max(...entries.map(e=>e[1]),1);
  const html=entries.map(([s,n])=>{
    const h=Math.max(Math.round((n/max)*90),4);
    const isOficina = s==='Oficina Central';
    const color = isOficina?'var(--info)':n===max?'var(--danger)':'var(--bread)';
    const label = s.length>7?s.slice(0,6)+'…':s;
    return '<div class="bg-group" title="'+s+': '+n+' reportes">'
      +'<div class="bv">'+n+'</div>'
      +'<div class="bar" style="height:'+h+'px;background:'+color+'"></div>'
      +'<div class="bl">'+label+'</div></div>';
  }).join('');

  ['chart-sucursales','chart-met-sucursales'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.innerHTML=html||'<div style="text-align:center;color:var(--gray);font-size:12px;width:100%;padding:1rem">Sin datos</div>';
  });
}
function renderCategorias(correos){
  const conteo={};correos.forEach(c=>{conteo[c.categoria||'Otro']=(conteo[c.categoria||'Otro']||0)+1;});
  const total=correos.length||1;const colors=['var(--bread)','var(--info)','#D4860C','var(--success)','var(--purple)'];
  const el=document.getElementById('chart-categorias');if(!el)return;
  el.innerHTML=Object.entries(conteo).map(([cat,n],i)=>{const pct=Math.round((n/total)*100);return'<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>'+cat+'</span><strong>'+pct+'%</strong></div><div class="prog"><div class="prog-fill" style="width:'+pct+'%;background:'+colors[i%colors.length]+'"></div></div></div>';}).join('')||'<div style="font-size:12px;color:var(--gray)">Sin datos</div>';
}

// -- MAPA --
async function renderMapa(correos){
  const gridSuc=document.getElementById('mapa-sucursales');if(!gridSuc)return;
  gridSuc.innerHTML='';let sucCrit=0,sucPend=0;

  // Cargar sucursales personalizadas de Firestore (con empresa)
  let sucPersonalizadas=[];
  try{
    const snap=await getDocs(collection(db,'sucursales'));
    snap.forEach(d=>{ const d2=d.data(); if(d2.nombre) sucPersonalizadas.push({nombre:d2.nombre, empresa:d2.empresa||'Pan Pa\u2019 Ya!'}); });
  }catch(e){}

  // Sucursales fijas son de Pan Pa' Ya!
  const sucFijas = SUCURSALES.map(s=>({nombre:s, empresa:'Pan Pa\u2019 Ya!'}));
  const todasSucursales=[...sucFijas,...sucPersonalizadas];

  // Agrupar por empresa
  const porEmpresa = {};
  todasSucursales.forEach(s => {
    if(!porEmpresa[s.empresa]) porEmpresa[s.empresa] = [];
    porEmpresa[s.empresa].push(s.nombre);
  });

  Object.entries(porEmpresa).forEach(([empresa, sucursales]) => {
    // Header empresa
    const sep = document.createElement('div');
    sep.style.cssText = 'grid-column:1/-1;padding:.4rem .8rem;font-size:11px;font-weight:700;color:var(--gray);background:var(--cream);border-radius:8px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em';
    sep.textContent = '🏢 ' + empresa;
    gridSuc.appendChild(sep);

    sucursales.forEach(s=>{
      const criticos=correos.filter(c=>c.sucursal===s&&c.urgencia==='critico'&&c.estado!=='resuelto').length;
      const pendientes=correos.filter(c=>c.sucursal===s&&c.estado!=='resuelto').length;
      if(criticos>0)sucCrit++;else if(pendientes>0)sucPend++;
      const estado=criticos>0?'bsr':pendientes>0?'bsa':'bsg';
      const texto=criticos>0?'🔴 '+criticos+' crítico(s)':pendientes>0?'🟡 '+pendientes+' pendiente(s)':'🟢 Sin novedad';
      const bc=document.createElement('div');bc.className='bc';
      bc.innerHTML='<div class="bsdot '+estado+'"></div><div class="bn">'+s.replace('Pan Pa Ya Sucursal ','')+'</div><div class="bcount">'+texto+'</div>';
      bc.onclick=()=>{sv('correos');renderCorreos(correos.filter(c=>c.sucursal===s));};
      gridSuc.appendChild(bc);
    });
  });
  const rs=document.getElementById('mapa-resumen-suc');if(rs)rs.textContent=sucCrit>0?sucCrit+' con críticos':sucPend>0?sucPend+' con pendientes':'Todas sin novedad 🎉';
  const critOf=correos.filter(c=>c.sucursal==='Oficina Central'&&c.urgencia==='critico'&&c.estado!=='resuelto').length;
  const pendOf=correos.filter(c=>c.sucursal==='Oficina Central'&&c.estado!=='resuelto').length;
  const estadoOf=critOf>0?'bsr':pendOf>0?'bsa':'bsg';
  const textoOf=critOf>0?'🔴 '+critOf+' crítico(s)':pendOf>0?'🟡 '+pendOf+' pendiente(s)':'🟢 Sin novedades';
  const ro=document.getElementById('mapa-resumen-of');if(ro)ro.textContent=critOf>0?critOf+' crítico(s)':pendOf>0?pendOf+' pendiente(s)':'Sin novedades';
  const ed=document.getElementById('mapa-oficina-estado');
  if(ed)ed.innerHTML='<div class="bc" style="display:flex;align-items:center;gap:10px;cursor:pointer;background:var(--cream2)" onclick="sv(\'correos\');renderCorreos(todosLosCorreos.filter(c=>c.sucursal===\'Oficina Central\'))"><div class="bsdot '+estadoOf+'" style="width:14px;height:14px;flex-shrink:0"></div><div style="flex:1"><div style="font-weight:600;font-size:13px">Reportes Oficina Central</div><div style="font-size:12px;color:var(--gray)">'+textoOf+'</div></div><span style="font-size:11px;color:var(--info)">Ver →</span></div>';
  cargarPersonasOficina();
}
window.renderCorreos=renderCorreos;
async function cargarPersonasOficina(){
  const cont=document.getElementById('mapa-oficina-personas');if(!cont)return;
  try{
    const snap=await getDocs(query(collection(db,'usuarios'),where('sucursal','==','Oficina Central'),where('rol','==','usuario')));
    if(snap.empty){cont.innerHTML='<div style="grid-column:1/-1;font-size:12px;color:var(--gray);padding:.5rem;text-align:center">Nadie registrado en Oficina Central aún.</div>';return;}
    cont.innerHTML='';
    snap.forEach(d=>{
      const u=d.data();
      const ini=u.nombre?u.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase():'??';
      const cargo=u.cargo||'Sin cargo';
      // Semáforo basado en sus reportes
      const criticos=todosLosCorreos.filter(c=>c.remitenteUid===d.id&&c.urgencia==='critico'&&c.estado!=='resuelto').length;
      const pendientes=todosLosCorreos.filter(c=>c.remitenteUid===d.id&&c.estado!=='resuelto').length;
      const semColor=criticos>0?'#E53E3E':pendientes>0?'#D4860C':'#2E7D32';
      const semLabel=criticos>0?'🔴 '+criticos+' crítico(s)':pendientes>0?'🟡 '+pendientes+' pendiente(s)':'🟢 Sin novedad';
      const empresa=u.empresa||'Pan Pa\u2019 Ya!';
      const bg=criticos>0?'var(--danger)':cargo.includes('Sistem')||cargo.includes('TI')||cargo.includes('Desarr')?'var(--info)':'var(--bread)';
      const div=document.createElement('div');
      div.className='persona-card';
      div.style.cssText='border-left:3px solid '+semColor+';cursor:pointer';
      div.innerHTML='<div class="av" style="background:'+bg+';flex-shrink:0;font-size:11px">'+ini+'</div>'
        +'<div style="overflow:hidden;flex:1">'
        +'<div style="font-size:12px;font-weight:600;color:var(--charcoal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+u.nombre+'</div>'
        +'<div class="cargo-tag" style="margin-top:2px">'+cargo+'</div>'
        +'<div style="font-size:10px;margin-top:2px">'+semLabel+'</div>'
        +(empresa!=='Pan Pa\u2019 Ya!'?'<div style="font-size:9px;color:var(--info);font-weight:600">'+empresa+'</div>':'')
        +'</div>';
      div.onclick=()=>{sv('correos');renderCorreos(todosLosCorreos.filter(c=>c.remitenteUid===d.id));};
      cont.appendChild(div);
    });
  }catch(e){if(cont)cont.innerHTML='<div style="grid-column:1/-1;font-size:12px;color:var(--gray)">Error cargando</div>';}
}

// -- CHAT --
let usuariosOficina=[];

async function cargarUsuariosOficina(){
  try{
    const snap=await getDocs(query(collection(db,'usuarios'),where('sucursal','==','Oficina Central'),where('rol','==','usuario')));
    usuariosOficina=[];
    snap.forEach(d=>usuariosOficina.push({id:d.id,...d.data()}));
    window._usuariosOficinaMovil = usuariosOficina; // exponer para selector móvil
  }catch(e){usuariosOficina=[];}
}


// CHAT CONTACTOS
async function cargarChatContactos(){
  const cont = document.getElementById('chat-contactos-admin');
  if(!cont) return;

  // Limpiar lista
  cont.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--gray);font-size:12px">Cargando...</div>';

  try {
    // 1. Cargar usuarios de Oficina Central
    await cargarUsuariosOficina();

    // 2. Sucursales extra de Firestore
    let sucExtra = [];
    try {
      const snap = await getDocs(collection(db,'sucursales'));
      snap.forEach(d => { const n = d.data().nombre||d.data().nombreCorto||''; if(n) sucExtra.push(n); });
    } catch(e){}

    const todasSuc = [...SUCURSALES, ...sucExtra];

    // 3. Construir lista
    cont.innerHTML = '';

    // Header sucursales
    const h1 = document.createElement('div');
    h1.style.cssText = 'padding:6px 12px 4px;font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;background:var(--cream)';
    h1.textContent = 'Sucursales';
    cont.appendChild(h1);

    todasSuc.forEach(s => {
      const criticos = todosLosCorreos.filter(c=>c.sucursal===s&&c.urgencia==='critico'&&c.estado!=='resuelto').length;
      const div = document.createElement('div');
      div.className = 'ci' + (s===sucursalChatActual?' on':'');
      const ini = s.replace('Pan Pa Ya Sucursal ','').slice(0,3).toUpperCase();
      div.innerHTML =
        '<div class="av" style="background:'+(criticos>0?'var(--danger)':'var(--bread)')+';width:34px;height:34px;font-size:10px">'+ini+'</div>'
        +'<div class="ci-online"></div>'
        +'<div style="flex:1;overflow:hidden">'
        +'<div class="ci-name" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.replace('Pan Pa Ya Sucursal ','')+'</div>'
        +'<div class="ci-last">'+(criticos>0?criticos+' critico(s)':'Sin novedades')+'</div>'
        +'</div>'+(criticos>0?'<span class="nbadge nb-red">!</span>':'');
      div.onclick = ()=>seleccionarChat(s,div,ini,false);
      cont.appendChild(div);
    });

    // Header Oficina Central
    const h2 = document.createElement('div');
    h2.style.cssText = 'padding:10px 12px 4px;font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;border-top:1px solid rgba(0,0,0,.08);margin-top:4px;background:var(--cream)';
    h2.textContent = 'Oficina Central';
    cont.appendChild(h2);

    if(!usuariosOficina.length){
      const v = document.createElement('div');
      v.style.cssText = 'padding:.5rem 1rem;font-size:12px;color:var(--gray)';
      v.textContent = 'Sin usuarios registrados';
      cont.appendChild(v);
    } else {
      usuariosOficina.forEach(u => {
        const chatId = 'oficina_'+u.id;
        const div = document.createElement('div');
        div.className = 'ci'+(chatId===sucursalChatActual?' on':'');
        div.dataset.chatId = chatId;
        const ini = (u.nombre||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        div.innerHTML =
          '<div class="av" style="background:var(--info);width:34px;height:34px;font-size:10px">'+ini+'</div>'
          +'<div class="ci-online"></div>'
          +'<div style="flex:1;overflow:hidden">'
          +'<div class="ci-name" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(u.nombre||'Sin nombre')+'</div>'
          +'<div class="ci-last" style="font-size:10px">'+(u.cargo||'Oficina Central')+'</div>'
          +'</div>';
        div.onclick = ()=>seleccionarChat(chatId,div,ini,true,u.nombre);
        cont.appendChild(div);
      });
    }
    // Actualizar badges despues de crear items
    setTimeout(actualizarBadgesChat, 600);
  } catch(e) {
    cont.innerHTML = '<div style="padding:1rem;color:var(--danger);font-size:12px">Error cargando: '+e.message+'</div>';
  }
}

function seleccionarChat(chatId, el, ini, esPersona, nombrePersona){
  esPersona = esPersona||false;
  nombrePersona = nombrePersona||'';
  sucursalChatActual = chatId;

  document.querySelectorAll('#chat-contactos-admin .ci').forEach(x=>x.classList.remove('on'));
  if(el) el.classList.add('on');
  // Limpiar badge del item seleccionado
  const badge = el?.querySelector('.nbadge');
  if(badge) badge.remove();

  // Marcar como visto al abrir
  marcarChatVisto(chatId);
  // En móvil abrir panel de chat
  if(window.abrirChatMovil) window.abrirChatMovil();

  const displayName = esPersona ? nombrePersona : chatId.replace('Pan Pa Ya Sucursal ','');
  const av = document.getElementById('chat-av');
  const nombre = document.getElementById('chat-nombre-actual');
  const status = document.getElementById('chat-header-status');
  if(av) av.textContent = ini || displayName.slice(0,3).toUpperCase();
  if(nombre) nombre.textContent = displayName;
  if(status) status.textContent = 'En linea';

  if(chatUnsubscribe){ chatUnsubscribe(); chatUnsubscribe=null; }

  const q = esPersona
    ? query(collection(db,'chat'), where('chatId','==',chatId), orderBy('creadoEn','asc'))
    : query(collection(db,'chat'), where('sucursal','==',chatId), orderBy('creadoEn','asc'));

  chatUnsubscribe = onSnapshot(q, snap => {
    const cont = document.getElementById('chat-mensajes-admin');
    if(!cont) return;
    cont.innerHTML = '';
    if(snap.empty){
      cont.innerHTML = '<div style="text-align:center;color:var(--gray);font-size:13px;padding:2rem">Sin mensajes aun. Escribe el primero.</div>';
      return;
    }

    // Marcar mensajes de sucursal como leídos
    snap.docs.forEach(d => {
      const m = d.data();
      if(m.esAdmin === false && !m.leidoPorAdmin){
        updateDoc(doc(db,'chat',d.id), {leidoPorAdmin: true}).catch(()=>{});
      }
    });

    snap.forEach(d => {
      const m = d.data();
      const esA = m.esAdmin === true;
      const div = document.createElement('div');
      div.className = 'cm ' + (esA ? 'cm-out' : 'cm-in');
      const hora = m.creadoEn ? new Date(m.creadoEn.seconds*1000).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : '';
      if(m.tipo==='texto'){
        div.innerHTML = (esA?'':'<div class="cm-sender">'+(m.nombre||'')+(m.cargo?' - '+m.cargo:'')+'</div>')
          +'<div class="cm-bubble">'+m.texto+'</div>'
          +'<div class="cm-time">'+hora+(esA?' vv':'')+'</div>';
      } else if(m.tipo==='audio'){
        const aid='a'+Date.now()+Math.random().toString(36).slice(2);
        div.innerHTML='<div class="cm-sender" style="'+(esA?'text-align:right':'')+'">Nota de voz</div><div class="cm-audio"><button class="play-btn" id="'+aid+'" onclick="window.toggleAudioAdmin(this.dataset.url,this.id)" data-url="'+m.url+'" >&#9654;</button><div class="waveform"></div><span class="audio-dur">'+(m.duracion||'0:00')+'</span></div><div class="cm-time">'+hora+'</div>';
      } else if(m.tipo==='imagen'||m.tipo==='evidencia'){
        div.innerHTML='<div class="cm-sender" style="'+(esA?'text-align:right':'')+'">'+(!esA?(m.nombre||'')+' ':'')+( m.tipo==='evidencia'?'Evidencia':'Imagen')+'</div><div class="cm-img"><img src="'+m.url+'" style="width:200px;height:140px;object-fit:cover;border-radius:12px;cursor:pointer" onclick="window.open(this.src)" onerror="this.style.display=\'none\'" ></div><div class="cm-time">'+hora+'</div>';
      } else if(m.tipo==='video'){
        div.innerHTML='<div class="cm-sender" style="'+(esA?'text-align:right':'')+'">Video</div><div class="cm-video"><video controls style="width:220px;border-radius:12px" preload="metadata"><source src="'+m.url+'"></video></div><div class="cm-time">'+hora+'</div>';
      } else if(m.tipo==='documento'){
        const nom=m.nombre_archivo||'Documento';
        const ext=(nom.split('.').pop()||'').toLowerCase();
        const ico=ext==='pdf'?'PDF':ext.startsWith('doc')?'DOC':ext.startsWith('xls')?'XLS':'FILE';
        div.innerHTML='<div class="cm-sender" style="'+(esA?'text-align:right':'')+'">'+(!esA?(m.nombre||'')+' ':'')+'Documento</div><div style="background:rgba(0,0,0,.06);border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:10px;max-width:260px;cursor:pointer" onclick="window.open(this.dataset.url)" data-url="'+m.url+'"><span style="background:var(--info);color:#fff;padding:3px 7px;border-radius:6px;font-size:11px;font-weight:700">'+ico+'</span><div style="flex:1;overflow:hidden"><div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+nom+'</div><div style="font-size:10px;color:var(--gray)">'+(m.tamano||'')+' - Abrir</div></div></div><div class="cm-time">'+hora+'</div>';
      }
      cont.appendChild(div);
    });
    cont.scrollTop = cont.scrollHeight;
  });
}

const audioAdmin={};
window.toggleAudioAdmin=function(url,id){
  const btn=document.getElementById(id);if(!btn)return;
  if(audioAdmin[id]){audioAdmin[id].pause();audioAdmin[id]=null;btn.textContent='►';return;}
  const a=new Audio(url);audioAdmin[id]=a;btn.textContent='⏸';
  a.play().catch(()=>{btn.textContent='►';mostrarToast('❌ No se pudo reproducir');});
  a.onended=()=>{btn.textContent='►';audioAdmin[id]=null;};
};

window.enviarMensajeChat=async function(){
  const inp=document.getElementById('chat-input');const t=inp?.value.trim();
  if(!t||!sucursalChatActual){if(!sucursalChatActual)mostrarToast('⚠ Selecciona una sucursal');return;}
  inp.value='';
  const esPersona=sucursalChatActual.startsWith('oficina_');
  const datos={
    tipo:'texto',texto:t,esAdmin:true,
    nombre:perfilAdmin.nombre,
    creadoEn:serverTimestamp()
  };
  if(esPersona){
    datos.chatId=sucursalChatActual;
    datos.sucursal='Oficina Central';
  }else{
    datos.sucursal=sucursalChatActual;
  }
  await addDoc(collection(db,'chat'),datos);
};

async function subirACloudinary(archivo, tipo){
  const fd=new FormData();
  fd.append('file',archivo);
  fd.append('upload_preset',UPLOAD_PRESET);
  fd.append('folder','sistemail');
  // Documentos van como raw
  const endpoint = tipo==='raw' ? 'raw' : tipo==='video' ? 'video' : 'image';
  const resp=await fetch('https://api.cloudinary.com/v1_1/'+CLOUD_NAME+'/'+endpoint+'/upload',{method:'POST',body:fd});
  const data=await resp.json();
  if(data.secure_url)return data.secure_url;
  throw new Error(data.error?.message||'Error Cloudinary');
}

function datosChatActual(extra={}){
  const esPersona=sucursalChatActual.startsWith('oficina_');
  const base={esAdmin:true,nombre:perfilAdmin.nombre,leidoPorUsuario:false,creadoEn:serverTimestamp(),...extra};
  if(esPersona){base.chatId=sucursalChatActual;base.sucursal='Oficina Central';}
  else{base.sucursal=sucursalChatActual;}
  return base;
}

window.subirArchivoCloudinary=async function(input,tipo){
  if(!input.files.length||!sucursalChatActual){mostrarToast('Selecciona una sucursal');return;}
  const archivo=input.files[0];
  const maxMB=tipo==='video'?50:tipo==='documento'?20:10;
  if(archivo.size>maxMB*1024*1024){mostrarToast('Maximo '+maxMB+'MB para '+tipo);input.value='';return;}
  document.getElementById('upload-bar').style.display='block';
  document.getElementById('normal-input').style.display='none';
  try{
    const esDoc=tipo==='documento';
    const cloudTipo=esDoc?'raw':tipo==='video'?'video':'image';
    const url=await subirACloudinary(archivo,cloudTipo);
    const datos=datosChatActual({tipo:esDoc?'documento':tipo,url,nombre_archivo:archivo.name,tamano:Math.round(archivo.size/1024)+'KB'});
    await addDoc(collection(db,'chat'),datos);
    mostrarToast('Enviado: '+(esDoc?'Documento':tipo==='video'?'Video':'Imagen'));
    input.value='';
  }catch(e){
    console.error('Upload error:',e);
    mostrarToast('Error al subir: '+e.message);
  }finally{
    document.getElementById('upload-bar').style.display='none';
    document.getElementById('normal-input').style.display='block';
  }
};

window.iniciarGrabacion=async function(){
  if(!sucursalChatActual){mostrarToast('⚠ Selecciona una sucursal');return;}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRecorder=new MediaRecorder(stream);
    audioChunks=[];
    mediaRecorder.ondataavailable=e=>{if(e.data.size>0)audioChunks.push(e.data);};
    mediaRecorder.start(100); // recopilar cada 100ms
    document.getElementById('recording-ui').style.display='flex';
    document.getElementById('normal-input').style.display='none';
    recSegs=0;
    recInterval=setInterval(()=>{
      recSegs++;
      const m=Math.floor(recSegs/60),s=recSegs%60;
      document.getElementById('rec-timer').textContent=m+':'+(s+'').padStart(2,'0');
    },1000);
  }catch(e){mostrarToast('❌ Micrófono no disponible: '+e.message);}
};

window.cancelarGrabacion=function(){
  if(mediaRecorder&&mediaRecorder.state!=='inactive'){
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t=>t.stop());
  }
  clearInterval(recInterval);
  document.getElementById('recording-ui').style.display='none';
  document.getElementById('normal-input').style.display='block';
};

window.enviarAudio=async function(){
  if(!mediaRecorder||!sucursalChatActual)return;
  const duracion=document.getElementById('rec-timer').textContent;
  clearInterval(recInterval);

  // Mostrar loading
  document.getElementById('recording-ui').style.display='none';
  document.getElementById('upload-bar').style.display='block';
  document.getElementById('normal-input').style.display='none';

  mediaRecorder.onstop=async()=>{
    try{
      if(audioChunks.length===0){mostrarToast('⚠ Audio vacío');return;}
      const blob=new Blob(audioChunks,{type:'audio/webm;codecs=opus'});
      const archivo=new File([blob],'audio_'+Date.now()+'.webm',{type:'audio/webm'});
      const url=await subirACloudinary(archivo,'video');
      const datos=datosChatActual({tipo:'audio',url,duracion});
      await addDoc(collection(db,'chat'),datos);
      mostrarToast('🎙️ Audio enviado');
    }catch(e){
      console.error('Audio error:',e);
      mostrarToast('❌ Error al subir audio: '+e.message);
    }finally{
      document.getElementById('upload-bar').style.display='none';
      document.getElementById('normal-input').style.display='block';
      audioChunks=[];
    }
    mediaRecorder.stream.getTracks().forEach(t=>t.stop());
  };

  if(mediaRecorder.state!=='inactive') mediaRecorder.stop();
  else mediaRecorder.onstop();
};

window.filtrarCorreos=function(u,btn){document.querySelectorAll('.mt-btn').forEach(b=>b.classList.remove('on'));btn.classList.add('on');if(u==='todos')renderCorreos(todosLosCorreos);else renderCorreos(todosLosCorreos.filter(c=>c.urgencia===u));};
// Variable para guardar la vista activa actual
let vistaActualAdmin = 'dashboard';

window.buscarAdmin = function(t) {
  const raw = t.trim();
  const texto = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  function coincide(v){
    return (v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(texto);
  }

  // Si está vacío — restaurar la vista actual
  if(!texto){
    switch(vistaActualAdmin){
      case 'correos': case 'criticos': renderCorreos(todosLosCorreos); break;
      case 'chat': cargarChatContactos(); break;
      case 'usuarios': cargarUsuarios(); break;
    }
    return;
  }

  // ── BUSCAR SEGÚN VISTA ACTIVA ──
  switch(vistaActualAdmin){

    case 'correos':
    case 'criticos':
    case 'dashboard': {
      const filtrados = todosLosCorreos.filter(c=>
        coincide(c.asunto)||coincide(c.cuerpo)||coincide(c.categoria)||
        coincide(c.urgencia)||coincide(c.estado)||coincide(c.sucursal)||
        coincide(c.remitenteNombre)||coincide(c.cargo)||
        (c.respuestas||[]).some(r=>coincide(r.texto)||coincide(r.nombre))
      );
      renderCorreos(filtrados);
      if(vistaActualAdmin==='dashboard') sv('correos');
      mostrarToast(filtrados.length>0 ? filtrados.length+' correo(s) encontrado(s)' : 'Sin resultados');
      break;
    }

    case 'chat': {
      // Buscar sucursal u oficina en el panel del chat
      const cont = document.getElementById('chat-contactos-admin');
      if(!cont) break;
      let encontrados = 0;
      cont.querySelectorAll('.ci').forEach(item=>{
        const nombre = item.querySelector('.ci-name')?.textContent||'';
        const cargo = item.querySelector('.ci-last')?.textContent||'';
        const visible = coincide(nombre)||coincide(cargo);
        item.style.display = visible ? '' : 'none';
        if(visible) encontrados++;
      });
      // Mostrar/ocultar headers si todos sus items están ocultos
      cont.querySelectorAll('div[style*="text-transform:uppercase"]').forEach(h=>{
        let siguiente = h.nextElementSibling;
        let tieneVisibles = false;
        while(siguiente && !siguiente.style.cssText?.includes('text-transform:uppercase')){
          if(siguiente.classList.contains('ci') && siguiente.style.display!=='none') tieneVisibles=true;
          siguiente = siguiente.nextElementSibling;
        }
        h.style.display = tieneVisibles ? '' : 'none';
      });
      mostrarToast(encontrados>0 ? encontrados+' contacto(s) encontrado(s)' : 'Sin resultados en chat');
      break;
    }

    case 'usuarios': {
      // Buscar en usuarios registrados
      const cont = document.getElementById('lista-usuarios-aprobados');
      if(!cont) break;
      let encontrados = 0;
      cont.querySelectorAll('div[style*="border-bottom"]').forEach(item=>{
        const txt = item.textContent||'';
        const visible = coincide(txt);
        item.style.display = visible ? '' : 'none';
        if(visible) encontrados++;
      });
      // También buscar en pendientes
      const contP = document.getElementById('lista-usuarios-pendientes');
      if(contP){
        contP.querySelectorAll('div[style*="border-bottom"]').forEach(item=>{
          const txt = item.textContent||'';
          const visible = coincide(txt);
          item.style.display = visible ? '' : 'none';
        });
      }
      mostrarToast(encontrados>0 ? encontrados+' usuario(s) encontrado(s)' : 'Sin resultados');
      break;
    }

    case 'reuniones': {
      const cont = document.getElementById('lista-reuniones');
      if(!cont) break;
      let encontrados = 0;
      cont.querySelectorAll('.mc').forEach(item=>{
        const txt = item.textContent||'';
        const visible = coincide(txt);
        item.style.display = visible ? '' : 'none';
        if(visible) encontrados++;
      });
      mostrarToast(encontrados>0 ? encontrados+' reunión(es)' : 'Sin resultados');
      break;
    }

    case 'mapa': {
      // Buscar sucursal en el mapa
      document.querySelectorAll('.mapa-item,.map-card').forEach(item=>{
        const txt = item.textContent||'';
        item.style.display = coincide(txt) ? '' : 'none';
      });
      break;
    }

    default: {
      // Si está en otra vista — buscar en correos y navegar
      const filtrados = todosLosCorreos.filter(c=>
        coincide(c.asunto)||coincide(c.cuerpo)||coincide(c.sucursal)||coincide(c.remitenteNombre)
      );
      renderCorreos(filtrados);
      sv('correos');
      mostrarToast(filtrados.length>0 ? filtrados.length+' correo(s) encontrado(s)' : 'Sin resultados');
    }
  }
};

const titulos={dashboard:'🏠 Inicio',correos:'📥 Correos entrantes',criticos:'🚨 Alertas críticas',chat:'💬 Chat con sucursales',reuniones:'📅 Agenda de reuniones',solicitudes:'🙋 Solicitudes de reunión',mapa:'📍 Estado de sucursales',reportes:'📊 Estadísticas',usuarios:'👥 Control de acceso',sucursales:'🏪 Gestionar sucursales',compose:'✏️ Redactar correo'};

// ── REDACTAR CORREO (ADMIN) ──
let urgenciaAdmin = 'normal';
let archivosAdmin = [];

window.selUrgenciaAdmin = function(u) {
  urgenciaAdmin = u;
  ['normal','media','critico'].forEach(x => {
    const btn = document.getElementById('adm-urg-'+x);
    if(!btn) return;
    const colores = {normal:'var(--success)',media:'var(--warning)',critico:'var(--danger)'};
    if(x===u){ btn.style.background=colores[x]; btn.style.color='#fff'; }
    else{ btn.style.background='#fff'; btn.style.color=colores[x]; }
  });
};

window.mostrarArchivosAdmin = function(input) {
  const nuevos = Array.from(input.files);
  // Acumular — no reemplazar
  nuevos.forEach(f => {
    if(!archivosAdmin.find(x=>x.name===f.name && x.size===f.size)) archivosAdmin.push(f);
  });
  input.value = ''; // limpiar para poder volver a seleccionar
  const prev = document.getElementById('adm-archivos-preview');
  if(!prev) return;
  prev.innerHTML = '';
  archivosAdmin.forEach((f,i) => {
    const chip = document.createElement('div');
    chip.className = 'att-chip';
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:#F0F0F0;border-radius:8px;padding:4px 8px;font-size:12px';
    const esDoc = !f.type.startsWith('image') && !f.type.startsWith('video');
    const ext = f.name.split('.').pop().toUpperCase();
    chip.innerHTML = '<span>'+(esDoc?'📄':'📸')+'</span>'
      +'<span style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+f.name+'</span>'
      +'<span style="color:#999;font-size:10px">('+Math.round(f.size/1024)+'KB)</span>'
      +'<span onclick="window.quitarArchivoAdmin('+i+')" style="cursor:pointer;color:#E53935;font-weight:700;font-size:14px;padding:0 2px">×</span>';
    prev.appendChild(chip);
  });
  if(archivosAdmin.length>0){
    const info=document.createElement('div');
    info.style.cssText='font-size:11px;color:var(--gray);margin-top:4px;width:100%';
    info.textContent=archivosAdmin.length+' archivo(s) seleccionado(s). Puedes agregar más.';
    prev.appendChild(info);
  }
};

window.quitarArchivoAdmin = function(idx) {
  archivosAdmin.splice(idx,1);
  // Re-render preview
  const prev = document.getElementById('adm-archivos-preview');
  if(!prev) return;
  prev.innerHTML = '';
  archivosAdmin.forEach((f,i) => {
    const chip = document.createElement('div');
    chip.className = 'att-chip';
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:#F0F0F0;border-radius:8px;padding:4px 8px;font-size:12px';
    chip.innerHTML = '<span>'+(!f.type.startsWith('image')&&!f.type.startsWith('video')?'📄':'📸')+'</span>'
      +'<span style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+f.name+'</span>'
      +'<span style="color:#999;font-size:10px">('+Math.round(f.size/1024)+'KB)</span>'
      +'<span onclick="window.quitarArchivoAdmin('+i+')" style="cursor:pointer;color:#E53935;font-weight:700;font-size:14px;padding:0 2px">×</span>';
    prev.appendChild(chip);
  });
};

window.cargarDestinatarios = async function(sucursal) {
  const sel = document.getElementById('adm-compose-correo');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Toda la sucursal / oficina —</option>';
  if (!sucursal || sucursal === 'TODAS') return;
  try {
    // Para Oficina Central buscar por esOficina o por sucursal
    const q = sucursal === 'Oficina Central'
      ? query(collection(db,'usuarios'), where('esOficina','==',true), where('rol','==','usuario'), where('estado','==','aprobado'))
      : query(collection(db,'usuarios'), where('sucursal','==',sucursal), where('rol','==','usuario'), where('estado','==','aprobado'));
    const snap = await getDocs(q);
    if (snap.empty) {
      sel.innerHTML += '<option disabled>Sin usuarios registrados</option>';
      return;
    }
    snap.forEach(d => {
      const u = d.data();
      const opt = document.createElement('option');
      opt.value = u.email || '';
      opt.textContent = (u.nombre||'Sin nombre') + (u.cargo?' · '+u.cargo:'') + (u.email?' ('+u.email+')':'');
      sel.appendChild(opt);
    });
  } catch(e) { console.error('cargarDestinatarios:', e.message); }
};

window.limpiarComposeAdmin = function() {
  const c = document.getElementById('adm-compose-cuerpo');
  if(c) c.innerHTML = '';
  const a = document.getElementById('adm-compose-asunto'); if(a) a.value='';
  const p = document.getElementById('adm-compose-para'); if(p) p.value='';
  const cat = document.getElementById('adm-compose-categoria'); if(cat) cat.value='general';
  const correo = document.getElementById('adm-compose-correo'); if(correo) correo.value='';
  archivosAdmin = [];
  const prev = document.getElementById('adm-archivos-preview'); if(prev) prev.innerHTML='';
  selUrgenciaAdmin('normal');
};

window.enviarCorreoAdmin = async function() {
  const para = document.getElementById('adm-compose-para')?.value;
  const asunto = document.getElementById('adm-compose-asunto')?.value.trim();
  const cuerpo = document.getElementById('adm-compose-cuerpo')?.innerText.trim();
  const categoria = document.getElementById('adm-compose-categoria')?.value || 'general';
  const correoDestinatario = document.getElementById('adm-compose-correo')?.value.trim() || '';

  if(!para){ mostrarToast('⚠ Selecciona el destinatario'); return; }
  if(!asunto){ mostrarToast('⚠ Escribe un asunto'); return; }
  if(!cuerpo){ mostrarToast('⚠ Escribe el mensaje'); return; }

  const btn = document.getElementById('btn-adm-enviar');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Enviando...'; }

  try {
    // Subir archivos si hay
    const urls = [];
    const docs = [];
    if(archivosAdmin.length > 0){
      mostrarToast('📎 Subiendo ' + archivosAdmin.length + ' archivo(s)...');
      for(const f of archivosAdmin){
        try{
          const fd = new FormData();
          fd.append('file', f);
          fd.append('upload_preset', UPLOAD_PRESET);
          fd.append('folder', 'sistemail/correos');
          const esDoc = !f.type.startsWith('image') && !f.type.startsWith('video');
          const endpoint = esDoc ? 'raw' : f.type.startsWith('video') ? 'video' : 'image';
          const r = await fetch('https://api.cloudinary.com/v1_1/'+CLOUD_NAME+'/'+endpoint+'/upload',{method:'POST',body:fd});
          const d = await r.json();
          if(d.secure_url){
            urls.push(d.secure_url);
            if(esDoc) docs.push({url:d.secure_url, nombre:f.name, tamano:Math.round(f.size/1024)+'KB', tipo:'documento'});
          }
        }catch(e){ mostrarToast('⚠ No se pudo subir: '+f.name); }
      }
    }

    // Si es "TODAS" enviar a cada sucursal
    const destinos = para === 'TODAS' ? SUCURSALES : [para];

    for(const dest of destinos){
      const docData = {
        asunto, cuerpo, categoria,
        urgencia: urgenciaAdmin,
        remitenteUid: adminActual.uid,
        remitenteNombre: perfilAdmin.nombre,
        sucursal: dest,
        cargo: perfilAdmin.cargo || 'Sistemas',
        correoDestinatario: correoDestinatario,
        esDeAdmin: true,
        estado: 'enviado',
        archivos: urls,
        documentos: docs,
        leidoPorAdmin: true,
        leidoPorUsuario: false,
        respuestas: [],
        creadoEn: serverTimestamp()
      };
      // Si hay destinatario específico, buscar su UID y guardarlo
      if(correoDestinatario) {
        try {
          const uSnap = await getDocs(query(collection(db,'usuarios'), where('email','==',correoDestinatario)));
          if(!uSnap.empty) {
            docData.destinatarioUid = uSnap.docs[0].id;
          }
        } catch(e) {}
      }
      await addDoc(collection(db,'correos'), docData);
    }

    mostrarToast('✅ Correo enviado' + (destinos.length > 1 ? ' a ' + destinos.length + ' sucursales' : ' a ' + para.replace('Pan Pa Ya Sucursal ','')));
    limpiarComposeAdmin();
    setTimeout(()=>sv('correos'), 1000);

  } catch(e){ mostrarToast('❌ Error: '+e.message); }
  finally{ if(btn){ btn.disabled=false; btn.textContent='📤 Enviar correo'; } }
};
window.sv=function(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  const view=document.getElementById('view-'+v);if(view)view.classList.add('active');
  document.querySelectorAll('.ni').forEach(x=>x.classList.remove('on'));
  const nav=document.getElementById('nav-'+v);if(nav)nav.classList.add('on');
  const pt=document.getElementById('page-title');if(pt)pt.textContent=titulos[v]||v;
  vistaActualAdmin = v;
  // Limpiar buscador al cambiar de vista
  const search = document.querySelector('.searchbar input');
  if(search && search.value){ search.value=''; buscarAdmin(''); }
  // Actualizar placeholder del buscador según vista
  if(search){
    const placeholders = {
      correos:'Buscar correos...', criticos:'Buscar alertas...',
      chat:'Buscar sucursal u oficina...', usuarios:'Buscar usuarios...',
      reuniones:'Buscar reuniones...', mapa:'Buscar sucursal...',
      dashboard:'Buscar...', solicitudes:'Buscar solicitudes...',
      sucursales:'Buscar sucursal...'
    };
    search.placeholder = placeholders[v] || 'Buscar...';
  }
  if(v==='chat'){
    cargarChatContactos();
    setTimeout(()=>window.actualizarSelectorMovilChat&&window.actualizarSelectorMovilChat(),200);
  }
  if(v==='mapa'){renderMapa(todosLosCorreos);cargarPersonasOficina();}
  if(v==='usuarios')cargarUsuarios();
  if(v==='sucursales')cargarSucursalesAdmin();
};

// ── GESTIONAR SUCURSALES ──
window.toggleFormSucursal=function(){
  const f=document.getElementById('form-nueva-sucursal');
  if(f)f.style.display=f.style.display==='none'?'block':'none';
};

window.crearSucursal=async function(){
  const nombre=document.getElementById('ns-nombre')?.value.trim();
  const ciudad=document.getElementById('ns-ciudad')?.value.trim();
  const direccion=document.getElementById('ns-direccion')?.value.trim();
  if(!nombre){mostrarToast('⚠ Escribe el nombre de la sucursal');return;}
  const nombreCompleto='Pan Pa Ya Sucursal '+nombre;
  try{
    await addDoc(collection(db,'sucursales'),{
      nombre:nombreCompleto,
      nombreCorto:nombre,
      ciudad:ciudad||'',
      direccion:direccion||'',
      activa:true,
      creadoEn:serverTimestamp(),
      creadoPor:perfilAdmin.nombre
    });
    mostrarToast('✅ Sucursal "'+nombre+'" agregada');
    toggleFormSucursal();
    ['ns-nombre','ns-ciudad','ns-direccion'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  }catch(e){mostrarToast('❌ Error: '+e.message);}
};

let _sucursalesAdminUnsub = null;
function cargarSucursalesAdmin(){
  const cont=document.getElementById('lista-sucursales-admin');
  const badge=document.getElementById('badge-total-suc');
  if(!cont)return;
  cont.innerHTML='<div style="padding:1rem;text-align:center;color:var(--gray);font-size:13px">Cargando...</div>';

  if(_sucursalesAdminUnsub) _sucursalesAdminUnsub();

  _sucursalesAdminUnsub = onSnapshot(collection(db,'sucursales'), snap => {
    const sucFijas=SUCURSALES.map(s=>({nombre:s,fija:true}));
    const sucPersonalizadas=[];
    snap.forEach(d=>sucPersonalizadas.push({id:d.id,...d.data(),fija:false}));
    const todas=[...sucFijas,...sucPersonalizadas];
    if(badge)badge.textContent=todas.length+' sucursales';
    cont.innerHTML='';

    // Sucursales fijas
    sucFijas.forEach(s=>{
      const div=document.createElement('div');
      div.style.cssText='padding:.6rem .8rem;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(0,0,0,.04)';
      const ini=s.nombre.replace('Pan Pa Ya Sucursal ','').slice(0,3).toUpperCase();
      div.innerHTML='<div class="av" style="background:var(--bread);width:32px;height:32px;font-size:10px;flex-shrink:0">'+ini+'</div>'
        +'<div style="flex:1"><div style="font-size:13px;font-weight:500">'+s.nombre.replace('Pan Pa Ya Sucursal ','')+'</div></div>'
        +'<span style="font-size:10px;background:var(--cream2);color:var(--gray);padding:2px 8px;border-radius:100px">Predeterminada</span>';
      cont.appendChild(div);
    });

    // Sucursales personalizadas
    if(sucPersonalizadas.length>0){
      const sep=document.createElement('div');
      sep.style.cssText='padding:.5rem .8rem;font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.05em;background:var(--cream);margin-top:.5rem';
      sep.textContent='Sucursales agregadas manualmente';
      cont.appendChild(sep);
      sucPersonalizadas.forEach(s=>{
        const div=document.createElement('div');
        div.style.cssText='padding:.7rem .8rem;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(0,0,0,.04);background:#fff';
        const ini=(s.nombreCorto||s.nombre||'').slice(0,3).toUpperCase();
        div.innerHTML='<div class="av" style="background:var(--info);width:32px;height:32px;font-size:10px;flex-shrink:0">'+ini+'</div>'
          +'<div style="flex:1">'
          +'<div style="font-size:13px;font-weight:600">'+(s.nombre||s.nombreCorto||'')+'</div>'
          +(s.ciudad?'<div style="font-size:11px;color:var(--gray)">'+s.ciudad+(s.direccion?' · '+s.direccion:'')+'</div>':'')
          +'</div>'
          +'<span style="font-size:10px;background:var(--info-bg);color:var(--info);padding:2px 8px;border-radius:100px">Nueva</span>'
          +'<button class="btn bg-d" style="font-size:11px" onclick="eliminarSucursal(\''+s.id+'\',\''+s.nombre+'\')">Eliminar</button>';
        cont.appendChild(div);
      });
    }

    // Actualizar selectores con sucursales nuevas
    actualizarSelectoresSucursal(sucPersonalizadas);
  });
}

function actualizarSelectoresSucursal(sucPersonalizadas) {
  // Selectores a actualizar: crear usuario y redactar correo
  const selectores = [
    document.getElementById('nu-sucursal'),
    document.getElementById('adm-compose-para')
  ];
  selectores.forEach(sel => {
    if (!sel) return;
    // Eliminar opciones personalizadas previas
    const prev = sel.querySelectorAll('option[data-custom]');
    prev.forEach(o => o.remove());
    // Agregar nuevas al final (antes de Oficina Central si existe)
    sucPersonalizadas.forEach(s => {
      if (!s.nombre) return;
      // Evitar duplicados
      if (sel.querySelector('option[value="'+s.nombre+'"]')) return;
      const opt = document.createElement('option');
      opt.value = s.nombre;
      opt.textContent = s.nombre;
      opt.setAttribute('data-custom','1');
      sel.appendChild(opt);
    });
  });
}

window.eliminarSucursal=async function(id,nombre){
  if(!confirm('¿Eliminar la sucursal "'+nombre+'"? Se quitará del sistema.'))return;
  const{deleteDoc:dd}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await dd(doc(db,'sucursales',id));
  mostrarToast('Sucursal eliminada');
  cargarSucursalesAdmin();
};

// Exponer para el selector móvil
window.seleccionarChatAdmin = function(chatId, esPersona, nombrePersona) {
  const ini = esPersona
    ? (nombrePersona||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
    : chatId.replace('Pan Pa Ya Sucursal ','').slice(0,3).toUpperCase();
  seleccionarChat(chatId, null, ini, esPersona||false, nombrePersona||'');
};

window.toggleFormReunion=function(){
  const f=document.getElementById('form-reunion');
  if(!f)return;
  f.style.display=f.style.display==='none'?'block':'none';
  if(f.style.display==='block'){
    const d=new Date();d.setDate(d.getDate()+1);
    const rf=document.getElementById('re-fecha');
    if(rf)rf.value=d.toISOString().split('T')[0];
    // Llenar selector de correos registrados
    cargarCorreosRegistrados();
    // Limpiar chips
    const chips=document.getElementById('chips-correos');
    if(chips)chips.innerHTML='';
    const hidden=document.getElementById('re-correo-inv');
    if(hidden)hidden.value='';
  }
};

async function cargarCorreosRegistrados(){
  const sel=document.getElementById('sel-correo-inv');
  if(!sel)return;
  sel.innerHTML='<option value="">+ Agregar correo registrado...</option>';
  try{
    const snap=await getDocs(collection(db,'usuarios'));
    snap.forEach(d=>{
      const u=d.data();
      if(u.email&&u.estado==='aprobado'){
        const opt=document.createElement('option');
        opt.value=u.email;
        opt.textContent=(u.nombre||u.email)+' — '+u.email;
        sel.appendChild(opt);
      }
    });
  }catch(e){}
}

function actualizarHiddenCorreos(){
  const chips=document.getElementById('chips-correos');
  if(!chips)return;
  const correos=Array.from(chips.querySelectorAll('.correo-chip')).map(c=>c.dataset.email);
  const hidden=document.getElementById('re-correo-inv');
  if(hidden)hidden.value=correos.join(', ');
}

window.agregarCorreoChip=function(email){
  if(!email)return;
  const chips=document.getElementById('chips-correos');
  if(!chips)return;
  // No duplicar
  if(chips.querySelector('[data-email="'+email+'"]'))return;
  const chip=document.createElement('span');
  chip.className='correo-chip';
  chip.dataset.email=email;
  chip.style.cssText='display:inline-flex;align-items:center;gap:4px;background:var(--info-bg);color:var(--info);padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600';
  chip.innerHTML=email+'<button onclick="this.parentElement.remove();actualizarHiddenCorreos()" style="background:none;border:none;cursor:pointer;color:var(--info);font-size:14px;padding:0 0 0 2px">×</button>';
  chips.appendChild(chip);
  actualizarHiddenCorreos();
};

window.agregarCorreoExterno=function(){
  const inp=document.getElementById('inp-correo-ext');
  if(!inp||!inp.value.trim())return;
  const email=inp.value.trim();
  if(!email.includes('@')){mostrarToast('⚠ Correo inválido');return;}
  window.agregarCorreoChip(email);
  inp.value='';
};
function mostrarToast(msg){const t=document.getElementById('toast');const tm=document.getElementById('toast-msg');if(!t||!tm)return;tm.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500);}
window.mostrarToast=mostrarToast;

// -- GESTIÓN DE USUARIOS --
function cargarUsuarios(){
  onSnapshot(collection(db,'usuarios'), snap=>{
    const pendientes=[], tecnicos=[], admins=[], usuarios=[];
    snap.forEach(d=>{
      const u={id:d.id,...d.data()};
      // Excluir solo al superadmin actual
      if(u.rol==='admin'&&u.subrol==='superadmin'&&u.id===adminActual?.uid) return;
      if(u.estado==='pendiente'){ pendientes.push(u); return; }
      if(u.rol==='admin'&&u.subrol==='tecnico') tecnicos.push(u);
      else if(u.rol==='admin') admins.push(u);
      else usuarios.push(u);
    });

    const badge=document.getElementById('badge-usuarios');
    const label=document.getElementById('label-usuarios-pend');
    if(badge){badge.textContent=pendientes.length;badge.style.display=pendientes.length>0?'inline':'none';}
    if(label)label.textContent=pendientes.length+' pendiente(s)';

    renderUsuariosPendientes(pendientes);
    renderUsuariosAprobados([...tecnicos,...admins,...usuarios]);
  }, err=>{ console.error('Error usuarios:',err.message); });
}

function renderUsuariosPendientes(pendientes){
  const cont=document.getElementById('lista-usuarios-pendientes');
  if(!cont)return;
  if(!pendientes.length){
    cont.innerHTML='<div style="padding:1.5rem;text-align:center;color:var(--gray);font-size:13px">✅ No hay solicitudes pendientes.</div>';
    return;
  }
  cont.innerHTML='';
  pendientes.forEach(u=>{
    const div=document.createElement('div');
    div.style.cssText='padding:1rem;border-bottom:1px solid rgba(0,0,0,.06);display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#fff';
    const ini=(u.nombre||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const sid=u.id;
    const snombre=(u.nombre||'').replace(/['"]/g,' ');
    div.innerHTML=
      '<div class="av" style="background:var(--warning);flex-shrink:0">'+ini+'</div>'
      +'<div style="flex:1;min-width:140px">'
      +'<div style="font-weight:600;font-size:14px;color:var(--charcoal)">'+(u.nombre||'Sin nombre')+'</div>'
      +'<div style="font-size:12px;color:var(--gray);margin-top:2px">📧 '+(u.email||'')+'</div>'
      +'<div style="font-size:11px;color:var(--gray);margin-top:2px">📍 '+(u.sucursal||'').replace('Pan Pa Ya Sucursal ','')+(u.cargo?' · '+u.cargo:'')+'</div>'
      +'</div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
      +'<button class="btn bg-s" onclick="aprobarUsuario(\''+sid+'\',\''+snombre+'\')">✅ Aprobar</button>'
      +'<button class="btn bg-d" onclick="rechazarUsuario(\''+sid+'\',\''+snombre+'\')">❌ Rechazar</button>'
      +'<button class="btn bo" style="font-size:11px;margin-left:4px" onclick="eliminarUsuario(\''+sid+'\',\''+snombre+'\')" title="Eliminar">🗑 Eliminar</button>'
      +'</div>';
    cont.appendChild(div);
  });
}

function renderUsuariosAprobados(aprobados){
  const cont=document.getElementById('lista-usuarios-aprobados');
  if(!cont)return;
  if(!aprobados.length){
    cont.innerHTML='<div style="padding:1rem;text-align:center;color:var(--gray);font-size:13px">Sin usuarios registrados aún.</div>';
    return;
  }
  cont.innerHTML='';
  aprobados.forEach(u=>{
    const div=document.createElement('div');
    div.style.cssText='border-bottom:1px solid rgba(0,0,0,.05);background:#fff';
    const ini=(u.nombre||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const esRechazado=u.estado==='rechazado';
    const esTecnico=u.rol==='admin'&&u.subrol==='tecnico';
    const esAdmin=u.rol==='admin'&&u.subrol!=='tecnico';
    const sid=u.id;
    const snombre=(u.nombre||'').replace(/['"]/g,' ');
    const rolLabel=esAdmin?'ADMIN':esTecnico?'TECNICO':'USUARIO';
    const rolColor=esAdmin?'var(--info)':esTecnico?'var(--warning)':'var(--gray)';
    const rolBg=esAdmin?'var(--info-bg)':esTecnico?'var(--warning-bg)':'var(--cream2)';
    const perms=u.permisos||{};

    // Resumen de permisos activos para técnicos
    const TODOS_PERMS=[
      {k:'correos',label:'Correos'},
      {k:'responder',label:'Responder'},
      {k:'redactar',label:'Redactar'},
      {k:'chat',label:'Chat'},
      {k:'reuniones',label:'Reuniones'},
      {k:'solicitudes',label:'Solicitudes'},
      {k:'mapa',label:'Mapa'},
      {k:'estadisticas',label:'Estadísticas'},
    ];

    const resumenPerms = esTecnico
      ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px">'
        + TODOS_PERMS.map(p=>{
            const activo = perms[p.k]!==false;
            return '<span style="font-size:10px;padding:2px 7px;border-radius:100px;font-weight:600;background:'+(activo?'var(--success-bg)':'rgba(0,0,0,.06)')+';color:'+(activo?'var(--success)':'var(--gray)')+'">'
              +(activo?'✅':'⛔')+' '+p.label+'</span>';
          }).join('')
        +'</div>'
      : '';

    div.innerHTML=
      '<div style="padding:.8rem 1rem;display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">'
      +'<div class="av" style="background:'+(esRechazado?'var(--danger)':esAdmin||esTecnico?'var(--info)':'var(--success)')+';flex-shrink:0;font-size:11px">'+ini+'</div>'
      +'<div style="flex:1;min-width:160px">'
      +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
      +'<div style="font-size:13px;font-weight:700;color:var(--charcoal)">'+(u.nombre||'Sin nombre')+'</div>'
      +'<span style="background:'+rolBg+';color:'+rolColor+';padding:2px 8px;border-radius:100px;font-size:10px;font-weight:700">'+rolLabel+'</span>'
      +(esRechazado?'<span style="background:var(--danger-bg);color:var(--danger);padding:2px 8px;border-radius:100px;font-size:10px;font-weight:700">SUSPENDIDO</span>':'')
      +'</div>'
      +'<div style="font-size:11px;color:var(--gray);margin-top:2px">'+(u.email||'')+'</div>'
      +'<div style="font-size:11px;color:var(--gray)">'+(u.sucursal||'').replace('Pan Pa Ya Sucursal ','')+(u.cargo?' · '+u.cargo:'')+'</div>'
      +resumenPerms
      +'</div>'
      +'<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;padding-top:2px">'
      +'<select onchange="cambiarRol(\''+sid+'\',this.value)" style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid rgba(0,0,0,.15);cursor:pointer;background:#fff">'
      +'<option value="usuario"'+(u.rol!=='admin'?' selected':'')+'>Usuario</option>'
      +'<option value="tecnico"'+(esTecnico?' selected':'')+'>Tecnico</option>'
      +'<option value="admin"'+(esAdmin?' selected':'')+'>Admin</option>'
      +'</select>'
      +(esTecnico?'<button class="btn bp" style="font-size:11px" onclick="togglePermisos(\''+sid+'\')">🔑 Permisos</button>':'')
      +(esRechazado
        ?'<button class="btn bp" style="font-size:11px" onclick="aprobarUsuario(\''+sid+'\',\''+snombre+'\')">Activar</button>'
        :'<button class="btn bo" style="font-size:11px" onclick="desactivarUsuario(\''+sid+'\')">Suspender</button>'
      )
      +'<button class="btn bg-d" style="font-size:11px" onclick="eliminarUsuario(\''+sid+'\',\''+snombre+'\')">Eliminar</button>'
      +'</div>'
      +'</div>'
      +(esTecnico?
        '<div id="permisos-'+sid+'" style="display:none;padding:.8rem 1rem 1rem;background:var(--cream);border-top:1px solid rgba(0,0,0,.06)">'
        +'<div style="font-size:12px;font-weight:700;color:var(--charcoal);margin-bottom:.5rem">🔑 Configurar permisos de '+( u.nombre.split(' ')[0]||'Técnico')+':</div>'
        // Botón acceso total
        +'<div style="margin-bottom:.8rem;padding:10px 12px;background:'+(perms.accesoTotal?'var(--success-bg)':'#fff')+';border:2px solid '+(perms.accesoTotal?'var(--success)':'rgba(0,0,0,.1)')+';border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:10px">'
        +'<div>'
        +'<div style="font-size:13px;font-weight:700;color:'+(perms.accesoTotal?'var(--success)':'var(--charcoal)')+'">👑 Acceso total — Mano derecha</div>'
        +'<div style="font-size:11px;color:var(--gray);margin-top:2px">Puede hacer todo lo que hace el Administrador</div>'
        +'</div>'
        +'<label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0">'
        +'<input type="checkbox" '+(perms.accesoTotal?'checked':'')+' onchange="toggleAccesoTotal(\''+sid+'\',this.checked)" style="opacity:0;width:0;height:0">'
        +'<span style="position:absolute;cursor:pointer;inset:0;background:'+(perms.accesoTotal?'var(--success)':'#ccc')+';border-radius:34px;transition:.3s">'
        +'<span style="position:absolute;content:\'\';height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s;transform:'+(perms.accesoTotal?'translateX(20px)':'translateX(0)')+'"></span>'
        +'</span>'
        +'</label>'
        +'</div>'
        +'<div id="panel-perms-individual-'+sid+'" style="'+(perms.accesoTotal?'opacity:.4;pointer-events:none':'')+'"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px">'
        +TODOS_PERMS.map(p=>{
            const activo=perms[p.k]!==false;
            return '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#fff;border-radius:8px;border:1px solid '+(activo?'var(--success)':'rgba(0,0,0,.1)')+';cursor:pointer">'
              +'<input type="checkbox" '+(activo?'checked':'')+' onchange="guardarPermiso(\''+sid+'\',\''+p.k+'\',this.checked)" style="width:16px;height:16px;cursor:pointer;accent-color:var(--success)">'
              +'<span style="font-size:12px;font-weight:600;color:'+(activo?'var(--charcoal)':'var(--gray)')+'">'+p.label+'</span>'
              +'</label>';
          }).join('')
        +'</div>'  // cierre grid
        +'</div>'  // cierre panel-perms-individual
        +'<div style="margin-top:.6rem;font-size:11px;color:var(--danger);background:var(--danger-bg);padding:5px 8px;border-radius:6px">⛔ Sin acceso total: Aprobar usuarios · Crear cuentas · Eliminar usuarios</div>'
        +'</div>'
      :'');
    cont.appendChild(div);
  });
}

// Helper para checkbox de permiso
function permCheck(uid, perm, perms, label){
  const checked = perms[perm]!==false ? 'checked' : ''; // default: todos activos
  return '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;background:#fff;padding:5px 8px;border-radius:6px;border:1px solid rgba(0,0,0,.08)">'
    +'<input type="checkbox" '+checked+' onchange="guardarPermiso(\''+uid+'\',\''+perm+'\',this.checked)" style="cursor:pointer">'
    +label+'</label>';
}

window.togglePermisos = function(uid){
  const panel = document.getElementById('permisos-'+uid);
  if(!panel) return;
  panel.style.display = panel.style.display==='none' ? 'block' : 'none';
};

window.toggleAccesoTotal = async function(uid, valor){
  if(perfilAdmin.subrol==='tecnico'&&!perfilAdmin.permisos?.accesoTotal){
    mostrarToast('⛔ Sin permisos para esto');return;
  }
  await updateDoc(doc(db,'usuarios',uid),{'permisos.accesoTotal': valor});
  mostrarToast(valor ? '👑 Acceso total activado — ahora es mano derecha' : '🔒 Acceso total desactivado');
};

window.guardarPermiso = async function(uid, perm, valor){
  if(perfilAdmin.subrol==='tecnico'&&!perfilAdmin.permisos?.accesoTotal){
    mostrarToast('⛔ Sin permisos');return;
  }
  await updateDoc(doc(db,'usuarios',uid),{['permisos.'+perm]: valor});
  mostrarToast(valor ? '✅ '+perm+' activado' : '⛔ '+perm+' desactivado');
};

window.aprobarUsuario=async function(uid,nombre){
  if(perfilAdmin.subrol==='tecnico'){mostrarToast('⛔ Solo el Administrador puede aprobar usuarios');return;}
  await updateDoc(doc(db,'usuarios',uid),{estado:'aprobado'});
  mostrarToast('✅ '+nombre+' aprobado — ya puede ingresar al sistema');
};

window.cambiarRol=async function(uid,nuevoRol){
  if(perfilAdmin.subrol==='tecnico'){mostrarToast('Sin permisos');return;}
  let datos={};
  if(nuevoRol==='usuario'){datos={rol:'usuario',subrol:''};}
  else if(nuevoRol==='tecnico'){datos={rol:'admin',subrol:'tecnico'};}
  else if(nuevoRol==='admin'){datos={rol:'admin',subrol:'superadmin'};}
  await updateDoc(doc(db,'usuarios',uid),datos);
  mostrarToast('Rol actualizado a: '+nuevoRol);
};

// -- CREAR USUARIO DESDE ADMIN --
window.toggleFormCrearUsuario = function() {
  const f = document.getElementById('form-crear-usuario');
  if (!f) return;
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
};

window.crearUsuarioDesdeAdmin = async function() {
  if(perfilAdmin.subrol==='tecnico'){mostrarToast('⛔ Solo el Administrador puede crear usuarios');return;}
  const nombre = document.getElementById('nu-nombre')?.value.trim();
  const sucursal = document.getElementById('nu-sucursal')?.value;
  const cargo = document.getElementById('nu-cargo')?.value || '';
  const email = document.getElementById('nu-email')?.value.trim();
  const pass = document.getElementById('nu-pass')?.value;
  const tipo = document.getElementById('nu-tipo')?.value || 'usuario';
  const empresa = document.getElementById('nu-empresa')?.value || 'Pan Pa Ya';

  if (!nombre || !email || !pass) { mostrarToast('⚠ Completa nombre, correo y contraseña'); return; }
  if (pass.length < 6) { mostrarToast('⚠ Contraseña mínimo 6 caracteres'); return; }
  if (tipo === 'usuario' && !sucursal) { mostrarToast('⚠ Selecciona la sucursal del usuario'); return; }

  const btn = document.getElementById('btn-crear-usuario');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Creando...'; }

  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getAuth: getAuth2, createUserWithEmailAndPassword: createUser } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { setDoc: setDoc2 } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const app2 = initializeApp({
      apiKey:"AIzaSyD0E16pOxUHE4RvJhO83LY2CAXXyGpMp2s",
      authDomain:"sistemail-panpaya2.firebaseapp.com",
      projectId:"sistemail-panpaya2",
      storageBucket:"sistemail-panpaya2.firebasestorage.app",
      messagingSenderId:"449058639435",
      appId:"1:449058639435:web:06b9b0b6cd3ba193e4c7ce"
    }, 'app-crear-'+Date.now());

    const auth2 = getAuth2(app2);
    const cred = await createUser(auth2, email, pass);

    // Definir datos según tipo
    const datos = {
      nombre, email, cargo: cargo||'', estado: 'aprobado',
      empresa: empresa,
      creadoPor: perfilAdmin.nombre,
      creadoEn: new Date().toISOString()
    };

    if (tipo === 'tecnico') {
      datos.rol = 'admin';
      datos.subrol = 'tecnico';
      datos.sucursal = 'Oficina Central';
      datos.esOficina = true;
    } else if (tipo === 'admin') {
      datos.rol = 'admin';
      datos.subrol = 'superadmin';
      datos.sucursal = 'Oficina Central';
      datos.esOficina = true;
    } else {
      datos.rol = 'usuario';
      datos.sucursal = sucursal || 'Oficina Central';
      datos.esOficina = sucursal === 'Oficina Central';
    }

    await setDoc2(doc(db,'usuarios',cred.user.uid), datos);
    await auth2.signOut();

    const tipoLabel = tipo==='tecnico'?'Técnico':tipo==='admin'?'Administrador':'Usuario';
    mostrarToast('✅ '+tipoLabel+' '+nombre+' creado correctamente');
    ['nu-nombre','nu-email','nu-pass','nu-cargo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const ns=document.getElementById('nu-sucursal');if(ns)ns.value='';
    const nt=document.getElementById('nu-tipo');if(nt)nt.value='usuario';
    toggleFormCrearUsuario();

  } catch(e) {
    if (e.code==='auth/email-already-in-use') mostrarToast('❌ Ese correo ya está registrado');
    else mostrarToast('❌ Error: '+e.message);
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='✅ Crear usuario'; }
  }
};

// -- PLATAFORMAS DE REUNIÓN --
window.abrirPlataforma = function(plataforma) {
  const urls = {
    meet: 'https://meet.google.com/new',
    teams: 'https://teams.microsoft.com/l/meeting/new',
    zoom: 'https://zoom.us/start/videomeeting',
    webex: 'https://www.webex.com/start-a-meeting.html'
  };
  if (urls[plataforma]) window.open(urls[plataforma], '_blank');
};

window.rechazarUsuario=async function(uid,nombre){
  if(perfilAdmin.subrol==='tecnico'){mostrarToast('Sin permisos');return;}
  if(!confirm('Rechazar acceso de '+nombre+'?')) return;
  await updateDoc(doc(db,'usuarios',uid),{estado:'rechazado'});
  mostrarToast('Acceso rechazado para '+nombre);
  cargarUsuarios();
};

window.eliminarUsuario=async function(uid,nombre){
  if(perfilAdmin.subrol==='tecnico'){mostrarToast('Sin permisos');return;}
  if(!confirm('ELIMINAR completamente a '+nombre+'? No se puede deshacer.')) return;
  try{
    const {deleteDoc:dd}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await dd(doc(db,'usuarios',uid));
    mostrarToast('Usuario eliminado');
  }catch(e){mostrarToast('Error: '+e.message);}
};

window.desactivarUsuario=async function(uid){
  if(perfilAdmin.subrol==='tecnico'){mostrarToast('Sin permisos');return;}
  if(!confirm('Suspender este usuario?')) return;
  await updateDoc(doc(db,'usuarios',uid),{estado:'pendiente'});
  mostrarToast('Usuario suspendido');
  cargarUsuarios();
};