<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `c2746283` · baseline `7f029f6c` · generated 2026-07-06T12:43:41.431Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000005389 · Linux · X64 |
| CPU | AMD EPYC 7763 64-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.18.0 · V8 13.6.233.17-node.50 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.12 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.64% | +0.64% | 0 | 0 | 19 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 +0.41% | +0.38% | 2 | 1 | 37 | 4 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** +0.64%  
**Raw geometric mean:** +0.64%

### 🚀 Fastest reliable improvements

_None outside the reliability threshold._

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 184,044 | 189,418 | +2.92% | — | 3.00% | high | 0.00528 | 1.14% | 0.32% | █▁▇ |
| 🌿 | class name: privacy redaction and truncation | 143,920 | 144,980 | +0.74% | — | 3.00% | high | 0.00690 | 0.36% | 0.38% | █▁▄ |
| 🌿 | class name: readable property-value-context-hash | 185,604 | 187,313 | +0.92% | — | 3.00% | high | 0.00534 | 1.02% | 0.89% | █▁▅ |
| 🌿 | cold atomic.css: transform parse compile | 2,142 | 2,141 | -0.08% | — | 3.61% | high | 0.46716 | 0.62% | 0.51% | ▁█▃ |
| 🌿 | cold css: atomic detection + compile | 2,216 | 2,245 | +1.27% | — | 3.42% | high | 0.44551 | 1.02% | 0.01% | ▁██ |
| 🌿 | cold css: configure parse + normalized apply | 11,015 | 11,042 | +0.24% | — | 5.28% | high | 0.09057 | 0.84% | 0.69% | ▁█▃ |
| 🌿 | cold css: sheet detection + compile | 2,442 | 2,481 | +1.60% | — | 3.17% | high | 0.40304 | 0.80% | 0.57% | █▆▁ |
| 🌿 | cold sheet.css: transform parse compile | 2,444 | 2,492 | +1.98% | — | 3.10% | high | 0.40121 | 0.90% | 0.15% | ▁▂█ |
| 🌿 | stylis: nested stylesheet compile | 75,554 | 76,068 | +0.68% | — | 3.00% | high | 0.01315 | 1.60% | 0.40% | ▇▁█ |
| 🌿 | stylis: tiny declaration compile | 1,489,513 | 1,496,465 | +0.47% | — | 3.00% | high | 0.00067 | 1.93% | 1.19% | ▁▆█ |
| 🧭 | baseline: String.raw tiny css | 3,149,877 | 3,197,342 | +1.51% | — | 3.00% | high | 0.00031 | 1.39% | 1.37% | █▁▄ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 240,990 | 239,188 | -0.75% | — | 3.00% | high | 0.00418 | 0.39% | 0.28% | ▁▃█ |
| 🌿 | warm atomic.css: classic atomic compile | 405,127 | 401,250 | -0.96% | — | 3.00% | high | 0.00249 | 1.10% | 0.53% | ▂▁█ |
| 🌿 | warm atomic.css.withImportant | 241,499 | 240,952 | -0.23% | — | 3.00% | high | 0.00415 | 0.52% | 0.27% | ▆▁█ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,435,904 | 1,468,522 | +2.27% | — | 3.00% | high | 0.00068 | 2.34% | 0.52% | ▁▇█ |
| 🌿 | warm css: polymorphic sheet identity hit | 686,713 | 697,153 | +1.52% | — | 3.00% | high | 0.00143 | 0.77% | 0.04% | ██▁ |
| 🌿 | warm css: prepared configure plan hit | 4,791,881 | 4,813,881 | +0.46% | — | 3.00% | high | 0.00021 | 1.40% | 0.71% | ▁█▆ |
| 🌿 | warm inline.css: inline style compile | 407,917 | 406,893 | -0.25% | — | 3.00% | high | 0.00246 | 0.88% | 0.94% | █▁▅ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 162,764 | 162,948 | +0.11% | — | 3.00% | high | 0.00614 | 0.82% | 0.04% | █▁█ |
| 🌿 | warm sheet.css.withImportant | 162,662 | 161,668 | -0.61% | — | 3.00% | high | 0.00619 | 1.54% | 0.19% | █▁█ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** +0.41%  
**Raw geometric mean:** +0.38%

### 🚀 Fastest reliable improvements

1. **reactive-class-style :: fabrica.html** · +5.67% normalized · high confidence
2. **shared-registry-resolution :: lit.html** · +4.66% normalized · high confidence

### 🐢 Largest reliable regressions

1. **named-component-definition :: lit.html** · -11.50% normalized · high confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 20.27% noise floor
3. **virtual-list-window :: fabrica.html** · 19.61% noise floor
4. **named-instance-reuse :: fabrica.html** · 15.33% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 23,739 | control |
| complex-attributes | fabrica.html | 5,959 | 25.10% of manual throughput |
| complex-attributes | lit.html | 11,975 | 50.44% of manual throughput |
| conditional-component | manual.createElement | 7,326 | control |
| conditional-component | fabrica.html | 1,032 | 14.09% of manual throughput |
| conditional-component | lit.html | 4,744 | 64.75% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,796,552 | control |
| forked-registry-resolution | fabrica.html | 737,393 | 41.04% of manual throughput |
| forked-registry-resolution | lit.html | 14,083,953 | 783.94% of manual throughput |
| instance-named-render | manual.createElement | 79,826 | control |
| instance-named-render | fabrica.html | 8,654 | 10.84% of manual throughput |
| instance-named-render | lit.html | 42,363 | 53.07% of manual throughput |
| keyed-list-update | manual.createElement | 852 | control |
| keyed-list-update | fabrica.html | 111 | 13.00% of manual throughput |
| keyed-list-update | lit.html | 492 | 57.78% of manual throughput |
| named-component-definition | manual.createElement | 3,789,440 | control |
| named-component-definition | fabrica.html | 388,522 | 10.25% of manual throughput |
| named-component-definition | lit.html | 3,320,746 | 87.63% of manual throughput |
| named-instance-reuse | manual.createElement | 10,813,375 | control |
| named-instance-reuse | fabrica.html | 317,342 | 2.93% of manual throughput |
| named-instance-reuse | lit.html | 14,689,392 | 135.84% of manual throughput |
| named-styled-registry | manual.createElement | 59,849 | control |
| named-styled-registry | fabrica.html | 9,992 | 16.70% of manual throughput |
| named-styled-registry | lit.html | 38,468 | 64.27% of manual throughput |
| nested-components | manual.createElement | 8,540 | control |
| nested-components | fabrica.html | 1,022 | 11.97% of manual throughput |
| nested-components | lit.html | 4,121 | 48.26% of manual throughput |
| portable-definition-install | manual.createElement | 6,735,500 | control |
| portable-definition-install | fabrica.html | 144,637 | 2.15% of manual throughput |
| portable-definition-install | lit.html | 10,127,607 | 150.36% of manual throughput |
| portal-mount | manual.createElement | 50,375 | control |
| portal-mount | fabrica.html | 9,743 | 19.34% of manual throughput |
| portal-mount | lit.html | 19,340 | 38.39% of manual throughput |
| raw-html | manual.createElement | 13,755 | control |
| raw-html | fabrica.html | 12,945 | 94.11% of manual throughput |
| raw-html | lit.html | 9,508 | 69.12% of manual throughput |
| reactive-class-style | manual.createElement | 7,173 | control |
| reactive-class-style | fabrica.html | 2,990 | 41.68% of manual throughput |
| reactive-class-style | lit.html | 5,004 | 69.77% of manual throughput |
| reactive-text | manual.createElement | 55,114 | control |
| reactive-text | fabrica.html | 10,283 | 18.66% of manual throughput |
| reactive-text | lit.html | 16,033 | 29.09% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,696,919 | control |
| shared-registry-resolution | fabrica.html | 1,121,279 | 10.48% of manual throughput |
| shared-registry-resolution | lit.html | 15,139,511 | 141.53% of manual throughput |
| spread-props-events | manual.createElement | 21,953 | control |
| spread-props-events | fabrica.html | 7,776 | 35.42% of manual throughput |
| spread-props-events | lit.html | 9,733 | 44.33% of manual throughput |
| static-tree | manual.createElement | 13,686 | control |
| static-tree | fabrica.html | 11,688 | 85.40% of manual throughput |
| static-tree | lit.html | 12,110 | 88.49% of manual throughput |
| styled-artifact-composition | manual.createElement | 154,620 | control |
| styled-artifact-composition | fabrica.html | 72,337 | 46.78% of manual throughput |
| styled-artifact-composition | lit.html | 35,542 | 22.99% of manual throughput |
| styled-artifact-render | manual.createElement | 155,384 | control |
| styled-artifact-render | fabrica.html | 98,361 | 63.30% of manual throughput |
| styled-artifact-render | lit.html | 38,861 | 25.01% of manual throughput |
| styled-component-registration | manual.createElement | 807,642 | control |
| styled-component-registration | fabrica.html | 120,816 | 14.96% of manual throughput |
| styled-component-registration | lit.html | 1,701,248 | 210.64% of manual throughput |
| two-way-bind | manual.createElement | 41,886 | control |
| two-way-bind | fabrica.html | 11,757 | 28.07% of manual throughput |
| two-way-bind | lit.html | 13,315 | 31.79% of manual throughput |
| virtual-list-window | manual.createElement | 2,192 | control |
| virtual-list-window | fabrica.html | 634 | 28.92% of manual throughput |
| virtual-list-window | lit.html | 1,136 | 51.81% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 5,772 | 5,959 | +3.25% | +4.61% | 8.33% | medium | 0.16781 | 3.01% | 0.41% | ▁██ |
| 🌿 | complex-attributes :: lit.html | 12,003 | 11,975 | -0.24% | +1.08% | 3.00% | high | 0.08351 | 0.84% | 0.19% | █▇▁ |
| 🧭 | complex-attributes :: manual.createElement | 24,053 | 23,739 | -1.30% | — | 3.00% | high | 0.04212 | 0.82% | 0.80% | ▁▄█ |
| 🌿 | conditional-component :: fabrica.html | 1,035 | 1,032 | -0.26% | +0.35% | 9.77% | medium | 0.96889 | 0.73% | 0.54% | ▁█▆ |
| 🌿 | conditional-component :: lit.html | 4,739 | 4,744 | +0.10% | +0.72% | 3.00% | high | 0.21080 | 0.81% | 0.14% | █▇▁ |
| 🧭 | conditional-component :: manual.createElement | 7,371 | 7,326 | -0.61% | — | 3.00% | high | 0.13649 | 1.17% | 0.95% | ▃█▁ |
| 🌿 | forked-registry-resolution :: fabrica.html | 731,823 | 737,393 | +0.76% | +1.75% | 3.00% | high | 0.00136 | 1.76% | 1.15% | █▁▆ |
| 🌿 | forked-registry-resolution :: lit.html | 13,839,653 | 14,083,953 | +1.77% | +2.77% | 3.00% | high | 0.00007 | 1.01% | 1.00% | ▅█▁ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,814,212 | 1,796,552 | -0.97% | — | 3.00% | high | 0.00056 | 3.24% | 0.95% | █▁▇ |
| 🌿 | instance-named-render :: fabrica.html | 8,925 | 8,654 | -3.04% | -2.93% | 6.07% | high | 0.11556 | 2.59% | 3.12% | ▁▅█ |
| 🌿 | instance-named-render :: lit.html | 43,209 | 42,363 | -1.96% | -1.85% | 3.00% | high | 0.02361 | 0.74% | 0.69% | █▁▄ |
| 🧭 | instance-named-render :: manual.createElement | 79,917 | 79,826 | -0.11% | — | 3.00% | high | 0.01253 | 0.22% | 0.17% | ▁█▃ |
| 🌿 | keyed-list-update :: fabrica.html | 109 | 111 | +1.57% | +1.96% | 13.61% | medium | 9.02409 | 0.95% | 0.44% | ▁▇█ |
| 🌿 | keyed-list-update :: lit.html | 485 | 492 | +1.61% | +2.00% | 4.58% | high | 2.03105 | 0.44% | 0.46% | █▅▁ |
| 🧭 | keyed-list-update :: manual.createElement | 855 | 852 | -0.38% | — | 3.31% | high | 1.17349 | 1.30% | 0.44% | ▇█▁ |
| 🌿 | named-component-definition :: fabrica.html | 390,922 | 388,522 | -0.61% | -3.10% | 3.54% | high | 0.00257 | 0.63% | 0.48% | █▃▁ |
| 🐢 | named-component-definition :: lit.html | 3,658,497 | 3,320,746 | -9.23% | -11.50% | 3.34% | high | 0.00030 | 5.00% | 2.68% | ▁█▃ |
| 🧭 | named-component-definition :: manual.createElement | 3,694,834 | 3,789,440 | +2.56% | — | 3.00% | high | 0.00026 | 1.65% | 1.25% | ▆█▁ |
| ⚠️ | named-instance-reuse :: fabrica.html | 203,593 | 317,342 | +55.87% | +56.15% | 15.33% | low | 0.00315 | 0.37% | 0.07% | █▇▁ |
| 🌿 | named-instance-reuse :: lit.html | 14,338,674 | 14,689,392 | +2.45% | +2.63% | 3.00% | high | 0.00007 | 0.36% | 0.02% | ▁██ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,832,909 | 10,813,375 | -0.18% | — | 3.00% | high | 0.00009 | 1.70% | 0.31% | █▁▂ |
| 🌿 | named-styled-registry :: fabrica.html | 9,848 | 9,992 | +1.46% | +3.16% | 3.97% | high | 0.10008 | 0.70% | 0.02% | ██▁ |
| 🌿 | named-styled-registry :: lit.html | 38,373 | 38,468 | +0.25% | +1.92% | 3.00% | high | 0.02600 | 0.88% | 0.66% | █▃▁ |
| 🧭 | named-styled-registry :: manual.createElement | 60,851 | 59,849 | -1.65% | — | 3.00% | high | 0.01671 | 1.12% | 1.13% | ▁█▅ |
| 🌿 | nested-components :: fabrica.html | 1,000 | 1,022 | +2.21% | +2.53% | 16.19% | medium | 0.97839 | 0.84% | 0.08% | ▁██ |
| 🌿 | nested-components :: lit.html | 4,175 | 4,121 | -1.28% | -0.97% | 3.00% | high | 0.24263 | 0.92% | 0.99% | ▄█▁ |
| 🧭 | nested-components :: manual.createElement | 8,566 | 8,540 | -0.31% | — | 3.00% | high | 0.11710 | 1.58% | 1.80% | █▄▁ |
| ⚠️ | portable-definition-install :: fabrica.html | 150,466 | 144,637 | -3.87% | -6.69% | 25.00% | low | 0.00691 | 5.17% | 0.51% | ▁██ |
| 🌿 | portable-definition-install :: lit.html | 10,053,242 | 10,127,607 | +0.74% | -2.21% | 4.29% | high | 0.00010 | 2.86% | 0.26% | █▁█ |
| 🧭 | portable-definition-install :: manual.createElement | 6,538,483 | 6,735,500 | +3.01% | — | 4.29% | high | 0.00015 | 1.84% | 0.88% | █▂▁ |
| 🌿 | portal-mount :: fabrica.html | 9,859 | 9,743 | -1.18% | -2.36% | 9.59% | medium | 0.10263 | 0.93% | 0.09% | ▁█▁ |
| 🌿 | portal-mount :: lit.html | 19,243 | 19,340 | +0.50% | -0.70% | 3.00% | high | 0.05171 | 0.94% | 0.78% | ▆█▁ |
| 🧭 | portal-mount :: manual.createElement | 49,772 | 50,375 | +1.21% | — | 3.00% | high | 0.01985 | 1.29% | 1.27% | ▁█▅ |
| 🌿 | raw-html :: fabrica.html | 12,951 | 12,945 | -0.05% | +0.93% | 6.55% | high | 0.07725 | 0.98% | 0.21% | ▇█▁ |
| 🌿 | raw-html :: lit.html | 9,427 | 9,508 | +0.85% | +1.84% | 3.25% | high | 0.10518 | 1.29% | 0.60% | ▂█▁ |
| 🧭 | raw-html :: manual.createElement | 13,889 | 13,755 | -0.97% | — | 3.25% | high | 0.07270 | 3.21% | 3.25% | ▅█▁ |
| 🚀 | reactive-class-style :: fabrica.html | 2,825 | 2,990 | +5.84% | +5.67% | 5.59% | high | 0.33445 | 2.25% | 2.22% | ▁█▅ |
| 🌿 | reactive-class-style :: lit.html | 4,982 | 5,004 | +0.45% | +0.29% | 10.18% | medium | 0.19982 | 2.89% | 2.72% | ▁█▄ |
| 🧭 | reactive-class-style :: manual.createElement | 7,161 | 7,173 | +0.17% | — | 3.00% | high | 0.13941 | 0.76% | 0.22% | ▂█▁ |
| 🌿 | reactive-text :: fabrica.html | 10,264 | 10,283 | +0.19% | -0.03% | 11.04% | medium | 0.09725 | 1.90% | 1.87% | █▄▁ |
| 🌿 | reactive-text :: lit.html | 15,670 | 16,033 | +2.32% | +2.10% | 3.00% | high | 0.06237 | 1.85% | 2.19% | ▅█▁ |
| 🧭 | reactive-text :: manual.createElement | 54,994 | 55,114 | +0.22% | — | 3.00% | high | 0.01814 | 0.34% | 0.12% | █▂▁ |
| 🌿 | shared-registry-resolution :: fabrica.html | 1,115,642 | 1,121,279 | +0.51% | +0.95% | 3.00% | high | 0.00089 | 0.35% | 0.30% | ▁▃█ |
| 🚀 | shared-registry-resolution :: lit.html | 14,530,085 | 15,139,511 | +4.19% | +4.66% | 3.00% | high | 0.00007 | 0.87% | 0.48% | █▆▁ |
| 🧭 | shared-registry-resolution :: manual.createElement | 10,744,570 | 10,696,919 | -0.44% | — | 3.00% | high | 0.00009 | 2.13% | 0.55% | █▁▂ |
| 🌿 | spread-props-events :: fabrica.html | 7,966 | 7,776 | -2.39% | -3.07% | 10.44% | medium | 0.12860 | 1.49% | 0.05% | ▁██ |
| 🌿 | spread-props-events :: lit.html | 9,715 | 9,733 | +0.18% | -0.52% | 14.19% | medium | 0.10275 | 1.72% | 1.20% | ▃█▁ |
| 🧭 | spread-props-events :: manual.createElement | 21,799 | 21,953 | +0.70% | — | 3.00% | high | 0.04555 | 1.94% | 2.37% | ▄█▁ |
| 🌿 | static-tree :: fabrica.html | 11,724 | 11,688 | -0.31% | -0.04% | 3.13% | high | 0.08556 | 0.77% | 0.27% | █▁▂ |
| 🌿 | static-tree :: lit.html | 12,508 | 12,110 | -3.18% | -2.91% | 3.05% | high | 0.08258 | 0.07% | 0.03% | █▁▇ |
| 🧭 | static-tree :: manual.createElement | 13,723 | 13,686 | -0.27% | — | 3.00% | high | 0.07307 | 0.68% | 0.47% | ▃▁█ |
| 🌿 | styled-artifact-composition :: fabrica.html | 71,048 | 72,337 | +1.81% | +2.15% | 3.00% | high | 0.01382 | 1.03% | 0.33% | █▇▁ |
| 🌿 | styled-artifact-composition :: lit.html | 36,201 | 35,542 | -1.82% | -1.50% | 3.00% | high | 0.02814 | 1.33% | 0.55% | █▂▁ |
| 🧭 | styled-artifact-composition :: manual.createElement | 155,125 | 154,620 | -0.33% | — | 3.00% | high | 0.00647 | 1.28% | 0.43% | ▇█▁ |
| 🌿 | styled-artifact-render :: fabrica.html | 97,856 | 98,361 | +0.52% | +0.10% | 3.00% | high | 0.01017 | 1.27% | 0.71% | ▁▃█ |
| 🌿 | styled-artifact-render :: lit.html | 38,957 | 38,861 | -0.25% | -0.66% | 3.00% | high | 0.02573 | 0.33% | 0.03% | ▁█▁ |
| 🧭 | styled-artifact-render :: manual.createElement | 154,743 | 155,384 | +0.41% | — | 3.00% | high | 0.00644 | 0.56% | 0.32% | ▁▆█ |
| ⚠️ | styled-component-registration :: fabrica.html | 122,263 | 120,816 | -1.18% | -2.72% | 20.27% | low | 0.00828 | 3.11% | 1.47% | ▂▁█ |
| 🌿 | styled-component-registration :: lit.html | 1,646,254 | 1,701,248 | +3.34% | +1.73% | 6.80% | medium | 0.00059 | 3.63% | 0.94% | █▇▁ |
| 🧭 | styled-component-registration :: manual.createElement | 795,068 | 807,642 | +1.58% | — | 3.00% | high | 0.00124 | 0.49% | 0.10% | █▂▁ |
| 🌿 | two-way-bind :: fabrica.html | 11,455 | 11,757 | +2.64% | +4.62% | 16.46% | medium | 0.08506 | 1.01% | 0.70% | ▁▆█ |
| 🌿 | two-way-bind :: lit.html | 12,967 | 13,315 | +2.68% | +4.66% | 17.76% | medium | 0.07511 | 0.67% | 0.10% | ██▁ |
| 🧭 | two-way-bind :: manual.createElement | 42,694 | 41,886 | -1.89% | — | 11.80% | medium | 0.02387 | 2.58% | 2.95% | ▁▅█ |
| ⚠️ | virtual-list-window :: fabrica.html | 632 | 634 | +0.25% | -2.10% | 19.61% | low | 1.57767 | 1.97% | 2.12% | ▁█▄ |
| 🌿 | virtual-list-window :: lit.html | 1,136 | 1,136 | -0.03% | -2.37% | 3.00% | high | 0.88059 | 1.65% | 1.27% | ▆█▁ |
| 🧭 | virtual-list-window :: manual.createElement | 2,141 | 2,192 | +2.40% | — | 3.00% | high | 0.45621 | 1.38% | 1.02% | ▁█▃ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
