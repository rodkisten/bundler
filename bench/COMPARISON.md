<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `907ba7e2` · baseline `9b9092da` · generated 2026-07-02T13:44:51.882Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000005218 · Linux · X64 |
| CPU | AMD EPYC 7763 64-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.17.0 · V8 13.6.233.17-node.49 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.62 GB total · 14.13 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.23% | +0.23% | 0 | 0 | 19 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 +0.00% | +0.07% | 1 | 1 | 39 | 3 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** +0.23%  
**Raw geometric mean:** +0.23%

### 🚀 Fastest reliable improvements

_None outside the reliability threshold._

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 187,166 | 187,786 | +0.33% | — | 3.00% | high | 0.00533 | 0.54% | 0.05% | ▁██ |
| 🌿 | class name: privacy redaction and truncation | 141,859 | 145,521 | +2.58% | — | 3.00% | high | 0.00687 | 0.65% | 0.75% | ▁▅█ |
| 🌿 | class name: readable property-value-context-hash | 187,384 | 188,584 | +0.64% | — | 3.00% | high | 0.00530 | 0.41% | 0.22% | ▁█▆ |
| 🌿 | cold atomic.css: transform parse compile | 2,116 | 2,112 | -0.22% | — | 3.94% | high | 0.47351 | 0.79% | 0.83% | ▅█▁ |
| 🌿 | cold css: atomic detection + compile | 2,227 | 2,245 | +0.81% | — | 3.46% | high | 0.44550 | 0.26% | 0.29% | █▁▅ |
| 🌿 | cold css: configure parse + normalized apply | 11,297 | 11,209 | -0.77% | — | 5.31% | high | 0.08921 | 0.23% | 0.14% | ▆▁█ |
| 🌿 | cold css: sheet detection + compile | 2,458 | 2,485 | +1.12% | — | 3.23% | high | 0.40238 | 0.91% | 0.86% | ▁▅█ |
| 🌿 | cold sheet.css: transform parse compile | 2,456 | 2,485 | +1.18% | — | 3.22% | high | 0.40236 | 0.80% | 0.12% | █▁▁ |
| 🌿 | stylis: nested stylesheet compile | 75,893 | 76,855 | +1.27% | — | 3.00% | high | 0.01301 | 0.79% | 0.74% | █▁▄ |
| 🌿 | stylis: tiny declaration compile | 1,509,598 | 1,507,066 | -0.17% | — | 3.00% | high | 0.00066 | 0.61% | 0.51% | █▁▃ |
| 🧭 | baseline: String.raw tiny css | 3,151,357 | 3,128,592 | -0.72% | — | 3.00% | high | 0.00032 | 1.11% | 1.07% | █▄▁ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 241,751 | 238,858 | -1.20% | — | 3.00% | high | 0.00419 | 1.37% | 0.05% | ▁▁█ |
| 🌿 | warm atomic.css: classic atomic compile | 412,189 | 412,124 | -0.02% | — | 3.00% | high | 0.00243 | 1.39% | 1.69% | ▁▅█ |
| 🌿 | warm atomic.css.withImportant | 242,531 | 242,424 | -0.04% | — | 3.00% | high | 0.00413 | 0.46% | 0.11% | ▂▁█ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,428,873 | 1,417,867 | -0.77% | — | 3.00% | high | 0.00071 | 0.11% | 0.08% | ▃█▁ |
| 🌿 | warm css: polymorphic sheet identity hit | 686,141 | 688,303 | +0.32% | — | 3.00% | high | 0.00145 | 1.23% | 0.50% | █▇▁ |
| 🌿 | warm css: prepared configure plan hit | 4,581,601 | 4,577,444 | -0.09% | — | 5.11% | medium | 0.00022 | 4.17% | 5.11% | ▁█▄ |
| 🌿 | warm inline.css: inline style compile | 414,635 | 411,386 | -0.78% | — | 3.00% | high | 0.00243 | 0.51% | 0.03% | ▁▁█ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 163,128 | 162,617 | -0.31% | — | 3.00% | high | 0.00615 | 0.97% | 0.29% | █▇▁ |
| 🌿 | warm sheet.css.withImportant | 162,045 | 163,009 | +0.59% | — | 3.00% | high | 0.00613 | 0.60% | 0.42% | ▁▆█ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** +0.00%  
**Raw geometric mean:** +0.07%

### 🚀 Fastest reliable improvements

1. **forked-registry-resolution :: fabrica.html** · +4.85% normalized · high confidence

### 🐢 Largest reliable regressions

1. **named-instance-reuse :: fabrica.html** · -3.82% normalized · high confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 19.74% noise floor
3. **virtual-list-window :: fabrica.html** · 19.30% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 23,431 | control |
| complex-attributes | fabrica.html | 5,722 | 24.42% of manual throughput |
| complex-attributes | lit.html | 11,793 | 50.33% of manual throughput |
| conditional-component | manual.createElement | 7,400 | control |
| conditional-component | fabrica.html | 1,038 | 14.02% of manual throughput |
| conditional-component | lit.html | 4,839 | 65.40% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,781,897 | control |
| forked-registry-resolution | fabrica.html | 738,578 | 41.45% of manual throughput |
| forked-registry-resolution | lit.html | 13,722,101 | 770.08% of manual throughput |
| instance-named-render | manual.createElement | 79,589 | control |
| instance-named-render | fabrica.html | 8,798 | 11.05% of manual throughput |
| instance-named-render | lit.html | 42,452 | 53.34% of manual throughput |
| keyed-list-update | manual.createElement | 841 | control |
| keyed-list-update | fabrica.html | 107 | 12.77% of manual throughput |
| keyed-list-update | lit.html | 491 | 58.40% of manual throughput |
| named-component-definition | manual.createElement | 3,779,296 | control |
| named-component-definition | fabrica.html | 391,045 | 10.35% of manual throughput |
| named-component-definition | lit.html | 3,551,158 | 93.96% of manual throughput |
| named-instance-reuse | manual.createElement | 10,817,852 | control |
| named-instance-reuse | fabrica.html | 311,520 | 2.88% of manual throughput |
| named-instance-reuse | lit.html | 14,538,458 | 134.39% of manual throughput |
| named-styled-registry | manual.createElement | 60,144 | control |
| named-styled-registry | fabrica.html | 10,002 | 16.63% of manual throughput |
| named-styled-registry | lit.html | 39,052 | 64.93% of manual throughput |
| nested-components | manual.createElement | 8,688 | control |
| nested-components | fabrica.html | 1,005 | 11.57% of manual throughput |
| nested-components | lit.html | 4,163 | 47.92% of manual throughput |
| portable-definition-install | manual.createElement | 6,655,696 | control |
| portable-definition-install | fabrica.html | 144,869 | 2.18% of manual throughput |
| portable-definition-install | lit.html | 9,659,779 | 145.14% of manual throughput |
| portal-mount | manual.createElement | 49,437 | control |
| portal-mount | fabrica.html | 10,085 | 20.40% of manual throughput |
| portal-mount | lit.html | 19,752 | 39.95% of manual throughput |
| raw-html | manual.createElement | 13,806 | control |
| raw-html | fabrica.html | 12,606 | 91.31% of manual throughput |
| raw-html | lit.html | 9,549 | 69.17% of manual throughput |
| reactive-class-style | manual.createElement | 7,066 | control |
| reactive-class-style | fabrica.html | 2,862 | 40.51% of manual throughput |
| reactive-class-style | lit.html | 5,030 | 71.18% of manual throughput |
| reactive-text | manual.createElement | 55,819 | control |
| reactive-text | fabrica.html | 10,217 | 18.30% of manual throughput |
| reactive-text | lit.html | 16,269 | 29.15% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,913,146 | control |
| shared-registry-resolution | fabrica.html | 1,118,728 | 10.25% of manual throughput |
| shared-registry-resolution | lit.html | 14,976,895 | 137.24% of manual throughput |
| spread-props-events | manual.createElement | 21,819 | control |
| spread-props-events | fabrica.html | 7,681 | 35.20% of manual throughput |
| spread-props-events | lit.html | 9,629 | 44.13% of manual throughput |
| static-tree | manual.createElement | 14,049 | control |
| static-tree | fabrica.html | 11,917 | 84.83% of manual throughput |
| static-tree | lit.html | 12,537 | 89.24% of manual throughput |
| styled-artifact-composition | manual.createElement | 152,129 | control |
| styled-artifact-composition | fabrica.html | 69,677 | 45.80% of manual throughput |
| styled-artifact-composition | lit.html | 36,617 | 24.07% of manual throughput |
| styled-artifact-render | manual.createElement | 153,917 | control |
| styled-artifact-render | fabrica.html | 98,989 | 64.31% of manual throughput |
| styled-artifact-render | lit.html | 39,573 | 25.71% of manual throughput |
| styled-component-registration | manual.createElement | 791,147 | control |
| styled-component-registration | fabrica.html | 125,698 | 15.89% of manual throughput |
| styled-component-registration | lit.html | 1,742,526 | 220.25% of manual throughput |
| two-way-bind | manual.createElement | 42,292 | control |
| two-way-bind | fabrica.html | 11,680 | 27.62% of manual throughput |
| two-way-bind | lit.html | 13,428 | 31.75% of manual throughput |
| virtual-list-window | manual.createElement | 2,206 | control |
| virtual-list-window | fabrica.html | 626 | 28.38% of manual throughput |
| virtual-list-window | lit.html | 1,132 | 51.32% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 5,899 | 5,722 | -3.01% | -0.83% | 8.56% | medium | 0.17477 | 1.83% | 2.07% | ▅▁█ |
| 🌿 | complex-attributes :: lit.html | 11,685 | 11,793 | +0.92% | +3.20% | 4.98% | high | 0.08480 | 4.20% | 4.98% | ▅▁█ |
| 🧭 | complex-attributes :: manual.createElement | 23,959 | 23,431 | -2.21% | — | 3.00% | high | 0.04268 | 1.71% | 0.05% | ▁▁█ |
| 🌿 | conditional-component :: fabrica.html | 1,034 | 1,038 | +0.31% | -2.54% | 9.48% | medium | 0.96370 | 2.30% | 0.02% | ▁▁█ |
| 🌿 | conditional-component :: lit.html | 4,766 | 4,839 | +1.53% | -1.35% | 3.00% | high | 0.20664 | 1.10% | 0.62% | ▁▆█ |
| 🧭 | conditional-component :: manual.createElement | 7,190 | 7,400 | +2.92% | — | 3.00% | high | 0.13514 | 0.47% | 0.01% | ▁██ |
| 🚀 | forked-registry-resolution :: fabrica.html | 714,809 | 738,578 | +3.33% | +4.85% | 3.28% | high | 0.00135 | 1.46% | 0.22% | ██▁ |
| 🌿 | forked-registry-resolution :: lit.html | 13,964,362 | 13,722,101 | -1.73% | -0.29% | 3.28% | high | 0.00007 | 3.21% | 1.81% | ▁█▆ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,808,117 | 1,781,897 | -1.45% | — | 3.28% | high | 0.00056 | 2.96% | 3.28% | ▅█▁ |
| 🌿 | instance-named-render :: fabrica.html | 8,893 | 8,798 | -1.07% | -1.20% | 6.79% | high | 0.11367 | 0.81% | 0.38% | ▇█▁ |
| 🌿 | instance-named-render :: lit.html | 43,209 | 42,452 | -1.75% | -1.88% | 3.00% | high | 0.02356 | 0.68% | 0.07% | ▁▁█ |
| 🧭 | instance-named-render :: manual.createElement | 79,483 | 79,589 | +0.13% | — | 3.00% | high | 0.01256 | 1.79% | 0.02% | █▁█ |
| 🌿 | keyed-list-update :: fabrica.html | 112 | 107 | -3.83% | -3.61% | 13.32% | medium | 9.31098 | 1.83% | 2.19% | ▁▅█ |
| 🌿 | keyed-list-update :: lit.html | 481 | 491 | +2.03% | +2.27% | 4.82% | high | 2.03646 | 3.58% | 3.31% | ▁▅█ |
| 🧭 | keyed-list-update :: manual.createElement | 843 | 841 | -0.23% | — | 3.58% | high | 1.18935 | 1.93% | 1.60% | ▁█▆ |
| 🌿 | named-component-definition :: fabrica.html | 386,485 | 391,045 | +1.18% | +1.70% | 3.73% | high | 0.00256 | 0.81% | 0.64% | ▁▆█ |
| 🌿 | named-component-definition :: lit.html | 3,555,896 | 3,551,158 | -0.13% | +0.38% | 4.05% | high | 0.00028 | 3.62% | 1.23% | ▇▁█ |
| 🧭 | named-component-definition :: manual.createElement | 3,798,879 | 3,779,296 | -0.52% | — | 3.00% | high | 0.00026 | 2.39% | 2.23% | ▁█▅ |
| 🐢 | named-instance-reuse :: fabrica.html | 318,681 | 311,520 | -2.25% | -3.82% | 3.73% | high | 0.00321 | 1.16% | 0.40% | █▂▁ |
| 🌿 | named-instance-reuse :: lit.html | 14,365,894 | 14,538,458 | +1.20% | -0.43% | 4.36% | high | 0.00007 | 4.45% | 0.79% | ▁█▇ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,643,330 | 10,817,852 | +1.64% | — | 3.73% | high | 0.00009 | 3.30% | 0.56% | ▁▇█ |
| 🌿 | named-styled-registry :: fabrica.html | 9,870 | 10,002 | +1.34% | +0.09% | 3.99% | high | 0.09998 | 3.31% | 3.67% | ▄▁█ |
| 🌿 | named-styled-registry :: lit.html | 38,257 | 39,052 | +2.08% | +0.81% | 3.00% | high | 0.02561 | 0.17% | 0.13% | ▁█▃ |
| 🧭 | named-styled-registry :: manual.createElement | 59,399 | 60,144 | +1.25% | — | 3.00% | high | 0.01663 | 0.75% | 0.75% | █▁▄ |
| 🌿 | nested-components :: fabrica.html | 1,006 | 1,005 | -0.15% | -1.62% | 16.09% | medium | 0.99529 | 2.98% | 2.70% | ▄▁█ |
| 🌿 | nested-components :: lit.html | 4,116 | 4,163 | +1.15% | -0.34% | 3.00% | high | 0.24019 | 1.49% | 1.53% | ▁▄█ |
| 🧭 | nested-components :: manual.createElement | 8,560 | 8,688 | +1.49% | — | 3.00% | high | 0.11511 | 0.66% | 0.46% | ▁█▃ |
| ⚠️ | portable-definition-install :: fabrica.html | 141,381 | 144,869 | +2.47% | +4.83% | 25.00% | low | 0.00690 | 0.85% | 0.57% | ▆█▁ |
| 🌿 | portable-definition-install :: lit.html | 9,727,005 | 9,659,779 | -0.69% | +1.60% | 3.00% | high | 0.00010 | 2.24% | 1.41% | ▁▆█ |
| 🧭 | portable-definition-install :: manual.createElement | 6,809,141 | 6,655,696 | -2.25% | — | 3.00% | high | 0.00015 | 0.87% | 0.69% | ▁▆█ |
| 🌿 | portal-mount :: fabrica.html | 10,013 | 10,085 | +0.72% | +0.62% | 9.42% | medium | 0.09916 | 3.50% | 3.54% | ▅▁█ |
| 🌿 | portal-mount :: lit.html | 19,323 | 19,752 | +2.22% | +2.12% | 3.00% | high | 0.05063 | 0.45% | 0.32% | ▃▁█ |
| 🧭 | portal-mount :: manual.createElement | 49,391 | 49,437 | +0.09% | — | 3.00% | high | 0.02023 | 0.88% | 0.00% | ▁▁█ |
| 🌿 | raw-html :: fabrica.html | 12,701 | 12,606 | -0.75% | -0.83% | 6.90% | high | 0.07933 | 2.23% | 0.38% | ▁▂█ |
| 🌿 | raw-html :: lit.html | 9,524 | 9,549 | +0.27% | +0.19% | 3.00% | high | 0.10472 | 1.40% | 1.31% | ▁▄█ |
| 🧭 | raw-html :: manual.createElement | 13,795 | 13,806 | +0.08% | — | 3.00% | high | 0.07243 | 0.89% | 0.25% | ▁▇█ |
| 🌿 | reactive-class-style :: fabrica.html | 2,833 | 2,862 | +1.03% | +1.85% | 5.51% | high | 0.34940 | 3.86% | 1.96% | ▆▁█ |
| 🌿 | reactive-class-style :: lit.html | 5,113 | 5,030 | -1.63% | -0.83% | 9.25% | medium | 0.19882 | 11.52% | 0.10% | ▁▁█ |
| 🧭 | reactive-class-style :: manual.createElement | 7,123 | 7,066 | -0.80% | — | 3.00% | high | 0.14153 | 0.62% | 0.04% | ▁▁█ |
| 🌿 | reactive-text :: fabrica.html | 10,400 | 10,217 | -1.76% | -2.44% | 11.64% | medium | 0.09788 | 3.63% | 1.52% | ▂▁█ |
| 🌿 | reactive-text :: lit.html | 16,019 | 16,269 | +1.56% | +0.86% | 3.00% | high | 0.06147 | 6.70% | 0.44% | ██▁ |
| 🧭 | reactive-text :: manual.createElement | 55,432 | 55,819 | +0.70% | — | 3.00% | high | 0.01791 | 0.60% | 0.57% | ▁▄█ |
| 🌿 | shared-registry-resolution :: fabrica.html | 1,124,917 | 1,118,728 | -0.55% | +0.79% | 3.00% | high | 0.00089 | 0.46% | 0.54% | ▁█▄ |
| 🌿 | shared-registry-resolution :: lit.html | 15,089,592 | 14,976,895 | -0.75% | +0.59% | 3.00% | high | 0.00007 | 4.88% | 0.54% | ▁██ |
| 🧭 | shared-registry-resolution :: manual.createElement | 11,059,941 | 10,913,146 | -1.33% | — | 3.00% | high | 0.00009 | 4.01% | 2.72% | ▁█▆ |
| 🌿 | spread-props-events :: fabrica.html | 7,784 | 7,681 | -1.32% | +1.01% | 10.02% | medium | 0.13019 | 2.10% | 0.41% | █▁▂ |
| 🌿 | spread-props-events :: lit.html | 9,850 | 9,629 | -2.24% | +0.07% | 14.43% | medium | 0.10385 | 0.12% | 0.11% | █▁▄ |
| 🧭 | spread-props-events :: manual.createElement | 22,334 | 21,819 | -2.31% | — | 3.00% | high | 0.04583 | 1.95% | 0.46% | ▇█▁ |
| 🌿 | static-tree :: fabrica.html | 11,869 | 11,917 | +0.41% | -1.50% | 3.10% | high | 0.08391 | 0.39% | 0.48% | ▁█▄ |
| 🌿 | static-tree :: lit.html | 12,413 | 12,537 | +1.01% | -0.92% | 3.00% | high | 0.07976 | 1.32% | 0.19% | ▁██ |
| 🧭 | static-tree :: manual.createElement | 13,782 | 14,049 | +1.94% | — | 3.00% | high | 0.07118 | 1.54% | 0.50% | ▁▇█ |
| 🌿 | styled-artifact-composition :: fabrica.html | 71,191 | 69,677 | -2.13% | -2.30% | 3.00% | high | 0.01435 | 2.57% | 1.30% | ▁▆█ |
| 🌿 | styled-artifact-composition :: lit.html | 36,336 | 36,617 | +0.77% | +0.59% | 3.00% | high | 0.02731 | 1.52% | 0.54% | ▂▁█ |
| 🧭 | styled-artifact-composition :: manual.createElement | 151,856 | 152,129 | +0.18% | — | 3.00% | high | 0.00657 | 1.01% | 0.24% | ▁█▂ |
| 🌿 | styled-artifact-render :: fabrica.html | 99,568 | 98,989 | -0.58% | -1.96% | 3.00% | high | 0.01010 | 1.04% | 0.44% | ▇▁█ |
| 🌿 | styled-artifact-render :: lit.html | 38,987 | 39,573 | +1.50% | +0.09% | 3.00% | high | 0.02527 | 1.66% | 1.49% | ▁▄█ |
| 🧭 | styled-artifact-render :: manual.createElement | 151,783 | 153,917 | +1.41% | — | 3.00% | high | 0.00650 | 0.78% | 0.65% | ▆█▁ |
| ⚠️ | styled-component-registration :: fabrica.html | 122,500 | 125,698 | +2.61% | +2.41% | 19.74% | low | 0.00796 | 0.89% | 0.05% | ▁██ |
| 🌿 | styled-component-registration :: lit.html | 1,718,188 | 1,742,526 | +1.42% | +1.21% | 8.90% | medium | 0.00057 | 1.00% | 1.20% | █▅▁ |
| 🧭 | styled-component-registration :: manual.createElement | 789,569 | 791,147 | +0.20% | — | 3.00% | high | 0.00126 | 1.53% | 0.37% | ▇▁█ |
| 🌿 | two-way-bind :: fabrica.html | 11,610 | 11,680 | +0.60% | +1.21% | 17.07% | medium | 0.08562 | 2.19% | 2.41% | ▁▄█ |
| 🌿 | two-way-bind :: lit.html | 13,201 | 13,428 | +1.72% | +2.33% | 18.13% | medium | 0.07447 | 1.37% | 0.46% | █▁▇ |
| 🧭 | two-way-bind :: manual.createElement | 42,546 | 42,292 | -0.60% | — | 12.32% | medium | 0.02364 | 0.58% | 0.14% | █▁▇ |
| ⚠️ | virtual-list-window :: fabrica.html | 631 | 626 | -0.76% | -1.13% | 19.30% | low | 1.59726 | 4.00% | 1.67% | ▁▂█ |
| 🌿 | virtual-list-window :: lit.html | 1,116 | 1,132 | +1.49% | +1.12% | 3.02% | high | 0.88323 | 1.88% | 1.05% | ▁█▆ |
| 🧭 | virtual-list-window :: manual.createElement | 2,198 | 2,206 | +0.37% | — | 3.02% | high | 0.45331 | 2.53% | 2.99% | ▅▁█ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
