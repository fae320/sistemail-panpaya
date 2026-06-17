import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy,
         onSnapshot, doc, getDoc, updateDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD0E16pOxUHE4RvJhO83LY2CAXXyGpMp2s",
  authDomain: "sistemail-panpaya2.firebaseapp.com",
  projectId: "sistemail-panpaya2",
  storageBucket: "sistemail-panpaya2.firebasestorage.app",
  messagingSenderId: "449058639435",
  appId: "1:449058639435:web:06b9b0b6cd3ba193e4c7ce"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
window._firebaseApp = app;

// Cloudinary config
const CLOUD_NAME_U = 'dasj362le';
const PRESET_U = 'sistemail_panpaya';

let usuarioActual=null, perfilActual=null;
let urgenciaSeleccionada='critico', archivosSeleccionados=[];
let todosMisCorreos=[], notificaciones=[];
let cerrando = false;
let mediaRecorderU=null, audioChunksU=[], recSegsU=0, recIntervalU=null;
// Leer vistaActualUsuario del scope global (definida en HTML inline)
function getVistaActual(){ return window.vistaActualUsuario || 'bandeja'; }
let _usuarioIniciado = false;
// ── AUTH CON PERSISTENCIA ──
setPersistence(auth, browserLocalPersistence).then(() => {
  onAuthStateChanged(auth, async(user) => {
    if (cerrando) return;
    if (!user) { window.location.href='index.html'; return; }
    if (_usuarioIniciado) return;
    try {
      usuarioActual = user;
      const snap = await getDoc(doc(db,'usuarios',user.uid));
      if (!snap.exists()) { window.location.href='index.html'; return; }
      perfilActual = snap.data();
      if (perfilActual.rol === 'admin') { window.location.href='admin.html'; return; }
      if (perfilActual.estado === 'pendiente') { await signOut(auth); window.location.href='index.html?msg=pendiente'; return; }
      if (perfilActual.estado === 'rechazado') { await signOut(auth); window.location.href='index.html?msg=rechazado'; return; }
      _usuarioIniciado = true;
      if (!perfilActual.email && user.email) {
        await updateDoc(doc(db,'usuarios',user.uid), {email: user.email});
        perfilActual.email = user.email;
      }
      cargarPerfil();
      cargarMisCorreos();
      cargarChat();
      cargarMisSolicitudes();
      setTimeout(iniciarMonitorChatUsuario, 2000);
    } catch(e) {
      console.error('Auth error:', e);
    }
  });
});

// ── PERFIL ──
function cargarPerfil() {
  const ini = perfilActual.nombre ? perfilActual.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '--';
  document.getElementById('user-av').textContent = ini;
  document.getElementById('top-av').textContent = ini;
  document.getElementById('user-nombre').textContent = perfilActual.nombre || 'Usuario';
  document.getElementById('user-sucursal').textContent = perfilActual.sucursal || 'Sucursal';
  document.getElementById('cb-sucursal-label').textContent = perfilActual.sucursal || '';
  const cargoBadge = document.getElementById('user-cargo-badge');
  if (perfilActual.cargo && cargoBadge) {
    cargoBadge.style.display = 'block';
    cargoBadge.innerHTML = '<span class="cargo-badge">' + perfilActual.cargo + '</span>';
  }
  document.getElementById('cfg-nombre').value = perfilActual.nombre || '';
  document.getElementById('cfg-sucursal').value = perfilActual.sucursal || '';
  document.getElementById('cfg-email').value = perfilActual.email || usuarioActual?.email || '';
  if (perfilActual.esOficina || perfilActual.sucursal === 'Oficina Central') {
    const cargoRow = document.getElementById('cfg-cargo-row');
    const cargoCfg = document.getElementById('cfg-cargo');
    if (cargoRow) cargoRow.style.display = 'block';
    if (cargoCfg) cargoCfg.value = perfilActual.cargo || '';
  }
}


// ── HELPER: construir link de documento ──
function construirLinkDoc(url, nombre_archivo) {
  const ext = (nombre_archivo||'').split('.').pop().toLowerCase();
  const esPDF = ext === 'pdf';
  const nombre = nombre_archivo || 'documento';
  
  if (esPDF) {
    // Google Docs Viewer para PDFs — se ve en navegador sin descargar
    const googleUrl = 'https://docs.google.com/viewer?url=' + encodeURIComponent(url) + '&embedded=false';
    return '<a href="' + googleUrl + '" target="_blank" '
      + 'style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#FCE8E8;color:#C8201A;border-radius:8px;font-size:12px;text-decoration:none;font-weight:600;margin-top:4px">'
      + '<span style="background:#C8201A;color:#fff;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700">PDF</span>'
      + '👁 ' + nombre + '</a>'
      + ' <a href="' + url + '" download="' + nombre + '" '
      + 'style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:var(--info-bg);color:var(--info);border-radius:8px;font-size:12px;text-decoration:none;font-weight:600;margin-top:4px">⬇</a>';
  } else {
    // Word/Excel/otros — botón para abrir en Cloudinary + descargar
    const extUp = ext.toUpperCase() || 'DOC';
    return '<a href="' + url + '" target="_blank" '
      + 'style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--info-bg);color:var(--info);border-radius:8px;font-size:12px;text-decoration:none;font-weight:600;margin-top:4px">'
      + '<span style="background:var(--info);color:#fff;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700">' + extUp + '</span>'
      + '👁 ' + nombre + '</a>'
      + ' <a href="' + url + '" download="' + nombre + '" '
      + 'style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:#EAF3DE;color:#2E7D32;border-radius:8px;font-size:12px;text-decoration:none;font-weight:600;margin-top:4px">⬇</a>';
  }
}

// ── CORREOS ──
function cargarMisCorreos() {
  // Query 1: correos enviados por el usuario
  const q1 = query(collection(db,'correos'), where('remitenteUid','==',usuarioActual.uid), orderBy('creadoEn','desc'));
  // Query 2: correos enviados por admin a esta sucursal
  const q2 = query(collection(db,'correos'), where('sucursal','==',perfilActual.sucursal), where('esDeAdmin','==',true), orderBy('creadoEn','desc'));

  function procesarCorreos(snap1, snap2) {
    const mapa = {};
    snap1.forEach(d => mapa[d.id] = {id: d.id, ...d.data()});
    snap2.forEach(d => {
      const data = d.data();
      // Si tiene destinatarioUid, solo mostrar al destinatario específico
      if (data.destinatarioUid && data.destinatarioUid !== usuarioActual.uid) return;
      mapa[d.id] = {id: d.id, ...data};
    });
    todosMisCorreos = Object.values(mapa).sort((a,b)=>(b.creadoEn?.seconds||0)-(a.creadoEn?.seconds||0));
    notificaciones = [];
    renderBandeja(todosMisCorreos);
    renderEnviados(todosMisCorreos);
    actualizarContadores(todosMisCorreos);
    renderActividad(todosMisCorreos);
    todosMisCorreos.forEach(c => {
      // Correos del admin no leídos
      if (c.esDeAdmin && !c.leidoPorUsuario) {
        notificaciones.push({
          titulo: 'Nuevo mensaje de Sistemas', desc: c.asunto||'Sin asunto',
          detalle: c.cuerpo?.slice(0,60)||'',
          fecha: '', correoId: c.id, leida: false, urgencia: c.urgencia
        });
      }
      // Respuestas del admin a reportes del usuario
      if (c.respuestas && c.respuestas.length > 0 && !c.leidoPorUsuario) {
        notificaciones.push({
          titulo: 'Sistemas respondió tu reporte', desc: c.asunto||'Sin asunto',
          detalle: c.respuestas[c.respuestas.length-1]?.texto?.slice(0,60)||'',
          fecha: c.respuestas[c.respuestas.length-1]?.fecha||'',
          correoId: c.id, leida: c.leidoPorUsuario||false, urgencia: c.urgencia
        });
      }
    });
    const noLeidas = notificaciones.length;
    ['badge-bandeja','badge-notif','mn-b-bandeja'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = noLeidas; el.style.display = noLeidas>0?'inline':'none'; }
    });
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = noLeidas>0?'block':'none';
    renderNotificaciones();
    const alerta = document.getElementById('alerta-critica');
    if (alerta) alerta.style.display = todosMisCorreos.some(c=>c.urgencia==='critico'&&c.estado!=='resuelto') ? 'flex' : 'none';
  }

  let snap1Cache = null, snap2Cache = null;
  onSnapshot(q1, snap => { snap1Cache = snap; if(snap2Cache) procesarCorreos(snap1Cache, snap2Cache); });
  onSnapshot(q2, snap => { snap2Cache = snap; if(snap1Cache) procesarCorreos(snap1Cache, snap2Cache); });
}

function renderBandeja(correos) {
  const lista = document.getElementById('lista-bandeja');
  if (!lista) return;
  // Mostrar todos: correos del admin Y correos propios con respuestas
  const visibles = correos.filter(c => c.esDeAdmin || (c.respuestas && c.respuestas.length > 0));
  if (!visibles.length) {
    lista.innerHTML='<li style="padding:2rem;text-align:center;color:var(--gray);font-size:13px">No hay mensajes aún.<br><br><button class="btn bp" onclick="sv(\'compose\')">+ Crear reporte</button></li>';
    return;
  }
  lista.innerHTML = '';
  visibles.forEach(c => {
    const li = document.createElement('li');
    li.className = 'ei' + (!c.leidoPorUsuario?' unread':'');
    const urgClass = c.urgencia==='critico'?'uc':c.urgencia==='importante'?'ui':'un';
    const urgLabel = c.urgencia==='critico'?'🔴 Crítico':c.urgencia==='importante'?'🟡 Importante':'🟢 Normal';
    const fecha = c.creadoEn?new Date(c.creadoEn.seconds*1000).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):'—';
    let contenido = '';
    if (c.esDeAdmin) {
      // Correo del admin al usuario
      const preview = c.cuerpo?.slice(0,80)||'Sin contenido';
      const respNum = c.respuestas?.length || 0;
      contenido = '<div class="ea" style="background:var(--bread)">SI</div>'
        +'<div class="eb">'
        +'<div class="ef">📨 Sistemas · '+(c.asunto||'Sin asunto')+'</div>'
        +'<div class="es">'+preview+'...</div>'
        +'<div style="font-size:10px;color:var(--gray);margin-top:2px">'+(respNum>0?'💬 '+respNum+' respuesta(s)':'Nuevo mensaje')+'</div>'
        +'</div>'
        +'<div class="em"><div class="et">'+fecha+'</div><div class="urg '+urgClass+'">'+urgLabel+'</div></div>';
    } else {
      // Correo del usuario con respuesta del admin
      const ur = c.respuestas[c.respuestas.length-1];
      contenido = '<div class="ea" style="background:var(--info)">SI</div>'
        +'<div class="eb">'
        +'<div class="ef">Sistemas respondió · '+(c.asunto||'Sin asunto')+'</div>'
        +'<div class="es">'+(ur?.texto?.slice(0,80)||'')+'...</div>'
        +'<div style="font-size:10px;color:var(--gray);margin-top:2px">💬 '+c.respuestas.length+' mensaje(s)</div>'
        +'</div>'
        +'<div class="em"><div class="et">'+fecha+'</div><div class="urg '+urgClass+'">'+urgLabel+'</div></div>';
    }
    li.innerHTML = contenido;
    li.onclick = () => abrirDetalle(c);
    lista.appendChild(li);
  });
}

function renderEnviados(correos) {
  const lista = document.getElementById('lista-enviados');
  const total = document.getElementById('total-env');
  if (total) total.textContent = correos.length + ' reporte(s)';
  if (!correos.length) { lista.innerHTML='<li style="padding:2rem;text-align:center;color:var(--gray);font-size:13px">No has enviado reportes aún.</li>'; return; }
  lista.innerHTML = '';
  correos.forEach(c => {
    const li = document.createElement('li'); li.className = 'ei';
    const color = c.urgencia==='critico'?'var(--danger)':c.urgencia==='importante'?'#D4860C':'var(--success)';
    const urgClass = c.urgencia==='critico'?'uc':c.urgencia==='importante'?'ui':'un';
    const urgLabel = c.urgencia==='critico'?'🔴 Crítico':c.urgencia==='importante'?'🟡 Importante':'🟢 Normal';
    const fecha = c.creadoEn?new Date(c.creadoEn.seconds*1000).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):'—';
    const estadoLabel = c.estado==='resuelto'?'✅ Resuelto':c.estado==='en_proceso'?'🔄 En proceso':'📬 Abierto';
    const estadoColor = c.estado==='resuelto'?'var(--success)':c.estado==='en_proceso'?'var(--warning)':'var(--info)';
    li.innerHTML = '<div class="ea" style="background:'+color+'">'+(c.sucursal||'YO').replace('Pan Pa Ya Sucursal ','').slice(0,2).toUpperCase()+'</div><div class="eb"><div class="ef">'+(c.asunto||'Sin asunto')+' <span style="font-size:11px;color:'+estadoColor+'">· '+estadoLabel+'</span></div><div class="es">'+(c.cuerpo?c.cuerpo.slice(0,80)+'...':'')+'</div><div style="font-size:10px;color:var(--gray);margin-top:2px">🏷️ '+(c.categoria||'')+(c.respuestas&&c.respuestas.length>0?' · 💬 '+c.respuestas.length+' resp.':' · ⏳ Sin respuesta')+(c.archivos&&c.archivos.length>0?' · 📸 '+c.archivos.length:'')+'</div></div><div class="em"><div class="et">'+fecha+'</div><div class="urg '+urgClass+'">'+urgLabel+'</div></div>';
    li.onclick = () => abrirDetalle(c);
    lista.appendChild(li);
  });
}

function renderActividad(correos) {
  const cont = document.getElementById('actividad-lista'); if (!cont) return;
  cont.innerHTML = '';
  if (!correos.length) { cont.innerHTML='<li class="act-i"><div class="act-dot" style="background:var(--gray-light)"></div><div><div class="act-txt">Sin actividad</div></div></li>'; return; }
  correos.slice(0,4).forEach(c => {
    const li = document.createElement('li'); li.className = 'act-i';
    const color = c.urgencia==='critico'?'var(--danger)':c.urgencia==='importante'?'#D4860C':'var(--success)';
    const fecha = c.creadoEn?new Date(c.creadoEn.seconds*1000).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    const icon = c.estado==='resuelto'?'✅':c.respuestas&&c.respuestas.length>0?'💬':'📬';
    li.innerHTML = '<div class="act-dot" style="background:'+color+'"></div><div><div class="act-txt">'+icon+' <strong>'+(c.asunto||'Sin asunto')+'</strong></div><div class="act-time">'+fecha+'</div></div>';
    cont.appendChild(li);
  });
}

function actualizarContadores(correos) {
  const res = correos.filter(c=>c.estado==='resuelto').length;
  const proc = correos.filter(c=>c.estado==='en_proceso'||c.estado==='abierto').length;
  const crit = correos.filter(c=>c.urgencia==='critico'&&c.estado!=='resuelto').length;
  document.getElementById('cnt-resueltos').textContent = res;
  document.getElementById('cnt-proceso').textContent = proc;
  document.getElementById('cnt-criticos').textContent = crit;
  const pct = correos.length>0?Math.round((res/correos.length)*100):0;
  document.getElementById('prog-fill').style.width = pct+'%';
  document.getElementById('pct-texto').textContent = pct+'% de reportes resueltos';

  // Badge correos con respuesta no leída
  const noLeidos = correos.filter(c=>!c.leidoPorUsuario && c.respuestas && c.respuestas.length>0).length;
  const bb = document.getElementById('badge-bandeja');
  if(bb){ bb.textContent = noLeidos > 99?'99+':noLeidos; bb.style.display = noLeidos>0?'inline':'none'; }
  // Badge campana
  const bn = document.getElementById('badge-notif');
  if(bn){ bn.textContent = noLeidos > 99?'99+':noLeidos; bn.style.display = noLeidos>0?'inline':'none'; }
}

// Monitor mensajes de chat no leídos para usuario
function iniciarMonitorChatUsuario(){
  if(!perfilActual || !usuarioActual) return;
  const esOficina = perfilActual.sucursal === 'Oficina Central';
  const SEEN_KEY = 'sv_user_chat';

  function getVisto(){ try{ return parseInt(localStorage.getItem(SEEN_KEY)||'0'); }catch(e){return 0;} }

  window._marcarChatLeido = function(){
    try{ localStorage.setItem(SEEN_KEY, Date.now().toString()); }catch(e){}
    const bc = document.getElementById('badge-chat-usuario');
    if(bc) bc.style.display = 'none';
  };

  // Query simple sin indices compuestos
  const filtro = esOficina
    ? where('chatId','==','oficina_'+usuarioActual.uid)
    : where('sucursal','==',perfilActual.sucursal);

  onSnapshot(query(collection(db,'chat'), filtro), snap => {
    const visto = getVisto();
    let total = 0;
    snap.forEach(d => {
      const m = d.data();
      if(m.esAdmin !== true) return;
      const ts = m.creadoEn?.seconds ? m.creadoEn.seconds*1000 : 0;
      if(ts > visto) total++;
    });
    const bc = document.getElementById('badge-chat-usuario');
    if(bc){
      bc.textContent = total > 99 ? '99+' : total;
      bc.style.display = total > 0 ? 'inline' : 'none';
    }
  }, err => console.log('Chat monitor:', err.message));
}



function renderNotificaciones() {
  const cont = document.getElementById('lista-notif'); if (!cont) return;
  if (!notificaciones.length) {
    cont.innerHTML='<div style="padding:2.5rem 1rem;text-align:center"><div style="font-size:40px;margin-bottom:.7rem">🔔</div><div style="font-size:13px;color:var(--gray);font-weight:500">Todo al día — sin notificaciones</div></div>';
    return;
  }
  cont.innerHTML = '';
  notificaciones.forEach((n,i) => {
    const esC = n.urgencia==='critico', esI = n.urgencia==='importante';
    const bgCard = esC?'#FFF5F5':esI?'#FFFBEA':'#F7FFF9';
    const borderC = esC?'#E53E3E':esI?'#D4860C':'var(--success)';
    const bgIco  = esC?'#E53E3E':esI?'#D4860C':'var(--success)';
    const icono  = esC?'🚨':esI?'⚠️':'📬';
    const esAdmin = n.titulo.includes('Sistemas');

    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:12px;align-items:flex-start;padding:.9rem 1rem;border-left:3px solid '+borderC+';background:'+bgCard+';border-radius:0 10px 10px 0;margin-bottom:8px;cursor:pointer;transition:opacity .15s';
    div.onmouseenter=()=>div.style.opacity='.85';
    div.onmouseleave=()=>div.style.opacity='1';
    div.onclick = () => {
      const c = todosMisCorreos.find(x=>x.id===n.correoId);
      if(c) abrirDetalle(c);
    };
    div.innerHTML =
      '<div style="width:38px;height:38px;border-radius:10px;background:'+bgIco+';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">'+icono+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:12px;font-weight:700;color:'+borderC+';margin-bottom:2px">'+n.titulo+'</div>'
      +'<div style="font-size:13px;font-weight:600;color:var(--charcoal);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+n.desc+'</div>'
      +(n.detalle?'<div style="font-size:11px;color:var(--gray);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+n.detalle+'</div>':'')
      +(n.fecha?'<div style="font-size:10px;color:var(--gray);margin-top:3px">🕐 '+n.fecha+'</div>':'')
      +'</div>'
      +'<div style="font-size:11px;color:'+borderC+';font-weight:600;white-space:nowrap;padding-top:2px">Ver →</div>';
    cont.appendChild(div);
  });
}

window.marcarTodasLeidas = async function() {
  for (const c of todosMisCorreos) {
    if (!c.leidoPorUsuario && c.respuestas && c.respuestas.length>0)
      await updateDoc(doc(db,'correos',c.id), {leidoPorUsuario:true});
  }
  mostrarToast('✅ Notificaciones leídas');
};

// ── DETALLE CORREO ──
let _detalleUnsub = null;

async function abrirDetalle(c) {
  sv('detalle');
  window._correoDetalleId = c.id;
  if (_detalleUnsub) { _detalleUnsub(); _detalleUnsub = null; }
  if (!c.leidoPorUsuario)
    await updateDoc(doc(db,'correos',c.id), {leidoPorUsuario:true});

  function renderHilo(data) {
    const urgLabel = data.urgencia==='critico'?'🔴 Crítico':data.urgencia==='importante'?'🟡 Importante':'🟢 Normal';
    const estadoLabel = data.estado==='resuelto'?'✅ Resuelto':data.estado==='en_proceso'?'🔄 En proceso':'📬 Abierto';

    // Cabecera
    document.getElementById('detalle-cabecera').innerHTML =
      '<h2 style="font-size:1.1rem;font-weight:700;margin-bottom:.5rem">'+(data.asunto||'Sin asunto')+'</h2>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--gray)">'
      +'<span>'+urgLabel+'</span><span>'+estadoLabel+'</span>'
      +'<span>📍 '+(data.sucursal||'')+'</span>'
      +'</div>';

    // Hilo de mensajes
    const thread = document.getElementById('email-thread-container');
    
    // Guardar texto del reply si ya existe
    const replyTxt = document.getElementById('user-reply-txt');
    const savedText = replyTxt ? replyTxt.value : '';
    
    thread.innerHTML = '';


    // Adjuntos del mensaje original
    let adjuntosHtml = '';
    if (data.archivos && data.archivos.length>0) {
      adjuntosHtml += '<div style="margin-top:.8rem;display:flex;gap:8px;flex-wrap:wrap">';
      data.archivos.forEach(url => {
        adjuntosHtml += '<img src="'+url+'" style="max-width:180px;border-radius:8px;cursor:pointer" onclick="window.open(this.src)" onerror="this.style.display=\'none\'">';
      });
      adjuntosHtml += '</div>';
    }
    if (data.documentos && data.documentos.length>0) {
      adjuntosHtml += '<div style="margin-top:.8rem">';
      data.documentos.forEach(d => {
        const ext = (d.nombre||'').split('.').pop().toUpperCase()||'DOC';
        adjuntosHtml += construirLinkDoc(d.url, d.nombre);
      });
      adjuntosHtml += '</div>';
    }

    // Mensaje original
    const ini1 = data.esDeAdmin ? 'SI' : (perfilActual.nombre||'TU').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const msg1 = document.createElement('div');
    msg1.className = 'email-msg';
    msg1.innerHTML = '<div class="email-msg-header">'
      +'<div class="email-msg-avatar" style="background:var(--bread)">'+ini1+'</div>'
      +'<div class="email-msg-meta">'
      +'<div class="email-msg-from">'+(data.esDeAdmin?'Sistemas · '+(data.remitenteNombre||'Admin'):(perfilActual.nombre||'Tú'))+'</div>'
      +'<div class="email-msg-to">Para: <strong>'+(data.esDeAdmin?(perfilActual.nombre||'Tú'):'sistemas@panpaya.com')+'</strong></div>'
      +'</div>'
      +'<div class="email-msg-date">'+(data.creadoEn?new Date(data.creadoEn.seconds*1000).toLocaleString('es-CO'):'')+'</div>'      +'</div>'      +'<div class="email-msg-body">'+(data.cuerpo||'')+adjuntosHtml+'</div>';
    thread.appendChild(msg1);

    // Respuestas
    if (data.respuestas && data.respuestas.length>0) {
      data.respuestas.forEach((r,i) => {
        const esAdm = r.esAdmin !== false;
        const ini = (r.nombre||'SI').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        const msg = document.createElement('div');
        msg.className = 'email-msg';
        let bodyHtml = r.texto||'';
        if (r.url) {
          const ext = (r.nombre_archivo||'').split('.').pop().toLowerCase();
          if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
            bodyHtml += '<br><img src="'+r.url+'" style="max-width:200px;border-radius:8px;margin-top:6px" onclick="window.open(this.src)">';
          } else {
            bodyHtml += '<br>' + construirLinkDoc(r.url, r.nombre_archivo);
          }
        }
        msg.innerHTML = '<div class="email-msg-header">'
          +'<div class="email-msg-avatar" style="background:'+(esAdm?'var(--info)':'var(--bread)')+'">'+ini+'</div>'
          +'<div class="email-msg-meta">'
          +'<div class="email-msg-from">'+(esAdm?'Sistemas · ':'Tú · ')+(r.nombre||'')+'</div>'
          +'</div>'
          +'<div class="email-msg-date">'+(r.fecha||'')+'</div>'
          +'</div>'
          +'<div class="email-msg-body">'+bodyHtml+'</div>';
        thread.appendChild(msg);
      });
    }

    // Área de respuesta — siempre al final
    const replyDiv = document.createElement('div');
    replyDiv.style.cssText = 'background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:1rem;margin-top:12px';
    replyDiv.innerHTML =
      '<div style="font-size:12px;font-weight:600;color:var(--gray);margin-bottom:.5rem">↩ Responder</div>'
      +'<textarea id="user-reply-txt" placeholder="Escribe tu respuesta..." '
      +'style="width:100%;border:1.5px solid #E8DDD5;border-radius:10px;padding:.7rem;font-size:13px;font-family:Outfit,sans-serif;resize:vertical;min-height:80px;outline:none;line-height:1.5;box-sizing:border-box" '
      +'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();window.enviarRespuestaUsuario();}"></textarea>'
      +'<div id="reply-archivos-preview" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>'
      +'<div style="display:flex;align-items:center;gap:8px;margin-top:.6rem;flex-wrap:wrap">'
      +'<button class="btn bp" onclick="window.enviarRespuestaUsuario()">📤 Enviar</button>'
      +'<label class="btn bo" style="cursor:pointer">📎 Adjuntar archivos'
      +'<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple style="display:none" onchange="window.agregarArchivosRespuesta(this)"></label>'
      +'<span id="user-reply-status" style="font-size:12px;color:var(--gray)"></span>'
      +'</div>';
    thread.appendChild(replyDiv);
    
    // Restaurar texto guardado
    if (savedText) document.getElementById('user-reply-txt').value = savedText;
    
    // Scroll al final
    thread.scrollTop = thread.scrollHeight;
  }

  _detalleUnsub = onSnapshot(doc(db,'correos',c.id), snap => {
    if (!snap.exists()) return;
    renderHilo(snap.data());
  });
}

// ── RESPUESTA USUARIO A CORREO ──
window.enviarRespuestaUsuario = async function() {
  const txt = document.getElementById('user-reply-txt')?.value.trim();
  const tieneArchivos = _archivosRespuesta.length > 0;
  if (!txt && !tieneArchivos) { mostrarToast('⚠ Escribe algo o adjunta un archivo'); return; }
  if (!perfilActual || !usuarioActual) return;
  const correoId = window._correoDetalleId;
  if (!correoId) { mostrarToast('⚠ Error: recarga y vuelve a intentar'); return; }
  const status = document.getElementById('user-reply-status');
  if (status) status.textContent = '⏳ Enviando...';
  try {
    const ref = doc(db,'correos',correoId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const respuestas = data.respuestas || [];

    // Enviar texto si hay
    if (txt) {
      respuestas.push({
        texto: txt, nombre: perfilActual.nombre,
        cargo: perfilActual.cargo||'', sucursal: perfilActual.sucursal,
        esAdmin: false, fecha: new Date().toLocaleString('es-CO')
      });
    }

    // Subir archivos en cola
    for (const archivo of _archivosRespuesta) {
      const esDoc = !archivo.type.startsWith('image') && !archivo.type.startsWith('video');
      const cloudTipo = esDoc ? 'raw' : 'image';
      const fd = new FormData();
      fd.append('file', archivo);
      fd.append('upload_preset', PRESET_U);
      fd.append('folder', 'sistemail/correos');
      const r = await fetch('https://api.cloudinary.com/v1_1/'+CLOUD_NAME_U+'/'+cloudTipo+'/upload', {method:'POST',body:fd});
      const d = await r.json();
      if (!d.secure_url) continue;
      respuestas.push({
        texto: '📎 '+archivo.name, url: d.secure_url,
        nombre_archivo: archivo.name, nombre: perfilActual.nombre,
        cargo: perfilActual.cargo||'', esAdmin: false,
        fecha: new Date().toLocaleString('es-CO')
      });
    }

    await updateDoc(ref, { respuestas, leidoPorAdmin: false, leidoPorUsuario: true, estado: 'en_proceso' });

    // Limpiar
    const txtEl = document.getElementById('user-reply-txt');
    if (txtEl) txtEl.value = '';
    _archivosRespuesta = [];
    const prev = document.getElementById('reply-archivos-preview');
    if (prev) prev.innerHTML = '';
    if (status) status.textContent = '✅ Enviado';
    setTimeout(() => { if(status) status.textContent = ''; }, 3000);
    mostrarToast('✅ Respuesta enviada');
  } catch(e) { mostrarToast('❌ Error: '+e.message); if(status) status.textContent = ''; }
};

// ── COLA DE ARCHIVOS PARA RESPUESTA ──
let _archivosRespuesta = [];

window.agregarArchivosRespuesta = function(input) {
  const nuevos = Array.from(input.files);
  nuevos.forEach(f => {
    if(!_archivosRespuesta.find(x=>x.name===f.name&&x.size===f.size)) _archivosRespuesta.push(f);
  });
  input.value = '';
  const prev = document.getElementById('reply-archivos-preview');
  if(!prev) return;
  prev.innerHTML = '';
  _archivosRespuesta.forEach((f,i) => {
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:#F0F0F0;border-radius:8px;padding:3px 8px;font-size:11px';
    chip.innerHTML = '<span>'+(!f.type.startsWith('image')&&!f.type.startsWith('video')?'📄':'📸')+'</span>'
      +'<span style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+f.name+'</span>'
      +'<span style="color:#999">('+Math.round(f.size/1024)+'KB)</span>'
      +'<span onclick="window.quitarArchivoRespuesta('+i+')" style="cursor:pointer;color:#E53935;font-weight:700;font-size:13px;padding:0 2px">×</span>';
    prev.appendChild(chip);
  });
  if(_archivosRespuesta.length>0){
    const info=document.createElement('div');
    info.style.cssText='font-size:11px;color:var(--gray);margin-top:3px;width:100%';
    info.textContent=_archivosRespuesta.length+' archivo(s). Puedes agregar más o clic en Enviar.';
    prev.appendChild(info);
  }
};

window.quitarArchivoRespuesta = function(idx) {
  _archivosRespuesta.splice(idx,1);
  const prev=document.getElementById('reply-archivos-preview');
  if(!prev)return;
  prev.innerHTML='';
  _archivosRespuesta.forEach((f,i)=>{
    const chip=document.createElement('div');
    chip.style.cssText='display:flex;align-items:center;gap:5px;background:#F0F0F0;border-radius:8px;padding:3px 8px;font-size:11px';
    chip.innerHTML='<span>'+(!f.type.startsWith('image')&&!f.type.startsWith('video')?'📄':'📸')+'</span>'
      +'<span style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+f.name+'</span>'
      +'<span onclick="window.quitarArchivoRespuesta('+i+')" style="cursor:pointer;color:#E53935;font-weight:700;font-size:13px">×</span>';
    prev.appendChild(chip);
  });
};

window.adjuntarArchivoRespuestaUser = async function(input) {
  const archivos = Array.from(input.files);
  if (!archivos.length) return;
  const correoId = window._correoDetalleId;
  if (!correoId) return;
  const status = document.getElementById('user-reply-status');
  if (status) status.textContent = '⏳ Subiendo '+archivos.length+' archivo(s)...';
  try {
    const ref = doc(db,'correos',correoId);
    const snap = await getDoc(ref);
    const data = snap.data();
    const respuestas = data.respuestas || [];

    for (const archivo of archivos) {
      const esDoc = !archivo.type.startsWith('image') && !archivo.type.startsWith('video');
      const cloudTipo = esDoc ? 'raw' : 'image';
      const fd = new FormData();
      fd.append('file', archivo);
      fd.append('upload_preset', PRESET_U);
      fd.append('folder', 'sistemail/correos');
      const r = await fetch('https://api.cloudinary.com/v1_1/'+CLOUD_NAME_U+'/'+cloudTipo+'/upload', {method:'POST',body:fd});
      const d = await r.json();
      if (!d.secure_url) continue;
      respuestas.push({
        texto: '📎 '+archivo.name,
        url: d.secure_url,
        nombre_archivo: archivo.name,
        nombre: perfilActual.nombre,
        cargo: perfilActual.cargo || '',
        esAdmin: false,
        fecha: new Date().toLocaleString('es-CO')
      });
    }

    await updateDoc(ref, { respuestas, leidoPorAdmin: false, leidoPorUsuario: true });
    if (status) status.textContent = '✅ '+archivos.length+' archivo(s) enviado(s)';
    setTimeout(() => { if(status) status.textContent = ''; }, 3000);
    mostrarToast('✅ '+archivos.length+' archivo(s) enviado(s)');
    input.value = '';
  } catch(e) { mostrarToast('❌ Error: '+e.message); if(status) status.textContent = ''; }
};

// ── CHAT ──
function cargarChat() {
  if (!perfilActual || !usuarioActual) return;
  const esOficina = perfilActual.sucursal === 'Oficina Central';
  const chatId = esOficina ? 'oficina_' + usuarioActual.uid : null;

  let q;
  if (esOficina && chatId) {
    // Chat individual por UID para Oficina Central
    q = query(collection(db,'chat'), where('chatId','==',chatId), orderBy('creadoEn','asc'));
  } else {
    // Chat por sucursal para sucursales
    q = query(collection(db,'chat'), orderBy('creadoEn','asc'));
  }

  onSnapshot(q, snap => {
    const cont = document.getElementById('chat-mensajes-user');
    if (!cont) return;
    if (snap.empty) {
      cont.innerHTML = '<div style="text-align:center;color:var(--gray);font-size:13px;padding:2rem"><div style="font-size:32px;margin-bottom:.5rem">💬</div>Sin mensajes aún. ¡Escribe el primero!</div>';
      return;
    }
    cont.innerHTML = '';
    snap.forEach(d => {
      const m = d.data();
      // Para sucursales filtrar por sucursal
      if (!esOficina && m.sucursal && m.sucursal !== perfilActual.sucursal) return;
      const esPropio = m.esAdmin === false && m.uid === usuarioActual?.uid;
      const esAdmin = m.esAdmin === true;
      const div = document.createElement('div');
      div.className = 'cm ' + (esPropio ? 'cm-out' : 'cm-in');
      const hora = m.creadoEn ? new Date(m.creadoEn.seconds*1000).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : '';
      const remitente = esAdmin ? 'Sistemas · '+(m.nombre||'Admin') : (m.nombre||'');
      if (m.tipo === 'texto') {
        div.innerHTML = (!esPropio ? '<div class="cm-sender">'+remitente+'</div>' : '') + '<div class="cm-bubble">'+m.texto+'</div><div class="cm-time">'+hora+(esPropio?' ✓✓':'')+'</div>';
      } else if (m.tipo === 'audio') {
        const aid = 'a'+Date.now()+Math.random().toString(36).slice(2);
        div.innerHTML = '<div class="cm-sender" style="'+(esPropio?'text-align:right':'')+'">🎙️ Nota de voz</div><div class="cm-audio"><button class="play-btn" id="'+aid+'" onclick="toggleAudio(\''+m.url+'\',\''+aid+'\')">▶</button><div class="waveform"></div><span class="audio-dur">'+(m.duracion||'0:00')+'</span></div><div class="cm-time">'+hora+'</div>';
      } else if (m.tipo === 'imagen' || m.tipo === 'evidencia') {
        div.innerHTML = '<div class="cm-sender" style="'+(esPropio?'text-align:right':'')+'">'+remitente+' — '+(m.tipo==='evidencia'?'🔧':'📸')+'</div><div style="margin:4px 0"><img src="'+m.url+'" style="max-width:220px;border-radius:10px;display:block;cursor:zoom-in" onclick="abrirImagen(\''+m.url+'\')" onerror="this.parentElement.innerHTML=\'📷\'"></div><div class="cm-time">'+hora+'</div>';
      } else if (m.tipo === 'video') {
        div.innerHTML = '<div class="cm-sender" style="'+(esPropio?'text-align:right':'')+'">🎬 Video</div><div style="margin:4px 0"><video style="max-width:240px;border-radius:10px;display:block" controls preload="metadata"><source src="'+m.url+'"></video></div><div class="cm-time">'+hora+'</div>';
      } else if (m.tipo === 'documento') {
        const nom = m.nombre_archivo||'Documento';
        const ext = (nom.split('.').pop()||'').toLowerCase();
        const ico = ext==='pdf'?'PDF':ext.startsWith('doc')?'DOC':ext.startsWith('xls')?'XLS':'FILE';
        div.innerHTML = '<div class="cm-sender" style="'+(esPropio?'text-align:right':'')+'">'+remitente+' Documento</div>'
          +'<div style="background:rgba(0,0,0,.06);border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:10px;max-width:260px;cursor:pointer" onclick="window.open(\''+m.url+'\',\'_blank\')">'
          +'<span style="background:var(--info);color:#fff;padding:3px 7px;border-radius:6px;font-size:11px;font-weight:700">'+ico+'</span>'
          +'<div style="flex:1;overflow:hidden"><div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+nom+'</div>'
          +'<div style="font-size:10px;color:var(--gray)">'+(m.tamano||'')+' - Toca para abrir y descargar</div></div>'
          +'</div><div class="cm-time">'+hora+'</div>';
      }
      cont.appendChild(div);
    });
    cont.scrollTop = cont.scrollHeight;
  });
}

// ── AUDIO TOGGLE ──
const audioInstancias = {};
window.toggleAudio = function(url, btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (audioInstancias[btnId]) {
    audioInstancias[btnId].pause();
    audioInstancias[btnId] = null;
    btn.textContent = '▶';
    return;
  }
  const audio = new Audio(url);
  audioInstancias[btnId] = audio;
  btn.textContent = '⏸';
  audio.play().catch(() => { btn.textContent = '▶'; mostrarToast('❌ No se pudo reproducir'); });
  audio.onended = () => { btn.textContent = '▶'; audioInstancias[btnId] = null; };
  audio.onerror = () => { btn.textContent = '▶'; audioInstancias[btnId] = null; };
};

// ── ENVIAR REPORTE ──
async function subirFoto(archivo) {
  const fd = new FormData();
  fd.append('upload_preset','sistemail_panpaya');
  fd.append('folder','sistemail/reportes');
  fd.append('file', archivo);
  // Documentos como raw, imágenes/videos normal
  const esDoc = !archivo.type.startsWith('image') && !archivo.type.startsWith('video');
  const endpoint = esDoc ? 'raw' : archivo.type.startsWith('video') ? 'video' : 'image';
  const r = await fetch('https://api.cloudinary.com/v1_1/dasj362le/'+endpoint+'/upload',{method:'POST',body:fd});
  const d = await r.json();
  if (d.secure_url) return {url: d.secure_url, nombre: archivo.name, tipo: esDoc?'documento':'imagen', tamano: Math.round(archivo.size/1024)+'KB'};
  throw new Error(d.error?.message||'Error subiendo');
}

window.enviarReporte = async function() {
  const asunto = document.getElementById('reporte-asunto').value.trim();
  const cuerpo = document.getElementById('reporte-cuerpo').innerText.trim();
  const categoria = document.getElementById('reporte-categoria').value;
  if (!asunto) { mostrarToast('Escribe un asunto'); return; }
  if (!cuerpo) { mostrarToast('Describe el problema'); return; }
  const btn = document.getElementById('btn-enviar-reporte');
  if (btn) { btn.disabled=true; btn.textContent='Enviando...'; }
  try {
    const adjuntos = [];
    if (archivosSeleccionados.length>0) {
      mostrarToast('Subiendo '+archivosSeleccionados.length+' archivo(s)...');
      for (const f of archivosSeleccionados) {
        try { adjuntos.push(await subirFoto(f)); } catch(e) { mostrarToast('No se pudo subir: '+f.name); }
      }
    }
    const urls = adjuntos.map(a => a && a.url ? a.url : a).filter(Boolean);
    const documentos = adjuntos.filter(a => a && a.tipo === 'documento');
    await addDoc(collection(db,'correos'), {
      asunto, cuerpo, categoria, urgencia: urgenciaSeleccionada,
      remitenteUid: usuarioActual.uid, remitenteNombre: perfilActual.nombre,
      sucursal: perfilActual.sucursal, cargo: perfilActual.cargo||'',
      estado:'abierto', archivos: urls, documentos: documentos,
      leidoPorAdmin:false, leidoPorUsuario:true,
      respuestas:[], creadoEn:serverTimestamp()
    });
    mostrarToast(adjuntos.length>0?'Reporte enviado con '+adjuntos.length+' archivo(s)':'Reporte enviado');
    limpiarCompose();
    setTimeout(()=>sv('enviados'),1000);
  } catch(e) { mostrarToast('Error: '+e.message); }
  finally { if (btn) { btn.disabled=false; btn.innerHTML='Enviar reporte'; } }
};

window.limpiarCompose = function() {
  document.getElementById('reporte-asunto').value = '';
  document.getElementById('reporte-cuerpo').innerText = '';
  archivosSeleccionados = [];
  document.getElementById('archivos-preview').innerHTML = '';
  selUrgencia('critico');
};
window.mostrarArchivos = function(input) {
  const nuevos = Array.from(input.files);
  nuevos.forEach(f => {
    if(!archivosSeleccionados.find(x=>x.name===f.name && x.size===f.size)) archivosSeleccionados.push(f);
  });
  input.value = '';
  const prev = document.getElementById('archivos-preview'); if(!prev) return;
  prev.innerHTML = '';
  archivosSeleccionados.forEach((f,i) => {
    const chip=document.createElement('div');
    chip.className='att-chip';
    chip.style.cssText='display:flex;align-items:center;gap:5px;background:#F0F0F0;border-radius:8px;padding:4px 8px;font-size:12px';
    const esDoc = !f.type.startsWith('image') && !f.type.startsWith('video');
    chip.innerHTML='<span>'+(esDoc?'📄':'📸')+'</span>'
      +'<span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+f.name+'</span>'
      +'<span style="color:#999;font-size:10px">('+Math.round(f.size/1024)+'KB)</span>'
      +'<span onclick="window.quitarArchivoUsuario('+i+')" style="cursor:pointer;color:#E53935;font-weight:700;font-size:14px;padding:0 2px">×</span>';
    prev.appendChild(chip);
  });
  if(archivosSeleccionados.length>0){
    const info=document.createElement('div');
    info.style.cssText='font-size:11px;color:var(--gray);margin-top:4px;width:100%';
    info.textContent=archivosSeleccionados.length+' archivo(s). Puedes agregar más.';
    prev.appendChild(info);
  }
};

window.quitarArchivoUsuario = function(idx) {
  archivosSeleccionados.splice(idx,1);
  const prev = document.getElementById('archivos-preview'); if(!prev) return;
  prev.innerHTML = '';
  archivosSeleccionados.forEach((f,i) => {
    const chip=document.createElement('div');
    chip.className='att-chip';
    chip.style.cssText='display:flex;align-items:center;gap:5px;background:#F0F0F0;border-radius:8px;padding:4px 8px;font-size:12px';
    chip.innerHTML='<span>'+(!f.type.startsWith('image')&&!f.type.startsWith('video')?'📄':'📸')+'</span>'
      +'<span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+f.name+'</span>'
      +'<span style="color:#999;font-size:10px">('+Math.round(f.size/1024)+'KB)</span>'
      +'<span onclick="window.quitarArchivoUsuario('+i+')" style="cursor:pointer;color:#E53935;font-weight:700;font-size:14px;padding:0 2px">×</span>';
    prev.appendChild(chip);
  });
};

// ── SOLICITAR REUNIÓN ──
window.enviarSolicitudReunion = async function() {
  if (!perfilActual) { mostrarToast('⚠ Sesión no cargada, recarga la página'); return; }
  const motivo = document.getElementById('sol-motivo').value.trim();
  if (!motivo) { mostrarToast('⚠ Describe el motivo'); return; }
  try {
    await addDoc(collection(db,'solicitudes_reunion'), {
      sucursal:perfilActual.sucursal, nombre:perfilActual.nombre, cargo:perfilActual.cargo||'',
      motivo, fechaSugerida:document.getElementById('sol-fecha').value,
      horaSugerida:document.getElementById('sol-hora').value,
      correo:document.getElementById('sol-correo').value.trim(),
      notas:document.getElementById('sol-notas').value.trim(),
      estado:'pendiente', creadoEn:serverTimestamp()
    });
    mostrarToast('✅ Solicitud enviada');
    limpiarSolicitud(); cargarMisSolicitudes();
  } catch(e) { mostrarToast('❌ Error: '+e.message); }
};

// ── CARGAR MIS SOLICITUDES ──
let _solicitudesAntes = {};
function cargarMisSolicitudes(){
  if(!usuarioActual) return;
  const cont = document.getElementById('mis-solicitudes');
  if(!cont) return;
  onSnapshot(
    query(collection(db,'solicitudes_reunion'), where('sucursal','==',perfilActual?.sucursal||''), orderBy('creadoEn','desc')),
    snap => {
      if(snap.empty){ cont.innerHTML='<div style="padding:1.5rem;text-align:center;color:var(--gray);font-size:13px">Sin solicitudes aún</div>'; return; }

      // Detectar cambios y mostrar toast
      snap.docs.forEach(d=>{
        const s=d.data();
        const antes=_solicitudesAntes[d.id];
        if(antes){
          // Recién aprobada
          if(antes.estado!=='aprobada' && s.estado==='aprobada'){
            mostrarToast('✅ ¡Tu reunión fue aprobada! '+( s.reunionFecha?s.reunionFecha+' '+s.reunionHora:''));
            sonarAlertaUsuario();
          }
          // Nuevo recordatorio
          if(s.ultimoRecordatorio && s.ultimoRecordatorio!==antes.ultimoRecordatorio){
            mostrarToast('🔔 Recordatorio de Sistemas: '+(s.reunionTitulo||'')+(s.reunionHora?' a las '+s.reunionHora:''));
            sonarAlertaUsuario();
          }
        }
        _solicitudesAntes[d.id]=s;
      });

      const docs = snap.docs.filter(d => d.data().estado !== 'eliminada');
      if(!docs.length){ cont.innerHTML='<div style="padding:1.5rem;text-align:center;color:var(--gray);font-size:13px">Sin solicitudes aún</div>'; return; }

      cont.innerHTML = docs.map(d=>{
        const s=d.data();
        const esAprobada = s.estado==='aprobada';
        const esRechazada = s.estado==='rechazada';
        const estadoHtml = esAprobada
          ? '<span style="color:var(--success);font-weight:600;font-size:12px">✅ Aprobada</span>'
          : esRechazada
          ? '<span style="color:var(--danger);font-weight:600;font-size:12px">❌ Rechazada</span>'
          : '<span style="color:var(--warning);font-weight:600;font-size:12px">⏳ Pendiente</span>';
        const bgColor = esAprobada ? '#F0FFF4' : esRechazada ? '#FFF5F5' : '#FFFBEA';
        const borderColor = esAprobada ? 'var(--success)' : esRechazada ? 'var(--danger)' : 'var(--warning)';

        let detalleHtml = '';
        if (esAprobada) {
          detalleHtml += '<div style="margin-top:.5rem;padding:.7rem;background:#fff;border-radius:8px;font-size:12px">';
          if (s.reunionFecha) detalleHtml += '<div>📅 <strong>'+s.reunionFecha+'</strong> a las <strong>'+(s.reunionHora||'')+'</strong></div>';
          if (s.reunionTitulo) detalleHtml += '<div style="margin-top:3px">📋 '+s.reunionTitulo+'</div>';
          if (s.reunionLink) detalleHtml += '<div style="margin-top:6px"><a href="'+s.reunionLink+'" target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;background:var(--success);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:12px">🔗 Unirse a la reunión</a></div>';
          if (s.ultimoRecordatorio) detalleHtml += '<div style="margin-top:8px;padding:6px 8px;background:#FFF8E1;border-left:3px solid #D4860C;border-radius:4px;font-size:11px;color:#5D4037">🔔 <strong>Recordatorio de Sistemas:</strong> '+s.ultimoRecordatorio+'</div>';
          detalleHtml += '</div>';
        } else {
          if (s.fechaSugerida) detalleHtml += '<div style="font-size:11px;color:var(--gray);margin-top:3px">📅 Sugerida: '+s.fechaSugerida+(s.horaSugerida?' '+s.horaSugerida:'')+'</div>';
        }

        return '<div style="padding:.9rem 1rem;border-left:3px solid '+borderColor+';background:'+bgColor+';border-radius:8px;margin-bottom:8px">'
          +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
          +'<strong style="font-size:13px">'+s.motivo+'</strong>'+estadoHtml+'</div>'
          + detalleHtml
          +'</div>';
      }).join('');

      // Iniciar monitor de alarma para reuniones aprobadas
      iniciarMonitorReunionesUsuario(docs.map(d=>({id:d.id,...d.data()})));
    }
  );
}

// Monitor de alarma para el usuario
let _alarmaUsuarioInterval = null;
let _alarmasDisparadasUser = new Set();
function iniciarMonitorReunionesUsuario(solicitudes) {
  if(_alarmaUsuarioInterval) clearInterval(_alarmaUsuarioInterval);
  const aprobadas = solicitudes.filter(s=>s.estado==='aprobada'&&s.reunionFecha&&s.reunionHora);
  if(!aprobadas.length) return;

  _alarmaUsuarioInterval = setInterval(()=>{
    const ahora = new Date();
    aprobadas.forEach(s=>{
      try{
        const [a,m,d] = s.reunionFecha.split('-').map(Number);
        const [hh,mm] = s.reunionHora.split(':').map(Number);
        const fR = new Date(a,m-1,d,hh,mm,0);
        const diffMin = Math.round((fR-ahora)/60000);
        if(diffMin < -15) return;

        if(diffMin===5 && !_alarmasDisparadasUser.has(s.id+'_antes')){
          _alarmasDisparadasUser.add(s.id+'_antes');
          mostrarToast('⏰ En 5 minutos: '+s.reunionTitulo+(s.reunionLink?' — Prepárate':''));
          sonarAlertaUsuario();
        }
        if(diffMin===0 && !_alarmasDisparadasUser.has(s.id+'_ahora')){
          _alarmasDisparadasUser.add(s.id+'_ahora');
          mostrarToast('🔔 ¡Hora de tu reunión! '+s.reunionTitulo+(s.reunionLink?' — Conéctate ahora':''));
          sonarAlertaUsuario();
        }
      }catch(e){}
    });
  }, 30000);
}

function sonarAlertaUsuario(){
  try{
    const ctx = new AudioContext();
    [0,0.3,0.6].forEach(t=>{
      const o=ctx.createOscillator();const g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.frequency.value=880;g.gain.setValueAtTime(0.3,ctx.currentTime+t);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.4);
      o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+0.4);
    });
  }catch(e){}
}

window.limpiarSolicitud = function() {
  ['sol-motivo','sol-fecha','sol-notas','sol-correo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const hora = document.getElementById('sol-hora'); if (hora) hora.value='10:00';
};

window.enviarMensajeChatUser = async function() {
  const inp = document.getElementById('user-chat-input');
  const t = inp?.value.trim();
  if (!t || !usuarioActual || !perfilActual) return;
  inp.value = '';
  const esOficina = perfilActual.sucursal === 'Oficina Central';
  const datos = {
    tipo: 'texto', texto: t, esAdmin: false,
    nombre: perfilActual.nombre, cargo: perfilActual.cargo||'',
    sucursal: perfilActual.sucursal, uid: usuarioActual.uid,
    leidoPorAdmin: false,
    leidoPorUsuario: true,
    creadoEn: serverTimestamp()
  };
  if (esOficina) datos.chatId = 'oficina_' + usuarioActual.uid;
  await addDoc(collection(db,'chat'), datos);
};

window.subirArchivoUser = async function(input, tipo) {
  if (!input.files.length || !perfilActual) return;
  const archivo = input.files[0];

  // Validar tamaño — máximo 50MB para video, 10MB para imagen
  const maxMB = tipo === 'video' ? 50 : 10;
  if(archivo.size > maxMB * 1024 * 1024){
    mostrarToast('❌ El archivo es muy grande. Máximo '+maxMB+'MB');
    input.value = ''; return;
  }

  document.getElementById('user-upload-bar').style.display = 'block';
  document.getElementById('user-normal-input').style.display = 'none';
  try {
    const esDoc = tipo === 'documento';
    const cloudTipo = esDoc ? 'raw' : tipo === 'video' ? 'video' : 'image';
    const fd = new FormData();
    fd.append('file', archivo);
    fd.append('upload_preset', PRESET_U);
    fd.append('folder', 'sistemail/chat');
    const r = await fetch('https://api.cloudinary.com/v1_1/'+CLOUD_NAME_U+'/'+cloudTipo+'/upload', {method:'POST',body:fd});
    const d = await r.json();
    if (!d.secure_url) throw new Error(d.error?.message || 'Error subiendo archivo');
    const url = d.secure_url;
    const esOficina = perfilActual.sucursal === 'Oficina Central';
    const datos = {
      tipo: esDoc ? 'documento' : tipo,
      url, nombre_archivo: archivo.name,
      tamano: Math.round(archivo.size/1024)+'KB',
      esAdmin: false, nombre: perfilActual.nombre,
      cargo: perfilActual.cargo||'',
      sucursal: perfilActual.sucursal,
      uid: usuarioActual.uid,
      creadoEn: serverTimestamp()
    };
    if (esOficina) datos.chatId = 'oficina_' + usuarioActual.uid;
    await addDoc(collection(db,'chat'), datos);
    mostrarToast('✅ '+(esDoc?'Documento':tipo==='video'?'Video':'Imagen')+' enviado');
    input.value = '';
  } catch(e) {
    console.error('Upload error:', e);
    mostrarToast('❌ Error: ' + e.message);
  } finally {
    document.getElementById('user-upload-bar').style.display = 'none';
    document.getElementById('user-normal-input').style.display = 'block';
  }
};

window.iniciarGrabacionUser = async function() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderU = new MediaRecorder(stream);
    audioChunksU = [];
    mediaRecorderU.ondataavailable = e => { if(e.data.size > 0) audioChunksU.push(e.data); };
    mediaRecorderU.start(100);
    document.getElementById('user-recording-ui').style.display = 'flex';
    document.getElementById('user-normal-input').style.display = 'none';
    recSegsU = 0;
    recIntervalU = setInterval(() => {
      recSegsU++;
      const m = Math.floor(recSegsU / 60), s = recSegsU % 60;
      document.getElementById('user-rec-timer').textContent = m + ':' + (s + '').padStart(2, '0');
    }, 1000);
  } catch(e) { mostrarToast('❌ Micrófono no disponible: ' + e.message); }
};

window.cancelarGrabacionUser = function() {
  if (mediaRecorderU) { mediaRecorderU.stop(); mediaRecorderU.stream.getTracks().forEach(t => t.stop()); }
  clearInterval(recIntervalU);
  document.getElementById('user-recording-ui').style.display = 'none';
  document.getElementById('user-normal-input').style.display = 'block';
};

window.enviarAudioUser = async function() {
  if (!mediaRecorderU || !perfilActual) return;
  clearInterval(recIntervalU);
  const duracion = document.getElementById('user-rec-timer').textContent;
  document.getElementById('user-recording-ui').style.display = 'none';
  document.getElementById('user-upload-bar').style.display = 'block';
  document.getElementById('user-normal-input').style.display = 'none';

  mediaRecorderU.onstop = async () => {
    try {
      if(audioChunksU.length === 0){ mostrarToast('⚠ Audio vacío'); return; }
      const blob = new Blob(audioChunksU, { type: 'audio/webm;codecs=opus' });
      const archivo = new File([blob], 'audio_'+Date.now()+'.webm', { type: 'audio/webm' });
      const url = await subirCloudinaryUser(archivo, 'video');
      const esOficina = perfilActual.sucursal === 'Oficina Central';
      const datos = {
        tipo: 'audio', url, duracion,
        esAdmin: false,
        nombre: perfilActual.nombre,
        cargo: perfilActual.cargo||'',
        sucursal: perfilActual.sucursal,
        uid: usuarioActual.uid,
        creadoEn: serverTimestamp()
      };
      if(esOficina) datos.chatId = 'oficina_' + usuarioActual.uid;
      await addDoc(collection(db,'chat'), datos);
      mostrarToast('🎙️ Audio enviado');
      audioChunksU = [];
    } catch(e) {
      console.error('Audio error:', e);
      mostrarToast('❌ Error: ' + e.message);
    } finally {
      document.getElementById('user-upload-bar').style.display = 'none';
      document.getElementById('user-normal-input').style.display = 'block';
    }
    mediaRecorderU.stream.getTracks().forEach(t => t.stop());
  };

  if(mediaRecorderU.state !== 'inactive') mediaRecorderU.stop();
  else mediaRecorderU.onstop();
};

// ── HELPER CLOUDINARY ──
async function subirCloudinaryUser(archivo, tipo) {
  const cloudTipo = tipo === 'documento' ? 'raw' : tipo === 'video' ? 'video' : 'image';
  const fd = new FormData();
  fd.append('file', archivo);
  fd.append('upload_preset', PRESET_U);
  fd.append('folder', 'sistemail/chat');
  const r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUD_NAME_U + '/' + cloudTipo + '/upload', { method: 'POST', body: fd });
  const d = await r.json();
  if (!d.secure_url) throw new Error(d.error?.message || 'Error subiendo archivo');
  return d.secure_url;
}


window.selUrgencia = function(u) {
  urgenciaSeleccionada = u;
  document.getElementById('urg-critico').className = 'uopt'+(u==='critico'?' sel-r':'');
  document.getElementById('urg-importante').className = 'uopt'+(u==='importante'?' sel-a':'');
  document.getElementById('urg-normal').className = 'uopt'+(u==='normal'?' sel-g':'');
};
window.abrirImagen = function(url) { document.getElementById('img-modal-src').src=url; document.getElementById('img-modal').classList.add('open'); };
window.cerrarModal = function() { document.getElementById('img-modal').classList.remove('open'); };
document.addEventListener('keydown', e => { if(e.key==='Escape'){window.cerrarModal();window.cerrarIA&&window.cerrarIA();} });

const titulos = {bandeja:'Bandeja de entrada',compose:'Nuevo reporte',enviados:'Mis reportes enviados',detalle:'Hilo del correo',chat:'Chat con Sistemas',reunion:'Solicitar reunión',notif:'Notificaciones',config:'Configuración'};

// Hook del módulo — maneja config y limpia búsqueda al cambiar vista
window._svHook = function(v){
  // Limpiar buscador al cambiar de sección
  var search = document.querySelector('.searchbar input');
  if(search && search.value){
    search.value = '';
    renderBandeja(todosMisCorreos);
    renderEnviados(todosMisCorreos);
  }
  // Config
  if(v==='config' && perfilActual){
    var n=document.getElementById('cfg-nombre'); if(n)n.value=perfilActual.nombre||'';
    var s=document.getElementById('cfg-sucursal'); if(s)s.value=perfilActual.sucursal||'';
    var e=document.getElementById('cfg-email'); if(e)e.value=perfilActual.email||usuarioActual?.email||'';
    if(perfilActual.esOficina||perfilActual.sucursal==='Oficina Central'){
      var cr=document.getElementById('cfg-cargo-row'); if(cr)cr.style.display='block';
      var cc=document.getElementById('cfg-cargo'); if(cc)cc.value=perfilActual.cargo||'';
    }
  }
};

window.buscarCorreos = function(t) {
  const texto = (t||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  // Sin texto — mostrar todo
  if(!texto){
    renderBandeja(todosMisCorreos);
    renderEnviados(todosMisCorreos);
    return;
  }

  function ok(v){
    return (v||'').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .includes(texto);
  }

  const filtrados = todosMisCorreos.filter(c =>
    ok(c.asunto) || ok(c.cuerpo) || ok(c.categoria) ||
    ok(c.urgencia) || ok(c.estado) || ok(c.sucursal) ||
    ok(c.remitenteNombre) || ok(c.cargo) ||
    (c.respuestas||[]).some(r => ok(r.texto) || ok(r.nombre))
  );

  renderBandeja(filtrados);
  renderEnviados(filtrados);
};
window.guardarConfig = async function() {
  const nombre = document.getElementById('cfg-nombre').value.trim();
  if (!nombre) { mostrarToast('⚠ Escribe tu nombre'); return; }
  const datos = {nombre};
  if (perfilActual.esOficina||perfilActual.sucursal==='Oficina Central') {
    const cargo = document.getElementById('cfg-cargo')?.value;
    if (cargo) datos.cargo = cargo;
  }
  await updateDoc(doc(db,'usuarios',usuarioActual.uid), datos);
  Object.assign(perfilActual, datos);
  cargarPerfil();
  mostrarToast('✅ Cambios guardados');
};
function mostrarToast(msg) {
  const t=document.getElementById('toast'); const tm=document.getElementById('toast-msg');
  if(!t||!tm)return; tm.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3500);
}
window.mostrarToast = mostrarToast;

// ── CERRAR SESIÓN ──
window.cerrarSesion = async function() {
  cerrando = true; // bloquear onAuthStateChanged
  try { await signOut(auth); } catch(e) {}
  // Limpiar todo
  sessionStorage.clear();
  // Redirigir
  window.location.replace('index.html');
};
window.confirmarCerrarSesion = function() {
  if (confirm('¿Deseas cerrar sesión?')) window.cerrarSesion();
};

window.eliminarSolicitud = async function(id){
  if(!confirm('Eliminar esta solicitud?')) return;
  const {deleteDoc:dd} = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await dd(doc(db,'solicitudes_reunion',id));
  mostrarToast('Solicitud eliminada');
};

window.eliminarMiReunion = async function(id){
  if(!confirm("Eliminar esta reunion de tu lista?")) return;
  // Solo marcar como eliminada para el usuario (no borrar de admin)
  await updateDoc(doc(db,'reuniones',id),{ocultarParaSucursal: perfilActual.sucursal});
  mostrarToast("Reunion eliminada de tu lista");
};