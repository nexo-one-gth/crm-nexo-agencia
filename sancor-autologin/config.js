// ============================================================================
// config.js — Configuración centralizada de NEXO · Autologin Sancor Salud
//
// Acá viven TODOS los selectores y constantes que usa content.js. La idea es
// que cuando Sancor cambie un id de clase en su SPA, el ajuste se haga en UN
// solo lugar, sin tocar la lógica de content.js.
//
// Los selectores de LOGIN, SELECCION_PRODUCTO y MENU_SALUD ya están
// confirmados contra el HTML real del portal (2026-06-19). Cada campo es un
// ARRAY de "estrategias" ordenadas de la más específica a la más genérica —
// content.js las prueba en orden hasta encontrar un elemento. El flujo
// automatizado termina al hacer click en "Simulador de cotización"; de ahí
// en adelante el asesor completa el formulario a mano.
//
// Tipos de estrategia soportados (ver buscarElemento en content.js):
//   { tipo: 'id',     valor: 'idDelElemento' }
//   { tipo: 'name',   valor: 'nombreDelCampo' }          → [name="..."]
//   { tipo: 'css',    valor: 'cualquier selector CSS' }
//   { tipo: 'texto',  valor: 'texto a buscar', tags: [...] } → busca por
//       contenido de texto (sin distinguir mayúsculas) dentro de los tags
//       indicados (por defecto ['button'])
// ============================================================================

const CONFIG = {
  URLS: {
    BASE: 'https://abacomui.sancorsalud.com.ar',
    LOGIN: 'https://abacomui.sancorsalud.com.ar/#/login?returnUrl=%2FseleccionProducto%2Fsalud',
    // Confirmado navegando el flujo real (2026-06-19): el simulador vive en
    // este hash una vez que se hace click en el ítem de menú "Simulador de cotización".
    SIMULADOR_APROX: 'https://abacomui.sancorsalud.com.ar/#/seleccionProducto/simularCotizacion',
  },

  // Tiempo máximo (ms) que esperamos a que aparezca cada elemento en el DOM.
  TIMEOUT_DEFAULT: 8000,

  // ── Pantalla de login (#/login) ───────────────────────────────────────────
  // Confirmado contra el HTML real (2026-06-19): el campo de usuario usa
  // formcontrolname="user" (NO "usuario") y name="username". El botón es un
  // <button type="submit"> sin id ni clase, con texto "Ingresar".
  LOGIN: {
    usuario: [
      { tipo: 'css', valor: 'input[formcontrolname="user"]' },
      { tipo: 'name', valor: 'username' },
      { tipo: 'id', valor: 'usuario' },
      { tipo: 'css', valor: 'input[type="text"]' },
    ],
    password: [
      { tipo: 'css', valor: 'input[formcontrolname="password"]' },
      { tipo: 'name', valor: 'password' },
      { tipo: 'css', valor: 'input[type="password"]' },
    ],
    submit: [
      { tipo: 'css', valor: 'button[type="submit"]' },
      { tipo: 'texto', valor: 'ingresar', tags: ['button'] },
    ],
  },

  // ── Pantalla de selección de producto (#/seleccionProducto) ───────────────
  // Confirmado: es un <mat-card class="card"> SIN id ni atributo data-producto.
  // Para esta entidad de prueba solo había UNA card (SALUD), pero si un broker
  // tiene más de un producto asignado podría haber varias mat-card.card — por
  // eso el texto va primero (más específico) y el CSS queda como fallback
  // genérico solo útil cuando hay una sola card en pantalla.
  SELECCION_PRODUCTO: {
    botonSalud: [
      { tipo: 'texto', valor: 'salud', tags: ['mat-card', 'button', 'a', 'div', 'span'] },
      { tipo: 'css', valor: 'mat-card.card' },
    ],
  },

  // ── Pantalla de menú de salud (#/seleccionProducto/salud) ─────────────────
  // Confirmado: <a mat-list-item class="... subnav ..."> sin href (navega via
  // Angular Router por código). OJO: la clase "subnav" la comparten TODOS los
  // ítems del menú (Home, Simulador, Indicadores, etc.) — NO es única, por eso
  // NO se usa como selector CSS solo (matchearía siempre el primer ítem, "Home").
  // La única estrategia confiable es por texto exacto.
  MENU_SALUD: {
    itemSimulador: [
      { tipo: 'texto', valor: 'simulador de cotización', tags: ['a', 'li', 'span', 'div', 'button'] },
    ],
  },
}
