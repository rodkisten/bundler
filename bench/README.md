<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `1b10f9c6` · baseline `ad9a76ca` · generated 2026-07-01T22:13:38.581Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000005184 · Linux · X64 |
| CPU | AMD EPYC 7763 64-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.17.0 · V8 13.6.233.17-node.49 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.27 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.10% | +0.10% | 0 | 0 | 19 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🚀 +4.78% | +1.29% | 8 | 1 | 32 | 3 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** +0.10%  
**Raw geometric mean:** +0.10%

### 🚀 Fastest reliable improvements

_None outside the reliability threshold._

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 186,445 | 187,063 | +0.33% | — | 3.00% | high | 0.00535 | 1.01% | 1.02% | █▅▁ |
| 🌿 | class name: privacy redaction and truncation | 143,915 | 145,046 | +0.79% | — | 3.00% | high | 0.00689 | 0.74% | 0.28% | ▇█▁ |
| 🌿 | class name: readable property-value-context-hash | 186,805 | 185,897 | -0.49% | — | 3.00% | high | 0.00538 | 0.79% | 0.66% | █▃▁ |
| 🌿 | cold atomic.css: transform parse compile | 2,129 | 2,168 | +1.82% | — | 3.47% | high | 0.46123 | 2.24% | 0.85% | ▁█▇ |
| 🌿 | cold css: atomic detection + compile | 2,244 | 2,231 | -0.58% | — | 3.25% | high | 0.44815 | 0.40% | 0.45% | █▁▄ |
| 🌿 | cold css: configure parse + normalized apply | 11,304 | 11,255 | -0.43% | — | 4.80% | high | 0.08885 | 2.15% | 0.12% | ▁▁█ |
| 🌿 | cold css: sheet detection + compile | 2,478 | 2,520 | +1.69% | — | 3.00% | high | 0.39686 | 0.44% | 0.00% | █▁█ |
| 🌿 | cold sheet.css: transform parse compile | 2,478 | 2,508 | +1.21% | — | 3.02% | high | 0.39868 | 1.09% | 1.31% | ▁▅█ |
| 🌿 | stylis: nested stylesheet compile | 76,887 | 76,614 | -0.36% | — | 3.00% | high | 0.01305 | 0.24% | 0.08% | █▇▁ |
| 🌿 | stylis: tiny declaration compile | 1,509,870 | 1,531,916 | +1.46% | — | 3.00% | high | 0.00065 | 0.25% | 0.15% | ▆▁█ |
| 🧭 | baseline: String.raw tiny css | 3,084,940 | 3,213,340 | +4.16% | — | 3.00% | high | 0.00031 | 2.57% | 1.87% | ▆▁█ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 239,844 | 234,828 | -2.09% | — | 3.53% | high | 0.00426 | 1.83% | 1.01% | ▃▁█ |
| 🌿 | warm atomic.css: classic atomic compile | 412,909 | 414,579 | +0.40% | — | 3.00% | high | 0.00241 | 2.20% | 0.70% | ▇█▁ |
| 🌿 | warm atomic.css.withImportant | 241,882 | 238,829 | -1.26% | — | 3.00% | high | 0.00419 | 0.64% | 0.07% | ▁█▁ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,427,020 | 1,442,113 | +1.06% | — | 3.00% | high | 0.00069 | 1.71% | 0.85% | █▇▁ |
| 🌿 | warm css: polymorphic sheet identity hit | 697,822 | 686,787 | -1.58% | — | 3.00% | high | 0.00146 | 0.18% | 0.16% | █▁▅ |
| 🌿 | warm css: prepared configure plan hit | 4,728,473 | 4,770,395 | +0.89% | — | 3.05% | high | 0.00021 | 1.56% | 0.57% | █▁▇ |
| 🌿 | warm inline.css: inline style compile | 412,035 | 415,412 | +0.82% | — | 3.00% | high | 0.00241 | 1.19% | 0.01% | ██▁ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 164,882 | 163,715 | -0.71% | — | 3.00% | high | 0.00611 | 0.25% | 0.15% | ▁█▃ |
| 🌿 | warm sheet.css.withImportant | 163,843 | 162,233 | -0.98% | — | 3.00% | high | 0.00616 | 0.42% | 0.12% | █▂▁ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** +4.78%  
**Raw geometric mean:** +1.29%

### 🚀 Fastest reliable improvements

1. **styled-component-registration :: lit.html** · +54.90% normalized · low confidence
2. **named-component-definition :: lit.html** · +51.38% normalized · medium confidence
3. **reactive-class-style :: lit.html** · +45.06% normalized · medium confidence
4. **named-component-definition :: fabrica.html** · +40.33% normalized · medium confidence
5. **reactive-class-style :: fabrica.html** · +18.62% normalized · medium confidence

### 🐢 Largest reliable regressions

1. **spread-props-events :: lit.html** · -20.21% normalized · medium confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 20.75% noise floor
3. **virtual-list-window :: fabrica.html** · 18.91% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 23,568 | control |
| complex-attributes | fabrica.html | 6,025 | 25.56% of manual throughput |
| complex-attributes | lit.html | 12,361 | 52.45% of manual throughput |
| conditional-component | manual.createElement | 7,411 | control |
| conditional-component | fabrica.html | 1,073 | 14.48% of manual throughput |
| conditional-component | lit.html | 4,886 | 65.93% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,698,454 | control |
| forked-registry-resolution | fabrica.html | 711,437 | 41.89% of manual throughput |
| forked-registry-resolution | lit.html | 13,955,684 | 821.67% of manual throughput |
| instance-named-render | manual.createElement | 78,963 | control |
| instance-named-render | fabrica.html | 9,061 | 11.48% of manual throughput |
| instance-named-render | lit.html | 43,248 | 54.77% of manual throughput |
| keyed-list-update | manual.createElement | 864 | control |
| keyed-list-update | fabrica.html | 115 | 13.30% of manual throughput |
| keyed-list-update | lit.html | 499 | 57.81% of manual throughput |
| named-component-definition | manual.createElement | 2,669,758 | control |
| named-component-definition | fabrica.html | 383,085 | 14.35% of manual throughput |
| named-component-definition | lit.html | 3,810,196 | 142.72% of manual throughput |
| named-instance-reuse | manual.createElement | 10,615,938 | control |
| named-instance-reuse | fabrica.html | 321,025 | 3.02% of manual throughput |
| named-instance-reuse | lit.html | 14,651,834 | 138.02% of manual throughput |
| named-styled-registry | manual.createElement | 60,015 | control |
| named-styled-registry | fabrica.html | 10,214 | 17.02% of manual throughput |
| named-styled-registry | lit.html | 38,811 | 64.67% of manual throughput |
| nested-components | manual.createElement | 8,697 | control |
| nested-components | fabrica.html | 1,066 | 12.26% of manual throughput |
| nested-components | lit.html | 4,316 | 49.63% of manual throughput |
| portable-definition-install | manual.createElement | 6,854,315 | control |
| portable-definition-install | fabrica.html | 150,486 | 2.20% of manual throughput |
| portable-definition-install | lit.html | 9,954,829 | 145.23% of manual throughput |
| portal-mount | manual.createElement | 49,852 | control |
| portal-mount | fabrica.html | 10,334 | 20.73% of manual throughput |
| portal-mount | lit.html | 19,792 | 39.70% of manual throughput |
| raw-html | manual.createElement | 13,880 | control |
| raw-html | fabrica.html | 13,043 | 93.97% of manual throughput |
| raw-html | lit.html | 9,626 | 69.35% of manual throughput |
| reactive-class-style | manual.createElement | 5,946 | control |
| reactive-class-style | fabrica.html | 2,943 | 49.49% of manual throughput |
| reactive-class-style | lit.html | 6,241 | 104.95% of manual throughput |
| reactive-text | manual.createElement | 55,817 | control |
| reactive-text | fabrica.html | 10,778 | 19.31% of manual throughput |
| reactive-text | lit.html | 16,438 | 29.45% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,757,471 | control |
| shared-registry-resolution | fabrica.html | 1,105,940 | 10.28% of manual throughput |
| shared-registry-resolution | lit.html | 14,666,665 | 136.34% of manual throughput |
| spread-props-events | manual.createElement | 22,837 | control |
| spread-props-events | fabrica.html | 7,956 | 34.84% of manual throughput |
| spread-props-events | lit.html | 7,746 | 33.92% of manual throughput |
| static-tree | manual.createElement | 14,074 | control |
| static-tree | fabrica.html | 12,163 | 86.42% of manual throughput |
| static-tree | lit.html | 12,456 | 88.51% of manual throughput |
| styled-artifact-composition | manual.createElement | 150,031 | control |
| styled-artifact-composition | fabrica.html | 71,571 | 47.70% of manual throughput |
| styled-artifact-composition | lit.html | 36,224 | 24.14% of manual throughput |
| styled-artifact-render | manual.createElement | 149,160 | control |
| styled-artifact-render | fabrica.html | 96,609 | 64.77% of manual throughput |
| styled-artifact-render | lit.html | 39,263 | 26.32% of manual throughput |
| styled-component-registration | manual.createElement | 788,797 | control |
| styled-component-registration | fabrica.html | 121,439 | 15.40% of manual throughput |
| styled-component-registration | lit.html | 2,471,876 | 313.37% of manual throughput |
| two-way-bind | manual.createElement | 43,365 | control |
| two-way-bind | fabrica.html | 11,709 | 27.00% of manual throughput |
| two-way-bind | lit.html | 13,656 | 31.49% of manual throughput |
| virtual-list-window | manual.createElement | 2,206 | control |
| virtual-list-window | fabrica.html | 644 | 29.19% of manual throughput |
| virtual-list-window | lit.html | 1,149 | 52.11% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 5,891 | 6,025 | +2.27% | +4.75% | 7.88% | medium | 0.16598 | 0.61% | 0.16% | ▁▇█ |
| 🌿 | complex-attributes :: lit.html | 12,308 | 12,361 | +0.44% | +2.87% | 3.00% | high | 0.08090 | 1.63% | 0.95% | █▁▆ |
| 🧭 | complex-attributes :: manual.createElement | 24,139 | 23,568 | -2.37% | — | 3.00% | high | 0.04243 | 1.30% | 0.93% | █▃▁ |
| 🌿 | conditional-component :: fabrica.html | 1,068 | 1,073 | +0.48% | -0.79% | 8.33% | medium | 0.93197 | 1.20% | 0.94% | ▃▁█ |
| 🚀 | conditional-component :: lit.html | 4,646 | 4,886 | +5.17% | +3.84% | 3.45% | high | 0.20465 | 2.34% | 0.97% | █▁▇ |
| 🧭 | conditional-component :: manual.createElement | 7,317 | 7,411 | +1.28% | — | 3.45% | high | 0.13493 | 1.05% | 0.50% | ▇█▁ |
| 🌿 | forked-registry-resolution :: fabrica.html | 715,669 | 711,437 | -0.59% | -0.35% | 3.66% | high | 0.00141 | 2.23% | 0.28% | ██▁ |
| 🌿 | forked-registry-resolution :: lit.html | 13,721,588 | 13,955,684 | +1.71% | +1.95% | 3.00% | high | 0.00007 | 6.48% | 1.18% | ▇▁█ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,702,558 | 1,698,454 | -0.24% | — | 3.00% | high | 0.00059 | 4.12% | 0.64% | ▁▁█ |
| 🌿 | instance-named-render :: fabrica.html | 8,918 | 9,061 | +1.60% | +5.12% | 6.44% | high | 0.11036 | 1.95% | 2.11% | █▁▅ |
| 🚀 | instance-named-render :: lit.html | 43,392 | 43,248 | -0.33% | +3.12% | 3.00% | high | 0.02312 | 1.11% | 0.84% | █▃▁ |
| 🧭 | instance-named-render :: manual.createElement | 81,699 | 78,963 | -3.35% | — | 3.00% | high | 0.01266 | 1.78% | 0.27% | ██▁ |
| 🌿 | keyed-list-update :: fabrica.html | 112 | 115 | +2.34% | +1.55% | 12.24% | medium | 8.70349 | 1.08% | 0.52% | ▁▂█ |
| 🌿 | keyed-list-update :: lit.html | 500 | 499 | -0.03% | -0.80% | 4.61% | high | 2.00261 | 0.90% | 1.01% | ▄▁█ |
| 🧭 | keyed-list-update :: manual.createElement | 857 | 864 | +0.77% | — | 3.32% | high | 1.15780 | 1.78% | 0.51% | █▁▇ |
| 🚀 | named-component-definition :: fabrica.html | 391,726 | 383,085 | -2.21% | +40.33% | 8.81% | medium | 0.00261 | 4.49% | 1.42% | ▇▁█ |
| 🚀 | named-component-definition :: lit.html | 3,611,706 | 3,810,196 | +5.50% | +51.38% | 8.86% | medium | 0.00026 | 9.84% | 2.94% | ▇▁█ |
| 🧭 | named-component-definition :: manual.createElement | 3,831,014 | 2,669,758 | -30.31% | — | 8.57% | medium | 0.00037 | 2.96% | 1.21% | ▁█▂ |
| 🌿 | named-instance-reuse :: fabrica.html | 313,459 | 321,025 | +2.41% | -0.51% | 4.53% | high | 0.00312 | 0.08% | 0.03% | ▁▂█ |
| 🌿 | named-instance-reuse :: lit.html | 14,488,955 | 14,651,834 | +1.12% | -1.77% | 4.53% | high | 0.00007 | 6.72% | 0.93% | █▁█ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,312,357 | 10,615,938 | +2.94% | — | 4.53% | high | 0.00009 | 4.97% | 4.53% | ▅▁█ |
| 🌿 | named-styled-registry :: fabrica.html | 10,184 | 10,214 | +0.29% | +1.56% | 3.72% | high | 0.09791 | 1.54% | 0.80% | ▆▁█ |
| 🌿 | named-styled-registry :: lit.html | 39,095 | 38,811 | -0.73% | +0.52% | 3.00% | high | 0.02577 | 1.70% | 0.56% | █▁▂ |
| 🧭 | named-styled-registry :: manual.createElement | 60,771 | 60,015 | -1.24% | — | 3.00% | high | 0.01666 | 1.06% | 0.61% | ▆█▁ |
| 🌿 | nested-components :: fabrica.html | 1,035 | 1,066 | +3.00% | +3.03% | 14.89% | medium | 0.93808 | 2.23% | 0.21% | ▁██ |
| 🌿 | nested-components :: lit.html | 4,262 | 4,316 | +1.28% | +1.30% | 3.00% | high | 0.23168 | 1.44% | 0.61% | █▁▇ |
| 🧭 | nested-components :: manual.createElement | 8,700 | 8,697 | -0.03% | — | 3.00% | high | 0.11498 | 1.07% | 0.07% | ██▁ |
| ⚠️ | portable-definition-install :: fabrica.html | 147,185 | 150,486 | +2.24% | +3.68% | 25.00% | low | 0.00665 | 1.39% | 0.10% | ▁██ |
| 🌿 | portable-definition-install :: lit.html | 10,080,385 | 9,954,829 | -1.25% | +0.15% | 3.31% | high | 0.00010 | 7.14% | 2.87% | █▁▇ |
| 🧭 | portable-definition-install :: manual.createElement | 6,950,832 | 6,854,315 | -1.39% | — | 3.00% | high | 0.00015 | 3.00% | 1.21% | █▁▇ |
| 🌿 | portal-mount :: fabrica.html | 10,168 | 10,334 | +1.63% | +3.31% | 8.75% | medium | 0.09677 | 0.38% | 0.22% | █▆▁ |
| 🌿 | portal-mount :: lit.html | 19,741 | 19,792 | +0.26% | +1.91% | 3.00% | high | 0.05053 | 3.21% | 1.40% | █▁▇ |
| 🧭 | portal-mount :: manual.createElement | 50,673 | 49,852 | -1.62% | — | 3.00% | high | 0.02006 | 1.03% | 0.89% | █▅▁ |
| 🌿 | raw-html :: fabrica.html | 13,139 | 13,043 | -0.73% | -1.16% | 5.90% | high | 0.07667 | 0.51% | 0.55% | ▄▁█ |
| 🌿 | raw-html :: lit.html | 9,420 | 9,626 | +2.19% | +1.74% | 3.00% | high | 0.10389 | 1.79% | 0.89% | █▁▆ |
| 🧭 | raw-html :: manual.createElement | 13,819 | 13,880 | +0.44% | — | 3.00% | high | 0.07205 | 1.65% | 2.02% | ▅▁█ |
| 🚀 | reactive-class-style :: fabrica.html | 2,998 | 2,943 | -1.83% | +18.62% | 8.17% | medium | 0.33980 | 0.92% | 0.65% | ▃█▁ |
| 🚀 | reactive-class-style :: lit.html | 5,199 | 6,241 | +20.05% | +45.06% | 8.96% | medium | 0.16023 | 2.90% | 0.91% | █▂▁ |
| 🧭 | reactive-class-style :: manual.createElement | 7,185 | 5,946 | -17.24% | — | 6.62% | medium | 0.16817 | 0.89% | 0.77% | █▁▆ |
| 🌿 | reactive-text :: fabrica.html | 10,673 | 10,778 | +0.98% | +2.33% | 10.17% | medium | 0.09278 | 0.81% | 0.15% | ▇█▁ |
| 🌿 | reactive-text :: lit.html | 16,304 | 16,438 | +0.82% | +2.17% | 3.00% | high | 0.06083 | 0.80% | 0.49% | ▁▃█ |
| 🧭 | reactive-text :: manual.createElement | 56,560 | 55,817 | -1.31% | — | 3.00% | high | 0.01792 | 1.39% | 1.61% | █▅▁ |
| 🌿 | shared-registry-resolution :: fabrica.html | 1,123,391 | 1,105,940 | -1.55% | -0.85% | 3.00% | high | 0.00090 | 5.72% | 1.49% | █▇▁ |
| 🌿 | shared-registry-resolution :: lit.html | 14,896,949 | 14,666,665 | -1.55% | -0.84% | 3.00% | high | 0.00007 | 5.76% | 1.59% | █▁▇ |
| 🧭 | shared-registry-resolution :: manual.createElement | 10,834,223 | 10,757,471 | -0.71% | — | 3.00% | high | 0.00009 | 3.48% | 1.39% | ▇▁█ |
| 🌿 | spread-props-events :: fabrica.html | 7,959 | 7,956 | -0.03% | -0.80% | 9.69% | medium | 0.12568 | 2.13% | 2.07% | ▅▁█ |
| 🐢 | spread-props-events :: lit.html | 9,633 | 7,746 | -19.59% | -20.21% | 13.93% | medium | 0.12910 | 3.32% | 3.69% | █▅▁ |
| 🧭 | spread-props-events :: manual.createElement | 22,661 | 22,837 | +0.77% | — | 3.00% | high | 0.04379 | 1.46% | 1.24% | ▆█▁ |
| 🌿 | static-tree :: fabrica.html | 12,083 | 12,163 | +0.66% | +0.55% | 3.20% | high | 0.08222 | 2.32% | 0.35% | █▁█ |
| 🌿 | static-tree :: lit.html | 12,480 | 12,456 | -0.19% | -0.30% | 3.20% | high | 0.08028 | 1.01% | 0.23% | █▂▁ |
| 🧭 | static-tree :: manual.createElement | 14,058 | 14,074 | +0.11% | — | 3.20% | high | 0.07106 | 1.75% | 0.99% | ▆█▁ |
| 🌿 | styled-artifact-composition :: fabrica.html | 73,799 | 71,571 | -3.02% | +0.67% | 3.00% | high | 0.01397 | 1.88% | 2.12% | █▄▁ |
| 🌿 | styled-artifact-composition :: lit.html | 36,926 | 36,224 | -1.90% | +1.83% | 3.00% | high | 0.02761 | 1.24% | 1.50% | █▁▄ |
| 🧭 | styled-artifact-composition :: manual.createElement | 155,734 | 150,031 | -3.66% | — | 3.00% | high | 0.00667 | 1.55% | 1.68% | █▄▁ |
| 🌿 | styled-artifact-render :: fabrica.html | 99,890 | 96,609 | -3.28% | +0.79% | 3.00% | high | 0.01035 | 1.87% | 1.02% | █▃▁ |
| 🌿 | styled-artifact-render :: lit.html | 40,217 | 39,263 | -2.37% | +1.74% | 3.00% | high | 0.02547 | 1.59% | 0.56% | █▁▂ |
| 🧭 | styled-artifact-render :: manual.createElement | 155,447 | 149,160 | -4.04% | — | 3.00% | high | 0.00670 | 4.41% | 0.92% | ▇█▁ |
| ⚠️ | styled-component-registration :: fabrica.html | 122,195 | 121,439 | -0.62% | -0.73% | 20.75% | low | 0.00823 | 3.43% | 2.92% | ▃▁█ |
| 🚀 | styled-component-registration :: lit.html | 1,593,901 | 2,471,876 | +55.08% | +54.90% | 14.93% | low | 0.00040 | 0.66% | 0.34% | █▁▆ |
| 🧭 | styled-component-registration :: manual.createElement | 787,884 | 788,797 | +0.12% | — | 3.00% | high | 0.00127 | 0.65% | 0.36% | █▁▃ |
| 🌿 | two-way-bind :: fabrica.html | 11,857 | 11,709 | -1.25% | -1.33% | 16.48% | medium | 0.08540 | 0.75% | 0.13% | ▇█▁ |
| 🌿 | two-way-bind :: lit.html | 13,515 | 13,656 | +1.04% | +0.96% | 17.22% | medium | 0.07323 | 0.31% | 0.25% | ▃▁█ |
| 🧭 | two-way-bind :: manual.createElement | 43,329 | 43,365 | +0.08% | — | 12.21% | medium | 0.02306 | 2.10% | 2.09% | ▅█▁ |
| ⚠️ | virtual-list-window :: fabrica.html | 656 | 644 | -1.77% | +0.73% | 18.91% | low | 1.55292 | 1.50% | 0.56% | ▁▇█ |
| 🚀 | virtual-list-window :: lit.html | 1,143 | 1,149 | +0.57% | +3.12% | 3.00% | high | 0.86999 | 0.83% | 0.50% | ▆▁█ |
| 🧭 | virtual-list-window :: manual.createElement | 2,262 | 2,206 | -2.48% | — | 3.00% | high | 0.45338 | 1.55% | 1.90% | █▅▁ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
