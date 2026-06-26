<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Commit `unknown` · generated 2026-06-26T19:13:56.818Z · higher ops/sec is better.

Benchmarks run through **Vitest benchmark mode / Tinybench**. Changes inside the combined statistical noise floor are marked stable rather than celebrated as tiny, glittery lies. 🧪

## 🌳 Forest overview

| Package | Overall | Faster | Slower | Stable | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.04% | 2 | 3 | 10 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 +0.26% | 6 | 7 | 15 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Overall geometric mean:** +0.04%

### 🚀 Fastest improvements

1. **warm atomic.css.withImportant** · +8.43% ops/sec
2. **cold css: atomic detection + compile** · +6.84% ops/sec

### 🐢 Largest regressions

1. **warm css: polymorphic atomic identity hit** · -9.28% ops/sec
2. **warm atomic.css: classic atomic compile** · -5.03% ops/sec
3. **cold atomic.css: transform parse compile** · -4.80% ops/sec

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Previous ops/s | Current ops/s | Δ ops/s | Mean ms | RME |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 🌿 | baseline: String.raw tiny css | 4,389,287 | 4,332,479 | -1.29% | 0.00023 | ±0.59% |
| 🐢 | warm atomic.css: classic atomic compile | 508,805 | 483,195 | -5.03% | 0.00207 | ±0.45% |
| 🐢 | warm css: polymorphic atomic identity hit | 1,835,217 | 1,664,886 | -9.28% | 0.00060 | ±0.44% |
| 🌿 | warm inline.css: inline style compile | 520,118 | 505,373 | -2.83% | 0.00198 | ±0.53% |
| 🌿 | warm atomic.css: aliases helpers comments variants | 280,722 | 281,954 | +0.44% | 0.00355 | ±0.47% |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 186,891 | 191,444 | +2.44% | 0.00522 | ±0.38% |
| 🌿 | warm css: polymorphic sheet identity hit | 829,621 | 834,456 | +0.58% | 0.00120 | ±0.43% |
| 🌿 | warm css: prepared configure plan hit | 5,386,130 | 5,455,847 | +1.29% | 0.00018 | ±5.01% |
| 🌿 | warm sheet.css.withImportant | 184,041 | 183,722 | -0.17% | 0.00544 | ±0.41% |
| 🚀 | warm atomic.css.withImportant | 261,016 | 283,023 | +8.43% | 0.00353 | ±0.43% |
| 🐢 | cold atomic.css: transform parse compile | 3,357 | 3,195 | -4.80% | 0.31294 | ±2.31% |
| 🌿 | cold sheet.css: transform parse compile | 2,726 | 2,718 | -0.29% | 0.36787 | ±4.23% |
| 🚀 | cold css: atomic detection + compile | 3,027 | 3,233 | +6.84% | 0.30927 | ±2.21% |
| 🌿 | cold css: sheet detection + compile | 2,681 | 2,804 | +4.58% | 0.35668 | ±2.19% |
| 🌿 | cold css: configure parse + normalized apply | 17,320 | 17,515 | +1.13% | 0.05709 | ±2.20% |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering matrix compared with manual document.createElement baselines.

**Overall geometric mean:** +0.26%

### 🚀 Fastest improvements

1. **keyed-list-update :: fabrica.html** · +34.87% ops/sec
2. **named-styled-registry :: fabrica.html** · +13.63% ops/sec
3. **portal-mount :: fabrica.html** · +12.77% ops/sec
4. **portal-mount :: manual.createElement** · +12.09% ops/sec
5. **reactive-text :: fabrica.html** · +10.76% ops/sec

### 🐢 Largest regressions

1. **complex-attributes :: fabrica.html** · -19.27% ops/sec
2. **static-tree :: fabrica.html** · -19.26% ops/sec
3. **styled-component-registration :: manual.createElement** · -11.40% ops/sec
4. **virtual-list-window :: manual.createElement** · -8.34% ops/sec
5. **named-styled-registry :: manual.createElement** · -6.08% ops/sec

### 🥊 Current framework race

| Case | Adapter | Ops/s | Versus manual |
| --- | --- | ---: | ---: |
| static-tree | manual.createElement | 23,891 | baseline |
| static-tree | fabrica.html | 7,334 | 🐢 3.26× slower |
| complex-attributes | manual.createElement | 43,361 | baseline |
| complex-attributes | fabrica.html | 7,858 | 🐢 5.52× slower |
| nested-components | manual.createElement | 11,976 | baseline |
| nested-components | fabrica.html | 866 | 🐢 13.83× slower |
| reactive-text | manual.createElement | 75,493 | baseline |
| reactive-text | fabrica.html | 12,568 | 🐢 6.01× slower |
| reactive-class-style | manual.createElement | 10,827 | baseline |
| reactive-class-style | fabrica.html | 4,116 | 🐢 2.63× slower |
| conditional-component | manual.createElement | 10,090 | baseline |
| conditional-component | fabrica.html | 1,743 | 🐢 5.79× slower |
| spread-props-events | manual.createElement | 42,644 | baseline |
| spread-props-events | fabrica.html | 12,063 | 🐢 3.54× slower |
| keyed-list-update | manual.createElement | 864 | baseline |
| keyed-list-update | fabrica.html | 106 | 🐢 8.14× slower |
| virtual-list-window | manual.createElement | 4,503 | baseline |
| virtual-list-window | fabrica.html | 560 | 🐢 8.05× slower |
| portal-mount | manual.createElement | 65,919 | baseline |
| portal-mount | fabrica.html | 10,719 | 🐢 6.15× slower |
| raw-html | manual.createElement | 19,915 | baseline |
| raw-html | fabrica.html | 6,978 | 🐢 2.85× slower |
| two-way-bind | manual.createElement | 73,856 | baseline |
| two-way-bind | fabrica.html | 14,872 | 🐢 4.97× slower |
| named-styled-registry | manual.createElement | 76,145 | baseline |
| named-styled-registry | fabrica.html | 8,691 | 🐢 8.76× slower |
| styled-component-registration | manual.createElement | 3,254,241 | baseline |
| styled-component-registration | fabrica.html | 194,652 | 🐢 16.72× slower |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Previous ops/s | Current ops/s | Δ ops/s | Mean ms | RME |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 🌿 | static-tree :: manual.createElement | 23,336 | 23,891 | +2.38% | 0.04186 | ±1.61% |
| 🌿 | complex-attributes :: manual.createElement | 42,332 | 43,361 | +2.43% | 0.02306 | ±1.28% |
| 🌿 | nested-components :: manual.createElement | 11,829 | 11,976 | +1.24% | 0.08350 | ±1.29% |
| 🌿 | reactive-text :: manual.createElement | 74,033 | 75,493 | +1.97% | 0.01325 | ±1.15% |
| 🌿 | reactive-class-style :: manual.createElement | 10,954 | 10,827 | -1.16% | 0.09236 | ±1.31% |
| 🚀 | conditional-component :: manual.createElement | 9,759 | 10,090 | +3.39% | 0.09911 | ±1.15% |
| 🌿 | spread-props-events :: manual.createElement | 43,393 | 42,644 | -1.73% | 0.02345 | ±1.44% |
| 🌿 | keyed-list-update :: manual.createElement | 861 | 864 | +0.32% | 1.15763 | ±2.22% |
| 🐢 | virtual-list-window :: manual.createElement | 4,913 | 4,503 | -8.34% | 0.22207 | ±2.06% |
| 🚀 | portal-mount :: manual.createElement | 58,808 | 65,919 | +12.09% | 0.01517 | ±1.22% |
| 🐢 | raw-html :: manual.createElement | 20,818 | 19,915 | -4.34% | 0.05021 | ±1.66% |
| 🐢 | two-way-bind :: manual.createElement | 76,475 | 73,856 | -3.42% | 0.01354 | ±1.27% |
| 🐢 | named-styled-registry :: manual.createElement | 81,073 | 76,145 | -6.08% | 0.01313 | ±1.41% |
| 🐢 | styled-component-registration :: manual.createElement | 3,672,816 | 3,254,241 | -11.40% | 0.00031 | ±3.30% |
| 🐢 | static-tree :: fabrica.html | 9,083 | 7,334 | -19.26% | 0.13635 | ±2.12% |
| 🐢 | complex-attributes :: fabrica.html | 9,734 | 7,858 | -19.27% | 0.12726 | ±2.38% |
| 🌿 | nested-components :: fabrica.html | 966 | 866 | -10.36% | 1.15497 | ±5.38% |
| 🚀 | reactive-text :: fabrica.html | 11,347 | 12,568 | +10.76% | 0.07957 | ±4.46% |
| 🌿 | reactive-class-style :: fabrica.html | 4,263 | 4,116 | -3.45% | 0.24294 | ±3.88% |
| 🌿 | conditional-component :: fabrica.html | 1,702 | 1,743 | +2.41% | 0.57367 | ±3.09% |
| 🌿 | spread-props-events :: fabrica.html | 11,027 | 12,063 | +9.40% | 0.08290 | ±5.74% |
| 🚀 | keyed-list-update :: fabrica.html | 79 | 106 | +34.87% | 9.41788 | ±4.53% |
| 🌿 | virtual-list-window :: fabrica.html | 558 | 560 | +0.24% | 1.78700 | ±12.76% |
| 🚀 | portal-mount :: fabrica.html | 9,506 | 10,719 | +12.77% | 0.09329 | ±6.03% |
| 🌿 | raw-html :: fabrica.html | 7,260 | 6,978 | -3.87% | 0.14330 | ±2.39% |
| 🌿 | two-way-bind :: fabrica.html | 13,369 | 14,872 | +11.24% | 0.06724 | ±5.40% |
| 🚀 | named-styled-registry :: fabrica.html | 7,648 | 8,691 | +13.63% | 0.11506 | ±2.33% |
| 🌿 | styled-component-registration :: fabrica.html | 201,980 | 194,652 | -3.63% | 0.00514 | ±9.12% |

</details>

## 🧭 Reading the numbers

- **🚀 Faster** means the ops/sec gain exceeded the larger of 3% or the combined benchmark RME.
- **🐢 Slower** means the regression exceeded that same noise-aware threshold.
- **🌿 Stable** means the change is too small to separate confidently from runner noise.
- Compare only runs produced by similar GitHub runners. Local machines are useful for exploration, not courtroom testimony.
