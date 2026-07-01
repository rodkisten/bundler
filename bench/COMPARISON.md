<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `9859b62b` · baseline `b4cee19d` · generated 2026-07-01T20:33:21.985Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000005160 · Linux · X64 |
| CPU | AMD EPYC 9V74 80-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.17.0 · V8 13.6.233.17-node.49 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.13 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.22% | +0.22% | 1 | 0 | 18 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 -0.34% | -0.49% | 1 | 4 | 34 | 5 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** +0.22%  
**Raw geometric mean:** +0.22%

### 🚀 Fastest reliable improvements

1. **stylis: tiny declaration compile** · +6.84% raw · high confidence

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 193,197 | 196,128 | +1.52% | — | 3.00% | high | 0.00510 | 0.74% | 0.10% | ██▁ |
| 🌿 | class name: privacy redaction and truncation | 151,217 | 151,296 | +0.05% | — | 3.00% | high | 0.00661 | 0.17% | 0.15% | ▅█▁ |
| 🌿 | class name: readable property-value-context-hash | 194,823 | 195,877 | +0.54% | — | 3.00% | high | 0.00511 | 0.77% | 0.34% | █▇▁ |
| 🌿 | cold atomic.css: transform parse compile | 2,398 | 2,347 | -2.15% | — | 3.60% | high | 0.42611 | 1.21% | 1.28% | █▁▄ |
| 🌿 | cold css: atomic detection + compile | 2,477 | 2,463 | -0.54% | — | 3.33% | high | 0.40594 | 0.83% | 0.25% | ▂█▁ |
| 🌿 | cold css: configure parse + normalized apply | 14,581 | 14,270 | -2.13% | — | 5.79% | high | 0.07008 | 1.05% | 0.25% | █▁▂ |
| 🌿 | cold css: sheet detection + compile | 2,750 | 2,782 | +1.16% | — | 3.00% | high | 0.35951 | 1.42% | 0.71% | ▆█▁ |
| 🌿 | cold sheet.css: transform parse compile | 2,789 | 2,774 | -0.56% | — | 3.19% | high | 0.36055 | 2.00% | 0.37% | ▇█▁ |
| 🌿 | stylis: nested stylesheet compile | 80,504 | 80,627 | +0.15% | — | 3.00% | high | 0.01240 | 0.42% | 0.12% | ▂█▁ |
| 🚀 | stylis: tiny declaration compile | 1,609,975 | 1,720,075 | +6.84% | — | 3.00% | high | 0.00058 | 1.29% | 1.44% | ▁█▅ |
| 🧭 | baseline: String.raw tiny css | 3,561,847 | 3,559,623 | -0.06% | — | 3.00% | high | 0.00028 | 0.45% | 0.11% | ▂▁█ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 237,629 | 231,784 | -2.46% | — | 3.63% | high | 0.00431 | 1.03% | 0.37% | ▂▁█ |
| 🌿 | warm atomic.css: classic atomic compile | 414,119 | 418,670 | +1.10% | — | 3.00% | high | 0.00239 | 0.43% | 0.31% | █▁▆ |
| 🌿 | warm atomic.css.withImportant | 240,341 | 239,610 | -0.30% | — | 3.00% | high | 0.00417 | 0.29% | 0.24% | ▁▃█ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,440,614 | 1,473,575 | +2.29% | — | 3.00% | high | 0.00068 | 1.83% | 0.96% | ▁▆█ |
| 🌿 | warm css: polymorphic sheet identity hit | 663,712 | 660,418 | -0.50% | — | 3.00% | high | 0.00151 | 1.84% | 0.43% | ▁█▇ |
| 🌿 | warm css: prepared configure plan hit | 4,572,133 | 4,563,805 | -0.18% | — | 3.00% | high | 0.00022 | 2.04% | 1.41% | ▁▃█ |
| 🌿 | warm inline.css: inline style compile | 415,759 | 415,942 | +0.04% | — | 3.00% | high | 0.00240 | 0.81% | 0.28% | ▂▁█ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 159,635 | 159,527 | -0.07% | — | 3.00% | high | 0.00627 | 0.27% | 0.30% | █▁▅ |
| 🌿 | warm sheet.css.withImportant | 159,739 | 159,319 | -0.26% | — | 3.00% | high | 0.00628 | 0.28% | 0.05% | ▇▁█ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** -0.34%  
**Raw geometric mean:** -0.49%

### 🚀 Fastest reliable improvements

1. **forked-registry-resolution :: lit.html** · +3.27% normalized · high confidence

### 🐢 Largest reliable regressions

1. **static-tree :: lit.html** · -4.26% normalized · high confidence
2. **styled-component-registration :: lit.html** · -3.96% normalized · high confidence
3. **portable-definition-install :: lit.html** · -3.72% normalized · high confidence
4. **static-tree :: fabrica.html** · -3.05% normalized · high confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 25.00% noise floor
3. **virtual-list-window :: fabrica.html** · 19.15% noise floor
4. **nested-components :: fabrica.html** · 17.00% noise floor
5. **spread-props-events :: lit.html** · 16.79% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 31,611 | control |
| complex-attributes | fabrica.html | 7,889 | 24.96% of manual throughput |
| complex-attributes | lit.html | 15,826 | 50.06% of manual throughput |
| conditional-component | manual.createElement | 7,895 | control |
| conditional-component | fabrica.html | 1,275 | 16.15% of manual throughput |
| conditional-component | lit.html | 5,368 | 67.99% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,733,589 | control |
| forked-registry-resolution | fabrica.html | 702,173 | 40.50% of manual throughput |
| forked-registry-resolution | lit.html | 13,644,676 | 787.08% of manual throughput |
| instance-named-render | manual.createElement | 84,006 | control |
| instance-named-render | fabrica.html | 10,935 | 13.02% of manual throughput |
| instance-named-render | lit.html | 48,215 | 57.39% of manual throughput |
| keyed-list-update | manual.createElement | 882 | control |
| keyed-list-update | fabrica.html | 124 | 14.09% of manual throughput |
| keyed-list-update | lit.html | 550 | 62.38% of manual throughput |
| named-component-definition | manual.createElement | 3,597,375 | control |
| named-component-definition | fabrica.html | 392,607 | 10.91% of manual throughput |
| named-component-definition | lit.html | 3,828,893 | 106.44% of manual throughput |
| named-instance-reuse | manual.createElement | 10,539,153 | control |
| named-instance-reuse | fabrica.html | 303,404 | 2.88% of manual throughput |
| named-instance-reuse | lit.html | 14,420,833 | 136.83% of manual throughput |
| named-styled-registry | manual.createElement | 66,139 | control |
| named-styled-registry | fabrica.html | 12,813 | 19.37% of manual throughput |
| named-styled-registry | lit.html | 44,777 | 67.70% of manual throughput |
| nested-components | manual.createElement | 9,555 | control |
| nested-components | fabrica.html | 1,202 | 12.58% of manual throughput |
| nested-components | lit.html | 4,726 | 49.46% of manual throughput |
| portable-definition-install | manual.createElement | 6,683,705 | control |
| portable-definition-install | fabrica.html | 133,165 | 1.99% of manual throughput |
| portable-definition-install | lit.html | 9,441,140 | 141.26% of manual throughput |
| portal-mount | manual.createElement | 53,643 | control |
| portal-mount | fabrica.html | 12,970 | 24.18% of manual throughput |
| portal-mount | lit.html | 21,963 | 40.94% of manual throughput |
| raw-html | manual.createElement | 16,722 | control |
| raw-html | fabrica.html | 16,025 | 95.83% of manual throughput |
| raw-html | lit.html | 10,628 | 63.56% of manual throughput |
| reactive-class-style | manual.createElement | 7,908 | control |
| reactive-class-style | fabrica.html | 3,673 | 46.44% of manual throughput |
| reactive-class-style | lit.html | 7,938 | 100.38% of manual throughput |
| reactive-text | manual.createElement | 60,353 | control |
| reactive-text | fabrica.html | 13,605 | 22.54% of manual throughput |
| reactive-text | lit.html | 14,935 | 24.75% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,595,983 | control |
| shared-registry-resolution | fabrica.html | 1,150,218 | 10.86% of manual throughput |
| shared-registry-resolution | lit.html | 14,835,878 | 140.01% of manual throughput |
| spread-props-events | manual.createElement | 31,327 | control |
| spread-props-events | fabrica.html | 11,288 | 36.03% of manual throughput |
| spread-props-events | lit.html | 13,422 | 42.84% of manual throughput |
| static-tree | manual.createElement | 16,800 | control |
| static-tree | fabrica.html | 13,386 | 79.68% of manual throughput |
| static-tree | lit.html | 13,948 | 83.02% of manual throughput |
| styled-artifact-composition | manual.createElement | 154,319 | control |
| styled-artifact-composition | fabrica.html | 78,311 | 50.75% of manual throughput |
| styled-artifact-composition | lit.html | 42,345 | 27.44% of manual throughput |
| styled-artifact-render | manual.createElement | 153,696 | control |
| styled-artifact-render | fabrica.html | 104,451 | 67.96% of manual throughput |
| styled-artifact-render | lit.html | 45,217 | 29.42% of manual throughput |
| styled-component-registration | manual.createElement | 822,381 | control |
| styled-component-registration | fabrica.html | 133,822 | 16.27% of manual throughput |
| styled-component-registration | lit.html | 2,523,429 | 306.84% of manual throughput |
| two-way-bind | manual.createElement | 55,391 | control |
| two-way-bind | fabrica.html | 19,206 | 34.67% of manual throughput |
| two-way-bind | lit.html | 19,432 | 35.08% of manual throughput |
| virtual-list-window | manual.createElement | 2,617 | control |
| virtual-list-window | fabrica.html | 752 | 28.73% of manual throughput |
| virtual-list-window | lit.html | 1,264 | 48.30% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 8,186 | 7,889 | -3.63% | -2.53% | 10.39% | medium | 0.12676 | 1.39% | 0.66% | ▇█▁ |
| 🌿 | complex-attributes :: lit.html | 16,187 | 15,826 | -2.23% | -1.12% | 3.00% | high | 0.06319 | 1.84% | 0.88% | ▁█▂ |
| 🧭 | complex-attributes :: manual.createElement | 31,972 | 31,611 | -1.13% | — | 3.00% | high | 0.03163 | 1.04% | 0.56% | ▁█▃ |
| 🌿 | conditional-component :: fabrica.html | 1,280 | 1,275 | -0.40% | +0.28% | 10.15% | medium | 0.78445 | 0.41% | 0.33% | █▃▁ |
| 🌿 | conditional-component :: lit.html | 5,414 | 5,368 | -0.84% | -0.17% | 3.00% | high | 0.18628 | 0.17% | 0.08% | ▇█▁ |
| 🧭 | conditional-component :: manual.createElement | 7,949 | 7,895 | -0.68% | — | 3.00% | high | 0.12666 | 1.22% | 0.65% | █▆▁ |
| 🌿 | forked-registry-resolution :: fabrica.html | 727,753 | 702,173 | -3.51% | -0.49% | 3.00% | high | 0.00142 | 1.61% | 0.64% | █▇▁ |
| 🚀 | forked-registry-resolution :: lit.html | 13,627,089 | 13,644,676 | +0.13% | +3.27% | 3.00% | high | 0.00007 | 1.09% | 1.30% | █▁▄ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,787,968 | 1,733,589 | -3.04% | — | 3.00% | high | 0.00058 | 1.02% | 0.69% | ▆▁█ |
| 🌿 | instance-named-render :: fabrica.html | 11,101 | 10,935 | -1.50% | -0.58% | 8.24% | medium | 0.09145 | 1.28% | 1.22% | ▄▁█ |
| 🌿 | instance-named-render :: lit.html | 48,495 | 48,215 | -0.58% | +0.35% | 3.00% | high | 0.02074 | 0.67% | 0.69% | ▁█▅ |
| 🧭 | instance-named-render :: manual.createElement | 84,789 | 84,006 | -0.92% | — | 3.00% | high | 0.01190 | 0.89% | 0.01% | ▁█▁ |
| 🌿 | keyed-list-update :: fabrica.html | 127 | 124 | -2.44% | -2.23% | 12.75% | medium | 8.04171 | 1.87% | 0.11% | ▁██ |
| 🌿 | keyed-list-update :: lit.html | 544 | 550 | +1.18% | +1.39% | 3.76% | high | 1.81661 | 0.35% | 0.41% | ▁█▄ |
| 🧭 | keyed-list-update :: manual.createElement | 884 | 882 | -0.21% | — | 3.00% | high | 1.13316 | 1.31% | 1.53% | ▁█▅ |
| 🌿 | named-component-definition :: fabrica.html | 389,610 | 392,607 | +0.77% | +1.52% | 3.83% | high | 0.00255 | 0.62% | 0.28% | █▁▇ |
| 🌿 | named-component-definition :: lit.html | 3,821,834 | 3,828,893 | +0.18% | +0.93% | 3.83% | high | 0.00026 | 1.37% | 0.19% | ██▁ |
| 🧭 | named-component-definition :: manual.createElement | 3,624,126 | 3,597,375 | -0.74% | — | 3.83% | high | 0.00028 | 2.02% | 0.09% | ▁█▁ |
| 🌿 | named-instance-reuse :: fabrica.html | 305,507 | 303,404 | -0.69% | +0.08% | 3.00% | high | 0.00330 | 2.07% | 0.69% | ▇▁█ |
| 🌿 | named-instance-reuse :: lit.html | 14,277,888 | 14,420,833 | +1.00% | +1.78% | 3.00% | high | 0.00007 | 1.42% | 0.54% | █▁▂ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,620,404 | 10,539,153 | -0.77% | — | 3.00% | high | 0.00009 | 1.66% | 0.94% | █▁▃ |
| 🌿 | named-styled-registry :: fabrica.html | 13,331 | 12,813 | -3.88% | -4.40% | 4.96% | high | 0.07805 | 34.28% | 3.27% | ██▁ |
| 🌿 | named-styled-registry :: lit.html | 44,965 | 44,777 | -0.42% | -0.95% | 3.00% | high | 0.02233 | 0.46% | 0.42% | ▁▅█ |
| 🧭 | named-styled-registry :: manual.createElement | 65,786 | 66,139 | +0.54% | — | 3.00% | high | 0.01512 | 0.22% | 0.26% | █▄▁ |
| ⚠️ | nested-components :: fabrica.html | 1,201 | 1,202 | +0.06% | -0.02% | 17.00% | low | 0.83188 | 0.32% | 0.04% | █▁█ |
| 🌿 | nested-components :: lit.html | 4,699 | 4,726 | +0.57% | +0.50% | 3.00% | high | 0.21160 | 1.24% | 0.95% | █▁▆ |
| 🧭 | nested-components :: manual.createElement | 9,548 | 9,555 | +0.07% | — | 3.00% | high | 0.10466 | 0.87% | 0.01% | ██▁ |
| ⚠️ | portable-definition-install :: fabrica.html | 132,039 | 133,165 | +0.85% | +1.03% | 25.00% | low | 0.00751 | 5.36% | 1.46% | ▂█▁ |
| 🐢 | portable-definition-install :: lit.html | 9,822,811 | 9,441,140 | -3.89% | -3.72% | 3.00% | high | 0.00011 | 2.63% | 2.38% | █▁▄ |
| 🧭 | portable-definition-install :: manual.createElement | 6,695,240 | 6,683,705 | -0.17% | — | 3.00% | high | 0.00015 | 0.56% | 0.39% | ▆█▁ |
| 🌿 | portal-mount :: fabrica.html | 13,129 | 12,970 | -1.21% | -1.40% | 10.10% | medium | 0.07710 | 0.95% | 0.48% | ▁█▃ |
| 🌿 | portal-mount :: lit.html | 21,946 | 21,963 | +0.08% | -0.11% | 3.00% | high | 0.04553 | 0.38% | 0.46% | ▁▄█ |
| 🧭 | portal-mount :: manual.createElement | 53,541 | 53,643 | +0.19% | — | 3.00% | high | 0.01864 | 1.42% | 1.30% | ▅█▁ |
| 🌿 | raw-html :: fabrica.html | 15,861 | 16,025 | +1.04% | +2.31% | 5.52% | high | 0.06240 | 1.32% | 0.68% | ▁█▆ |
| 🌿 | raw-html :: lit.html | 10,719 | 10,628 | -0.85% | +0.40% | 3.00% | high | 0.09409 | 0.58% | 0.35% | ▃█▁ |
| 🧭 | raw-html :: manual.createElement | 16,932 | 16,722 | -1.24% | — | 3.00% | high | 0.05980 | 1.28% | 1.43% | ▁▅█ |
| 🌿 | reactive-class-style :: fabrica.html | 3,710 | 3,673 | -1.00% | -2.02% | 6.21% | high | 0.27226 | 1.16% | 0.76% | ▆█▁ |
| 🌿 | reactive-class-style :: lit.html | 7,876 | 7,938 | +0.79% | -0.25% | 3.00% | high | 0.12597 | 0.97% | 0.41% | ▁▇█ |
| 🧭 | reactive-class-style :: manual.createElement | 7,826 | 7,908 | +1.04% | — | 3.00% | high | 0.12645 | 0.40% | 0.46% | █▅▁ |
| 🌿 | reactive-text :: fabrica.html | 13,539 | 13,605 | +0.49% | +0.96% | 12.28% | medium | 0.07350 | 0.57% | 0.01% | ██▁ |
| 🌿 | reactive-text :: lit.html | 15,024 | 14,935 | -0.60% | -0.13% | 10.13% | medium | 0.06696 | 0.66% | 0.69% | ▄█▁ |
| 🧭 | reactive-text :: manual.createElement | 60,634 | 60,353 | -0.46% | — | 3.00% | high | 0.01657 | 0.49% | 0.28% | ▁█▃ |
| 🌿 | shared-registry-resolution :: fabrica.html | 1,164,922 | 1,150,218 | -1.26% | -2.00% | 3.00% | high | 0.00087 | 3.82% | 1.37% | ▇█▁ |
| 🌿 | shared-registry-resolution :: lit.html | 14,834,575 | 14,835,878 | +0.01% | -0.73% | 3.00% | high | 0.00007 | 1.36% | 1.62% | █▁▅ |
| 🧭 | shared-registry-resolution :: manual.createElement | 10,517,241 | 10,595,983 | +0.75% | — | 3.00% | high | 0.00009 | 1.10% | 0.59% | ▁█▃ |
| 🌿 | spread-props-events :: fabrica.html | 11,040 | 11,288 | +2.25% | +3.49% | 14.25% | medium | 0.08859 | 2.37% | 1.90% | ▁█▆ |
| ⚠️ | spread-props-events :: lit.html | 13,970 | 13,422 | -3.92% | -2.75% | 16.79% | low | 0.07451 | 1.09% | 0.62% | ▃█▁ |
| 🧭 | spread-props-events :: manual.createElement | 31,708 | 31,327 | -1.20% | — | 3.02% | high | 0.03192 | 0.75% | 0.50% | █▁▃ |
| 🐢 | static-tree :: fabrica.html | 13,312 | 13,386 | +0.56% | -3.05% | 3.00% | high | 0.07470 | 0.50% | 0.42% | ▆▁█ |
| 🐢 | static-tree :: lit.html | 14,046 | 13,948 | -0.70% | -4.26% | 3.00% | high | 0.07170 | 1.32% | 0.88% | ▁█▃ |
| 🧭 | static-tree :: manual.createElement | 16,196 | 16,800 | +3.72% | — | 3.00% | high | 0.05953 | 2.36% | 0.79% | █▇▁ |
| 🌿 | styled-artifact-composition :: fabrica.html | 77,499 | 78,311 | +1.05% | +0.68% | 3.00% | high | 0.01277 | 0.54% | 0.18% | ▁█▂ |
| 🌿 | styled-artifact-composition :: lit.html | 42,432 | 42,345 | -0.21% | -0.57% | 3.00% | high | 0.02362 | 0.71% | 0.48% | ▁▃█ |
| 🧭 | styled-artifact-composition :: manual.createElement | 153,759 | 154,319 | +0.36% | — | 3.00% | high | 0.00648 | 0.18% | 0.21% | ▄█▁ |
| 🌿 | styled-artifact-render :: fabrica.html | 104,306 | 104,451 | +0.14% | +1.24% | 3.00% | high | 0.00957 | 0.83% | 0.92% | ▁█▄ |
| 🌿 | styled-artifact-render :: lit.html | 45,334 | 45,217 | -0.26% | +0.84% | 3.00% | high | 0.02212 | 0.73% | 0.64% | ▁▅█ |
| 🧭 | styled-artifact-render :: manual.createElement | 155,388 | 153,696 | -1.09% | — | 3.00% | high | 0.00651 | 0.37% | 0.23% | ▃█▁ |
| ⚠️ | styled-component-registration :: fabrica.html | 63,519 | 133,822 | +110.68% | +108.09% | 25.00% | low | 0.00747 | 31.90% | 1.16% | ▁██ |
| 🐢 | styled-component-registration :: lit.html | 2,595,083 | 2,523,429 | -2.76% | -3.96% | 3.15% | high | 0.00040 | 14.13% | 3.00% | ▇█▁ |
| 🧭 | styled-component-registration :: manual.createElement | 812,262 | 822,381 | +1.25% | — | 3.00% | high | 0.00122 | 21.43% | 2.09% | █▁█ |
| 🌿 | two-way-bind :: fabrica.html | 18,623 | 19,206 | +3.13% | +1.75% | 20.03% | medium | 0.05207 | 2.04% | 0.75% | ▂▁█ |
| 🌿 | two-way-bind :: lit.html | 19,269 | 19,432 | +0.85% | -0.50% | 20.03% | medium | 0.05146 | 3.06% | 0.95% | ▁▇█ |
| 🧭 | two-way-bind :: manual.createElement | 54,653 | 55,391 | +1.35% | — | 13.56% | medium | 0.01805 | 1.49% | 1.57% | ▅█▁ |
| ⚠️ | virtual-list-window :: fabrica.html | 772 | 752 | -2.57% | -1.94% | 19.15% | low | 1.32971 | 0.24% | 0.28% | ▁█▄ |
| 🌿 | virtual-list-window :: lit.html | 1,263 | 1,264 | +0.07% | +0.72% | 3.00% | high | 0.79108 | 0.43% | 0.41% | ▁▄█ |
| 🧭 | virtual-list-window :: manual.createElement | 2,634 | 2,617 | -0.65% | — | 3.00% | high | 0.38207 | 1.01% | 1.14% | ▄█▁ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
