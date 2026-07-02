<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `76e6f4a2` · baseline `36be25dc` · generated 2026-07-02T02:23:23.772Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000005202 · Linux · X64 |
| CPU | AMD EPYC 7763 64-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.17.0 · V8 13.6.233.17-node.49 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.06 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 -0.21% | -0.21% | 0 | 1 | 18 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 -0.39% | +0.75% | 2 | 2 | 37 | 3 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** -0.21%  
**Raw geometric mean:** -0.21%

### 🚀 Fastest reliable improvements

_None outside the reliability threshold._

### 🐢 Largest reliable regressions

1. **warm css: polymorphic sheet identity hit** · -3.13% raw · high confidence

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 187,581 | 187,204 | -0.20% | — | 3.00% | high | 0.00534 | 0.39% | 0.47% | ▄█▁ |
| 🌿 | class name: privacy redaction and truncation | 143,617 | 144,196 | +0.40% | — | 3.00% | high | 0.00694 | 1.05% | 0.82% | ▃█▁ |
| 🌿 | class name: readable property-value-context-hash | 188,330 | 188,121 | -0.11% | — | 3.00% | high | 0.00532 | 1.47% | 1.20% | ▆█▁ |
| 🌿 | cold atomic.css: transform parse compile | 2,106 | 2,167 | +2.91% | — | 3.58% | high | 0.46147 | 1.10% | 0.44% | ▇▁█ |
| 🌿 | cold css: atomic detection + compile | 2,250 | 2,260 | +0.45% | — | 3.08% | high | 0.44248 | 0.40% | 0.09% | ▂█▁ |
| 🌿 | cold css: configure parse + normalized apply | 11,420 | 11,459 | +0.35% | — | 4.85% | high | 0.08727 | 2.23% | 0.23% | ▁██ |
| 🌿 | cold css: sheet detection + compile | 2,518 | 2,520 | +0.06% | — | 3.00% | high | 0.39689 | 0.20% | 0.25% | ▁▄█ |
| 🌿 | cold sheet.css: transform parse compile | 2,535 | 2,505 | -1.19% | — | 3.00% | high | 0.39924 | 1.30% | 0.94% | ▁▃█ |
| 🌿 | stylis: nested stylesheet compile | 77,168 | 73,013 | -5.38% | — | 5.49% | medium | 0.01370 | 7.79% | 5.49% | █▆▁ |
| 🌿 | stylis: tiny declaration compile | 1,528,061 | 1,510,191 | -1.17% | — | 3.00% | high | 0.00066 | 4.90% | 2.72% | █▆▁ |
| 🧭 | baseline: String.raw tiny css | 3,189,681 | 3,163,370 | -0.82% | — | 3.00% | high | 0.00032 | 0.36% | 0.17% | ▂█▁ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 239,184 | 242,337 | +1.32% | — | 3.00% | high | 0.00413 | 0.66% | 0.65% | ▅█▁ |
| 🌿 | warm atomic.css: classic atomic compile | 415,222 | 412,961 | -0.54% | — | 3.00% | high | 0.00242 | 0.43% | 0.14% | █▂▁ |
| 🌿 | warm atomic.css.withImportant | 242,930 | 240,641 | -0.94% | — | 3.00% | high | 0.00416 | 0.76% | 0.70% | ▁▄█ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,402,270 | 1,414,683 | +0.89% | — | 3.00% | high | 0.00071 | 0.80% | 0.32% | ▂█▁ |
| 🐢 | warm css: polymorphic sheet identity hit | 702,125 | 680,147 | -3.13% | — | 3.00% | high | 0.00147 | 0.99% | 0.81% | ▁▃█ |
| 🌿 | warm css: prepared configure plan hit | 4,595,061 | 4,721,587 | +2.75% | — | 3.00% | high | 0.00021 | 0.49% | 0.38% | █▁▃ |
| 🌿 | warm inline.css: inline style compile | 411,553 | 413,811 | +0.55% | — | 3.00% | high | 0.00242 | 0.80% | 0.19% | ▁▇█ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 164,051 | 163,276 | -0.47% | — | 3.00% | high | 0.00612 | 0.99% | 0.41% | ▁█▇ |
| 🌿 | warm sheet.css.withImportant | 163,386 | 162,966 | -0.26% | — | 3.00% | high | 0.00614 | 0.73% | 0.28% | ▇█▁ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** -0.39%  
**Raw geometric mean:** +0.75%

### 🚀 Fastest reliable improvements

1. **spread-props-events :: lit.html** · +19.93% normalized · medium confidence
2. **virtual-list-window :: lit.html** · +3.85% normalized · high confidence

### 🐢 Largest reliable regressions

1. **reactive-class-style :: fabrica.html** · -18.40% normalized · medium confidence
2. **reactive-class-style :: lit.html** · -14.04% normalized · medium confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 20.92% noise floor
3. **virtual-list-window :: fabrica.html** · 17.82% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 23,989 | control |
| complex-attributes | fabrica.html | 6,018 | 25.09% of manual throughput |
| complex-attributes | lit.html | 12,226 | 50.97% of manual throughput |
| conditional-component | manual.createElement | 7,329 | control |
| conditional-component | fabrica.html | 1,096 | 14.96% of manual throughput |
| conditional-component | lit.html | 4,725 | 64.48% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,717,024 | control |
| forked-registry-resolution | fabrica.html | 714,015 | 41.58% of manual throughput |
| forked-registry-resolution | lit.html | 14,042,933 | 817.86% of manual throughput |
| instance-named-render | manual.createElement | 79,759 | control |
| instance-named-render | fabrica.html | 9,225 | 11.57% of manual throughput |
| instance-named-render | lit.html | 42,787 | 53.64% of manual throughput |
| keyed-list-update | manual.createElement | 859 | control |
| keyed-list-update | fabrica.html | 113 | 13.15% of manual throughput |
| keyed-list-update | lit.html | 490 | 57.05% of manual throughput |
| named-component-definition | manual.createElement | 2,654,528 | control |
| named-component-definition | fabrica.html | 381,612 | 14.38% of manual throughput |
| named-component-definition | lit.html | 3,841,268 | 144.71% of manual throughput |
| named-instance-reuse | manual.createElement | 10,823,253 | control |
| named-instance-reuse | fabrica.html | 318,311 | 2.94% of manual throughput |
| named-instance-reuse | lit.html | 14,653,695 | 135.39% of manual throughput |
| named-styled-registry | manual.createElement | 60,414 | control |
| named-styled-registry | fabrica.html | 10,238 | 16.95% of manual throughput |
| named-styled-registry | lit.html | 39,077 | 64.68% of manual throughput |
| nested-components | manual.createElement | 8,661 | control |
| nested-components | fabrica.html | 1,036 | 11.96% of manual throughput |
| nested-components | lit.html | 4,298 | 49.62% of manual throughput |
| portable-definition-install | manual.createElement | 6,882,517 | control |
| portable-definition-install | fabrica.html | 151,646 | 2.20% of manual throughput |
| portable-definition-install | lit.html | 9,794,202 | 142.31% of manual throughput |
| portal-mount | manual.createElement | 50,326 | control |
| portal-mount | fabrica.html | 10,236 | 20.34% of manual throughput |
| portal-mount | lit.html | 19,617 | 38.98% of manual throughput |
| raw-html | manual.createElement | 14,012 | control |
| raw-html | fabrica.html | 13,124 | 93.66% of manual throughput |
| raw-html | lit.html | 9,557 | 68.21% of manual throughput |
| reactive-class-style | manual.createElement | 6,986 | control |
| reactive-class-style | fabrica.html | 2,791 | 39.95% of manual throughput |
| reactive-class-style | lit.html | 6,334 | 90.68% of manual throughput |
| reactive-text | manual.createElement | 56,381 | control |
| reactive-text | fabrica.html | 10,562 | 18.73% of manual throughput |
| reactive-text | lit.html | 16,395 | 29.08% of manual throughput |
| shared-registry-resolution | manual.createElement | 11,000,976 | control |
| shared-registry-resolution | fabrica.html | 1,121,264 | 10.19% of manual throughput |
| shared-registry-resolution | lit.html | 14,880,039 | 135.26% of manual throughput |
| spread-props-events | manual.createElement | 22,666 | control |
| spread-props-events | fabrica.html | 7,962 | 35.13% of manual throughput |
| spread-props-events | lit.html | 9,917 | 43.75% of manual throughput |
| static-tree | manual.createElement | 14,132 | control |
| static-tree | fabrica.html | 11,963 | 84.65% of manual throughput |
| static-tree | lit.html | 12,605 | 89.19% of manual throughput |
| styled-artifact-composition | manual.createElement | 153,681 | control |
| styled-artifact-composition | fabrica.html | 71,273 | 46.38% of manual throughput |
| styled-artifact-composition | lit.html | 36,240 | 23.58% of manual throughput |
| styled-artifact-render | manual.createElement | 153,915 | control |
| styled-artifact-render | fabrica.html | 97,600 | 63.41% of manual throughput |
| styled-artifact-render | lit.html | 39,361 | 25.57% of manual throughput |
| styled-component-registration | manual.createElement | 790,364 | control |
| styled-component-registration | fabrica.html | 121,964 | 15.43% of manual throughput |
| styled-component-registration | lit.html | 2,425,301 | 306.86% of manual throughput |
| two-way-bind | manual.createElement | 42,403 | control |
| two-way-bind | fabrica.html | 11,476 | 27.06% of manual throughput |
| two-way-bind | lit.html | 13,765 | 32.46% of manual throughput |
| virtual-list-window | manual.createElement | 2,212 | control |
| virtual-list-window | fabrica.html | 642 | 29.03% of manual throughput |
| virtual-list-window | lit.html | 1,144 | 51.72% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 5,858 | 6,018 | +2.72% | +2.46% | 7.86% | medium | 0.16617 | 3.33% | 3.88% | ▅▁█ |
| 🌿 | complex-attributes :: lit.html | 12,142 | 12,226 | +0.69% | +0.44% | 3.00% | high | 0.08179 | 0.41% | 0.29% | ▆▁█ |
| 🧭 | complex-attributes :: manual.createElement | 23,929 | 23,989 | +0.25% | — | 3.00% | high | 0.04169 | 1.22% | 1.36% | █▁▄ |
| 🌿 | conditional-component :: fabrica.html | 1,075 | 1,096 | +1.93% | +2.41% | 8.35% | medium | 0.91241 | 1.69% | 0.78% | █▁▇ |
| 🌿 | conditional-component :: lit.html | 4,795 | 4,725 | -1.46% | -1.00% | 3.00% | high | 0.21162 | 0.89% | 0.77% | █▁▄ |
| 🧭 | conditional-component :: manual.createElement | 7,363 | 7,329 | -0.47% | — | 3.00% | high | 0.13645 | 0.90% | 0.97% | ▄▁█ |
| 🌿 | forked-registry-resolution :: fabrica.html | 733,095 | 714,015 | -2.60% | -1.64% | 3.58% | high | 0.00140 | 3.07% | 3.58% | █▁▅ |
| 🌿 | forked-registry-resolution :: lit.html | 13,973,483 | 14,042,933 | +0.50% | +1.49% | 3.00% | high | 0.00007 | 0.79% | 0.47% | ▁█▃ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,734,041 | 1,717,024 | -0.98% | — | 3.00% | high | 0.00058 | 2.79% | 1.66% | █▃▁ |
| 🌿 | instance-named-render :: fabrica.html | 9,009 | 9,225 | +2.41% | +1.87% | 6.62% | high | 0.10840 | 0.40% | 0.11% | ▁█▇ |
| 🌿 | instance-named-render :: lit.html | 42,491 | 42,787 | +0.69% | +0.17% | 3.00% | high | 0.02337 | 0.94% | 1.04% | ▅█▁ |
| 🧭 | instance-named-render :: manual.createElement | 79,341 | 79,759 | +0.53% | — | 3.00% | high | 0.01254 | 1.16% | 0.93% | ▆█▁ |
| 🌿 | keyed-list-update :: fabrica.html | 112 | 113 | +0.98% | +0.71% | 12.42% | medium | 8.85271 | 2.57% | 2.66% | ▁▄█ |
| 🌿 | keyed-list-update :: lit.html | 481 | 490 | +1.91% | +1.64% | 4.40% | high | 2.04105 | 1.73% | 1.16% | ▁▃█ |
| 🧭 | keyed-list-update :: manual.createElement | 856 | 859 | +0.27% | — | 3.05% | high | 1.16451 | 11.11% | 0.48% | ██▁ |
| 🌿 | named-component-definition :: fabrica.html | 385,125 | 381,612 | -0.91% | -0.94% | 13.55% | medium | 0.00262 | 0.63% | 0.08% | ▁█▁ |
| 🌿 | named-component-definition :: lit.html | 3,791,410 | 3,841,268 | +1.32% | +1.29% | 13.62% | medium | 0.00026 | 5.07% | 1.85% | ▇▁█ |
| 🧭 | named-component-definition :: manual.createElement | 2,653,868 | 2,654,528 | +0.02% | — | 13.38% | medium | 0.00038 | 19.90% | 8.65% | ▂█▁ |
| 🌿 | named-instance-reuse :: fabrica.html | 318,746 | 318,311 | -0.14% | -2.61% | 3.00% | high | 0.00314 | 2.82% | 1.11% | █▁▇ |
| 🌿 | named-instance-reuse :: lit.html | 14,569,468 | 14,653,695 | +0.58% | -1.91% | 3.00% | high | 0.00007 | 0.98% | 0.10% | █▁█ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,555,127 | 10,823,253 | +2.54% | — | 3.00% | high | 0.00009 | 1.20% | 0.03% | ▁██ |
| 🌿 | named-styled-registry :: fabrica.html | 10,147 | 10,238 | +0.90% | -0.10% | 3.63% | high | 0.09767 | 0.53% | 0.10% | ▁█▂ |
| 🌿 | named-styled-registry :: lit.html | 38,499 | 39,077 | +1.50% | +0.50% | 3.00% | high | 0.02559 | 0.64% | 0.14% | ▇█▁ |
| 🧭 | named-styled-registry :: manual.createElement | 59,817 | 60,414 | +1.00% | — | 3.00% | high | 0.01655 | 0.99% | 0.94% | ▁▄█ |
| 🌿 | nested-components :: fabrica.html | 1,058 | 1,036 | -2.06% | -1.31% | 14.65% | medium | 0.96548 | 1.45% | 0.84% | █▆▁ |
| 🌿 | nested-components :: lit.html | 4,248 | 4,298 | +1.17% | +1.95% | 3.00% | high | 0.23268 | 0.32% | 0.19% | ▁▆█ |
| 🧭 | nested-components :: manual.createElement | 8,727 | 8,661 | -0.76% | — | 3.00% | high | 0.11546 | 0.81% | 0.15% | ▁█▂ |
| ⚠️ | portable-definition-install :: fabrica.html | 146,869 | 151,646 | +3.25% | +4.02% | 25.00% | low | 0.00659 | 1.41% | 1.23% | ▁█▅ |
| 🌿 | portable-definition-install :: lit.html | 9,921,305 | 9,794,202 | -1.28% | -0.55% | 3.21% | high | 0.00010 | 2.67% | 1.02% | ▁▂█ |
| 🧭 | portable-definition-install :: manual.createElement | 6,933,497 | 6,882,517 | -0.74% | — | 3.21% | high | 0.00015 | 2.33% | 2.30% | █▁▅ |
| 🌿 | portal-mount :: fabrica.html | 10,032 | 10,236 | +2.04% | +0.26% | 8.67% | medium | 0.09769 | 0.64% | 0.33% | ▆▁█ |
| 🌿 | portal-mount :: lit.html | 19,365 | 19,617 | +1.30% | -0.47% | 3.00% | high | 0.05098 | 2.25% | 1.70% | ▁▃█ |
| 🧭 | portal-mount :: manual.createElement | 49,445 | 50,326 | +1.78% | — | 3.00% | high | 0.01987 | 0.69% | 0.58% | ▁▃█ |
| 🌿 | raw-html :: fabrica.html | 12,856 | 13,124 | +2.08% | -0.47% | 6.35% | high | 0.07620 | 0.97% | 1.03% | ▄▁█ |
| 🌿 | raw-html :: lit.html | 9,501 | 9,557 | +0.59% | -1.92% | 3.00% | high | 0.10463 | 0.63% | 0.49% | █▃▁ |
| 🧭 | raw-html :: manual.createElement | 13,662 | 14,012 | +2.56% | — | 3.00% | high | 0.07137 | 1.21% | 1.16% | ▁█▅ |
| 🐢 | reactive-class-style :: fabrica.html | 2,932 | 2,791 | -4.82% | -18.40% | 8.55% | medium | 0.35829 | 8.53% | 8.24% | ▁▅█ |
| 🐢 | reactive-class-style :: lit.html | 6,318 | 6,334 | +0.26% | -14.04% | 6.65% | medium | 0.15787 | 8.70% | 0.21% | █▁█ |
| 🧭 | reactive-class-style :: manual.createElement | 5,989 | 6,986 | +16.64% | — | 6.52% | medium | 0.14315 | 8.21% | 2.47% | █▇▁ |
| 🌿 | reactive-text :: fabrica.html | 10,647 | 10,562 | -0.80% | -0.68% | 10.30% | medium | 0.09468 | 1.41% | 1.37% | ▄▁█ |
| 🌿 | reactive-text :: lit.html | 16,631 | 16,395 | -1.42% | -1.31% | 3.00% | high | 0.06099 | 1.17% | 0.84% | ▃█▁ |
| 🧭 | reactive-text :: manual.createElement | 56,447 | 56,381 | -0.12% | — | 3.00% | high | 0.01774 | 0.09% | 0.00% | █▁▁ |
| 🌿 | shared-registry-resolution :: fabrica.html | 1,120,662 | 1,121,264 | +0.05% | -1.13% | 3.00% | high | 0.00089 | 3.27% | 0.13% | █▁█ |
| 🌿 | shared-registry-resolution :: lit.html | 14,949,845 | 14,880,039 | -0.47% | -1.65% | 3.00% | high | 0.00007 | 0.46% | 0.52% | ▁▅█ |
| 🧭 | shared-registry-resolution :: manual.createElement | 10,870,550 | 11,000,976 | +1.20% | — | 3.00% | high | 0.00009 | 1.00% | 0.38% | ▁▇█ |
| 🌿 | spread-props-events :: fabrica.html | 8,005 | 7,962 | -0.54% | -2.22% | 9.52% | medium | 0.12560 | 1.87% | 1.83% | ▁█▄ |
| 🚀 | spread-props-events :: lit.html | 8,129 | 9,917 | +21.99% | +19.93% | 13.49% | medium | 0.10083 | 9.19% | 0.66% | ▁██ |
| 🧭 | spread-props-events :: manual.createElement | 22,283 | 22,666 | +1.72% | — | 3.00% | high | 0.04412 | 0.83% | 0.78% | ▁█▄ |
| 🌿 | static-tree :: fabrica.html | 11,751 | 11,963 | +1.80% | +1.17% | 3.00% | high | 0.08359 | 0.62% | 0.73% | ▁▄█ |
| 🌿 | static-tree :: lit.html | 12,643 | 12,605 | -0.30% | -0.92% | 3.00% | high | 0.07933 | 0.91% | 0.39% | ▂▁█ |
| 🧭 | static-tree :: manual.createElement | 14,045 | 14,132 | +0.62% | — | 3.00% | high | 0.07076 | 0.43% | 0.25% | █▁▃ |
| 🌿 | styled-artifact-composition :: fabrica.html | 73,161 | 71,273 | -2.58% | -1.87% | 3.00% | high | 0.01403 | 1.60% | 1.14% | ▁█▃ |
| 🌿 | styled-artifact-composition :: lit.html | 36,031 | 36,240 | +0.58% | +1.31% | 3.00% | high | 0.02759 | 1.08% | 1.15% | ▄█▁ |
| 🧭 | styled-artifact-composition :: manual.createElement | 154,801 | 153,681 | -0.72% | — | 3.00% | high | 0.00651 | 0.98% | 0.19% | ▁█▇ |
| 🌿 | styled-artifact-render :: fabrica.html | 98,982 | 97,600 | -1.40% | -1.75% | 3.00% | high | 0.01025 | 1.82% | 1.64% | ▁█▅ |
| 🌿 | styled-artifact-render :: lit.html | 38,822 | 39,361 | +1.39% | +1.03% | 3.00% | high | 0.02541 | 0.79% | 0.78% | ▄█▁ |
| 🧭 | styled-artifact-render :: manual.createElement | 153,364 | 153,915 | +0.36% | — | 3.00% | high | 0.00650 | 1.05% | 0.99% | ▁█▅ |
| ⚠️ | styled-component-registration :: fabrica.html | 119,648 | 121,964 | +1.94% | +2.05% | 20.92% | low | 0.00820 | 1.28% | 0.07% | ██▁ |
| 🌿 | styled-component-registration :: lit.html | 2,465,874 | 2,425,301 | -1.65% | -1.54% | 3.00% | high | 0.00041 | 20.04% | 0.58% | █▁█ |
| 🧭 | styled-component-registration :: manual.createElement | 791,215 | 790,364 | -0.11% | — | 3.00% | high | 0.00127 | 1.52% | 0.53% | █▂▁ |
| 🌿 | two-way-bind :: fabrica.html | 11,409 | 11,476 | +0.59% | +1.11% | 18.28% | medium | 0.08714 | 0.31% | 0.23% | ▁█▆ |
| 🌿 | two-way-bind :: lit.html | 13,307 | 13,765 | +3.44% | +3.97% | 18.81% | medium | 0.07265 | 0.77% | 0.58% | ▁▆█ |
| 🧭 | two-way-bind :: manual.createElement | 42,622 | 42,403 | -0.51% | — | 14.28% | medium | 0.02358 | 1.19% | 0.16% | ██▁ |
| ⚠️ | virtual-list-window :: fabrica.html | 630 | 642 | +1.94% | +3.33% | 17.82% | low | 1.55742 | 1.62% | 1.89% | ▁▅█ |
| 🚀 | virtual-list-window :: lit.html | 1,117 | 1,144 | +2.45% | +3.85% | 3.00% | high | 0.87411 | 0.56% | 0.56% | ▄█▁ |
| 🧭 | virtual-list-window :: manual.createElement | 2,242 | 2,212 | -1.34% | — | 3.00% | high | 0.45209 | 1.80% | 1.17% | ▁▃█ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
