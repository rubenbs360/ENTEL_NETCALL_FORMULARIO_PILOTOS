/**
 * NETCALL - REGISTRO DE VENTAS DE PILOTOS
 * 
 * INSTRUCCIONES PARA VINCULAR A GOOGLE SHEETS:
 * 1. Crea una Google Sheet y pon estas cabeceras en la primera fila:
 *    Fecha_Registro | DNI_Asesor | Fecha_Venta | Orden | Piloto | Tipo_Líneas | Tipo_Documento | Documento | Celular | Producto | Comentarios
 * 2. Ve a Extensiones > Apps Script.
 * 3. Borra el código existente y pega el siguiente script:
 * 
 *    function doPost(e) {
 *      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 *      try {
 *        var data = JSON.parse(e.postData.contents);
 *        sheet.appendRow([
 *          new Date(),
 *          data.advisor_id,
 *          data.sale_date,
 *          data.order_id,
 *          data.pilot_type,
 *          data.line_type,
 *          data.doc_type,
 *          data.doc_id,
 *          data.client_phone,
 *          data.product_type || "",
 *          data.comments || ""
 *        ]);
 *        return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
 *                             .setMimeType(ContentService.MimeType.JSON);
 *      } catch(error) {
 *        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
 *                             .setMimeType(ContentService.MimeType.JSON);
 *      }
 *    }
 * 
 * 4. Haz clic en "Implementar" > "Nueva implementación".
 * 5. Selecciona Tipo: "Aplicación web".
 * 6. Configura:
 *    - Ejecutar como: "Tú" (tu cuenta de Google).
 *    - Quién tiene acceso: "Cualquiera" (necesario para envíos anónimos de los asesores).
 * 7. Copia la URL de la aplicación web generada y pégala en la variable GOOGLE_SCRIPT_URL abajo.
 */

// Reemplazar con la URL generada en Google Apps Script
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyYFxVnittViByNqy8LqevvCFuTQLLmZ_6HB8dQRQr8jAcjeFEvN28U3uBZSOGPiMsE/exec"; 

document.addEventListener("DOMContentLoaded", () => {
  initializeDate();
  setupValidationListeners();
  
  // Request native push notification permission if supported
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  
  const form = document.getElementById("pilot-sale-form");
  form.addEventListener("submit", handleSubmit);
});

// Set default date to today
function initializeDate() {
  const dateInput = document.getElementById("sale-date");
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }
}

// Check custom validations on input/change to clear errors immediately
function setupValidationListeners() {
  const fields = ['advisor-id', 'sale-date', 'order-id', 'doc-id', 'client-phone'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => validateField(id));
      el.addEventListener("change", () => validateField(id));
    }
  });
  
  // Custom logic for doc-type changes to validate doc-id lengths
  const docType = document.getElementById("doc-type");
  if (docType) {
    docType.addEventListener("change", () => validateField("doc-id"));
  }
}

// Field validation rules
function validateField(id) {
  const el = document.getElementById(id);
  if (!el) return true;
  
  const val = el.value.trim();
  let isValid = true;
  let errorMsg = "";
  
  const group = el.closest(".form-group");
  
  if (id === 'advisor-id') {
    isValid = val.length > 0;
    errorMsg = "Por favor ingresa tu DNI o Usuario de asesor";
  } 
  else if (id === 'sale-date') {
    isValid = val.length > 0;
    errorMsg = "Ingresa una fecha de venta válida";
  } 
  else if (id === 'order-id') {
    isValid = /^9\d{8}$/.test(val);
    errorMsg = "La orden debe iniciar con 9 y tener exactamente 9 dígitos";
  } 
  else if (id === 'doc-id') {
    const docType = document.getElementById("doc-type")?.value || "DNI";
    const isNumeric = /^\d+$/.test(val);
    
    if (docType === "DNI") {
      isValid = isNumeric && val.length === 8;
      errorMsg = "El DNI debe tener exactamente 8 dígitos";
    } else {
      isValid = isNumeric && val.length === 11;
      errorMsg = `El RUC debe tener exactamente 11 dígitos`;
    }
  } 
  else if (id === 'client-phone') {
    isValid = /^9\d{8}$/.test(val);
    errorMsg = "El celular debe tener 9 dígitos e iniciar con 9";
  }
  
  if (!isValid) {
    group.classList.add("has-error");
    const errEl = group.querySelector(".error-msg");
    if (errEl) errEl.textContent = errorMsg;
  } else {
    group.classList.remove("has-error");
  }
  
  return isValid;
}

// Submit handler
async function handleSubmit(e) {
  e.preventDefault();
  
  // Validate all fields
  const fields = ['advisor-id', 'sale-date', 'order-id', 'doc-id', 'client-phone'];
  let isFormValid = true;
  
  fields.forEach(id => {
    const ok = validateField(id);
    if (!ok) isFormValid = false;
  });
  
  if (!isFormValid) {
    showToast("error", "Campos incompletos o inválidos", "Revisa los campos marcados en rojo antes de enviar.");
    return;
  }
  
  // Collect data
  const data = {
    advisor_id: document.getElementById("advisor-id").value.trim().toUpperCase(),
    sale_date: document.getElementById("sale-date").value,
    order_id: document.getElementById("order-id").value.trim(),
    pilot_type: document.querySelector('input[name="pilot-type"]:checked').value,
    line_type: document.querySelector('input[name="line-type"]:checked').value,
    doc_type: document.getElementById("doc-type").value,
    doc_id: document.getElementById("doc-id").value.trim(),
    client_phone: document.getElementById("client-phone").value.trim(),
    product_type: document.getElementById("product-type").value,
    comments: document.getElementById("comments").value.trim()
  };
  
  // Loading UI state
  const submitBtn = document.getElementById("submit-btn");
  const btnText = submitBtn.querySelector(".btn-text");
  const loader = submitBtn.querySelector(".loader");
  
  submitBtn.disabled = true;
  btnText.textContent = "Registrando...";
  loader.classList.remove("hidden");
  
  try {
    if (!GOOGLE_SCRIPT_URL) {
      // Simulate local demo success when URL is not set
      await new Promise(resolve => setTimeout(resolve, 1000));
      showToast("success", "¡Formulario Listo!", "Los datos son válidos. Conecta la URL de Google Sheets en app.js para realizar registros reales.");
      playSuccessSound();
      showPushNotification("¡Formulario Listo!", `Orden ${data.order_id} procesada.`);
      resetForm();
    } else {
      // Real submission with AbortController timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds timeout (Google Sheets writing can sometimes take 10-15s)
      
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors", // Required to bypass Google Apps Script CORS redirection limits
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          signal: controller.signal,
          body: JSON.stringify(data)
        });
        
        clearTimeout(timeoutId);
        showToast("success", "¡Venta Registrada!", "La información se guardó correctamente en Google Sheets.");
        playSuccessSound();
        showPushNotification("¡Venta Registrada!", `Orden ${data.order_id} de ${data.pilot_type} guardada con éxito.`);
        resetForm();
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          showToast("error", "Tiempo de Espera Agotado", "El servidor de Google tardó más de lo esperado. Revisa si tu venta ya se guardó en el Excel antes de volver a intentar.");
        } else {
          throw err; // Pass down to the outer catch for real network drops
        }
      }
    }
  } catch (error) {
    console.error("Submission error:", error);
    showToast("error", "Error de Red", "No se pudo conectar con el servidor. Revisa tu conexión a internet.");
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = "Registrar Venta";
    loader.classList.add("hidden");
  }
}

// Reset form values preserving advisor & date
function resetForm() {
  document.getElementById("order-id").value = "";
  document.getElementById("doc-id").value = "";
  document.getElementById("client-phone").value = "";
  document.getElementById("product-type").selectedIndex = 0;
  document.getElementById("comments").value = "";
  
  // Clear error classes
  document.querySelectorAll(".form-group").forEach(el => el.classList.remove("has-error"));
}

// Display modern visual Toast alert
let toastTimeout = null;
function showToast(type, title, desc) {
  const toast = document.getElementById("feedback-toast");
  if (!toast) return;
  
  clearTimeout(toastTimeout);
  
  // Configure types
  toast.classList.remove("hidden", "error");
  const iconEl = toast.querySelector(".toast-icon");
  
  if (type === "error") {
    toast.classList.add("error");
    iconEl.textContent = "❌";
  } else {
    iconEl.textContent = "✅";
  }
  
  toast.querySelector(".toast-title").textContent = title;
  toast.querySelector(".toast-desc").textContent = desc;
  
  // Hide toast after 4 seconds
  toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}

// Synthesize a premium double-tone success sound using Web Audio API (no files needed)
function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    // Tone 1 (G5)
    osc.frequency.setValueAtTime(783.99, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    
    // Tone 2 (C6)
    osc.frequency.setValueAtTime(1046.50, now + 0.12);
    gain.gain.setValueAtTime(0.08, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.error("Audio Context is not enabled by user action:", e);
  }
}

// Display native OS push notification
function showPushNotification(title, body) {
  if (!("Notification" in window)) return;
  
  if (Notification.permission === "granted") {
    new Notification(title, { 
      body: body,
      icon: "https://gerencia.proyectrubs.com/favicon.png"
    });
  }
}
