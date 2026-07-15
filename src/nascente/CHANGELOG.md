# Changelog

## 0.2.0 - 2026-07-15

- Substitui a landing estática por documentação gerada automaticamente durante o build.
- Reutiliza o renderer Markdown de `scripts/docs` para README e CHANGELOG.
- Extrai a referência da API diretamente das exportações e TSDoc de `index.ts`.
- Adiciona sidebar responsiva com busca instantânea da API e navegação por categoria.
- Redesenha a landing page com identidade visual própria inspirada em água, nascente e correnteza.
- Integra `nascente` ao escopo automático e manual da pipeline de browser bundles.
- Adiciona workflow dedicado `Publish Nascente` e execução opcional dos benchmarks do pacote.


## 0.1.0 - 2026-07-15

- Nasce o pacote **Nascente** com API flat e zero dependencies.
- Adiciona utilitários de arrays, objetos, funções, Map, Set, promises, strings, matemática e predicados.
- Adiciona `Mutex`, `Semaphore`, `AbortError` e `TimeoutError`.
- Adiciona testes de correção e benchmarks comparativos para hot paths comuns.
- Adiciona landing page mobile-first inspirada em nascente e documentação de estratégia de performance.
