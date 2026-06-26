<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Commit `uploaded` · generated 2026-06-26T12:53:49.580Z · higher ops/sec is better.

Benchmarks run through **Vitest benchmark mode / Tinybench**. Changes inside the combined statistical noise floor are marked stable rather than celebrated as tiny, glittery lies. 🧪

## 🌳 Forest overview

| Package | Overall | Faster | Slower | Stable | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌱 baseline | 0 | 0 | 0 | 15 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌱 baseline | 0 | 0 | 0 | 24 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

> 🌱 **Baseline created.** 15 benchmark cases are now ready for the next commit comparison.

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Previous ops/s | Current ops/s | Δ ops/s | Mean ms | RME |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 🆕 | baseline: String.raw tiny css | — | 4,183,750 | baseline | 0.00024 | ±0.56% |
| 🆕 | warm atomic.css: classic atomic compile | — | 489,660 | baseline | 0.00204 | ±0.41% |
| 🆕 | warm css: polymorphic atomic identity hit | — | 1,745,566 | baseline | 0.00057 | ±0.40% |
| 🆕 | warm inline.css: inline style compile | — | 447,817 | baseline | 0.00223 | ±0.60% |
| 🆕 | warm atomic.css: aliases helpers comments variants | — | 266,594 | baseline | 0.00375 | ±0.61% |
| 🆕 | warm sheet.css: nested sheet runtime DSL | — | 174,843 | baseline | 0.00572 | ±0.61% |
| 🆕 | warm css: polymorphic sheet identity hit | — | 755,534 | baseline | 0.00132 | ±0.61% |
| 🆕 | warm css: prepared configure plan hit | — | 5,642,829 | baseline | 0.00018 | ±0.11% |
| 🆕 | warm sheet.css.withImportant | — | 173,598 | baseline | 0.00576 | ±0.53% |
| 🆕 | warm atomic.css.withImportant | — | 261,106 | baseline | 0.00383 | ±0.55% |
| 🆕 | cold atomic.css: transform parse compile | — | 3,189 | baseline | 0.31355 | ±2.15% |
| 🆕 | cold sheet.css: transform parse compile | — | 2,789 | baseline | 0.35858 | ±2.36% |
| 🆕 | cold css: atomic detection + compile | — | 3,083 | baseline | 0.32433 | ±2.40% |
| 🆕 | cold css: sheet detection + compile | — | 2,739 | baseline | 0.36513 | ±2.55% |
| 🆕 | cold css: configure parse + normalized apply | — | 16,614 | baseline | 0.06019 | ±2.79% |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering matrix compared with manual document.createElement baselines.

> 🌱 **Baseline created.** 24 benchmark cases are now ready for the next commit comparison.

### 🥊 Current framework race

| Case | Adapter | Ops/s | Versus manual |
| --- | --- | ---: | ---: |
| static-tree | manual.createElement | 21,548 | baseline |
| static-tree | fabrica.html | 8,485 | 🐢 2.54× slower |
| complex-attributes | manual.createElement | 42,814 | baseline |
| complex-attributes | fabrica.html | 9,941 | 🐢 4.31× slower |
| nested-components | manual.createElement | 11,720 | baseline |
| nested-components | fabrica.html | 906 | 🐢 12.94× slower |
| reactive-text | manual.createElement | 74,891 | baseline |
| reactive-text | fabrica.html | 11,328 | 🐢 6.61× slower |
| reactive-class-style | manual.createElement | 10,749 | baseline |
| reactive-class-style | fabrica.html | 3,454 | 🐢 3.11× slower |
| conditional-component | manual.createElement | 9,901 | baseline |
| conditional-component | fabrica.html | 1,665 | 🐢 5.95× slower |
| spread-props-events | manual.createElement | 40,835 | baseline |
| spread-props-events | fabrica.html | 10,530 | 🐢 3.88× slower |
| keyed-list-update | manual.createElement | 822 | baseline |
| keyed-list-update | fabrica.html | 111 | 🐢 7.43× slower |
| virtual-list-window | manual.createElement | 4,752 | baseline |
| virtual-list-window | fabrica.html | 678 | 🐢 7.00× slower |
| portal-mount | manual.createElement | 66,671 | baseline |
| portal-mount | fabrica.html | 10,876 | 🐢 6.13× slower |
| raw-html | manual.createElement | 21,039 | baseline |
| raw-html | fabrica.html | 8,229 | 🐢 2.56× slower |
| two-way-bind | manual.createElement | 74,926 | baseline |
| two-way-bind | fabrica.html | 13,857 | 🐢 5.41× slower |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Previous ops/s | Current ops/s | Δ ops/s | Mean ms | RME |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 🆕 | static-tree :: manual.createElement | — | 21,548 | baseline | 0.04641 | ±1.65% |
| 🆕 | complex-attributes :: manual.createElement | — | 42,814 | baseline | 0.02336 | ±1.32% |
| 🆕 | nested-components :: manual.createElement | — | 11,720 | baseline | 0.08532 | ±1.21% |
| 🆕 | reactive-text :: manual.createElement | — | 74,891 | baseline | 0.01335 | ±1.05% |
| 🆕 | reactive-class-style :: manual.createElement | — | 10,749 | baseline | 0.09303 | ±1.33% |
| 🆕 | conditional-component :: manual.createElement | — | 9,901 | baseline | 0.10100 | ±1.10% |
| 🆕 | spread-props-events :: manual.createElement | — | 40,835 | baseline | 0.02449 | ±1.44% |
| 🆕 | keyed-list-update :: manual.createElement | — | 822 | baseline | 1.21618 | ±2.05% |
| 🆕 | virtual-list-window :: manual.createElement | — | 4,752 | baseline | 0.21045 | ±1.66% |
| 🆕 | portal-mount :: manual.createElement | — | 66,671 | baseline | 0.01500 | ±1.02% |
| 🆕 | raw-html :: manual.createElement | — | 21,039 | baseline | 0.04753 | ±1.45% |
| 🆕 | two-way-bind :: manual.createElement | — | 74,926 | baseline | 0.01335 | ±1.15% |
| 🆕 | static-tree :: fabrica.html | — | 8,485 | baseline | 0.11786 | ±1.70% |
| 🆕 | complex-attributes :: fabrica.html | — | 9,941 | baseline | 0.10060 | ±1.63% |
| 🆕 | nested-components :: fabrica.html | — | 906 | baseline | 1.10387 | ±7.38% |
| 🆕 | reactive-text :: fabrica.html | — | 11,328 | baseline | 0.08827 | ±5.92% |
| 🆕 | reactive-class-style :: fabrica.html | — | 3,454 | baseline | 0.28956 | ±10.15% |
| 🆕 | conditional-component :: fabrica.html | — | 1,665 | baseline | 0.60057 | ±3.05% |
| 🆕 | spread-props-events :: fabrica.html | — | 10,530 | baseline | 0.09497 | ±6.10% |
| 🆕 | keyed-list-update :: fabrica.html | — | 111 | baseline | 9.03350 | ±4.61% |
| 🆕 | virtual-list-window :: fabrica.html | — | 678 | baseline | 1.47420 | ±8.58% |
| 🆕 | portal-mount :: fabrica.html | — | 10,876 | baseline | 0.09194 | ±6.26% |
| 🆕 | raw-html :: fabrica.html | — | 8,229 | baseline | 0.12152 | ±2.56% |
| 🆕 | two-way-bind :: fabrica.html | — | 13,857 | baseline | 0.07216 | ±6.72% |

</details>

## 🧭 Reading the numbers

- **🚀 Faster** means the ops/sec gain exceeded the larger of 3% or the combined benchmark RME.
- **🐢 Slower** means the regression exceeded that same noise-aware threshold.
- **🌿 Stable** means the change is too small to separate confidently from runner noise.
- Compare only runs produced by similar GitHub runners. Local machines are useful for exploration, not courtroom testimony.
