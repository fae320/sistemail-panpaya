// ════════════════════════════════════════════
//  js/firebase-config.js
//  PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE
// ════════════════════════════════════════════
//
// CÓMO OBTENERLA:
// 1. Ve a https://console.firebase.google.com
// 2. Abre tu proyecto
// 3. Haz clic en el ícono ⚙️ (Configuración del proyecto)
// 4. En "Tus apps" → selecciona tu app web
// 5. Copia el objeto firebaseConfig y reemplaza los valores de abajo
//
// ════════════════════════════════════════════

export const firebaseConfig = {
  apiKey:            "TU_API_KEY_AQUI",
  authDomain:        "TU_PROYECTO.firebaseapp.com",
  projectId:         "TU_PROYECTO",
  storageBucket:     "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID"
};

// ════════════════════════════════════════════
//  IMPORTANTE: Después de pegar tus datos
//  también tienes que reemplazar el objeto
//  firebaseConfig que está dentro de index.html,
//  usuario.html y admin.html con los mismos datos.
// ════════════════════════════════════════════