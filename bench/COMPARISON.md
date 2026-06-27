<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Commit `baseline` · generated 2026-06-27T13:17:04.197Z · higher ops/sec is better.

Benchmarks run through **Vitest benchmark mode / Tinybench**. Changes inside the combined statistical noise floor are marked stable rather than celebrated as tiny, glittery lies. 🧪

## 🌳 Forest overview

| Package | Overall | Faster | Slower | Stable | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 -1.15% | 4 | 8 | 6 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🐢 -4.83% | 3 | 10 | 19 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Overall geometric mean:** -1.15%

### 🚀 Fastest improvements

1. **cold css: sheet detection + compile** · +19.54% ops/sec
2. **cold css: atomic detection + compile** · +16.56% ops/sec
3. **cold sheet.css: transform parse compile** · +13.07% ops/sec
4. **class name: privacy redaction and truncation** · +4.20% ops/sec

### 🐢 Largest regressions

1. **cold atomic.css: transform parse compile** · -12.95% ops/sec
2. **warm sheet.css: nested sheet runtime DSL** · -12.53% ops/sec
3. **warm css: polymorphic sheet identity hit** · -10.89% ops/sec
4. **warm inline.css: inline style compile** · -10.04% ops/sec
5. **warm css: prepared configure plan hit** · -8.91% ops/sec

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Previous ops/s | Current ops/s | Δ ops/s | Mean ms | RME |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 🐢 | baseline: String.raw tiny css | 2,176,034 | 2,107,633 | -3.14% | 0.00047 | ±0.77% |
| 🌿 | warm atomic.css: classic atomic compile | 279,465 | 273,222 | -2.23% | 0.00366 | ±0.58% |
| 🐢 | warm css: polymorphic atomic identity hit | 1,028,671 | 994,104 | -3.36% | 0.00101 | ±0.63% |
| 🐢 | warm inline.css: inline style compile | 266,769 | 239,981 | -10.04% | 0.00417 | ±4.06% |
| 🐢 | warm atomic.css: aliases helpers comments variants | 158,845 | 150,105 | -5.50% | 0.00666 | ±0.83% |
| 🐢 | warm sheet.css: nested sheet runtime DSL | 104,940 | 91,791 | -12.53% | 0.01089 | ±1.14% |
| 🐢 | warm css: polymorphic sheet identity hit | 482,180 | 429,663 | -10.89% | 0.00233 | ±1.17% |
| 🐢 | warm css: prepared configure plan hit | 3,062,292 | 2,789,381 | -8.91% | 0.00036 | ±3.75% |
| 🌿 | warm sheet.css.withImportant | 108,064 | 106,901 | -1.08% | 0.00935 | ±0.73% |
| 🌿 | warm atomic.css.withImportant | 160,616 | 157,094 | -2.19% | 0.00637 | ±0.78% |
| 🐢 | cold atomic.css: transform parse compile | 1,402 | 1,221 | -12.95% | 0.81914 | ±17.44% |
| 🚀 | cold sheet.css: transform parse compile | 1,342 | 1,517 | +13.07% | 0.65913 | ±4.11% |
| 🚀 | cold css: atomic detection + compile | 1,215 | 1,416 | +16.56% | 0.70633 | ±2.40% |
| 🚀 | cold css: sheet detection + compile | 1,313 | 1,570 | +19.54% | 0.63710 | ±2.50% |
| 🌿 | cold css: configure parse + normalized apply | 7,785 | 8,242 | +5.87% | 0.12133 | ±3.25% |
| 🌿 | class name: compact prefix-a-hash | 140,616 | 140,367 | -0.18% | 0.00712 | ±1.21% |
| 🌿 | class name: readable property-value-context-hash | 141,561 | 142,542 | +0.69% | 0.00702 | ±0.71% |
| 🚀 | class name: privacy redaction and truncation | 106,816 | 111,300 | +4.20% | 0.00898 | ±0.66% |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering matrix compared with manual document.createElement baselines.

**Overall geometric mean:** -4.83%

### 🚀 Fastest improvements

1. **virtual-list-window :: fabrica.html** · +34.59% ops/sec
2. **styled-component-registration :: fabrica.html** · +13.18% ops/sec
3. **complex-attributes :: fabrica.html** · +5.09% ops/sec

### 🐢 Largest regressions

1. **portal-mount :: manual.createElement** · -29.23% ops/sec
2. **reactive-text :: fabrica.html** · -25.23% ops/sec
3. **reactive-class-style :: manual.createElement** · -22.98% ops/sec
4. **reactive-text :: manual.createElement** · -20.65% ops/sec
5. **reactive-class-style :: fabrica.html** · -19.65% ops/sec

### 🥊 Current framework race

| Case | Adapter | Ops/s | Versus manual |
| --- | --- | ---: | ---: |
| static-tree | manual.createElement | 10,208 | baseline |
| static-tree | fabrica.html | 4,089 | 🐢 2.50× slower |
| complex-attributes | manual.createElement | 16,766 | baseline |
| complex-attributes | fabrica.html | 3,529 | 🐢 4.75× slower |
| nested-components | manual.createElement | 6,059 | baseline |
| nested-components | fabrica.html | 370 | 🐢 16.38× slower |
| reactive-text | manual.createElement | 28,878 | baseline |
| reactive-text | fabrica.html | 4,116 | 🐢 7.02× slower |
| reactive-class-style | manual.createElement | 3,936 | baseline |
| reactive-class-style | fabrica.html | 1,518 | 🐢 2.59× slower |
| conditional-component | manual.createElement | 5,152 | baseline |
| conditional-component | fabrica.html | 803 | 🐢 6.42× slower |
| spread-props-events | manual.createElement | 16,628 | baseline |
| spread-props-events | fabrica.html | 3,863 | 🐢 4.30× slower |
| keyed-list-update | manual.createElement | 429 | baseline |
| keyed-list-update | fabrica.html | 62 | 🐢 6.88× slower |
| virtual-list-window | manual.createElement | 2,326 | baseline |
| virtual-list-window | fabrica.html | 351 | 🐢 6.62× slower |
| portal-mount | manual.createElement | 24,466 | baseline |
| portal-mount | fabrica.html | 5,560 | 🐢 4.40× slower |
| raw-html | manual.createElement | 8,478 | baseline |
| raw-html | fabrica.html | 4,365 | 🐢 1.94× slower |
| two-way-bind | manual.createElement | 33,707 | baseline |
| two-way-bind | fabrica.html | 6,153 | 🐢 5.48× slower |
| named-styled-registry | manual.createElement | 40,230 | baseline |
| named-styled-registry | fabrica.html | 4,253 | 🐢 9.46× slower |
| styled-component-registration | manual.createElement | 2,091,446 | baseline |
| styled-component-registration | fabrica.html | 99,840 | 🐢 20.95× slower |
| styled-artifact-render | manual.createElement | 96,458 | baseline |
| styled-artifact-render | fabrica.html | 59,851 | 🐢 1.61× slower |
| styled-artifact-composition | manual.createElement | 82,165 | baseline |
| styled-artifact-composition | fabrica.html | 43,031 | 🐢 1.91× slower |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Previous ops/s | Current ops/s | Δ ops/s | Mean ms | RME |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 🌿 | static-tree :: manual.createElement | 10,038 | 10,208 | +1.69% | 0.09796 | ±2.23% |
| 🌿 | static-tree :: fabrica.html | 4,221 | 4,089 | -3.12% | 0.24454 | ±2.07% |
| 🌿 | complex-attributes :: manual.createElement | 16,920 | 16,766 | -0.91% | 0.05964 | ±1.92% |
| 🚀 | complex-attributes :: fabrica.html | 3,358 | 3,529 | +5.09% | 0.28333 | ±2.18% |
| 🌿 | nested-components :: manual.createElement | 6,055 | 6,059 | +0.07% | 0.16505 | ±1.79% |
| 🐢 | nested-components :: fabrica.html | 436 | 370 | -15.23% | 2.70366 | ±8.76% |
| 🐢 | reactive-text :: manual.createElement | 36,396 | 28,878 | -20.65% | 0.03463 | ±2.29% |
| 🐢 | reactive-text :: fabrica.html | 5,504 | 4,116 | -25.23% | 0.24298 | ±9.78% |
| 🐢 | reactive-class-style :: manual.createElement | 5,110 | 3,936 | -22.98% | 0.25405 | ±2.60% |
| 🐢 | reactive-class-style :: fabrica.html | 1,890 | 1,518 | -19.65% | 0.65868 | ±4.94% |
| 🌿 | conditional-component :: manual.createElement | 5,025 | 5,152 | +2.52% | 0.19412 | ±1.59% |
| 🌿 | conditional-component :: fabrica.html | 830 | 803 | -3.27% | 1.24574 | ±4.00% |
| 🐢 | spread-props-events :: manual.createElement | 17,763 | 16,628 | -6.39% | 0.06014 | ±2.26% |
| 🌿 | spread-props-events :: fabrica.html | 3,747 | 3,863 | +3.10% | 0.25885 | ±5.98% |
| 🌿 | keyed-list-update :: manual.createElement | 435 | 429 | -1.51% | 2.33141 | ±3.08% |
| 🌿 | keyed-list-update :: fabrica.html | 63 | 62 | -1.17% | 16.04300 | ±4.88% |
| 🌿 | virtual-list-window :: manual.createElement | 2,377 | 2,326 | -2.12% | 0.42987 | ±2.14% |
| 🚀 | virtual-list-window :: fabrica.html | 261 | 351 | +34.59% | 2.84532 | ±10.63% |
| 🐢 | portal-mount :: manual.createElement | 34,572 | 24,466 | -29.23% | 0.04087 | ±26.88% |
| 🌿 | portal-mount :: fabrica.html | 6,156 | 5,560 | -9.68% | 0.17986 | ±6.55% |
| 🌿 | raw-html :: manual.createElement | 8,771 | 8,478 | -3.35% | 0.11796 | ±2.63% |
| 🌿 | raw-html :: fabrica.html | 4,485 | 4,365 | -2.69% | 0.22911 | ±2.82% |
| 🐢 | two-way-bind :: manual.createElement | 35,984 | 33,707 | -6.33% | 0.02967 | ±2.46% |
| 🌿 | two-way-bind :: fabrica.html | 5,833 | 6,153 | +5.49% | 0.16251 | ±6.23% |
| 🌿 | named-styled-registry :: manual.createElement | 40,555 | 40,230 | -0.80% | 0.02486 | ±2.19% |
| 🌿 | named-styled-registry :: fabrica.html | 4,265 | 4,253 | -0.27% | 0.23511 | ±2.55% |
| 🌿 | styled-component-registration :: manual.createElement | 2,053,105 | 2,091,446 | +1.87% | 0.00048 | ±3.96% |
| 🚀 | styled-component-registration :: fabrica.html | 88,216 | 99,840 | +13.18% | 0.01002 | ±7.65% |
| 🌿 | styled-artifact-render :: manual.createElement | 96,300 | 96,458 | +0.16% | 0.01037 | ±2.36% |
| 🐢 | styled-artifact-render :: fabrica.html | 64,412 | 59,851 | -7.08% | 0.01671 | ±3.04% |
| 🐢 | styled-artifact-composition :: manual.createElement | 93,304 | 82,165 | -11.94% | 0.01217 | ±3.38% |
| 🌿 | styled-artifact-composition :: fabrica.html | 45,645 | 43,031 | -5.73% | 0.02324 | ±3.55% |

</details>

## 🧭 Reading the numbers

- **🚀 Faster** means the ops/sec gain exceeded the larger of 3% or the combined benchmark RME.
- **🐢 Slower** means the regression exceeded that same noise-aware threshold.
- **🌿 Stable** means the change is too small to separate confidently from runner noise.
- Compare only runs produced by similar GitHub runners. Local machines are useful for exploration, not courtroom testimony.
