# Broto

Broto is the reactive runtime extracted from Fábrica. It owns signals, computed values, effects, batching, scheduling, stores, graph helpers and async resources.

## Why Broto exists

Fábrica should own HTML/UI. Cipó should own CSS. Fabrica Elements should own component/element factories. Broto owns reactivity.

## Examples

```ts
import { signal, computed, effect, batch, store, resource } from "./broto";

const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => {
  console.log(doubled());
});

batch(() => {
  count.set(1);
  count.set(2);
});

const user = store({ name: "Rod" });
user.name.set("Rodolfo");

const profile = resource(() => fetch("/me").then((r) => r.json()));
profile.reload();
```
