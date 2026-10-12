// Consistent, user-friendly error messages in Spanish
export const ERROR_MESSAGES = {
  // Network & Connection Errors
  NETWORK_ERROR: 'No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta nuevamente.',
  CONNECTION_TIMEOUT: 'La conexión tardó demasiado tiempo. Por favor intenta nuevamente.',
  SERVER_ERROR: 'Ocurrió un error en el servidor. Por favor intenta más tarde.',
  
  // Authentication Errors
  INVALID_CREDENTIALS: 'Correo o PIN incorrecto. Por favor verifica tus datos e intenta nuevamente.',
  NOT_FOUND: 'Usuario no encontrado. Por favor verifica tu correo electrónico.',
  UNAUTHORIZED: 'No tienes permisos para acceder a esta función.',
  SESSION_EXPIRED: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
  
  // File Upload Errors
  NO_FILE: 'No se seleccionó ningún archivo. Por favor intenta de nuevo.',
  FILE_TOO_LARGE: 'El archivo es demasiado grande. El tamaño máximo permitido es 10MB.',
  INVALID_FILE_TYPE: 'Tipo de archivo no permitido. Por favor selecciona una imagen válida (JPG, PNG, etc.).',
  UPLOAD_FAILED: 'Error al subir el archivo. Por favor intenta nuevamente.',
  
  // Form Validation Errors
  REQUIRED_FIELD: 'Este campo es obligatorio.',
  INVALID_EMAIL: 'El correo electrónico no es válido.',
  INVALID_PIN: 'El PIN debe tener 4 dígitos numéricos.',
  INVALID_PHONE: 'El número de teléfono no es válido.',
  
  // Database Errors
  DUPLICATE_ENTRY: 'Este registro ya existe. Por favor verifica los datos.',
  RECORD_NOT_FOUND: 'El registro no fue encontrado.',
  SAVE_FAILED: 'Error al guardar el registro. Por favor verifica los datos e intenta nuevamente.',
  DELETE_FAILED: 'Error al eliminar el registro. Por favor intenta nuevamente.',
  
  // Camera Errors
  CAMERA_NOT_AVAILABLE: 'La cámara no está disponible. Por favor verifica los permisos de la cámara.',
  CAMERA_PERMISSION_DENIED: 'Debes permitir el acceso a la cámara para tomar fotos.',
  CAMERA_NOT_FOUND: 'No se encontró ninguna cámara. Usa el botón "Subir Foto" para seleccionar una imagen.',
  CAMERA_BUSY: 'La cámara está ocupada. Intenta cerrar otras aplicaciones que usen la cámara e intenta nuevamente.',
  CAMERA_NOT_READY: 'La cámara aún no está lista. Por favor espera un momento e intenta de nuevo.',
  
  // Email Errors
  EMAIL_SEND_FAILED: 'No se pudo enviar el correo electrónico. Por favor intenta nuevamente.',
  EMAIL_SERVICE_DOWN: 'El servicio de correo electrónico no está disponible en este momento. Por favor intenta más tarde.',
  SMTP_CONFIG_ERROR: 'El servidor de correo no está configurado correctamente. Por favor contacta al administrador.',
  
  // WhatsApp Errors
  WHATSAPP_SEND_FAILED: 'Error al enviar el mensaje por WhatsApp.',
  WHATSAPP_NOT_CONFIGURED: 'WhatsApp no está configurado. Por favor contacta al administrador.',
  INVALID_PHONE_NUMBER: 'El número de teléfono no es válido.',
  
  // Printer Errors
  NO_PRINTER: 'No hay impresoras configuradas. Por favor configura una impresora en Configuración.',
  PRINT_FAILED: 'Error al enviar a la impresora. Por favor verifica que esté disponible.',
  
  // Lot Errors
  LOT_NOT_FOUND: 'El lote no fue encontrado.',
  DUPLICATE_LOT_NUMBER: 'El número de lote ya existe. Por favor genera uno nuevo.',
  
  // Generic Error Handler
  GENERIC_ERROR: 'Ocurrió un error inesperado. Por favor intenta nuevamente.',
};

/**
 * Get a user-friendly error message based on API error or error code
 * @param {string|Error} error - The error object, error message, or error code
 * @returns {string} User-friendly error message in Spanish
 */
export function getUserFriendlyErrorMessage(error) {
  if (!error) return ERROR_MESSAGES.GENERIC_ERROR;
  
  const errorStr = typeof error === 'string' ? error.toLowerCase() : (error.message || '').toLowerCase();
  
  // Check for specific error patterns
  if (errorStr.includes('network') || errorStr.includes('econnrefused') || errorStr.includes('fetch')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  if (errorStr.includes('timeout') || errorStr.includes('econnreset')) {
    return ERROR_MESSAGES.CONNECTION_TIMEOUT;
  }
  
  if (errorStr.includes('authentication') || errorStr.includes('unauthorized')) {
    return ERROR_MESSAGES.UNAUTHORIZED;
  }
  
  if (errorStr.includes('not found') || errorStr.includes('404')) {
    return ERROR_MESSAGES.RECORD_NOT_FOUND;
  }
  
  if (errorStr.includes('duplicate') || errorStr.includes('unique constraint')) {
    return ERROR_MESSAGES.DUPLICATE_ENTRY;
  }
  
  if (errorStr.includes('file') || errorStr.includes('upload')) {
    return ERROR_MESSAGES.UPLOAD_FAILED;
  }
  
  if (errorStr.includes('camera')) {
    return ERROR_MESSAGES.CAMERA_NOT_AVAILABLE;
  }
  
  if (errorStr.includes('permission')) {
    return ERROR_MESSAGES.CAMERA_PERMISSION_DENIED;
  }
  
  if (errorStr.includes('email') || errorStr.includes('mail')) {
    return ERROR_MESSAGES.EMAIL_SEND_FAILED;
  }
  
  if (errorStr.includes('whatsapp')) {
    return ERROR_MESSAGES.WHATSAPP_SEND_FAILED;
  }
  
  if (errorStr.includes('printer') || errorStr.includes('print')) {
    return ERROR_MESSAGES.PRINT_FAILED;
  }
  
  if (errorStr.includes('500') || errorStr.includes('server error')) {
    return ERROR_MESSAGES.SERVER_ERROR;
  }
  
  return ERROR_MESSAGES.GENERIC_ERROR;
}
