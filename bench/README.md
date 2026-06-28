<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `5fcacd37` · baseline `ada7ae91` · generated 2026-06-28T12:05:31.836Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000004932 · Linux · X64 |
| CPU | AMD EPYC 7763 64-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.17.0 · V8 13.6.233.17-node.49 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.12 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.11% | +0.11% | 1 | 0 | 18 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 +1.53% | +2.67% | 4 | 2 | 35 | 3 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** +0.11%  
**Raw geometric mean:** +0.11%

### 🚀 Fastest reliable improvements

1. **cold atomic.css: transform parse compile** · +4.41% raw · high confidence

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 186,161 | 185,755 | -0.22% | — | 3.00% | high | 0.00538 | 0.91% | 0.58% | █▁▆ |
| 🌿 | class name: privacy redaction and truncation | 145,090 | 143,005 | -1.44% | — | 3.00% | high | 0.00699 | 1.05% | 0.62% | █▁▃ |
| 🌿 | class name: readable property-value-context-hash | 187,187 | 185,463 | -0.92% | — | 3.00% | high | 0.00539 | 0.84% | 0.86% | █▁▄ |
| 🚀 | cold atomic.css: transform parse compile | 2,066 | 2,158 | +4.41% | — | 3.50% | high | 0.46347 | 0.33% | 0.32% | █▁▅ |
| 🌿 | cold css: atomic detection + compile | 2,225 | 2,236 | +0.47% | — | 3.31% | high | 0.44729 | 0.58% | 0.03% | ▁██ |
| 🌿 | cold css: configure parse + normalized apply | 11,092 | 11,299 | +1.87% | — | 4.88% | high | 0.08851 | 2.45% | 0.02% | ▁██ |
| 🌿 | cold css: sheet detection + compile | 2,441 | 2,490 | +2.01% | — | 3.00% | high | 0.40158 | 0.35% | 0.39% | ▄▁█ |
| 🌿 | cold sheet.css: transform parse compile | 2,523 | 2,468 | -2.16% | — | 3.21% | high | 0.40519 | 0.59% | 0.64% | █▅▁ |
| 🌿 | stylis: nested stylesheet compile | 76,586 | 77,546 | +1.25% | — | 3.00% | high | 0.01290 | 0.50% | 0.07% | █▁█ |
| 🌿 | stylis: tiny declaration compile | 1,526,185 | 1,535,270 | +0.60% | — | 3.00% | high | 0.00065 | 1.01% | 1.15% | █▅▁ |
| 🧭 | baseline: String.raw tiny css | 3,217,426 | 3,140,904 | -2.38% | — | 3.00% | high | 0.00032 | 2.08% | 2.19% | ▁█▅ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 243,503 | 238,359 | -2.11% | — | 3.00% | high | 0.00420 | 0.57% | 0.07% | ▁▁█ |
| 🌿 | warm atomic.css: classic atomic compile | 418,101 | 412,402 | -1.36% | — | 3.00% | high | 0.00242 | 2.09% | 2.16% | ▁▅█ |
| 🌿 | warm atomic.css.withImportant | 242,175 | 243,759 | +0.65% | — | 3.00% | high | 0.00410 | 0.44% | 0.51% | ▁▄█ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,464,291 | 1,471,412 | +0.49% | — | 3.00% | high | 0.00068 | 1.86% | 0.27% | ▁▁█ |
| 🌿 | warm css: polymorphic sheet identity hit | 705,408 | 707,899 | +0.35% | — | 3.00% | high | 0.00141 | 1.34% | 1.23% | ▁▅█ |
| 🌿 | warm css: prepared configure plan hit | 4,762,148 | 4,731,369 | -0.65% | — | 3.00% | high | 0.00021 | 2.72% | 1.11% | ▁▂█ |
| 🌿 | warm inline.css: inline style compile | 412,886 | 410,788 | -0.51% | — | 3.00% | high | 0.00243 | 0.59% | 0.03% | ▁▁█ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 163,856 | 163,083 | -0.47% | — | 3.00% | high | 0.00613 | 0.23% | 0.01% | ▁▁█ |
| 🌿 | warm sheet.css.withImportant | 162,868 | 163,039 | +0.11% | — | 3.00% | high | 0.00613 | 0.21% | 0.08% | ▁▂█ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** +1.53%  
**Raw geometric mean:** +2.67%

### 🚀 Fastest reliable improvements

1. **forked-registry-resolution :: fabrica.html** · +114.23% normalized · high confidence
2. **shared-registry-resolution :: fabrica.html** · +8.87% normalized · high confidence
3. **reactive-class-style :: lit.html** · +4.30% normalized · high confidence
4. **styled-artifact-composition :: lit.html** · +3.19% normalized · high confidence

### 🐢 Largest reliable regressions

1. **styled-artifact-render :: fabrica.html** · -3.88% normalized · high confidence
2. **static-tree :: lit.html** · -3.66% normalized · high confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 20.87% noise floor
3. **virtual-list-window :: fabrica.html** · 18.98% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 23,610 | control |
| complex-attributes | fabrica.html | 4,677 | 19.81% of manual throughput |
| complex-attributes | lit.html | 12,054 | 51.05% of manual throughput |
| conditional-component | manual.createElement | 7,467 | control |
| conditional-component | fabrica.html | 1,065 | 14.26% of manual throughput |
| conditional-component | lit.html | 4,738 | 63.45% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,782,515 | control |
| forked-registry-resolution | fabrica.html | 715,199 | 40.12% of manual throughput |
| forked-registry-resolution | lit.html | 13,939,270 | 782.00% of manual throughput |
| instance-named-render | manual.createElement | 79,736 | control |
| instance-named-render | fabrica.html | 6,386 | 8.01% of manual throughput |
| instance-named-render | lit.html | 42,635 | 53.47% of manual throughput |
| keyed-list-update | manual.createElement | 865 | control |
| keyed-list-update | fabrica.html | 105 | 12.08% of manual throughput |
| keyed-list-update | lit.html | 491 | 56.68% of manual throughput |
| named-component-definition | manual.createElement | 3,880,382 | control |
| named-component-definition | fabrica.html | 390,092 | 10.05% of manual throughput |
| named-component-definition | lit.html | 3,308,718 | 85.27% of manual throughput |
| named-instance-reuse | manual.createElement | 10,756,724 | control |
| named-instance-reuse | fabrica.html | 320,430 | 2.98% of manual throughput |
| named-instance-reuse | lit.html | 14,533,197 | 135.11% of manual throughput |
| named-styled-registry | manual.createElement | 60,303 | control |
| named-styled-registry | fabrica.html | 6,876 | 11.40% of manual throughput |
| named-styled-registry | lit.html | 39,226 | 65.05% of manual throughput |
| nested-components | manual.createElement | 8,786 | control |
| nested-components | fabrica.html | 808 | 9.20% of manual throughput |
| nested-components | lit.html | 4,314 | 49.10% of manual throughput |
| portable-definition-install | manual.createElement | 6,849,675 | control |
| portable-definition-install | fabrica.html | 147,949 | 2.16% of manual throughput |
| portable-definition-install | lit.html | 9,966,118 | 145.50% of manual throughput |
| portal-mount | manual.createElement | 49,977 | control |
| portal-mount | fabrica.html | 7,866 | 15.74% of manual throughput |
| portal-mount | lit.html | 19,317 | 38.65% of manual throughput |
| raw-html | manual.createElement | 14,019 | control |
| raw-html | fabrica.html | 8,283 | 59.08% of manual throughput |
| raw-html | lit.html | 9,637 | 68.74% of manual throughput |
| reactive-class-style | manual.createElement | 7,045 | control |
| reactive-class-style | fabrica.html | 2,638 | 37.45% of manual throughput |
| reactive-class-style | lit.html | 6,361 | 90.29% of manual throughput |
| reactive-text | manual.createElement | 56,149 | control |
| reactive-text | fabrica.html | 7,428 | 13.23% of manual throughput |
| reactive-text | lit.html | 16,250 | 28.94% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,356,119 | control |
| shared-registry-resolution | fabrica.html | 1,120,886 | 10.82% of manual throughput |
| shared-registry-resolution | lit.html | 14,836,581 | 143.26% of manual throughput |
| spread-props-events | manual.createElement | 21,739 | control |
| spread-props-events | fabrica.html | 5,810 | 26.72% of manual throughput |
| spread-props-events | lit.html | 8,302 | 38.19% of manual throughput |
| static-tree | manual.createElement | 13,982 | control |
| static-tree | fabrica.html | 5,715 | 40.87% of manual throughput |
| static-tree | lit.html | 12,365 | 88.44% of manual throughput |
| styled-artifact-composition | manual.createElement | 152,391 | control |
| styled-artifact-composition | fabrica.html | 72,144 | 47.34% of manual throughput |
| styled-artifact-composition | lit.html | 36,235 | 23.78% of manual throughput |
| styled-artifact-render | manual.createElement | 151,178 | control |
| styled-artifact-render | fabrica.html | 98,197 | 64.95% of manual throughput |
| styled-artifact-render | lit.html | 39,275 | 25.98% of manual throughput |
| styled-component-registration | manual.createElement | 791,116 | control |
| styled-component-registration | fabrica.html | 123,541 | 15.62% of manual throughput |
| styled-component-registration | lit.html | 2,436,813 | 308.02% of manual throughput |
| two-way-bind | manual.createElement | 42,289 | control |
| two-way-bind | fabrica.html | 8,433 | 19.94% of manual throughput |
| two-way-bind | lit.html | 13,013 | 30.77% of manual throughput |
| virtual-list-window | manual.createElement | 2,186 | control |
| virtual-list-window | fabrica.html | 544 | 24.90% of manual throughput |
| virtual-list-window | lit.html | 1,115 | 51.03% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 4,782 | 4,677 | -2.18% | -2.34% | 3.00% | high | 0.21380 | 0.74% | 0.38% | ▁█▃ |
| 🌿 | complex-attributes :: lit.html | 11,948 | 12,054 | +0.89% | +0.72% | 3.00% | high | 0.08296 | 1.13% | 0.91% | █▃▁ |
| 🧭 | complex-attributes :: manual.createElement | 23,572 | 23,610 | +0.16% | — | 3.00% | high | 0.04235 | 0.52% | 0.07% | ▁██ |
| 🌿 | conditional-component :: fabrica.html | 1,069 | 1,065 | -0.35% | -2.90% | 3.06% | high | 0.93918 | 1.54% | 0.87% | ▃█▁ |
| 🌿 | conditional-component :: lit.html | 4,728 | 4,738 | +0.20% | -2.36% | 3.00% | high | 0.21106 | 1.19% | 0.68% | ▁█▃ |
| 🧭 | conditional-component :: manual.createElement | 7,276 | 7,467 | +2.63% | — | 3.00% | high | 0.13393 | 0.71% | 0.26% | █▇▁ |
| 🚀 | forked-registry-resolution :: fabrica.html | 330,438 | 715,199 | +116.44% | +114.23% | 3.00% | high | 0.00140 | 1.93% | 0.91% | ▂▁█ |
| 🌿 | forked-registry-resolution :: lit.html | 13,770,075 | 13,939,270 | +1.23% | +0.19% | 3.00% | high | 0.00007 | 1.34% | 1.55% | ▁█▄ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,764,304 | 1,782,515 | +1.03% | — | 3.00% | high | 0.00056 | 3.51% | 2.76% | ▁█▆ |
| 🌿 | instance-named-render :: fabrica.html | 6,240 | 6,386 | +2.33% | +1.88% | 3.00% | high | 0.15659 | 0.68% | 0.68% | █▄▁ |
| 🌿 | instance-named-render :: lit.html | 41,968 | 42,635 | +1.59% | +1.14% | 3.00% | high | 0.02345 | 1.01% | 0.69% | █▆▁ |
| 🧭 | instance-named-render :: manual.createElement | 79,385 | 79,736 | +0.44% | — | 3.00% | high | 0.01254 | 1.37% | 1.00% | █▆▁ |
| 🌿 | keyed-list-update :: fabrica.html | 95 | 105 | +9.77% | +7.98% | 12.71% | medium | 9.56655 | 1.96% | 1.14% | ▁█▆ |
| 🌿 | keyed-list-update :: lit.html | 502 | 491 | -2.25% | -3.83% | 4.63% | high | 2.03858 | 1.78% | 0.43% | ▇█▁ |
| 🧭 | keyed-list-update :: manual.createElement | 851 | 865 | +1.65% | — | 3.52% | high | 1.15545 | 1.07% | 0.11% | ██▁ |
| 🌿 | named-component-definition :: fabrica.html | 388,652 | 390,092 | +0.37% | -1.86% | 3.00% | high | 0.00256 | 0.86% | 0.01% | █▁█ |
| 🌿 | named-component-definition :: lit.html | 3,336,182 | 3,308,718 | -0.82% | -3.03% | 3.08% | high | 0.00030 | 8.53% | 0.79% | ▁█▁ |
| 🧭 | named-component-definition :: manual.createElement | 3,794,020 | 3,880,382 | +2.28% | — | 3.00% | high | 0.00026 | 0.47% | 0.45% | ▅█▁ |
| 🌿 | named-instance-reuse :: fabrica.html | 316,187 | 320,430 | +1.34% | -1.24% | 3.85% | high | 0.00312 | 0.55% | 0.36% | █▁▆ |
| 🌿 | named-instance-reuse :: lit.html | 14,602,560 | 14,533,197 | -0.48% | -3.01% | 3.85% | high | 0.00007 | 1.53% | 1.49% | ▁█▅ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,483,020 | 10,756,724 | +2.61% | — | 3.85% | high | 0.00009 | 2.26% | 1.45% | ▆█▁ |
| 🌿 | named-styled-registry :: fabrica.html | 6,731 | 6,876 | +2.15% | -0.95% | 3.00% | high | 0.14544 | 1.34% | 0.94% | ▃▁█ |
| 🌿 | named-styled-registry :: lit.html | 38,195 | 39,226 | +2.70% | -0.42% | 3.00% | high | 0.02549 | 1.29% | 0.88% | ▆█▁ |
| 🧭 | named-styled-registry :: manual.createElement | 58,472 | 60,303 | +3.13% | — | 3.00% | high | 0.01658 | 1.00% | 1.00% | █▄▁ |
| 🌿 | nested-components :: fabrica.html | 805 | 808 | +0.44% | -0.24% | 14.75% | medium | 1.23727 | 1.61% | 0.25% | ▁██ |
| 🌿 | nested-components :: lit.html | 4,250 | 4,314 | +1.50% | +0.82% | 3.00% | high | 0.23183 | 1.80% | 0.85% | ▇█▁ |
| 🧭 | nested-components :: manual.createElement | 8,727 | 8,786 | +0.67% | — | 3.00% | high | 0.11381 | 1.35% | 1.36% | ▅█▁ |
| ⚠️ | portable-definition-install :: fabrica.html | 155,586 | 147,949 | -4.91% | -6.08% | 25.00% | low | 0.00676 | 0.30% | 0.25% | █▁▃ |
| 🌿 | portable-definition-install :: lit.html | 9,817,554 | 9,966,118 | +1.51% | +0.27% | 3.36% | high | 0.00010 | 0.75% | 0.45% | ▁█▆ |
| 🧭 | portable-definition-install :: manual.createElement | 6,765,574 | 6,849,675 | +1.24% | — | 3.00% | high | 0.00015 | 1.91% | 2.26% | ▄▁█ |
| 🌿 | portal-mount :: fabrica.html | 7,868 | 7,866 | -0.03% | -0.96% | 7.59% | medium | 0.12713 | 0.64% | 0.40% | ▃█▁ |
| 🌿 | portal-mount :: lit.html | 19,676 | 19,317 | -1.82% | -2.74% | 3.00% | high | 0.05177 | 1.23% | 0.90% | █▃▁ |
| 🧭 | portal-mount :: manual.createElement | 49,510 | 49,977 | +0.94% | — | 3.00% | high | 0.02001 | 1.47% | 0.64% | ▁█▂ |
| 🌿 | raw-html :: fabrica.html | 8,107 | 8,283 | +2.17% | +1.51% | 3.00% | high | 0.12073 | 1.00% | 0.86% | █▆▁ |
| 🌿 | raw-html :: lit.html | 9,598 | 9,637 | +0.40% | -0.25% | 3.00% | high | 0.10377 | 1.05% | 0.90% | █▆▁ |
| 🧭 | raw-html :: manual.createElement | 13,928 | 14,019 | +0.65% | — | 3.00% | high | 0.07133 | 0.95% | 0.45% | ▇▁█ |
| 🌿 | reactive-class-style :: fabrica.html | 2,686 | 2,638 | -1.79% | +0.32% | 4.85% | high | 0.37903 | 2.58% | 1.40% | ▆█▁ |
| 🚀 | reactive-class-style :: lit.html | 6,229 | 6,361 | +2.11% | +4.30% | 3.00% | high | 0.15722 | 0.81% | 0.84% | ▅▁█ |
| 🧭 | reactive-class-style :: manual.createElement | 7,196 | 7,045 | -2.10% | — | 3.00% | high | 0.14195 | 1.93% | 2.27% | ▄▁█ |
| 🌿 | reactive-text :: fabrica.html | 7,203 | 7,428 | +3.12% | +2.79% | 8.83% | medium | 0.13463 | 0.29% | 0.00% | █▁█ |
| 🌿 | reactive-text :: lit.html | 16,446 | 16,250 | -1.19% | -1.50% | 3.00% | high | 0.06154 | 2.07% | 0.93% | ▁█▂ |
| 🧭 | reactive-text :: manual.createElement | 55,973 | 56,149 | +0.31% | — | 3.00% | high | 0.01781 | 0.85% | 0.92% | ▅█▁ |
| 🚀 | shared-registry-resolution :: fabrica.html | 1,045,079 | 1,120,886 | +7.25% | +8.87% | 3.21% | high | 0.00089 | 0.14% | 0.13% | ▄█▁ |
| 🌿 | shared-registry-resolution :: lit.html | 14,947,907 | 14,836,581 | -0.74% | +0.75% | 3.21% | high | 0.00007 | 0.28% | 0.23% | ▁█▃ |
| 🧭 | shared-registry-resolution :: manual.createElement | 10,511,766 | 10,356,119 | -1.48% | — | 3.21% | high | 0.00010 | 5.57% | 3.21% | █▁▆ |
| 🌿 | spread-props-events :: fabrica.html | 5,836 | 5,810 | -0.45% | -2.85% | 8.44% | medium | 0.17213 | 1.74% | 0.38% | ▂█▁ |
| 🌿 | spread-props-events :: lit.html | 8,269 | 8,302 | +0.41% | -2.02% | 13.08% | medium | 0.12045 | 2.35% | 0.95% | ▁█▇ |
| 🧭 | spread-props-events :: manual.createElement | 21,213 | 21,739 | +2.48% | — | 3.00% | high | 0.04600 | 0.84% | 0.15% | █▁▂ |
| 🌿 | static-tree :: fabrica.html | 5,822 | 5,715 | -1.83% | -2.98% | 3.38% | high | 0.17498 | 1.43% | 0.33% | █▁▂ |
| 🐢 | static-tree :: lit.html | 12,686 | 12,365 | -2.53% | -3.66% | 3.00% | high | 0.08087 | 0.88% | 0.26% | ▂█▁ |
| 🧭 | static-tree :: manual.createElement | 13,819 | 13,982 | +1.18% | — | 3.00% | high | 0.07152 | 2.01% | 0.60% | ▇█▁ |
| 🌿 | styled-artifact-composition :: fabrica.html | 71,328 | 72,144 | +1.15% | +1.52% | 3.00% | high | 0.01386 | 0.96% | 0.42% | ▁█▂ |
| 🚀 | styled-artifact-composition :: lit.html | 35,245 | 36,235 | +2.81% | +3.19% | 3.00% | high | 0.02760 | 0.56% | 0.47% | █▆▁ |
| 🧭 | styled-artifact-composition :: manual.createElement | 152,959 | 152,391 | -0.37% | — | 3.00% | high | 0.00656 | 0.49% | 0.46% | ▅█▁ |
| 🐢 | styled-artifact-render :: fabrica.html | 99,821 | 98,197 | -1.63% | -3.88% | 3.00% | high | 0.01018 | 0.36% | 0.34% | ▁▅█ |
| 🌿 | styled-artifact-render :: lit.html | 38,461 | 39,275 | +2.12% | -0.22% | 3.00% | high | 0.02546 | 5.43% | 0.80% | ██▁ |
| 🧭 | styled-artifact-render :: manual.createElement | 147,717 | 151,178 | +2.34% | — | 3.00% | high | 0.00661 | 0.76% | 0.73% | ▄█▁ |
| ⚠️ | styled-component-registration :: fabrica.html | 122,105 | 123,541 | +1.18% | +0.52% | 20.87% | low | 0.00809 | 2.55% | 3.03% | █▅▁ |
| 🌿 | styled-component-registration :: lit.html | 2,385,690 | 2,436,813 | +2.14% | +1.48% | 3.00% | high | 0.00041 | 0.26% | 0.25% | ▁█▄ |
| 🧭 | styled-component-registration :: manual.createElement | 786,016 | 791,116 | +0.65% | — | 3.00% | high | 0.00126 | 0.53% | 0.34% | ▆▁█ |
| 🌿 | two-way-bind :: fabrica.html | 8,212 | 8,433 | +2.70% | -0.81% | 17.23% | medium | 0.11858 | 2.16% | 0.96% | ▁█▇ |
| 🌿 | two-way-bind :: lit.html | 13,022 | 13,013 | -0.07% | -3.48% | 19.58% | medium | 0.07685 | 0.51% | 0.47% | ▁█▅ |
| 🧭 | two-way-bind :: manual.createElement | 40,844 | 42,289 | +3.54% | — | 15.49% | medium | 0.02365 | 1.31% | 0.77% | ▁█▃ |
| ⚠️ | virtual-list-window :: fabrica.html | 545 | 544 | -0.07% | -0.29% | 18.98% | low | 1.83744 | 1.83% | 1.83% | ▄█▁ |
| 🌿 | virtual-list-window :: lit.html | 1,141 | 1,115 | -2.27% | -2.49% | 3.00% | high | 0.89647 | 2.48% | 2.95% | ▄█▁ |
| 🧭 | virtual-list-window :: manual.createElement | 2,181 | 2,186 | +0.23% | — | 3.00% | high | 0.45744 | 1.14% | 0.79% | ▃█▁ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
