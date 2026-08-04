// ============================================================================
// popup.js — UI de configuración de NEXO · Autologin Sancor Salud
//
// Permite guardar usuario/contraseña de la cuenta de broker compartida en
// chrome.storage.local (NUNCA hardcodeado en el código de la extensión).
// El mail de rastreo NO se configura acá: queda fijo en config.js porque es
// una regla de negocio, no una credencial.
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const inputUsuario = document.getElementById('usuario')
  const inputPassword = document.getElementById('password')
  const botonGuardar = document.getElementById('guardar')
  const botonToggle = document.getElementById('toggle-password')
  const estado = document.getElementById('estado')

  // Precargar valores ya guardados
  chrome.storage.local.get(['sancorUsuario', 'sancorPassword'], (resultado) => {
    inputUsuario.value = resultado.sancorUsuario || ''
    inputPassword.value = resultado.sancorPassword || ''
  })

  botonToggle.addEventListener('click', () => {
    const esPassword = inputPassword.type === 'password'
    inputPassword.type = esPassword ? 'text' : 'password'
    botonToggle.textContent = esPassword ? 'Ocultar' : 'Ver'
  })

  botonGuardar.addEventListener('click', () => {
    const usuario = inputUsuario.value.trim()
    const password = inputPassword.value

    if (!usuario || !password) {
      mostrarEstado('Completá usuario y contraseña.', 'error')
      return
    }

    chrome.storage.local.set({ sancorUsuario: usuario, sancorPassword: password }, () => {
      mostrarEstado('Credenciales guardadas ✓', 'ok')
    })
  })

  function mostrarEstado(mensaje, tipo) {
    estado.textContent = mensaje
    estado.className = 'estado ' + tipo
    setTimeout(() => {
      estado.textContent = ''
      estado.className = 'estado'
    }, 3000)
  }
})
