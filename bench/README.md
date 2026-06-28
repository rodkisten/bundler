<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `f5b691fe` · baseline `82153946` · generated 2026-06-28T11:41:39.234Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000004931 · Linux · X64 |
| CPU | AMD EPYC 7763 64-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.17.0 · V8 13.6.233.17-node.49 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.15 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.41% | +0.41% | 1 | 0 | 18 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 -0.15% | -0.70% | 2 | 3 | 36 | 3 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** +0.41%  
**Raw geometric mean:** +0.41%

### 🚀 Fastest reliable improvements

1. **warm css: prepared configure plan hit** · +7.17% raw · high confidence

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 189,692 | 189,571 | -0.06% | — | 3.00% | high | 0.00528 | 0.71% | 0.37% | ▃▁█ |
| 🌿 | class name: privacy redaction and truncation | 147,261 | 146,799 | -0.31% | — | 3.00% | high | 0.00681 | 3.10% | 1.25% | ▁▇█ |
| 🌿 | class name: readable property-value-context-hash | 190,430 | 189,632 | -0.42% | — | 3.00% | high | 0.00527 | 0.65% | 0.02% | ▁▁█ |
| 🌿 | cold atomic.css: transform parse compile | 2,171 | 2,197 | +1.20% | — | 3.51% | high | 0.45522 | 0.95% | 0.87% | ▅▁█ |
| 🌿 | cold css: atomic detection + compile | 2,272 | 2,271 | -0.03% | — | 3.14% | high | 0.44033 | 0.65% | 0.68% | ▁█▅ |
| 🌿 | cold css: configure parse + normalized apply | 11,417 | 11,552 | +1.18% | — | 4.82% | high | 0.08657 | 1.94% | 0.29% | ▁██ |
| 🌿 | cold css: sheet detection + compile | 2,510 | 2,514 | +0.12% | — | 3.00% | high | 0.39785 | 0.85% | 0.93% | ▁█▄ |
| 🌿 | cold sheet.css: transform parse compile | 2,521 | 2,532 | +0.46% | — | 3.00% | high | 0.39488 | 0.27% | 0.02% | ▁█▁ |
| 🌿 | stylis: nested stylesheet compile | 77,286 | 77,595 | +0.40% | — | 3.00% | high | 0.01289 | 0.07% | 0.08% | ▅█▁ |
| 🌿 | stylis: tiny declaration compile | 1,561,967 | 1,562,125 | +0.01% | — | 3.00% | high | 0.00064 | 0.34% | 0.14% | ▂▁█ |
| 🧭 | baseline: String.raw tiny css | 3,293,933 | 3,252,507 | -1.26% | — | 3.00% | high | 0.00031 | 1.21% | 0.92% | ▆▁█ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 248,030 | 248,276 | +0.10% | — | 3.00% | high | 0.00403 | 1.09% | 0.50% | ▇█▁ |
| 🌿 | warm atomic.css: classic atomic compile | 425,661 | 415,472 | -2.39% | — | 3.00% | high | 0.00241 | 1.50% | 1.40% | ▁▄█ |
| 🌿 | warm atomic.css.withImportant | 246,952 | 247,791 | +0.34% | — | 3.00% | high | 0.00404 | 0.29% | 0.29% | ▁▄█ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,507,735 | 1,510,886 | +0.21% | — | 3.00% | high | 0.00066 | 0.85% | 0.01% | ▁▁█ |
| 🌿 | warm css: polymorphic sheet identity hit | 718,284 | 713,617 | -0.65% | — | 3.00% | high | 0.00140 | 0.55% | 0.03% | █▁▁ |
| 🚀 | warm css: prepared configure plan hit | 4,602,490 | 4,932,345 | +7.17% | — | 3.00% | high | 0.00020 | 1.52% | 1.28% | ▁▆█ |
| 🌿 | warm inline.css: inline style compile | 416,928 | 421,617 | +1.12% | — | 3.00% | high | 0.00237 | 0.59% | 0.60% | ▁█▅ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 165,346 | 165,473 | +0.08% | — | 3.00% | high | 0.00604 | 0.23% | 0.01% | █▁█ |
| 🌿 | warm sheet.css.withImportant | 165,344 | 164,460 | -0.53% | — | 3.00% | high | 0.00608 | 0.12% | 0.12% | ▁▄█ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** -0.15%  
**Raw geometric mean:** -0.70%

### 🚀 Fastest reliable improvements

1. **shared-registry-resolution :: fabrica.html** · +36.35% normalized · high confidence
2. **virtual-list-window :: lit.html** · +4.71% normalized · high confidence

### 🐢 Largest reliable regressions

1. **forked-registry-resolution :: fabrica.html** · -46.25% normalized · high confidence
2. **named-styled-registry :: lit.html** · -3.19% normalized · high confidence
3. **complex-attributes :: lit.html** · -3.06% normalized · high confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 20.62% noise floor
3. **virtual-list-window :: fabrica.html** · 18.48% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 24,222 | control |
| complex-attributes | fabrica.html | 4,984 | 20.58% of manual throughput |
| complex-attributes | lit.html | 12,307 | 50.81% of manual throughput |
| conditional-component | manual.createElement | 7,483 | control |
| conditional-component | fabrica.html | 1,121 | 14.98% of manual throughput |
| conditional-component | lit.html | 4,808 | 64.25% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,786,518 | control |
| forked-registry-resolution | fabrica.html | 319,794 | 17.90% of manual throughput |
| forked-registry-resolution | lit.html | 13,979,026 | 782.47% of manual throughput |
| instance-named-render | manual.createElement | 79,298 | control |
| instance-named-render | fabrica.html | 6,550 | 8.26% of manual throughput |
| instance-named-render | lit.html | 43,184 | 54.46% of manual throughput |
| keyed-list-update | manual.createElement | 879 | control |
| keyed-list-update | fabrica.html | 97 | 10.99% of manual throughput |
| keyed-list-update | lit.html | 495 | 56.30% of manual throughput |
| named-component-definition | manual.createElement | 3,921,818 | control |
| named-component-definition | fabrica.html | 398,554 | 10.16% of manual throughput |
| named-component-definition | lit.html | 3,404,522 | 86.81% of manual throughput |
| named-instance-reuse | manual.createElement | 10,507,842 | control |
| named-instance-reuse | fabrica.html | 314,568 | 2.99% of manual throughput |
| named-instance-reuse | lit.html | 14,541,960 | 138.39% of manual throughput |
| named-styled-registry | manual.createElement | 60,604 | control |
| named-styled-registry | fabrica.html | 6,969 | 11.50% of manual throughput |
| named-styled-registry | lit.html | 38,929 | 64.23% of manual throughput |
| nested-components | manual.createElement | 8,948 | control |
| nested-components | fabrica.html | 821 | 9.18% of manual throughput |
| nested-components | lit.html | 4,295 | 48.00% of manual throughput |
| portable-definition-install | manual.createElement | 6,732,436 | control |
| portable-definition-install | fabrica.html | 152,263 | 2.26% of manual throughput |
| portable-definition-install | lit.html | 9,895,934 | 146.99% of manual throughput |
| portal-mount | manual.createElement | 50,276 | control |
| portal-mount | fabrica.html | 8,267 | 16.44% of manual throughput |
| portal-mount | lit.html | 19,824 | 39.43% of manual throughput |
| raw-html | manual.createElement | 13,988 | control |
| raw-html | fabrica.html | 8,383 | 59.93% of manual throughput |
| raw-html | lit.html | 9,760 | 69.77% of manual throughput |
| reactive-class-style | manual.createElement | 7,390 | control |
| reactive-class-style | fabrica.html | 2,726 | 36.89% of manual throughput |
| reactive-class-style | lit.html | 6,411 | 86.75% of manual throughput |
| reactive-text | manual.createElement | 56,669 | control |
| reactive-text | fabrica.html | 7,538 | 13.30% of manual throughput |
| reactive-text | lit.html | 16,188 | 28.57% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,487,483 | control |
| shared-registry-resolution | fabrica.html | 1,048,737 | 10.00% of manual throughput |
| shared-registry-resolution | lit.html | 15,260,944 | 145.52% of manual throughput |
| spread-props-events | manual.createElement | 22,576 | control |
| spread-props-events | fabrica.html | 5,897 | 26.12% of manual throughput |
| spread-props-events | lit.html | 8,329 | 36.89% of manual throughput |
| static-tree | manual.createElement | 14,626 | control |
| static-tree | fabrica.html | 6,138 | 41.97% of manual throughput |
| static-tree | lit.html | 12,913 | 88.28% of manual throughput |
| styled-artifact-composition | manual.createElement | 153,065 | control |
| styled-artifact-composition | fabrica.html | 72,806 | 47.57% of manual throughput |
| styled-artifact-composition | lit.html | 36,093 | 23.58% of manual throughput |
| styled-artifact-render | manual.createElement | 152,975 | control |
| styled-artifact-render | fabrica.html | 99,301 | 64.91% of manual throughput |
| styled-artifact-render | lit.html | 38,981 | 25.48% of manual throughput |
| styled-component-registration | manual.createElement | 811,518 | control |
| styled-component-registration | fabrica.html | 128,248 | 15.80% of manual throughput |
| styled-component-registration | lit.html | 2,499,408 | 307.99% of manual throughput |
| two-way-bind | manual.createElement | 41,553 | control |
| two-way-bind | fabrica.html | 8,540 | 20.55% of manual throughput |
| two-way-bind | lit.html | 13,182 | 31.72% of manual throughput |
| virtual-list-window | manual.createElement | 2,197 | control |
| virtual-list-window | fabrica.html | 544 | 24.75% of manual throughput |
| virtual-list-window | lit.html | 1,149 | 52.28% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 5,008 | 4,984 | -0.47% | -0.90% | 3.00% | high | 0.20064 | 1.86% | 1.65% | ▁▅█ |
| 🐢 | complex-attributes :: lit.html | 12,641 | 12,307 | -2.64% | -3.06% | 3.00% | high | 0.08125 | 1.23% | 0.15% | ▁█▁ |
| 🧭 | complex-attributes :: manual.createElement | 24,119 | 24,222 | +0.42% | — | 3.00% | high | 0.04129 | 0.62% | 0.28% | █▇▁ |
| 🌿 | conditional-component :: fabrica.html | 1,095 | 1,121 | +2.32% | +1.97% | 3.03% | high | 0.89218 | 1.25% | 0.47% | ▁▇█ |
| 🌿 | conditional-component :: lit.html | 4,906 | 4,808 | -2.00% | -2.34% | 3.00% | high | 0.20798 | 2.51% | 1.22% | █▁▇ |
| 🧭 | conditional-component :: manual.createElement | 7,457 | 7,483 | +0.35% | — | 3.00% | high | 0.13364 | 0.96% | 0.55% | █▁▃ |
| 🐢 | forked-registry-resolution :: fabrica.html | 599,377 | 319,794 | -46.65% | -46.25% | 3.00% | high | 0.00313 | 0.59% | 0.09% | ▁██ |
| 🌿 | forked-registry-resolution :: lit.html | 13,978,544 | 13,979,026 | +0.00% | +0.74% | 3.00% | high | 0.00007 | 2.02% | 0.79% | ▁▂█ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,799,607 | 1,786,518 | -0.73% | — | 3.00% | high | 0.00056 | 2.68% | 1.30% | ▁▇█ |
| 🌿 | instance-named-render :: fabrica.html | 6,447 | 6,550 | +1.59% | +2.68% | 3.00% | high | 0.15268 | 0.39% | 0.31% | █▆▁ |
| 🌿 | instance-named-render :: lit.html | 43,527 | 43,184 | -0.79% | +0.28% | 3.00% | high | 0.02316 | 2.02% | 1.83% | █▁▄ |
| 🧭 | instance-named-render :: manual.createElement | 80,151 | 79,298 | -1.06% | — | 3.00% | high | 0.01261 | 2.44% | 2.61% | █▁▄ |
| 🌿 | keyed-list-update :: fabrica.html | 95 | 97 | +1.91% | +2.87% | 11.77% | medium | 10.35626 | 0.81% | 0.96% | █▅▁ |
| 🌿 | keyed-list-update :: lit.html | 501 | 495 | -1.19% | -0.26% | 4.30% | high | 2.02136 | 0.15% | 0.15% | ▁▅█ |
| 🧭 | keyed-list-update :: manual.createElement | 887 | 879 | -0.94% | — | 3.00% | high | 1.13804 | 1.23% | 0.99% | █▃▁ |
| 🌿 | named-component-definition :: fabrica.html | 397,789 | 398,554 | +0.19% | -1.67% | 3.22% | high | 0.00251 | 0.56% | 0.34% | █▁▆ |
| 🌿 | named-component-definition :: lit.html | 3,255,371 | 3,404,522 | +4.58% | +2.64% | 3.47% | high | 0.00029 | 7.27% | 3.47% | ▂█▁ |
| 🧭 | named-component-definition :: manual.createElement | 3,848,883 | 3,921,818 | +1.89% | — | 3.00% | high | 0.00025 | 14.30% | 1.22% | █▁█ |
| 🌿 | named-instance-reuse :: fabrica.html | 321,711 | 314,568 | -2.22% | -1.89% | 3.00% | high | 0.00318 | 0.92% | 0.08% | ▁█▁ |
| 🌿 | named-instance-reuse :: lit.html | 14,696,221 | 14,541,960 | -1.05% | -0.72% | 3.97% | high | 0.00007 | 2.81% | 0.28% | ▁▁█ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,543,226 | 10,507,842 | -0.34% | — | 3.00% | high | 0.00010 | 2.01% | 0.87% | ▁▂█ |
| 🌿 | named-styled-registry :: fabrica.html | 7,095 | 6,969 | -1.77% | -1.56% | 3.00% | high | 0.14348 | 1.46% | 1.68% | ▁▄█ |
| 🐢 | named-styled-registry :: lit.html | 40,294 | 38,929 | -3.39% | -3.19% | 3.00% | high | 0.02569 | 1.48% | 0.60% | █▁▂ |
| 🧭 | named-styled-registry :: manual.createElement | 60,730 | 60,604 | -0.21% | — | 3.00% | high | 0.01650 | 1.56% | 1.58% | █▁▅ |
| 🌿 | nested-components :: fabrica.html | 802 | 821 | +2.40% | +3.72% | 14.41% | medium | 1.21793 | 0.70% | 0.18% | █▁▇ |
| 🌿 | nested-components :: lit.html | 4,408 | 4,295 | -2.56% | -1.31% | 3.00% | high | 0.23282 | 0.92% | 0.87% | ▁█▅ |
| 🧭 | nested-components :: manual.createElement | 9,063 | 8,948 | -1.27% | — | 3.00% | high | 0.11176 | 0.31% | 0.06% | ▇█▁ |
| ⚠️ | portable-definition-install :: fabrica.html | 150,675 | 152,263 | +1.05% | +2.01% | 25.00% | low | 0.00657 | 3.01% | 2.77% | █▄▁ |
| 🌿 | portable-definition-install :: lit.html | 9,985,560 | 9,895,934 | -0.90% | +0.04% | 3.00% | high | 0.00010 | 2.34% | 0.96% | █▁▇ |
| 🧭 | portable-definition-install :: manual.createElement | 6,796,188 | 6,732,436 | -0.94% | — | 3.00% | high | 0.00015 | 0.71% | 0.65% | ▁█▄ |
| 🌿 | portal-mount :: fabrica.html | 8,049 | 8,267 | +2.71% | +5.48% | 7.20% | medium | 0.12096 | 0.84% | 1.02% | █▁▄ |
| 🌿 | portal-mount :: lit.html | 19,942 | 19,824 | -0.59% | +2.08% | 3.00% | high | 0.05044 | 1.64% | 1.82% | █▄▁ |
| 🧭 | portal-mount :: manual.createElement | 51,631 | 50,276 | -2.62% | — | 3.00% | high | 0.01989 | 2.07% | 0.81% | █▁▂ |
| 🌿 | raw-html :: fabrica.html | 8,404 | 8,383 | -0.25% | +0.43% | 3.00% | high | 0.11929 | 0.33% | 0.02% | █▁▁ |
| 🌿 | raw-html :: lit.html | 9,612 | 9,760 | +1.54% | +2.24% | 3.00% | high | 0.10246 | 1.74% | 1.96% | ▅█▁ |
| 🧭 | raw-html :: manual.createElement | 14,084 | 13,988 | -0.68% | — | 3.00% | high | 0.07149 | 0.98% | 0.38% | ▂█▁ |
| 🌿 | reactive-class-style :: fabrica.html | 2,644 | 2,726 | +3.09% | +3.22% | 4.76% | high | 0.36685 | 0.88% | 0.69% | ▁█▆ |
| 🌿 | reactive-class-style :: lit.html | 6,232 | 6,411 | +2.87% | +3.00% | 3.00% | high | 0.15599 | 1.94% | 0.34% | ▇█▁ |
| 🧭 | reactive-class-style :: manual.createElement | 7,398 | 7,390 | -0.12% | — | 3.00% | high | 0.13533 | 0.59% | 0.65% | ▄▁█ |
| 🌿 | reactive-text :: fabrica.html | 7,402 | 7,538 | +1.84% | +2.38% | 8.85% | medium | 0.13265 | 1.22% | 1.44% | █▄▁ |
| 🌿 | reactive-text :: lit.html | 16,414 | 16,188 | -1.38% | -0.85% | 4.76% | high | 0.06177 | 5.89% | 4.76% | █▆▁ |
| 🧭 | reactive-text :: manual.createElement | 56,968 | 56,669 | -0.53% | — | 3.00% | high | 0.01765 | 0.84% | 0.10% | █▁▁ |
| 🚀 | shared-registry-resolution :: fabrica.html | 771,254 | 1,048,737 | +35.98% | +36.35% | 3.00% | high | 0.00095 | 0.21% | 0.24% | █▄▁ |
| 🌿 | shared-registry-resolution :: lit.html | 15,073,781 | 15,260,944 | +1.24% | +1.52% | 3.68% | high | 0.00007 | 1.71% | 0.08% | █▁█ |
| 🧭 | shared-registry-resolution :: manual.createElement | 10,516,219 | 10,487,483 | -0.27% | — | 3.00% | high | 0.00010 | 1.69% | 0.74% | ▁█▂ |
| 🌿 | spread-props-events :: fabrica.html | 5,869 | 5,897 | +0.46% | -0.03% | 8.78% | medium | 0.16959 | 0.83% | 0.98% | ▄█▁ |
| 🌿 | spread-props-events :: lit.html | 8,639 | 8,329 | -3.59% | -4.06% | 12.78% | medium | 0.12006 | 2.30% | 0.96% | ▇█▁ |
| 🧭 | spread-props-events :: manual.createElement | 22,466 | 22,576 | +0.49% | — | 3.00% | high | 0.04429 | 0.34% | 0.38% | █▁▅ |
| 🌿 | static-tree :: fabrica.html | 5,944 | 6,138 | +3.26% | +2.13% | 3.32% | high | 0.16291 | 1.87% | 0.45% | ▇█▁ |
| 🌿 | static-tree :: lit.html | 12,939 | 12,913 | -0.20% | -1.30% | 3.32% | high | 0.07744 | 1.81% | 1.86% | ▄█▁ |
| 🧭 | static-tree :: manual.createElement | 14,466 | 14,626 | +1.11% | — | 3.32% | high | 0.06837 | 4.28% | 3.32% | █▆▁ |
| 🌿 | styled-artifact-composition :: fabrica.html | 73,955 | 72,806 | -1.55% | -0.30% | 3.00% | high | 0.01374 | 0.51% | 0.48% | █▄▁ |
| 🌿 | styled-artifact-composition :: lit.html | 37,029 | 36,093 | -2.53% | -1.29% | 3.00% | high | 0.02771 | 0.83% | 0.63% | █▆▁ |
| 🧭 | styled-artifact-composition :: manual.createElement | 155,014 | 153,065 | -1.26% | — | 3.00% | high | 0.00653 | 1.64% | 1.53% | █▄▁ |
| 🌿 | styled-artifact-render :: fabrica.html | 99,248 | 99,301 | +0.05% | +1.64% | 3.00% | high | 0.01007 | 1.77% | 1.48% | █▁▃ |
| 🌿 | styled-artifact-render :: lit.html | 39,839 | 38,981 | -2.15% | -0.61% | 3.00% | high | 0.02565 | 2.15% | 0.45% | █▁▂ |
| 🧭 | styled-artifact-render :: manual.createElement | 155,395 | 152,975 | -1.56% | — | 3.00% | high | 0.00654 | 1.51% | 0.81% | █▃▁ |
| ⚠️ | styled-component-registration :: fabrica.html | 122,783 | 128,248 | +4.45% | +2.86% | 20.62% | low | 0.00780 | 2.50% | 0.00% | █▁█ |
| 🌿 | styled-component-registration :: lit.html | 2,458,392 | 2,499,408 | +1.67% | +0.12% | 3.00% | high | 0.00040 | 1.10% | 1.16% | ▅█▁ |
| 🧭 | styled-component-registration :: manual.createElement | 799,151 | 811,518 | +1.55% | — | 3.00% | high | 0.00123 | 0.93% | 0.79% | █▁▆ |
| 🌿 | two-way-bind :: fabrica.html | 8,374 | 8,540 | +1.98% | +4.64% | 14.48% | medium | 0.11710 | 2.14% | 0.96% | █▇▁ |
| 🌿 | two-way-bind :: lit.html | 13,131 | 13,182 | +0.39% | +3.01% | 17.51% | medium | 0.07586 | 1.79% | 1.55% | █▃▁ |
| 🧭 | two-way-bind :: manual.createElement | 42,635 | 41,553 | -2.54% | — | 12.45% | medium | 0.02407 | 1.98% | 1.55% | ▃▁█ |
| ⚠️ | virtual-list-window :: fabrica.html | 535 | 544 | +1.75% | +5.35% | 18.48% | low | 1.83872 | 2.36% | 0.49% | █▂▁ |
| 🚀 | virtual-list-window :: lit.html | 1,136 | 1,149 | +1.13% | +4.71% | 3.15% | high | 0.87056 | 0.47% | 0.41% | █▄▁ |
| 🧭 | virtual-list-window :: manual.createElement | 2,275 | 2,197 | -3.42% | — | 3.00% | high | 0.45515 | 1.95% | 2.33% | ▁█▅ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
