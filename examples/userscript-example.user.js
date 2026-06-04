// ==UserScript==
// @name         Rod Browser Tools Example
// @namespace    https://rod.dev/userscripts
// @version      1.0.0
// @description  Loads generated standalone IIFE globals.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @require      https://OWNER.github.io/REPO/fabrica.iife.js
// @require      https://OWNER.github.io/REPO/cipo.iife.js
// @require      https://OWNER.github.io/REPO/seiva-state.iife.js
// ==/UserScript==

console.log("Loaded tools", {
  Fabrica: window.Fabrica,
  Cipo: window.Cipo,
  Seiva: window.Seiva,
});
