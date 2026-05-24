// ==UserScript==
// @name         Rod Private Bundle Loader Example
// @namespace    https://rod.xyz/
// @version      1.0.0
// @description  Loads a public IIFE bundle generated from a private TypeScript repository.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @require      https://YOUR_PUBLIC_URL/bundle.iife.js
// ==/UserScript==

(() => {
  "use strict";

  const api = window.Rod;

  if (!api) {
    console.warn("Rod bundle was not loaded.");
    return;
  }

  console.log(api.createGreeting?.({ name: "Rod", emoji: "🌶️" }));
})();
