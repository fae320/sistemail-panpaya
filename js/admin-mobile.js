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

// ══════════════════════════════════════
// BASE DE CONOCIMIENTO — Admin Sistemas
// ══════════════════════════════════════
const BASE_ADMIN = [
  {
    palabras: ['pos','caja','sistema','venta','no enciende','no abre','diagnos','falla pos','error pos'],
    respuesta: `🔍 **Diagnóstico sistema POS — protocolo Sistemas:**

**Verificación remota (antes de desplazarse):**
1. Pedir a la sucursal reiniciar el equipo completamente
2. Preguntar: ¿Cuándo ocurrió? ¿Hubo corte de luz? ¿Qué error muestra?
3. Solicitar foto del error si aparece en pantalla

**Diagnóstico por tipo:**
- **No abre el programa:** Verificar que el servicio de Windows esté activo, revisar logs de la aplicación
- **Abre pero no conecta:** Problema de red o base de datos — verificar conexión al servidor
- **Error de licencia:** Verificar fecha de vencimiento, contactar proveedor del software
- **Pantalla negra al abrir:** Driver de video desactualizado o RAM insuficiente

**Solución remota primero:**
1. Acceso remoto con AnyDesk o TeamViewer
2. Reiniciar el servicio desde el administrador de tareas
3. Limpiar archivos temporales del sistema

**Si requiere visita:**
- Llevar equipo de reemplazo si el caso es crítico 🔴
- Verificar disponibilidad de la sucursal antes de ir

**Respuesta sugerida:**
*"Recibimos tu reporte. Ya estamos revisando remotamente. En 30 minutos te confirmamos solución o visita técnica."*`
  },
  {
    palabras: ['facturacion','factura electronica','dian','certificado','no factura','facturar'],
    respuesta: `🧾 **Falla de facturación electrónica — diagnóstico:**

**Causas más comunes:**
1. **Certificado digital vencido:** Renovar con el proveedor autorizado de la DIAN
2. **Token no reconocido:** Reinstalar drivers del token USB
3. **Resolución de facturación vencida:** Tramitar nueva resolución ante la DIAN
4. **Internet caído en la sucursal:** La facturación electrónica requiere conectividad

**Pasos de diagnóstico:**
1. Verificar estado del servicio DIAN en https://www.dian.gov.co
2. Revisar fecha de vencimiento del certificado digital
3. Verificar que el equipo tenga la hora y fecha correctas
4. Revisar logs del software de facturación

**Solución de contingencia:**
- Activar modo de facturación offline si el software lo permite
- Emitir documentos equivalentes hasta restaurar el servicio

⚠️ Si el certificado está vencido, es trámite urgente — puede tardar 1-3 días hábiles.`
  },
  {
    palabras: ['internet','red','conectividad','router','vpn','fibra','cable','sin internet','caida red'],
    respuesta: `🌐 **Diagnóstico falla de internet — niveles de atención:**

**Nivel 1 — La sucursal lo hace:**
1. Reiniciar router (apagar 1 min, encender)
2. Reiniciar el equipo afectado
3. Verificar luces del router

**Nivel 2 — Sistemas remoto:**
1. Verificar configuración IP: ¿tiene IP asignada? (cmd → ipconfig)
2. Hacer ping al gateway: ping 192.168.1.1
3. Verificar DNS: ping 8.8.8.8
4. Revisar configuración de VPN si aplica
5. Verificar si el problema es el equipo o toda la red de la sucursal

**Nivel 3 — Proveedor o visita:**
1. Si todos los equipos sin internet: llamar al proveedor (ETB/Claro/Movistar)
2. Si solo un equipo: problema de tarjeta de red o driver
3. Cable de red dañado: reemplazar

**Diagnóstico rápido por síntoma:**
- Solo una PC sin internet → problema del equipo o puerto del switch
- Todos los equipos sin internet → router o proveedor
- Internet lento → ancho de banda saturado, reiniciar router`
  },
  {
    palabras: ['impresora','driver','imprimir','ticket','papel','puerto','com','usb impresora'],
    respuesta: `🖨️ **Diagnóstico y solución de impresoras — Sistemas:**

**Diagnóstico técnico:**
1. Verificar que el driver esté instalado correctamente: Panel de Control → Dispositivos
2. Revisar el puerto COM asignado si es impresora serial
3. Eliminar y reinstalar el driver desde el sitio oficial del fabricante
4. Verificar que la impresora aparezca en el administrador de dispositivos sin errores

**Pasos de reinstalación de driver:**
1. Panel de Control → Dispositivos e impresoras → Clic derecho → Quitar dispositivo
2. Desconectar USB
3. Descargar driver oficial del fabricante (Epson, Star, Bixolon, etc.)
4. Instalar driver, conectar USB cuando lo pida
5. Imprimir página de prueba

**Configuración en el sistema de ventas:**
1. Abrir configuración del POS
2. Seleccionar la impresora correcta como predeterminada
3. Configurar el ancho de papel (57mm o 80mm según modelo)
4. Hacer prueba de impresión desde el sistema

**Modelos comunes Pan Pa' Ya:**
- Epson TM-T20 → Puerto USB
- Star TSP100 → Puerto USB o LAN`
  },
  {
    palabras: ['mejorar','redactar','respuesta','texto','formal','profesional','plantilla'],
    respuesta: `✨ **Plantillas de respuesta para Sistemas:**

**✅ Caso resuelto:**
*"El caso fue atendido satisfactoriamente. El sistema opera con normalidad. Cualquier novedad adicional no dude en reportarla."*

**🔄 En revisión:**
*"Recibimos su reporte y está siendo gestionado por nuestro equipo técnico. Tiempo estimado de solución: [X horas]. Le notificaremos al resolver."*

**🔧 Requiere visita técnica:**
*"El caso requiere atención presencial. Programamos visita técnica para el [fecha] a las [hora]. Por favor confirme disponibilidad."*

**📞 Información adicional requerida:**
*"Para gestionar su reporte necesitamos información adicional: [especificar qué necesitan]. Por favor responda este correo con los datos solicitados."*

**⏰ Fuera de horario:**
*"Su reporte fue recibido fuera del horario de atención. Será gestionado el próximo día hábil en horario de [hora inicio] a [hora fin]."*`
  },
  {
    palabras: ['backup','respaldo','base de datos','servidor','sql','restaurar','perdi datos','datos perdidos'],
    respuesta: `💾 **Gestión de backups y base de datos:**

**Verificación de backups:**
1. Revisar la última fecha de backup exitoso
2. Verificar que el backup se esté ejecutando automáticamente
3. Comprobar que el archivo de backup no esté corrupto

**Restauración de datos:**
1. Identificar la fecha del último backup válido
2. Detener el servicio de la aplicación antes de restaurar
3. Restaurar en entorno de prueba primero si es posible
4. Documentar qué datos se perderán del período sin backup

**Configuración de backup automático:**
1. Programar tarea en el Administrador de tareas de Windows
2. Backup diario a las 11:30 PM (fuera de horario de ventas)
3. Guardar en unidad externa Y en la nube
4. Mantener mínimo 7 días de backups

⚠️ Si hay pérdida de datos de ventas, notificar inmediatamente a Gerencia y Contabilidad.`
  },
  {
    palabras: ['acceso remoto','anydesk','teamviewer','remote','vpn','conectar remotamente'],
    respuesta: `🖥️ **Acceso remoto a sucursales:**

**Con AnyDesk:**
1. Pedir a la sucursal que abra AnyDesk
2. Solicitar el número de 9 dígitos que aparece
3. Escribir ese número en tu AnyDesk y conectar
4. La sucursal debe aceptar la conexión

**Con TeamViewer:**
1. Pedir el ID y contraseña de sesión
2. Ingresar en tu TeamViewer para conectar

**Buenas prácticas de acceso remoto:**
- Siempre notificar a la sucursal antes de conectarse
- No realizar cambios mayores sin confirmación
- Documentar los cambios realizados
- Cerrar la sesión remota al terminar

**Si no tienen AnyDesk instalado:**
1. Enviarles el link de descarga por chat del sistema
2. Darles instrucciones paso a paso para instalar
3. Solo requiere ejecutar el .exe, no necesita instalación completa`
  },
  {
    palabras: ['hola','buenas','buenos dias','ayuda','consulta'],
    respuesta: `👋 ¡Hola! Asistente técnico de Sistemas activo.

Puedo ayudarte con:
- 🔍 **Diagnóstico POS** — protocolo técnico completo
- 🧾 **Facturación electrónica** — DIAN y certificados
- 🌐 **Fallas de red** — niveles de diagnóstico
- 🖨️ **Impresoras** — drivers y configuración
- 💾 **Backups** y base de datos
- 🖥️ **Acceso remoto** a sucursales
- ✨ **Plantillas de respuesta** profesional

¿En qué estás trabajando?`
  },
  {
    palabras: ['visita','tecnica','cuando','prioridad','urgente','tiempo','demora','sla'],
    respuesta: `📅 **Prioridades y tiempos de atención — SLA:**

**🔴 Crítico — atención en 2 horas:**
- POS o caja sin funcionar (no pueden vender)
- Facturación totalmente bloqueada
- Pérdida de datos

**🟡 Importante — atención en 24 horas:**
- Impresora sin funcionar
- Internet lento o inestable
- Equipo con fallas intermitentes

**🟢 Normal — atención en 72 horas:**
- Mantenimiento preventivo
- Actualizaciones de software
- Configuraciones menores

**Para programar visita técnica:**
1. Confirmar con la sucursal horario disponible
2. Crear evento en Reuniones del sistema con link si es remota
3. Enviar recordatorio por chat 1 hora antes
4. Documentar en el reporte el resultado de la visita`
  }
];

const RESPUESTA_DEFAULT_ADMIN = `🤔 No tengo un protocolo específico para eso.

Te sugiero:
1. Revisar el historial de reportes similares en la bandeja
2. Responder a la sucursal que estás gestionando el caso
3. Si necesitas apoyo, escala el caso a un técnico senior

💡 *Puedo ayudarte con:*
- Diagnóstico de POS, impresoras, internet
- Mejorar respuestas a sucursales
- Plantillas de respuesta profesional`;

function buscarRespuestaAdmin(texto) {
  const textoLower = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let mejorCoincidencia = null;
  let maxCoincidencias = 0;
  for (const item of BASE_ADMIN) {
    let coincidencias = 0;
    for (const palabra of item.palabras) {
      if (textoLower.includes(palabra)) coincidencias++;
    }
    if (coincidencias > maxCoincidencias) { maxCoincidencias = coincidencias; mejorCoincidencia = item; }
  }
  return maxCoincidencias >= 1 ? mejorCoincidencia.respuesta : RESPUESTA_DEFAULT_ADMIN;
}

function formatearRespuesta(texto) {
  return texto.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>').replace(/\n/g,'<br>');
}

// ══════════════════════════════════════
// MODAL IA ADMIN
// ══════════════════════════════════════
window.abrirIA = function() { const m=document.getElementById('ia-modal');if(m)m.style.display='flex'; };
window.cerrarIA = function() { const m=document.getElementById('ia-modal');if(m)m.style.display='none'; };

window.enviarMensajeIA = function() {
  const inp = document.getElementById('ia-input');
  if (!inp) return;
  const texto = inp.value.trim();
  if (!texto) return;
  inp.value = '';

  const cont = document.getElementById('ia-mensajes');
  const bienvenida = document.getElementById('ia-bienvenida');
  if (bienvenida) bienvenida.style.display = 'none';

  const bUser = document.createElement('div');
  bUser.className = 'ia-burbuja-user';
  bUser.textContent = texto;
  cont.appendChild(bUser);

  const bLoad = document.createElement('div');
  bLoad.className = 'ia-burbuja-load';
  bLoad.textContent = '✨ Buscando protocolo...';
  cont.appendChild(bLoad);
  cont.scrollTop = cont.scrollHeight;

  setTimeout(() => {
    bLoad.remove();
    const respuesta = buscarRespuestaAdmin(texto);
    const bIA = document.createElement('div');
    bIA.className = 'ia-burbuja-ia';
    bIA.innerHTML = formatearRespuesta(respuesta);
    cont.appendChild(bIA);

    // Botón "Usar como respuesta" si el admin está mejorando texto
    const esMejora = texto.toLowerCase().includes('mejor') || texto.toLowerCase().includes('redact');
    if (esMejora) {
      const btnUsar = document.createElement('button');
      btnUsar.style.cssText = 'align-self:flex-start;background:var(--info);color:#fff;border:none;border-radius:100px;padding:5px 14px;font-size:11px;cursor:pointer;margin-top:4px;font-family:"Outfit",sans-serif;font-weight:600';
      btnUsar.textContent = '📋 Usar como respuesta';
      btnUsar.onclick = () => {
        const rt = document.getElementById('reply-txt');
        const textoLimpio = respuesta.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/✨.*?\n/,'').trim();
        if (rt) { rt.value = textoLimpio; window.cerrarIA(); window.mostrarToast && window.mostrarToast('✅ Respuesta aplicada'); }
        else { navigator.clipboard.writeText(textoLimpio).catch(()=>{}); window.mostrarToast && window.mostrarToast('✅ Copiado'); }
      };
      cont.appendChild(btnUsar);
    }
    cont.scrollTop = cont.scrollHeight;
  }, 600);
};

document.addEventListener('DOMContentLoaded', () => {
  const sugerencias = {
    'sug-diag': '¿Cómo diagnostico una falla en el sistema POS de una sucursal?',
    'sug-red': 'Ayúdame a mejorar esta respuesta para la sucursal',
    'sug-net': '¿Cómo diagnostico una falla de internet en una sucursal?'
  };
  Object.entries(sugerencias).forEach(([id, texto]) => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = () => {
      if (id === 'sug-red') {
        const rt = document.getElementById('reply-txt');
        const val = rt?.value?.trim();
        document.getElementById('ia-input').value = val && val.length > 5 ? 'Mejora esta respuesta: ' + val : texto;
      } else {
        document.getElementById('ia-input').value = texto;
      }
      window.enviarMensajeIA();
    };
  });
  const iaInput = document.getElementById('ia-input');
  if (iaInput) iaInput.addEventListener('keydown', e => { if (e.key === 'Enter') window.enviarMensajeIA(); });
  const iaSend = document.getElementById('ia-send');
  if (iaSend) iaSend.onclick = window.enviarMensajeIA;
  const iaModal = document.getElementById('ia-modal');
  if (iaModal) iaModal.addEventListener('click', e => { if (e.target === iaModal) window.cerrarIA(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.cerrarIA?.(); });
});