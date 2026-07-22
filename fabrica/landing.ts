import { computed, html, render, signal } from "@rodkisten/fabrica";

const count = signal(0);
const status = computed(() => count() === 0 ? "ready" : count() < 5 ? "warming" : count() < 10 ? "productive" : "factory overload");
const host = document.querySelector<HTMLElement>("#fabrica-demo");

if (!host) throw new Error("Fábrica landing demo host was not found.");

render(host, html`
  <section class="fab-demo-card">
    <div class="fab-demo-counter">${count}</div>
    <p class="fab-demo-status">${status}</p>
    <button class="fab-demo-button" @click=${() => count.update((value) => value + 1)}>Stamp component</button>
    <button class="fab-demo-reset" @click=${() => count.set(0)}>reset</button>
  </section>
`);
