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

// ══════════════════════════════════════
// BASE DE CONOCIMIENTO — Pan Pa' Ya
// ══════════════════════════════════════
const BASE_CONOCIMIENTO = [
  {
    palabras: ['pos','caja','sistema','venta','factura','no enciende','no prende','trabado','colgado','lento','reiniciar pos','reinicio','no abre','no me abre','no carga','no inicia'],
    respuesta: `🔄 **El sistema POS no abre o está trabado:**

1. Cierra el programa completamente (clic derecho en la barra de tareas → Cerrar)
2. Espera 30 segundos
3. Apaga el equipo con el botón de encendido
4. Espera 1 minuto completo
5. Enciende el equipo y espera que cargue completamente
6. Abre el sistema de ventas

⚠️ Si después de 2 intentos sigue sin abrir, crea un reporte con urgencia 🔴 **Crítico** — esto afecta las ventas.

💡 *Mientras tanto anota las ventas manualmente para registrarlas después.*`
  },
  {
    palabras: ['facturar','no puedo facturar','facturacion','factura electronica','dian','no genera','no factura'],
    respuesta: `🧾 **No puedo facturar — pasos a seguir:**

1. Verifica que el internet esté funcionando (la facturación electrónica lo requiere)
2. Cierra el programa y ábrelo nuevamente
3. Verifica que la fecha y hora del equipo estén correctas
4. Intenta con otro navegador si es facturación web

**Si el error dice "DIAN no responde":**
- Es un problema del servidor de la DIAN — espera 10-15 minutos e intenta de nuevo
- Puedes emitir facturas de contingencia mientras tanto

**Si el error dice "certificado vencido":**
- Este lo debe resolver Sistemas — crea un reporte urgente

⚠️ Si no puedes facturar por más de 30 minutos, reporta como 🔴 **Crítico**.`
  },
  {
    palabras: ['inventario','no carga inventario','stock','productos','no aparece','catalogo','no se ve','no muestra'],
    respuesta: `📦 **El inventario no carga o no aparece:**

1. Cierra y vuelve a abrir el programa
2. Verifica que tengas internet — el inventario se sincroniza en línea
3. Espera 2 minutos y recarga (F5 si es navegador)
4. Cierra todos los programas y reinicia el equipo

**Si el inventario aparece vacío:**
- Puede ser una sincronización pendiente — espera 5 minutos
- Verifica que estés en la sucursal correcta en el sistema

**Si un producto específico no aparece:**
- Puede que no esté asignado a tu sucursal
- Crea un reporte indicando el código o nombre del producto

⚠️ Crea un reporte si el inventario lleva más de 15 minutos sin cargar.`
  },
  {
    palabras: ['pedido','no aparece pedido','orden','no llego','no se ve el pedido','domicilio','no encuentro'],
    respuesta: `🛒 **No aparece el pedido:**

1. Actualiza la pantalla (F5 o botón de recargar)
2. Verifica el filtro de fecha — asegúrate que esté en la fecha de hoy
3. Cierra y abre el programa nuevamente
4. Verifica que el internet esté funcionando

**Si el pedido fue hecho pero no aparece:**
- Puede estar en otra sucursal por error de asignación
- Verifica el número de pedido con el cliente
- Busca por número de pedido si el programa lo permite

**Si es pedido en línea (app o web):**
- Puede tardar hasta 5 minutos en sincronizarse
- Refresca la pantalla cada 2 minutos

⚠️ Si el pedido tiene más de 10 minutos y no aparece, crea un reporte urgente indicando el número de pedido.`
  },
  {
    palabras: ['programa se cerro','se cerro solo','se apago','crasheo','error inesperado','se cerró','se cayó','pantalla azul','error windows'],
    respuesta: `💥 **El programa se cerró inesperadamente:**

1. Vuelve a abrir el programa normalmente
2. Si pide recuperar sesión anterior, acepta
3. Verifica si se guardaron los últimos datos

**Si se cierra repetidamente:**
1. Reinicia el equipo completamente
2. Espera 5 minutos antes de abrir el programa
3. Si hay actualizaciones de Windows pendientes, déjalas terminar

**Si apareció pantalla azul (BSOD):**
- El equipo se reiniciará solo
- Espera que cargue completamente
- Anota el código de error si aparece (ejemplo: MEMORY_MANAGEMENT)
- Crea un reporte con ese código

⚠️ Si el programa se cierra más de 3 veces en un día, crea un reporte con categoría **Software**.`
  },
  {
    palabras: ['caja lenta','muy lento','tarda','demora','lento','congela','se congela','no responde','cuelga'],
    respuesta: `🐌 **La caja o sistema está muy lento:**

**Solución rápida:**
1. Cierra todos los programas que no estés usando
2. Cierra pestañas del navegador si tienes varias abiertas
3. No reproduzcas videos o música mientras trabajas
4. Reinicia el equipo si lleva muchas horas encendido

**Si sigue lento después de reiniciar:**
1. Verifica que no haya actualizaciones de Windows corriendo en segundo plano (puede tardar y ocupa recursos)
2. Verifica que el equipo no esté muy caliente — asegúrate que tenga ventilación

**Si siempre ha sido lento:**
- El equipo puede necesitar mantenimiento interno (limpieza, más memoria RAM)
- Crea un reporte con categoría **Mantenimiento** para que Sistemas evalúe

💡 *Un equipo lento afecta la atención al cliente — repórtalo aunque no sea urgente.*`
  },
  {
    palabras: ['correo','email','no llega','no recibo','no me llega','bandeja','gmail','outlook','no entra','correo corporativo'],
    respuesta: `📧 **No me llega el correo / no puedo acceder:**

**Si no recibes correos:**
1. Revisa la carpeta de **Spam o Correo no deseado**
2. Verifica que el internet esté funcionando
3. Espera 10 minutos — a veces hay demora en la entrega
4. Revisa si el correo del remitente está en tu lista de bloqueados

**Si no puedes entrar al correo:**
1. Verifica que estés escribiendo bien el correo y la contraseña
2. Borra el caché del navegador: Ctrl + Shift + Delete → Borrar datos
3. Intenta en modo incógnito (Ctrl + Shift + N)
4. Si olvidaste la contraseña, clic en "Olvidé mi contraseña"

**Si es correo corporativo (@panpaya.com):**
- Crea un reporte a Sistemas indicando tu usuario y el error exacto

⚠️ Si es urgente por una notificación importante, comunícate directamente con la persona.`
  },
  {
    palabras: ['impresora','imprimir','no imprime','papel','atascada','taco','ticket','recibo'],
    respuesta: `🖨️ **La impresora no imprime:**

**Pasos básicos:**
1. Verifica que el cable USB esté bien conectado al computador y a la impresora
2. Revisa que haya papel cargado correctamente y en la posición correcta
3. Apaga la impresora, espera 15 segundos y enciéndela de nuevo
4. En el PC: Panel de Control → Dispositivos e impresoras → clic derecho en tu impresora → **Ver trabajos de impresión** → cancela todos los trabajos

**Si el papel está atascado:**
1. Apaga la impresora completamente
2. Abre la tapa con cuidado
3. Saca el papel jalando hacia afuera (nunca hacia adentro)
4. Carga papel nuevo, cierra la tapa y enciende

**Si imprime caracteres extraños:**
- El driver puede estar dañado — crea un reporte para que Sistemas lo reinstale

⚠️ Si no se soluciona, crea un reporte con categoría **Hardware**.`
  },
  {
    palabras: ['internet','wifi','red','conexion','no conecta','no hay internet','caido','sin internet','navegador'],
    respuesta: `🌐 **Sin internet — pasos a seguir:**

1. Revisa si otros equipos en la sucursal también tienen el problema
2. Mira el router — ¿las luces están normales? La luz de internet debe estar verde o azul fija
3. **Reinicia el router:** apágalo, espera 1 minuto, enciéndelo — espera 2 minutos
4. Si es por cable: desconecta y vuelve a conectar el cable de red

**Si solo tu equipo no conecta:**
1. Apaga y enciende el equipo
2. En Windows: clic derecho en el ícono de red → Solucionar problemas

**Si todo el local sin internet:**
- Llama al proveedor (ETB, Claro, Movistar) para reportar la falla
- Mientras tanto, si tienes datos en el celular puedes crear un hotspot de emergencia

⚠️ Si el internet afecta las ventas, crea un reporte urgente 🔴.`
  },
  {
    palabras: ['pantalla','monitor','negro','apagada','no se ve','sin imagen','parpadea','brillo'],
    respuesta: `🖥️ **Pantalla sin imagen o en negro:**

1. Verifica que el cable de video (HDMI o VGA) esté bien conectado al monitor y al CPU — desconéctalo y vuélvelo a conectar
2. Revisa que el monitor esté encendido — busca el botón en la parte inferior o lateral
3. Sube el brillo del monitor con los botones físicos del monitor
4. Apaga el equipo completamente y enciéndelo de nuevo
5. Si tienes otro cable disponible, prueba cambiándolo

💡 *Si el monitor tiene luz de encendido pero pantalla negra, el problema suele ser el cable de video.*

⚠️ Si no se soluciona, reporta a Sistemas con categoría **Hardware**.`
  },
  {
    palabras: ['contraseña','password','clave','no recuerdo','olvidé','olvide','acceso','bloqueado','no puedo entrar','no me deja entrar'],
    respuesta: `🔐 **Olvidé la contraseña — pasos:**

**Para SisteMail (esta app):**
1. Ve a la pantalla de login
2. Clic en **"¿No tienes cuenta? Regístrate"** — si ya tienes cuenta, Sistemas debe restablecerla
3. Crea un reporte indicando tu usuario para que Sistemas te ayude

**Para el sistema de ventas POS:**
1. En la pantalla de login, busca "Olvidé mi contraseña"
2. Ingresa tu correo corporativo
3. Revisa tu correo — llegará un enlace (caduca en 1 hora)

**Para Windows (equipo bloqueado):**
- Llama a Sistemas directamente — ellos deben desbloquear el equipo

⚠️ Por seguridad, nunca compartas tu contraseña con nadie, ni con el equipo de Sistemas.`
  },
  {
    palabras: ['mouse','ratón','teclado','no funciona','no responde','desconectado','usb'],
    respuesta: `🖱️ **Mouse o teclado no funciona:**

1. Desconecta el dispositivo del puerto USB
2. Conéctalo en otro puerto USB — prueba los de la parte de atrás del CPU
3. Espera 15 segundos — Windows lo detectará automáticamente
4. Si es inalámbrico: cambia las pilas o carga la batería

**Si ningún USB funciona:**
- Reinicia el equipo completamente
- Si sigue sin funcionar, hay un problema con los puertos USB del equipo — crea un reporte

💡 *Si tienes otro mouse disponible, pruébalo para saber si el problema es el dispositivo o el equipo.*`
  },
  {
    palabras: ['mejorar','redactar','redacción','correg','ortograf','escrib','reporte','texto','formal','ayuda redactar'],
    respuesta: `✨ **Mejora de redacción:**

Escribe tu texto tal como está y lo convierto en un reporte profesional.

**Ejemplos:**

*"el sistema no sirve"* → *"Se presenta falla en el sistema de ventas, impidiendo las operaciones normales. Se solicita soporte técnico urgente."*

*"no hay internet desde ayer"* → *"Se reporta falla en el servicio de internet desde el día de ayer, afectando las operaciones de la sucursal. Se solicita revisión urgente."*

*"la impresora no imprime"* → *"La impresora de la sucursal presenta falla al imprimir, imposibilitando la generación de comprobantes. Se requiere soporte técnico."*

---
📝 **Escribe tu problema y te ayudo a redactarlo:**`
  },
  {
    palabras: ['hola','buenas','buenos dias','buenas tardes','buenas noches','hey','buen dia'],
    respuesta: `👋 ¡Hola! Soy el asistente de soporte técnico de SisteMail para Pan Pa' Ya.

Puedo ayudarte con:
- 🔄 **Sistema POS** no abre o está lento
- 🧾 **Facturación** no funciona
- 📦 **Inventario** no carga
- 🖨️ **Impresora** no imprime
- 🌐 **Internet** caído
- 📧 **Correo** no llega
- 🔐 **Contraseña** olvidada
- 💥 **Programa** se cerró solo
- 🛒 **Pedido** no aparece
- ✨ **Mejorar** la redacción de tu reporte

¿Cuál es tu problema hoy?`
  },
  {
    palabras: ['gracias','muchas gracias','listo','solucionado','funciona','ya funciona','ok gracias','perfecto'],
    respuesta: `✅ ¡Me alegra que se haya solucionado!

Recuerda que si el problema vuelve a ocurrir puedes crear un reporte en **Nuevo reporte** para que Sistemas lo registre y haga seguimiento formal.

¡Que tengas un excelente día en la sucursal! 🍞`
  },
  {
    palabras: ['mantenimiento','limpieza','preventivo','polvo','ventilador','ruido','caliente','temperatura'],
    respuesta: `🔧 **Mantenimiento básico que puedes hacer tú:**

✅ **Lo que SÍ puedes hacer:**
- Limpiar el monitor y teclado con paño seco
- Usar aire comprimido para limpiar entre las teclas
- Asegurarte que el CPU tenga espacio para ventilar (mínimo 10cm)
- Organizar los cables para que no bloqueen la ventilación

❌ **Lo que SOLO hace Sistemas:**
- Abrir el CPU para limpieza interna
- Cambiar piezas de hardware
- Instalar o desinstalar programas

**Señales de que necesita mantenimiento urgente:**
- Hace ruido extraño (ventilador muy ruidoso)
- Se calienta mucho y se apaga solo
- Lleva más de 6 meses sin mantenimiento

⚠️ Crea un reporte con categoría **Mantenimiento** y Sistemas programará la visita.`
  }
];

// Respuesta por defecto si no coincide nada
const RESPUESTA_DEFAULT = `🤔 No encontré una solución específica para eso.

Te recomiendo:
1. **Crea un reporte** en "Nuevo reporte" describiendo el problema con detalle
2. Selecciona la urgencia correcta (🔴 si afecta las ventas)
3. Adjunta una foto si puedes

El equipo de Sistemas responderá pronto.

💡 *También puedes preguntarme sobre:*
- Problemas con POS o caja
- Fallas de impresora
- Internet sin conexión
- Equipos lentos o apagados
- Mejorar la redacción de tu reporte`;

function buscarRespuesta(texto) {
  const textoLower = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Buscar coincidencias
  let mejorCoincidencia = null;
  let maxCoincidencias = 0;

  for (const item of BASE_CONOCIMIENTO) {
    let coincidencias = 0;
    for (const palabra of item.palabras) {
      if (textoLower.includes(palabra)) coincidencias++;
    }
    if (coincidencias > maxCoincidencias) {
      maxCoincidencias = coincidencias;
      mejorCoincidencia = item;
    }
  }

  // Necesita al menos 1 coincidencia
  if (maxCoincidencias >= 1 && mejorCoincidencia) {
    return mejorCoincidencia.respuesta;
  }

  // Caso especial: si pregunta por mejorar un texto específico
  if (textoLower.includes(':') && (textoLower.includes('mejorar') || textoLower.includes('mejora') || textoLower.includes('redact'))) {
    const partes = texto.split(':');
    if (partes.length > 1) {
      const textoOriginal = partes.slice(1).join(':').trim();
      if (textoOriginal.length > 10) {
        return mejorarTexto(textoOriginal);
      }
    }
  }

  return RESPUESTA_DEFAULT;
}

function mejorarTexto(texto) {
  // Mejora básica del texto
  let mejorado = texto.trim();
  // Capitalizar primera letra
  mejorado = mejorado.charAt(0).toUpperCase() + mejorado.slice(1);
  // Agregar punto final si no tiene
  if (!mejorado.endsWith('.') && !mejorado.endsWith('?') && !mejorado.endsWith('!')) mejorado += '.';

  return `✨ **Texto mejorado:**

*"${mejorado}"*

---
📝 **Versión formal para reporte:**

*"Se presenta la siguiente novedad en la sucursal: ${mejorado} Se solicita al equipo de Sistemas revisión y solución del caso a la brevedad posible."*`;
}

function formatearRespuesta(texto) {
  return texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// ══════════════════════════════════════
// MODAL IA
// ══════════════════════════════════════
window.abrirIA = function() {
  const modal = document.getElementById('ia-modal');
  if (modal) modal.style.display = 'flex';
};
window.cerrarIA = function() {
  const modal = document.getElementById('ia-modal');
  if (modal) modal.style.display = 'none';
};

window.enviarMensajeIA = function() {
  const inp = document.getElementById('ia-input');
  if (!inp) return;
  const texto = inp.value.trim();
  if (!texto) return;
  inp.value = '';

  const cont = document.getElementById('ia-mensajes');
  const bienvenida = document.getElementById('ia-bienvenida');
  if (bienvenida) bienvenida.style.display = 'none';

  // Burbuja usuario
  const bUser = document.createElement('div');
  bUser.className = 'ia-burbuja-user';
  bUser.textContent = texto;
  cont.appendChild(bUser);

  // Simular que está "pensando" (500ms)
  const bLoad = document.createElement('div');
  bLoad.className = 'ia-burbuja-load';
  bLoad.innerHTML = '<span>✨ Buscando solución...</span>';
  cont.appendChild(bLoad);
  cont.scrollTop = cont.scrollHeight;

  setTimeout(() => {
    bLoad.remove();

    const respuesta = buscarRespuesta(texto);
    const bIA = document.createElement('div');
    bIA.className = 'ia-burbuja-ia';
    bIA.innerHTML = formatearRespuesta(respuesta);
    cont.appendChild(bIA);

    // Si la respuesta tiene texto mejorado, agregar botón "Usar en mi reporte"
    const esMejora = texto.toLowerCase().includes('mejor') || texto.toLowerCase().includes('redact') || texto.toLowerCase().includes('correg') || texto.toLowerCase().includes('formal');
    if (esMejora) {
      const btnUsar = document.createElement('button');
      btnUsar.style.cssText = 'align-self:flex-start;background:var(--bread);color:#fff;border:none;border-radius:100px;padding:5px 14px;font-size:11px;cursor:pointer;margin-top:4px;font-family:"Outfit",sans-serif;font-weight:600';
      btnUsar.textContent = '📋 Usar en mi reporte';
      btnUsar.onclick = () => {
        const cuerpo = document.getElementById('reporte-cuerpo');
        // Extraer solo el texto mejorado (sin markdown)
        const textoLimpio = respuesta.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/✨.*?\n/,'').trim();
        if (cuerpo) { cuerpo.innerText = textoLimpio; window.cerrarIA(); window.sv('compose'); window.mostrarToast && window.mostrarToast('✅ Texto aplicado al reporte'); }
        else { navigator.clipboard.writeText(textoLimpio).catch(()=>{}); window.mostrarToast && window.mostrarToast('✅ Copiado al portapapeles'); }
      };
      cont.appendChild(btnUsar);
    }

    cont.scrollTop = cont.scrollHeight;
  }, 600);
};

document.addEventListener('DOMContentLoaded', () => {
  // Sugerencias rápidas
  const sugerencias = {
    'sug-pos': '¿Cómo reinicio el sistema POS?',
    'sug-imp': '¿Qué hago si la impresora no imprime?',
    'sug-net': '¿Qué hago si no hay internet?',
    'sug-red': 'Ayúdame a mejorar la redacción de mi reporte'
  };
  Object.entries(sugerencias).forEach(([id, texto]) => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = () => { document.getElementById('ia-input').value = texto; window.enviarMensajeIA(); };
  });

  const iaInput = document.getElementById('ia-input');
  if (iaInput) iaInput.addEventListener('keydown', e => { if (e.key === 'Enter') window.enviarMensajeIA(); });
  const iaSend = document.getElementById('ia-send');
  if (iaSend) iaSend.onclick = window.enviarMensajeIA;
  const iaModal = document.getElementById('ia-modal');
  if (iaModal) iaModal.addEventListener('click', e => { if (e.target === iaModal) window.cerrarIA(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.cerrarIA?.(); });
});