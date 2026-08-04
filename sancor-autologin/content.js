// ============================================================================
// content.js — NEXO · Autologin Sancor Salud
//
// Lógica principal de la extensión. Se inyecta en abacomui.sancorsalud.com.ar
// y automatiza la navegación hasta dejar abierta la ventana del simulador de
// cotización, para que el asesor la complete a mano desde ahí:
//   1. Router por hash: detecta en qué pantalla de la SPA estamos y dispara
//      el paso correspondiente (login → selección de producto → menú salud).
//   2. Evita loops: cada paso se marca en sessionStorage antes de ejecutarse,
//      así que si algo falla no reintentamos en bucle dentro de la misma
//      pestaña/sesión.
//
// Todos los logs usan el prefijo [NEXO-SANCOR] para poder filtrarlos fácil
// en la consola del navegador.
// ============================================================================

const PREFIJO_LOG = '[NEXO-SANCOR]'
const PREFIJO_PASO = 'nexoSancorPaso_'

// ----------------------------------------------------------------------------
// Helpers de logging
// ----------------------------------------------------------------------------
function log(...args) {
  console.log(PREFIJO_LOG, ...args)
}
function logError(...args) {
  console.warn(PREFIJO_LOG, ...args)
}

// ----------------------------------------------------------------------------
// Anti-loop: marcar/consultar pasos ya ejecutados en esta sesión de pestaña.
// Se marca el paso como "ejecutado" ANTES de intentarlo, así si algo rompe a
// mitad de camino no quedamos reintentando login (o cualquier otro paso) en
// bucle cada vez que cambia el hash.
// ----------------------------------------------------------------------------
function pasoYaEjecutado(nombre) {
  return sessionStorage.getItem(PREFIJO_PASO + nombre) === '1'
}
function marcarPasoEjecutado(nombre) {
  sessionStorage.setItem(PREFIJO_PASO + nombre, '1')
}

// ----------------------------------------------------------------------------
// buscarElemento(estrategias) — recorre una lista de estrategias (definidas
// en config.js) y devuelve el primer elemento que matchee, o null.
// ----------------------------------------------------------------------------
function buscarElemento(estrategias) {
  for (const estrategia of estrategias) {
    let elemento = null
    try {
      switch (estrategia.tipo) {
        case 'id':
          elemento = document.getElementById(estrategia.valor)
          break
        case 'name':
          elemento = document.querySelector(`[name="${estrategia.valor}"]`)
          break
        case 'css':
          elemento = document.querySelector(estrategia.valor)
          break
        case 'texto':
          elemento = buscarPorTexto(estrategia.valor, estrategia.tags || ['button'])
          break
        default:
          logError('Estrategia de selector desconocida:', estrategia)
      }
    } catch (err) {
      // Un selector CSS inválido no debería romper el resto de las estrategias
      logError('Error evaluando estrategia', estrategia, err)
    }
    if (elemento) return elemento
  }
  return null
}

// Busca un elemento cuyo texto visible contenga `texto` (sin distinguir
// mayúsculas/acentos básicos), dentro de los tags indicados.
function buscarPorTexto(texto, tags) {
  const textoBuscado = texto.toLowerCase()
  for (const tag of tags) {
    const candidatos = document.querySelectorAll(tag)
    for (const candidato of candidatos) {
      const contenido = (candidato.textContent || '').trim().toLowerCase()
      if (contenido && contenido.includes(textoBuscado)) return candidato
    }
  }
  return null
}

// ----------------------------------------------------------------------------
// waitForElement(estrategias, timeout) — espera a que aparezca un elemento
// usando MutationObserver (para reaccionar rápido a los renders de Angular)
// + polling de respaldo (por si la mutación no es detectable a tiempo) y
// rechaza la promesa si se cumple el timeout.
// ----------------------------------------------------------------------------
function waitForElement(estrategias, timeout = CONFIG.TIMEOUT_DEFAULT) {
  return new Promise((resolve, reject) => {
    const existente = buscarElemento(estrategias)
    if (existente) return resolve(existente)

    let resuelto = false
    const finalizar = (fn, valor) => {
      if (resuelto) return
      resuelto = true
      observer.disconnect()
      clearInterval(intervalo)
      clearTimeout(temporizador)
      fn(valor)
    }

    const observer = new MutationObserver(() => {
      const elemento = buscarElemento(estrategias)
      if (elemento) finalizar(resolve, elemento)
    })
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })

    // Polling de respaldo — Angular a veces actualiza el DOM de formas que el
    // observer tarda en notificar (ej. dentro de zonas fuera de change detection).
    const intervalo = setInterval(() => {
      const elemento = buscarElemento(estrategias)
      if (elemento) finalizar(resolve, elemento)
    }, 300)

    const temporizador = setTimeout(() => {
      finalizar(reject, new Error(`Timeout (${timeout}ms) esperando elemento: ${JSON.stringify(estrategias)}`))
    }, timeout)
  })
}

// ----------------------------------------------------------------------------
// setValorInput(elemento, valor) — setea el .value de un input/select y
// dispara los eventos 'input' y 'change' nativos. Angular escucha estos
// eventos nativos para actualizar sus formularios reactivos / ngModel; con
// solo asignar .value no alcanza porque Angular no se entera del cambio.
// ----------------------------------------------------------------------------
function setValorInput(elemento, valor) {
  const prototipo = elemento.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototipo, 'value')
  if (descriptor && descriptor.set) {
    descriptor.set.call(elemento, valor)
  } else {
    elemento.value = valor
  }
  elemento.dispatchEvent(new Event('input', { bubbles: true }))
  elemento.dispatchEvent(new Event('change', { bubbles: true }))
}

// Click "real": .click() alcanza para la mayoría de los botones Angular,
// que escuchan (click) estándar.
function clickElemento(elemento) {
  elemento.click()
}

// ----------------------------------------------------------------------------
// Credenciales — SIEMPRE desde chrome.storage, nunca hardcodeadas.
// Se configuran desde popup.html / popup.js.
// ----------------------------------------------------------------------------
function obtenerCredenciales() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['sancorUsuario', 'sancorPassword'], (resultado) => {
      resolve({
        usuario: resultado.sancorUsuario || '',
        password: resultado.sancorPassword || '',
      })
    })
  })
}

// STUB — no implementado todavía. Pensado para reemplazar a obtenerCredenciales()
// si NEXO decide centralizar la cuenta de broker compartida en el backend del
// CRM (Server Action / API route) en lugar de guardarla en chrome.storage de
// cada extensión instalada. Cuando se implemente, debería devolver el mismo
// shape que obtenerCredenciales(): { usuario, password }.
async function getCredencialesDesdeCRM() {
  // TODO: implementar cuando el CRM expuesta un endpoint para esto, por ejemplo:
  // const respuesta = await fetch('https://<dominio-crm>/api/sancor/credenciales', { credentials: 'include' })
  // if (!respuesta.ok) throw new Error('No se pudieron obtener las credenciales desde el CRM')
  // return respuesta.json()
  throw new Error('getCredencialesDesdeCRM() no implementado todavía — usar obtenerCredenciales()')
}

// ----------------------------------------------------------------------------
// Paso 1: Login (#/login)
// ----------------------------------------------------------------------------
async function ejecutarLogin() {
  log('Ejecutando paso: login')
  const { usuario, password } = await obtenerCredenciales()

  if (!usuario || !password) {
    logError('No hay credenciales configuradas. Abrí el popup de la extensión y guardalas antes de continuar.')
    return
  }

  try {
    const inputUsuario = await waitForElement(CONFIG.LOGIN.usuario)
    setValorInput(inputUsuario, usuario)

    const inputPassword = await waitForElement(CONFIG.LOGIN.password)
    setValorInput(inputPassword, password)

    const botonSubmit = await waitForElement(CONFIG.LOGIN.submit)
    clickElemento(botonSubmit)

    log('Login enviado correctamente')
  } catch (err) {
    logError('Falló el paso de login:', err.message)
  }
}

// ----------------------------------------------------------------------------
// Paso 2: Selección de producto (#/seleccionProducto) → click en "SALUD"
// ----------------------------------------------------------------------------
async function ejecutarSeleccionProducto() {
  log('Ejecutando paso: selección de producto')
  try {
    const boton = await waitForElement(CONFIG.SELECCION_PRODUCTO.botonSalud)
    clickElemento(boton)
    log('Click en "SALUD" realizado')
  } catch (err) {
    logError('Falló el paso de selección de producto:', err.message)
  }
}

// ----------------------------------------------------------------------------
// Paso 3: Menú de salud (#/seleccionProducto/salud) → click en "Simulador de cotización"
// ----------------------------------------------------------------------------
async function ejecutarMenuSalud() {
  log('Ejecutando paso: menú salud')
  try {
    const item = await waitForElement(CONFIG.MENU_SALUD.itemSimulador)
    clickElemento(item)
    log('Click en "Simulador de cotización" realizado')
  } catch (err) {
    logError('Falló el paso de menú salud:', err.message)
  }
}

// ----------------------------------------------------------------------------
// Router por hash
// ----------------------------------------------------------------------------
function manejarRuta() {
  const hash = location.hash || ''
  log('Hash detectado:', hash || '(vacío)')

  // Paso 1: login
  if (hash.startsWith('#/login')) {
    if (!pasoYaEjecutado('login')) {
      marcarPasoEjecutado('login')
      ejecutarLogin()
    }
    return
  }

  // Paso 2: selección de producto (sin /salud todavía)
  if (hash === '#/seleccionProducto' || hash.startsWith('#/seleccionProducto?')) {
    if (!pasoYaEjecutado('seleccionProducto')) {
      marcarPasoEjecutado('seleccionProducto')
      ejecutarSeleccionProducto()
    }
    return
  }

  // Paso 3: menú de salud → dispara el click en "Simulador de cotización".
  // A partir de ahí el asesor completa el formulario a mano; la extensión
  // no interviene más.
  if (hash.startsWith('#/seleccionProducto/salud')) {
    if (!pasoYaEjecutado('menuSalud')) {
      marcarPasoEjecutado('menuSalud')
      ejecutarMenuSalud()
    }
    return
  }
}

// ----------------------------------------------------------------------------
// Inicialización
// ----------------------------------------------------------------------------
;(function init() {
  log('Content script cargado en', location.href)
  manejarRuta()
  window.addEventListener('hashchange', manejarRuta)
})()
