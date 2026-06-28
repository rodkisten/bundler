<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `2b669ca6` · baseline `56089fc5` · generated 2026-06-28T01:40:50.894Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000004924 · Linux · X64 |
| CPU | AMD EPYC 9V45 96-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.17.0 · V8 13.6.233.17-node.49 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.00 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 -2.34% | -2.34% | 0 | 6 | 13 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 -0.42% | -1.40% | 3 | 4 | 30 | 7 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** -2.34%  
**Raw geometric mean:** -2.34%

### 🚀 Fastest reliable improvements

_None outside the reliability threshold._

### 🐢 Largest reliable regressions

1. **warm sheet.css: nested sheet runtime DSL** · -11.19% raw · high confidence
2. **stylis: tiny declaration compile** · -6.14% raw · high confidence
3. **warm sheet.css.withImportant** · -4.45% raw · high confidence
4. **cold css: sheet detection + compile** · -4.35% raw · high confidence
5. **warm atomic.css.withImportant** · -3.30% raw · high confidence

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🐢 | class name: compact prefix-a-hash | 347,153 | 336,386 | -3.10% | — | 3.00% | high | 0.00297 | 2.63% | 0.78% | ▁▂█ |
| 🌿 | class name: privacy redaction and truncation | 262,584 | 257,735 | -1.85% | — | 3.00% | high | 0.00388 | 1.53% | 0.45% | ▂▁█ |
| 🌿 | class name: readable property-value-context-hash | 341,634 | 332,683 | -2.62% | — | 3.00% | high | 0.00301 | 1.59% | 0.49% | ▁▂█ |
| 🌿 | cold atomic.css: transform parse compile | 4,714 | 4,550 | -3.48% | — | 3.91% | high | 0.21980 | 0.27% | 0.01% | █▁▁ |
| 🌿 | cold css: atomic detection + compile | 4,956 | 4,808 | -2.98% | — | 3.68% | high | 0.20799 | 1.54% | 1.73% | ▁█▅ |
| 🌿 | cold css: configure parse + normalized apply | 28,417 | 28,724 | +1.08% | — | 5.63% | high | 0.03481 | 8.30% | 1.93% | ▁█▇ |
| 🐢 | cold css: sheet detection + compile | 5,528 | 5,287 | -4.35% | — | 3.57% | high | 0.18914 | 1.45% | 0.06% | ▁█▁ |
| 🌿 | cold sheet.css: transform parse compile | 5,569 | 5,381 | -3.38% | — | 3.96% | high | 0.18585 | 0.97% | 0.93% | ▁█▄ |
| 🌿 | stylis: nested stylesheet compile | 144,934 | 145,949 | +0.70% | — | 3.00% | high | 0.00685 | 1.19% | 1.21% | █▁▅ |
| 🐢 | stylis: tiny declaration compile | 3,029,685 | 2,843,703 | -6.14% | — | 3.90% | high | 0.00035 | 1.58% | 0.37% | ▂█▁ |
| 🧭 | baseline: String.raw tiny css | 6,418,751 | 6,762,589 | +5.36% | — | 3.00% | high | 0.00015 | 7.23% | 0.95% | ▁██ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 420,743 | 415,355 | -1.28% | — | 3.00% | high | 0.00241 | 0.64% | 0.27% | █▂▁ |
| 🌿 | warm atomic.css: classic atomic compile | 755,040 | 739,853 | -2.01% | — | 3.00% | high | 0.00135 | 4.34% | 0.16% | █▁█ |
| 🐢 | warm atomic.css.withImportant | 415,064 | 401,351 | -3.30% | — | 3.00% | high | 0.00249 | 1.33% | 0.55% | ▂█▁ |
| 🌿 | warm css: polymorphic atomic identity hit | 2,823,439 | 2,775,942 | -1.68% | — | 3.00% | high | 0.00036 | 1.25% | 1.01% | █▁▃ |
| 🌿 | warm css: polymorphic sheet identity hit | 1,136,483 | 1,125,442 | -0.97% | — | 3.00% | high | 0.00089 | 0.39% | 0.05% | █▁█ |
| 🌿 | warm css: prepared configure plan hit | 9,585,072 | 9,652,697 | +0.71% | — | 3.00% | high | 0.00010 | 2.53% | 0.78% | ▇█▁ |
| 🌿 | warm inline.css: inline style compile | 674,400 | 721,359 | +6.96% | — | 10.69% | medium | 0.00139 | 0.26% | 0.04% | ▇▁█ |
| 🐢 | warm sheet.css: nested sheet runtime DSL | 289,088 | 256,751 | -11.19% | — | 3.00% | high | 0.00389 | 6.38% | 2.33% | █▁▂ |
| 🐢 | warm sheet.css.withImportant | 289,200 | 276,317 | -4.45% | — | 3.00% | high | 0.00362 | 7.76% | 1.46% | █▇▁ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** -0.42%  
**Raw geometric mean:** -1.40%

### 🚀 Fastest reliable improvements

1. **reactive-class-style :: lit.html** · +6.05% normalized · high confidence
2. **conditional-component :: lit.html** · +4.21% normalized · high confidence
3. **raw-html :: lit.html** · +4.19% normalized · high confidence

### 🐢 Largest reliable regressions

1. **shared-registry-resolution :: fabrica.html** · -12.26% normalized · high confidence
2. **instance-named-render :: lit.html** · -5.93% normalized · high confidence
3. **styled-artifact-composition :: fabrica.html** · -3.71% normalized · high confidence
4. **complex-attributes :: lit.html** · -3.06% normalized · high confidence

### ⚠️ Noisy cases to rerun

1. **named-component-definition :: lit.html** · 25.00% noise floor
2. **portable-definition-install :: fabrica.html** · 25.00% noise floor
3. **two-way-bind :: lit.html** · 25.00% noise floor
4. **virtual-list-window :: fabrica.html** · 20.24% noise floor
5. **spread-props-events :: lit.html** · 18.10% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 58,521 | control |
| complex-attributes | fabrica.html | 13,289 | 22.71% of manual throughput |
| complex-attributes | lit.html | 31,495 | 53.82% of manual throughput |
| conditional-component | manual.createElement | 13,751 | control |
| conditional-component | fabrica.html | 2,285 | 16.62% of manual throughput |
| conditional-component | lit.html | 9,511 | 69.17% of manual throughput |
| forked-registry-resolution | manual.createElement | 3,326,961 | control |
| forked-registry-resolution | fabrica.html | 1,092,764 | 32.85% of manual throughput |
| forked-registry-resolution | lit.html | 24,179,257 | 726.77% of manual throughput |
| instance-named-render | manual.createElement | 149,862 | control |
| instance-named-render | fabrica.html | 12,709 | 8.48% of manual throughput |
| instance-named-render | lit.html | 81,800 | 54.58% of manual throughput |
| keyed-list-update | manual.createElement | 1,577 | control |
| keyed-list-update | fabrica.html | 173 | 10.99% of manual throughput |
| keyed-list-update | lit.html | 962 | 61.03% of manual throughput |
| named-component-definition | manual.createElement | 6,806,333 | control |
| named-component-definition | fabrica.html | 702,390 | 10.32% of manual throughput |
| named-component-definition | lit.html | 3,903,602 | 57.35% of manual throughput |
| named-instance-reuse | manual.createElement | 18,287,713 | control |
| named-instance-reuse | fabrica.html | 498,819 | 2.73% of manual throughput |
| named-instance-reuse | lit.html | 25,600,091 | 139.99% of manual throughput |
| named-styled-registry | manual.createElement | 115,265 | control |
| named-styled-registry | fabrica.html | 14,266 | 12.38% of manual throughput |
| named-styled-registry | lit.html | 79,755 | 69.19% of manual throughput |
| nested-components | manual.createElement | 16,720 | control |
| nested-components | fabrica.html | 1,580 | 9.45% of manual throughput |
| nested-components | lit.html | 8,566 | 51.23% of manual throughput |
| portable-definition-install | manual.createElement | 11,422,056 | control |
| portable-definition-install | fabrica.html | 121,677 | 1.07% of manual throughput |
| portable-definition-install | lit.html | 17,549,530 | 153.65% of manual throughput |
| portal-mount | manual.createElement | 91,799 | control |
| portal-mount | fabrica.html | 16,439 | 17.91% of manual throughput |
| portal-mount | lit.html | 37,296 | 40.63% of manual throughput |
| raw-html | manual.createElement | 28,600 | control |
| raw-html | fabrica.html | 13,385 | 46.80% of manual throughput |
| raw-html | lit.html | 20,348 | 71.15% of manual throughput |
| reactive-class-style | manual.createElement | 14,329 | control |
| reactive-class-style | fabrica.html | 6,559 | 45.78% of manual throughput |
| reactive-class-style | lit.html | 14,730 | 102.80% of manual throughput |
| reactive-text | manual.createElement | 105,227 | control |
| reactive-text | fabrica.html | 16,466 | 15.65% of manual throughput |
| reactive-text | lit.html | 26,347 | 25.04% of manual throughput |
| shared-registry-resolution | manual.createElement | 18,660,576 | control |
| shared-registry-resolution | fabrica.html | 1,410,145 | 7.56% of manual throughput |
| shared-registry-resolution | lit.html | 24,216,822 | 129.78% of manual throughput |
| spread-props-events | manual.createElement | 59,558 | control |
| spread-props-events | fabrica.html | 16,694 | 28.03% of manual throughput |
| spread-props-events | lit.html | 25,586 | 42.96% of manual throughput |
| static-tree | manual.createElement | 33,631 | control |
| static-tree | fabrica.html | 12,671 | 37.68% of manual throughput |
| static-tree | lit.html | 24,828 | 73.82% of manual throughput |
| styled-artifact-composition | manual.createElement | 268,770 | control |
| styled-artifact-composition | fabrica.html | 134,750 | 50.14% of manual throughput |
| styled-artifact-composition | lit.html | 75,493 | 28.09% of manual throughput |
| styled-artifact-render | manual.createElement | 263,401 | control |
| styled-artifact-render | fabrica.html | 178,268 | 67.68% of manual throughput |
| styled-artifact-render | lit.html | 79,494 | 30.18% of manual throughput |
| styled-component-registration | manual.createElement | 1,423,320 | control |
| styled-component-registration | fabrica.html | 242,325 | 17.03% of manual throughput |
| styled-component-registration | lit.html | 4,759,674 | 334.41% of manual throughput |
| two-way-bind | manual.createElement | 94,858 | control |
| two-way-bind | fabrica.html | 24,516 | 25.84% of manual throughput |
| two-way-bind | lit.html | 14,653 | 15.45% of manual throughput |
| virtual-list-window | manual.createElement | 4,768 | control |
| virtual-list-window | fabrica.html | 1,056 | 22.15% of manual throughput |
| virtual-list-window | lit.html | 2,202 | 46.19% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 13,289 | 13,289 | +0.00% | +1.59% | 3.00% | high | 0.07525 | 2.72% | 0.93% | ▁▇█ |
| 🐢 | complex-attributes :: lit.html | 33,006 | 31,495 | -4.58% | -3.06% | 3.00% | high | 0.03175 | 2.91% | 0.86% | ▁▂█ |
| 🧭 | complex-attributes :: manual.createElement | 59,451 | 58,521 | -1.57% | — | 3.00% | high | 0.01709 | 2.56% | 0.90% | ▂▁█ |
| 🌿 | conditional-component :: fabrica.html | 2,308 | 2,285 | -1.02% | +1.79% | 3.11% | high | 0.43766 | 1.40% | 0.86% | ▁▃█ |
| 🚀 | conditional-component :: lit.html | 9,385 | 9,511 | +1.34% | +4.21% | 3.00% | high | 0.10514 | 12.49% | 2.93% | ▇▁█ |
| 🧭 | conditional-component :: manual.createElement | 14,140 | 13,751 | -2.75% | — | 3.00% | high | 0.07272 | 0.71% | 0.72% | ▄▁█ |
| 🌿 | forked-registry-resolution :: fabrica.html | 1,085,313 | 1,092,764 | +0.69% | -4.19% | 4.26% | high | 0.00092 | 3.60% | 0.51% | █▁▁ |
| 🌿 | forked-registry-resolution :: lit.html | 23,791,340 | 24,179,257 | +1.63% | -3.29% | 4.26% | high | 0.00004 | 2.05% | 0.89% | █▇▁ |
| 🧭 | forked-registry-resolution :: manual.createElement | 3,165,907 | 3,326,961 | +5.09% | — | 4.26% | high | 0.00030 | 3.50% | 4.26% | █▁▄ |
| 🌿 | instance-named-render :: fabrica.html | 12,899 | 12,709 | -1.48% | -2.41% | 3.28% | high | 0.07869 | 0.99% | 0.53% | ▆▁█ |
| 🐢 | instance-named-render :: lit.html | 86,143 | 81,800 | -5.04% | -5.93% | 3.00% | high | 0.01222 | 0.79% | 0.13% | █▂▁ |
| 🧭 | instance-named-render :: manual.createElement | 148,454 | 149,862 | +0.95% | — | 3.00% | high | 0.00667 | 3.35% | 1.47% | █▁▇ |
| 🌿 | keyed-list-update :: fabrica.html | 172 | 173 | +0.44% | +4.28% | 11.98% | medium | 5.77166 | 1.07% | 0.68% | ▁▃█ |
| 🌿 | keyed-list-update :: lit.html | 1,009 | 962 | -4.59% | -0.94% | 3.25% | high | 1.03914 | 3.35% | 1.14% | ▂▁█ |
| 🧭 | keyed-list-update :: manual.createElement | 1,637 | 1,577 | -3.68% | — | 3.00% | high | 0.63421 | 5.05% | 0.10% | █▁█ |
| 🌿 | named-component-definition :: fabrica.html | 719,386 | 702,390 | -2.36% | -0.45% | 4.22% | high | 0.00142 | 1.58% | 1.73% | ▁█▄ |
| ⚠️ | named-component-definition :: lit.html | 4,669,405 | 3,903,602 | -16.40% | -14.77% | 25.00% | low | 0.00026 | 6.75% | 3.03% | ▂█▁ |
| 🧭 | named-component-definition :: manual.createElement | 6,939,368 | 6,806,333 | -1.92% | — | 3.00% | high | 0.00015 | 0.83% | 0.03% | █▁█ |
| 🌿 | named-instance-reuse :: fabrica.html | 508,676 | 498,819 | -1.94% | -0.73% | 3.00% | high | 0.00200 | 2.25% | 1.38% | ▃█▁ |
| 🌿 | named-instance-reuse :: lit.html | 25,311,438 | 25,600,091 | +1.14% | +2.39% | 3.00% | high | 0.00004 | 2.21% | 0.74% | ▁▇█ |
| 🧭 | named-instance-reuse :: manual.createElement | 18,513,740 | 18,287,713 | -1.22% | — | 3.00% | high | 0.00005 | 5.04% | 0.49% | ▁██ |
| ⚠️ | named-styled-registry :: fabrica.html | 14,389 | 14,266 | -0.86% | -21.55% | 16.88% | low | 0.07010 | 12.36% | 1.02% | ██▁ |
| ⚠️ | named-styled-registry :: lit.html | 78,640 | 79,755 | +1.42% | -19.75% | 16.78% | low | 0.01254 | 1.14% | 0.84% | █▁▆ |
| 🧭 | named-styled-registry :: manual.createElement | 91,204 | 115,265 | +26.38% | — | 16.68% | low | 0.00868 | 20.34% | 1.02% | ██▁ |
| 🌿 | nested-components :: fabrica.html | 1,605 | 1,580 | -1.57% | -6.85% | 15.89% | medium | 0.63285 | 2.75% | 0.30% | ▁▁█ |
| 🌿 | nested-components :: lit.html | 8,649 | 8,566 | -0.96% | -6.27% | 7.01% | medium | 0.11674 | 1.18% | 1.16% | █▅▁ |
| 🧭 | nested-components :: manual.createElement | 15,822 | 16,720 | +5.67% | — | 7.01% | medium | 0.05981 | 1.21% | 1.01% | ▆▁█ |
| ⚠️ | portable-definition-install :: fabrica.html | 120,555 | 121,677 | +0.93% | +0.87% | 25.00% | low | 0.00822 | 9.44% | 1.43% | ▁█▁ |
| 🌿 | portable-definition-install :: lit.html | 17,172,501 | 17,549,530 | +2.20% | +2.14% | 4.28% | high | 0.00006 | 1.46% | 1.55% | █▁▄ |
| 🧭 | portable-definition-install :: manual.createElement | 11,415,808 | 11,422,056 | +0.05% | — | 3.49% | high | 0.00009 | 4.61% | 2.10% | ▇▁█ |
| 🌿 | portal-mount :: fabrica.html | 17,573 | 16,439 | -6.45% | -2.01% | 9.26% | medium | 0.06083 | 1.67% | 1.77% | █▁▄ |
| 🌿 | portal-mount :: lit.html | 39,775 | 37,296 | -6.23% | -1.78% | 3.00% | high | 0.02681 | 1.54% | 1.08% | █▆▁ |
| 🧭 | portal-mount :: manual.createElement | 96,156 | 91,799 | -4.53% | — | 3.00% | high | 0.01089 | 10.31% | 2.76% | █▇▁ |
| 🌿 | raw-html :: fabrica.html | 14,052 | 13,385 | -4.75% | +0.98% | 3.19% | high | 0.07471 | 1.71% | 2.00% | ▁▄█ |
| 🚀 | raw-html :: lit.html | 20,703 | 20,348 | -1.72% | +4.19% | 3.00% | high | 0.04915 | 1.14% | 0.96% | ▁█▆ |
| 🧭 | raw-html :: manual.createElement | 30,318 | 28,600 | -5.67% | — | 3.00% | high | 0.03497 | 1.41% | 0.13% | ▁█▁ |
| 🌿 | reactive-class-style :: fabrica.html | 6,483 | 6,559 | +1.17% | +3.84% | 5.23% | high | 0.15246 | 0.86% | 0.94% | ▄▁█ |
| 🚀 | reactive-class-style :: lit.html | 14,256 | 14,730 | +3.32% | +6.05% | 3.00% | high | 0.06789 | 1.72% | 0.01% | █▁█ |
| 🧭 | reactive-class-style :: manual.createElement | 14,707 | 14,329 | -2.57% | — | 3.00% | high | 0.06979 | 1.01% | 0.21% | ▁▂█ |
| 🌿 | reactive-text :: fabrica.html | 16,507 | 16,466 | -0.25% | +3.13% | 10.60% | medium | 0.06073 | 1.58% | 1.34% | ▆▁█ |
| 🌿 | reactive-text :: lit.html | 26,503 | 26,347 | -0.59% | +2.78% | 12.73% | medium | 0.03795 | 1.80% | 1.36% | ▁▃█ |
| 🧭 | reactive-text :: manual.createElement | 108,794 | 105,227 | -3.28% | — | 3.00% | high | 0.00950 | 1.63% | 0.09% | ▁▁█ |
| 🐢 | shared-registry-resolution :: fabrica.html | 1,591,393 | 1,410,145 | -11.39% | -12.26% | 4.82% | high | 0.00071 | 10.23% | 4.31% | █▁▂ |
| 🌿 | shared-registry-resolution :: lit.html | 24,205,315 | 24,216,822 | +0.05% | -0.93% | 5.21% | medium | 0.00004 | 5.92% | 5.21% | ▅▁█ |
| 🧭 | shared-registry-resolution :: manual.createElement | 18,477,580 | 18,660,576 | +0.99% | — | 3.00% | high | 0.00005 | 1.76% | 0.61% | ▁█▇ |
| 🌿 | spread-props-events :: fabrica.html | 16,998 | 16,694 | -1.79% | -0.35% | 12.50% | medium | 0.05990 | 1.94% | 0.52% | ▁▂█ |
| ⚠️ | spread-props-events :: lit.html | 24,518 | 25,586 | +4.36% | +5.88% | 18.10% | low | 0.03908 | 2.45% | 1.78% | ▁▆█ |
| 🧭 | spread-props-events :: manual.createElement | 60,429 | 59,558 | -1.44% | — | 3.04% | high | 0.01679 | 0.15% | 0.03% | ▁▂█ |
| 🌿 | static-tree :: fabrica.html | 12,861 | 12,671 | -1.48% | -0.12% | 3.00% | high | 0.07892 | 1.11% | 0.82% | ▃▁█ |
| 🌿 | static-tree :: lit.html | 24,603 | 24,828 | +0.91% | +2.30% | 4.32% | high | 0.04028 | 2.58% | 0.72% | █▇▁ |
| 🧭 | static-tree :: manual.createElement | 34,093 | 33,631 | -1.35% | — | 3.00% | high | 0.02973 | 1.13% | 0.00% | █▁█ |
| 🐢 | styled-artifact-composition :: fabrica.html | 138,736 | 134,750 | -2.87% | -3.71% | 3.00% | high | 0.00742 | 2.35% | 0.37% | ▁▁█ |
| 🌿 | styled-artifact-composition :: lit.html | 75,836 | 75,493 | -0.45% | -1.31% | 3.08% | high | 0.01325 | 1.21% | 0.17% | █▁█ |
| 🧭 | styled-artifact-composition :: manual.createElement | 266,463 | 268,770 | +0.87% | — | 3.00% | high | 0.00372 | 0.24% | 0.16% | █▁▆ |
| 🌿 | styled-artifact-render :: fabrica.html | 183,900 | 178,268 | -3.06% | -1.26% | 3.14% | high | 0.00561 | 2.55% | 1.20% | █▁▂ |
| 🌿 | styled-artifact-render :: lit.html | 79,830 | 79,494 | -0.42% | +1.43% | 3.13% | high | 0.01258 | 4.31% | 1.43% | █▇▁ |
| 🧭 | styled-artifact-render :: manual.createElement | 268,297 | 263,401 | -1.82% | — | 3.00% | high | 0.00380 | 1.39% | 0.06% | █▁▁ |
| 🌿 | styled-component-registration :: fabrica.html | 229,402 | 242,325 | +5.63% | +4.29% | 16.86% | medium | 0.00413 | 3.91% | 1.85% | █▇▁ |
| 🌿 | styled-component-registration :: lit.html | 4,701,172 | 4,759,674 | +1.24% | -0.04% | 4.14% | high | 0.00021 | 0.63% | 0.58% | █▁▄ |
| 🧭 | styled-component-registration :: manual.createElement | 1,405,235 | 1,423,320 | +1.29% | — | 4.14% | high | 0.00070 | 6.78% | 4.14% | █▆▁ |
| 🌿 | two-way-bind :: fabrica.html | 25,209 | 24,516 | -2.75% | +1.34% | 17.07% | medium | 0.04079 | 8.13% | 4.08% | █▁▆ |
| ⚠️ | two-way-bind :: lit.html | 31,419 | 14,653 | -53.36% | -51.40% | 25.00% | low | 0.06825 | 44.05% | 4.62% | ▁▁█ |
| 🧭 | two-way-bind :: manual.createElement | 98,850 | 94,858 | -4.04% | — | 13.18% | medium | 0.01054 | 1.51% | 1.83% | █▁▅ |
| ⚠️ | virtual-list-window :: fabrica.html | 1,051 | 1,056 | +0.52% | +0.78% | 20.24% | low | 0.94691 | 0.45% | 0.48% | ▅█▁ |
| 🌿 | virtual-list-window :: lit.html | 2,247 | 2,202 | -2.02% | -1.77% | 3.10% | high | 0.45412 | 1.48% | 0.66% | ▂▁█ |
| 🧭 | virtual-list-window :: manual.createElement | 4,780 | 4,768 | -0.25% | — | 3.00% | high | 0.20975 | 1.92% | 0.94% | ▇▁█ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
