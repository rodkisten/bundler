# 💧 Nascente

**A fonte de utilitários para hot paths.** Nascente é um toolkit TypeScript flat, zero-dependency e allocation-conscious, desenhado para Safari/WebKit e dispositivos móveis sem sacrificar legibilidade.

## Filosofia

- Loops indexados em arrays densos, evitando callbacks e iteradores em caminhos críticos.
- Transformações fundidas em uma passagem quando isso elimina arrays intermediários.
- `Set` e `Map` quando reduzem complexidade algorítmica.
- Alocação preguiçosa e resultados pré-alocados em operações assíncronas.
- APIs nativas quando elas já são a melhor escolha. Nascente não promete que JavaScript puro vence o motor em todo microbenchmark.
- Benchmarks devem ser executados no dispositivo e workload reais. Performance é medida, não folclore.

## Uso

```ts
import { groupBy, mapAsync, mapValues, cloneDeep, Mutex } from './nascente';

const byTeam = groupBy(users, user => user.teamId);
const doubled = mapValues(scores, score => score * 2);
const hydrated = await mapAsync(ids, fetchUser, 4);
const snapshot = cloneDeep(state);
```

A API cobre arrays, funções, Map, Set, objetos, predicados, promises, strings, matemática e erros. Consulte a landing page gerada em `src/nascente/index.html` para o catálogo e as notas de performance.

## Documentação automática

A documentação publicada da Nascente é gerada durante o build a partir de três fontes de verdade:

- `README.md`, renderizado pelo mesmo pipeline Markdown usado pelo restante do repositório.
- `CHANGELOG.md`, incorporado automaticamente à landing page.
- TSDoc das exportações públicas de `index.ts`, usado para montar a referência da API e a navegação lateral.

Execute `pnpm build:nascente:docs` para gerar `dist/nascente/index.html` isoladamente, ou `pnpm build` para gerar a documentação junto com os bundles gerais.

A sidebar da documentação é criada a partir das APIs públicas detectadas no TypeScript. Isso evita manter manualmente uma lista duplicada de funções no HTML.
