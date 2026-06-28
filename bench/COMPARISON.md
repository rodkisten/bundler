<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `4b56edad` · baseline `ec811a62` · generated 2026-06-28T10:59:58.770Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000004930 · Linux · X64 |
| CPU | AMD EPYC 7763 64-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.17.0 · V8 13.6.233.17-node.49 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.14 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 -0.05% | -0.05% | 0 | 0 | 19 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 +0.77% | +1.85% | 8 | 5 | 26 | 5 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** -0.05%  
**Raw geometric mean:** -0.05%

### 🚀 Fastest reliable improvements

_None outside the reliability threshold._

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 184,000 | 185,307 | +0.71% | — | 3.00% | high | 0.00540 | 0.31% | 0.10% | ▁█▂ |
| 🌿 | class name: privacy redaction and truncation | 142,297 | 144,064 | +1.24% | — | 3.00% | high | 0.00694 | 0.38% | 0.32% | ▁█▆ |
| 🌿 | class name: readable property-value-context-hash | 184,098 | 185,955 | +1.01% | — | 3.00% | high | 0.00538 | 0.37% | 0.40% | ▁▄█ |
| 🌿 | cold atomic.css: transform parse compile | 2,127 | 2,153 | +1.18% | — | 3.81% | high | 0.46456 | 1.43% | 0.64% | ▇█▁ |
| 🌿 | cold css: atomic detection + compile | 2,231 | 2,232 | +0.04% | — | 3.59% | high | 0.44804 | 0.36% | 0.38% | ▁▄█ |
| 🌿 | cold css: configure parse + normalized apply | 10,894 | 11,163 | +2.47% | — | 5.23% | high | 0.08958 | 1.98% | 1.03% | █▁▆ |
| 🌿 | cold css: sheet detection + compile | 2,488 | 2,466 | -0.90% | — | 3.08% | high | 0.40550 | 0.83% | 0.73% | ▁█▄ |
| 🌿 | cold sheet.css: transform parse compile | 2,453 | 2,456 | +0.09% | — | 3.20% | high | 0.40724 | 0.96% | 1.13% | █▁▄ |
| 🌿 | stylis: nested stylesheet compile | 76,626 | 76,935 | +0.40% | — | 3.00% | high | 0.01300 | 2.00% | 0.03% | ▁██ |
| 🌿 | stylis: tiny declaration compile | 1,511,055 | 1,518,080 | +0.46% | — | 3.00% | high | 0.00066 | 1.99% | 1.16% | ▆▁█ |
| 🧭 | baseline: String.raw tiny css | 3,108,849 | 3,187,829 | +2.54% | — | 3.00% | high | 0.00031 | 0.84% | 0.84% | █▁▅ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 241,854 | 241,469 | -0.16% | — | 3.00% | high | 0.00414 | 0.76% | 0.63% | ▁▆█ |
| 🌿 | warm atomic.css: classic atomic compile | 419,201 | 413,352 | -1.40% | — | 3.00% | high | 0.00242 | 0.98% | 0.91% | ▁▅█ |
| 🌿 | warm atomic.css.withImportant | 243,158 | 240,275 | -1.19% | — | 3.00% | high | 0.00416 | 1.86% | 2.17% | ▅▁█ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,464,096 | 1,471,126 | +0.48% | — | 3.52% | high | 0.00068 | 3.22% | 3.52% | ▁█▅ |
| 🌿 | warm css: polymorphic sheet identity hit | 704,418 | 703,884 | -0.08% | — | 3.00% | high | 0.00142 | 1.39% | 0.69% | ▁█▇ |
| 🌿 | warm css: prepared configure plan hit | 4,558,675 | 4,458,509 | -2.20% | — | 3.00% | high | 0.00022 | 1.82% | 0.59% | █▂▁ |
| 🌿 | warm inline.css: inline style compile | 413,723 | 406,364 | -1.78% | — | 3.00% | high | 0.00246 | 1.08% | 0.69% | ▃▁█ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 163,153 | 162,414 | -0.45% | — | 3.00% | high | 0.00616 | 0.38% | 0.03% | ▁▁█ |
| 🌿 | warm sheet.css.withImportant | 163,249 | 162,082 | -0.71% | — | 3.00% | high | 0.00617 | 0.14% | 0.09% | ▁█▃ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** +0.77%  
**Raw geometric mean:** +1.85%

### 🚀 Fastest reliable improvements

1. **raw-html :: fabrica.html** · +41.40% normalized · high confidence
2. **named-styled-registry :: fabrica.html** · +21.94% normalized · high confidence
3. **named-instance-reuse :: fabrica.html** · +17.66% normalized · high confidence
4. **nested-components :: fabrica.html** · +14.33% normalized · medium confidence
5. **instance-named-render :: fabrica.html** · +14.00% normalized · high confidence

### 🐢 Largest reliable regressions

1. **keyed-list-update :: lit.html** · -21.10% normalized · medium confidence
2. **keyed-list-update :: fabrica.html** · -19.48% normalized · medium confidence
3. **shared-registry-resolution :: fabrica.html** · -6.76% normalized · high confidence
4. **portable-definition-install :: lit.html** · -5.61% normalized · high confidence
5. **virtual-list-window :: lit.html** · -3.42% normalized · high confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 20.83% noise floor
3. **named-component-definition :: fabrica.html** · 19.23% noise floor
4. **named-component-definition :: lit.html** · 19.23% noise floor
5. **virtual-list-window :: fabrica.html** · 18.03% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 23,475 | control |
| complex-attributes | fabrica.html | 4,713 | 20.08% of manual throughput |
| complex-attributes | lit.html | 12,028 | 51.24% of manual throughput |
| conditional-component | manual.createElement | 7,310 | control |
| conditional-component | fabrica.html | 1,064 | 14.56% of manual throughput |
| conditional-component | lit.html | 4,734 | 64.75% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,709,186 | control |
| forked-registry-resolution | fabrica.html | 595,633 | 34.85% of manual throughput |
| forked-registry-resolution | lit.html | 13,042,433 | 763.08% of manual throughput |
| instance-named-render | manual.createElement | 79,002 | control |
| instance-named-render | fabrica.html | 6,352 | 8.04% of manual throughput |
| instance-named-render | lit.html | 42,117 | 53.31% of manual throughput |
| keyed-list-update | manual.createElement | 846 | control |
| keyed-list-update | fabrica.html | 90 | 10.69% of manual throughput |
| keyed-list-update | lit.html | 480 | 56.68% of manual throughput |
| named-component-definition | manual.createElement | 2,908,193 | control |
| named-component-definition | fabrica.html | 387,261 | 13.32% of manual throughput |
| named-component-definition | lit.html | 3,716,327 | 127.79% of manual throughput |
| named-instance-reuse | manual.createElement | 10,783,023 | control |
| named-instance-reuse | fabrica.html | 318,576 | 2.95% of manual throughput |
| named-instance-reuse | lit.html | 14,109,078 | 130.85% of manual throughput |
| named-styled-registry | manual.createElement | 59,557 | control |
| named-styled-registry | fabrica.html | 6,953 | 11.67% of manual throughput |
| named-styled-registry | lit.html | 38,222 | 64.18% of manual throughput |
| nested-components | manual.createElement | 8,662 | control |
| nested-components | fabrica.html | 802 | 9.26% of manual throughput |
| nested-components | lit.html | 4,197 | 48.45% of manual throughput |
| portable-definition-install | manual.createElement | 6,573,831 | control |
| portable-definition-install | fabrica.html | 149,556 | 2.28% of manual throughput |
| portable-definition-install | lit.html | 9,252,390 | 140.75% of manual throughput |
| portal-mount | manual.createElement | 50,017 | control |
| portal-mount | fabrica.html | 7,956 | 15.91% of manual throughput |
| portal-mount | lit.html | 19,447 | 38.88% of manual throughput |
| raw-html | manual.createElement | 13,606 | control |
| raw-html | fabrica.html | 8,285 | 60.90% of manual throughput |
| raw-html | lit.html | 9,482 | 69.69% of manual throughput |
| reactive-class-style | manual.createElement | 7,135 | control |
| reactive-class-style | fabrica.html | 2,642 | 37.03% of manual throughput |
| reactive-class-style | lit.html | 6,246 | 87.55% of manual throughput |
| reactive-text | manual.createElement | 55,334 | control |
| reactive-text | fabrica.html | 7,226 | 13.06% of manual throughput |
| reactive-text | lit.html | 16,284 | 29.43% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,694,088 | control |
| shared-registry-resolution | fabrica.html | 770,369 | 7.20% of manual throughput |
| shared-registry-resolution | lit.html | 14,128,694 | 132.12% of manual throughput |
| spread-props-events | manual.createElement | 21,761 | control |
| spread-props-events | fabrica.html | 5,852 | 26.89% of manual throughput |
| spread-props-events | lit.html | 8,186 | 37.62% of manual throughput |
| static-tree | manual.createElement | 13,824 | control |
| static-tree | fabrica.html | 5,618 | 40.64% of manual throughput |
| static-tree | lit.html | 12,421 | 89.85% of manual throughput |
| styled-artifact-composition | manual.createElement | 153,227 | control |
| styled-artifact-composition | fabrica.html | 71,509 | 46.67% of manual throughput |
| styled-artifact-composition | lit.html | 35,481 | 23.16% of manual throughput |
| styled-artifact-render | manual.createElement | 147,844 | control |
| styled-artifact-render | fabrica.html | 98,071 | 66.33% of manual throughput |
| styled-artifact-render | lit.html | 38,395 | 25.97% of manual throughput |
| styled-component-registration | manual.createElement | 780,892 | control |
| styled-component-registration | fabrica.html | 123,560 | 15.82% of manual throughput |
| styled-component-registration | lit.html | 2,382,638 | 305.12% of manual throughput |
| two-way-bind | manual.createElement | 42,403 | control |
| two-way-bind | fabrica.html | 8,326 | 19.64% of manual throughput |
| two-way-bind | lit.html | 12,985 | 30.62% of manual throughput |
| virtual-list-window | manual.createElement | 2,219 | control |
| virtual-list-window | fabrica.html | 516 | 23.28% of manual throughput |
| virtual-list-window | lit.html | 1,128 | 50.86% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 4,768 | 4,713 | -1.15% | -2.73% | 3.00% | high | 0.21218 | 3.29% | 1.70% | ▁█▃ |
| 🌿 | complex-attributes :: lit.html | 11,725 | 12,028 | +2.58% | +0.93% | 3.00% | high | 0.08314 | 2.23% | 0.54% | █▇▁ |
| 🧭 | complex-attributes :: manual.createElement | 23,098 | 23,475 | +1.63% | — | 3.00% | high | 0.04260 | 1.11% | 0.45% | ▁█▇ |
| 🌿 | conditional-component :: fabrica.html | 1,056 | 1,064 | +0.78% | +1.28% | 3.62% | high | 0.93982 | 0.37% | 0.28% | ▁▃█ |
| 🌿 | conditional-component :: lit.html | 4,692 | 4,734 | +0.89% | +1.40% | 3.00% | high | 0.21125 | 1.99% | 1.73% | █▄▁ |
| 🧭 | conditional-component :: manual.createElement | 7,347 | 7,310 | -0.50% | — | 3.00% | high | 0.13679 | 0.81% | 0.25% | ▂▁█ |
| 🚀 | forked-registry-resolution :: fabrica.html | 582,187 | 595,633 | +2.31% | +6.50% | 3.00% | high | 0.00168 | 7.75% | 0.05% | █▁█ |
| 🌿 | forked-registry-resolution :: lit.html | 13,782,702 | 13,042,433 | -5.37% | -1.49% | 7.84% | medium | 0.00008 | 6.49% | 7.84% | █▁▅ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,779,229 | 1,709,186 | -3.94% | — | 3.00% | high | 0.00059 | 0.56% | 0.21% | ▇▁█ |
| 🚀 | instance-named-render :: fabrica.html | 5,553 | 6,352 | +14.38% | +14.00% | 3.28% | high | 0.15744 | 0.79% | 0.79% | ▄▁█ |
| 🌿 | instance-named-render :: lit.html | 42,538 | 42,117 | -0.99% | -1.32% | 3.28% | high | 0.02374 | 1.29% | 1.35% | ▁█▄ |
| 🧭 | instance-named-render :: manual.createElement | 78,736 | 79,002 | +0.34% | — | 3.28% | high | 0.01266 | 0.87% | 0.74% | ▃▁█ |
| 🐢 | keyed-list-update :: fabrica.html | 91 | 90 | -0.60% | -19.48% | 14.33% | medium | 11.05174 | 1.24% | 0.36% | █▇▁ |
| 🐢 | keyed-list-update :: lit.html | 493 | 480 | -2.60% | -21.10% | 8.83% | medium | 2.08440 | 0.18% | 0.19% | ▁█▅ |
| 🧭 | keyed-list-update :: manual.createElement | 686 | 846 | +23.45% | — | 8.23% | medium | 1.18145 | 1.82% | 2.15% | ▄█▁ |
| ⚠️ | named-component-definition :: fabrica.html | 407,489 | 387,261 | -4.96% | +5.30% | 19.23% | low | 0.00258 | 0.12% | 0.11% | ▄▁█ |
| ⚠️ | named-component-definition :: lit.html | 3,653,019 | 3,716,327 | +1.73% | +12.72% | 19.23% | low | 0.00027 | 6.32% | 0.20% | ▁██ |
| 🧭 | named-component-definition :: manual.createElement | 3,222,261 | 2,908,193 | -9.75% | — | 19.23% | low | 0.00034 | 17.35% | 10.82% | █▁▃ |
| 🚀 | named-instance-reuse :: fabrica.html | 264,181 | 318,576 | +20.59% | +17.66% | 3.00% | high | 0.00314 | 3.26% | 0.21% | █▁█ |
| 🌿 | named-instance-reuse :: lit.html | 14,436,068 | 14,109,078 | -2.27% | -4.64% | 5.90% | medium | 0.00007 | 5.29% | 5.90% | █▁▅ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,520,914 | 10,783,023 | +2.49% | — | 3.00% | high | 0.00009 | 2.87% | 0.43% | █▁█ |
| 🚀 | named-styled-registry :: fabrica.html | 5,696 | 6,953 | +22.07% | +21.94% | 3.00% | high | 0.14382 | 2.85% | 2.05% | █▆▁ |
| 🌿 | named-styled-registry :: lit.html | 38,966 | 38,222 | -1.91% | -2.01% | 3.00% | high | 0.02616 | 0.91% | 0.69% | ▆█▁ |
| 🧭 | named-styled-registry :: manual.createElement | 59,497 | 59,557 | +0.10% | — | 3.00% | high | 0.01679 | 0.38% | 0.36% | ▁▄█ |
| 🚀 | nested-components :: fabrica.html | 691 | 802 | +15.98% | +14.33% | 13.35% | medium | 1.24701 | 1.38% | 0.28% | █▁▇ |
| 🌿 | nested-components :: lit.html | 4,168 | 4,197 | +0.70% | -0.74% | 3.00% | high | 0.23829 | 0.75% | 0.04% | █▁▁ |
| 🧭 | nested-components :: manual.createElement | 8,539 | 8,662 | +1.45% | — | 3.00% | high | 0.11544 | 0.29% | 0.07% | ▁▇█ |
| ⚠️ | portable-definition-install :: fabrica.html | 145,857 | 149,556 | +2.54% | +0.69% | 25.00% | low | 0.00669 | 4.10% | 1.81% | █▇▁ |
| 🐢 | portable-definition-install :: lit.html | 9,625,416 | 9,252,390 | -3.88% | -5.61% | 3.00% | high | 0.00011 | 4.48% | 2.15% | █▁▂ |
| 🧭 | portable-definition-install :: manual.createElement | 6,455,240 | 6,573,831 | +1.84% | — | 3.00% | high | 0.00015 | 2.15% | 0.65% | █▁▂ |
| 🌿 | portal-mount :: fabrica.html | 7,977 | 7,956 | -0.27% | -0.94% | 7.72% | medium | 0.12570 | 1.52% | 1.18% | ▃█▁ |
| 🌿 | portal-mount :: lit.html | 19,386 | 19,447 | +0.32% | -0.35% | 3.00% | high | 0.05142 | 0.62% | 0.04% | ██▁ |
| 🧭 | portal-mount :: manual.createElement | 49,684 | 50,017 | +0.67% | — | 3.00% | high | 0.01999 | 3.12% | 0.62% | ▁▇█ |
| 🚀 | raw-html :: fabrica.html | 5,980 | 8,285 | +38.55% | +41.40% | 3.00% | high | 0.12069 | 1.43% | 1.44% | ▅█▁ |
| 🚀 | raw-html :: lit.html | 9,032 | 9,482 | +4.98% | +7.14% | 3.00% | high | 0.10546 | 1.04% | 0.05% | ██▁ |
| 🧭 | raw-html :: manual.createElement | 13,886 | 13,606 | -2.02% | — | 3.00% | high | 0.07350 | 1.11% | 0.10% | ▁█▁ |
| 🌿 | reactive-class-style :: fabrica.html | 2,588 | 2,642 | +2.08% | +2.69% | 4.99% | high | 0.37847 | 0.42% | 0.14% | █▇▁ |
| 🌿 | reactive-class-style :: lit.html | 6,263 | 6,246 | -0.27% | +0.33% | 3.00% | high | 0.16010 | 1.95% | 1.33% | █▆▁ |
| 🧭 | reactive-class-style :: manual.createElement | 7,177 | 7,135 | -0.59% | — | 3.00% | high | 0.14016 | 0.23% | 0.06% | ▇█▁ |
| 🌿 | reactive-text :: fabrica.html | 7,171 | 7,226 | +0.76% | +2.56% | 8.47% | medium | 0.13839 | 1.47% | 1.61% | ▁█▄ |
| 🚀 | reactive-text :: lit.html | 15,884 | 16,284 | +2.52% | +4.35% | 3.00% | high | 0.06141 | 0.94% | 0.42% | █▇▁ |
| 🧭 | reactive-text :: manual.createElement | 56,324 | 55,334 | -1.76% | — | 3.00% | high | 0.01807 | 1.40% | 0.58% | █▁▂ |
| 🐢 | shared-registry-resolution :: fabrica.html | 825,204 | 770,369 | -6.65% | -6.76% | 3.00% | high | 0.00130 | 0.14% | 0.00% | █▁█ |
| 🌿 | shared-registry-resolution :: lit.html | 14,589,121 | 14,128,694 | -3.16% | -3.27% | 7.45% | medium | 0.00007 | 6.71% | 7.45% | █▁▄ |
| 🧭 | shared-registry-resolution :: manual.createElement | 10,681,293 | 10,694,088 | +0.12% | — | 3.00% | high | 0.00009 | 1.16% | 0.44% | ▇▁█ |
| 🌿 | spread-props-events :: fabrica.html | 5,883 | 5,852 | -0.54% | -0.78% | 8.85% | medium | 0.17089 | 0.72% | 0.68% | █▁▄ |
| 🌿 | spread-props-events :: lit.html | 9,366 | 8,186 | -12.60% | -12.81% | 14.05% | medium | 0.12215 | 1.16% | 0.68% | ▆█▁ |
| 🧭 | spread-props-events :: manual.createElement | 21,708 | 21,761 | +0.24% | — | 3.00% | high | 0.04595 | 0.63% | 0.65% | ▁▅█ |
| 🌿 | static-tree :: fabrica.html | 5,576 | 5,618 | +0.76% | -1.17% | 5.72% | medium | 0.17800 | 2.23% | 1.46% | █▃▁ |
| 🌿 | static-tree :: lit.html | 12,420 | 12,421 | +0.01% | -1.90% | 5.72% | medium | 0.08051 | 1.21% | 0.10% | ██▁ |
| 🧭 | static-tree :: manual.createElement | 13,560 | 13,824 | +1.95% | — | 5.72% | medium | 0.07234 | 2.82% | 0.30% | ▁██ |
| 🌿 | styled-artifact-composition :: fabrica.html | 72,915 | 71,509 | -1.93% | -2.15% | 3.00% | high | 0.01398 | 0.90% | 1.08% | ▄▁█ |
| 🌿 | styled-artifact-composition :: lit.html | 35,436 | 35,481 | +0.13% | -0.10% | 3.00% | high | 0.02818 | 1.24% | 0.99% | ▁█▆ |
| 🧭 | styled-artifact-composition :: manual.createElement | 152,882 | 153,227 | +0.23% | — | 3.00% | high | 0.00653 | 1.48% | 0.11% | █▁█ |
| 🌿 | styled-artifact-render :: fabrica.html | 98,349 | 98,071 | -0.28% | +2.51% | 3.97% | high | 0.01020 | 1.38% | 1.47% | ▅▁█ |
| 🌿 | styled-artifact-render :: lit.html | 38,538 | 38,395 | -0.37% | +2.42% | 3.97% | high | 0.02604 | 0.32% | 0.38% | ▁█▄ |
| 🧭 | styled-artifact-render :: manual.createElement | 151,978 | 147,844 | -2.72% | — | 3.97% | high | 0.00676 | 3.47% | 3.97% | ▁▅█ |
| ⚠️ | styled-component-registration :: fabrica.html | 127,146 | 123,560 | -2.82% | -2.31% | 20.83% | low | 0.00809 | 2.65% | 3.16% | █▁▄ |
| 🌿 | styled-component-registration :: lit.html | 2,432,354 | 2,382,638 | -2.04% | -1.53% | 3.38% | high | 0.00042 | 3.28% | 3.38% | █▁▄ |
| 🧭 | styled-component-registration :: manual.createElement | 785,000 | 780,892 | -0.52% | — | 3.00% | high | 0.00128 | 0.45% | 0.22% | ▂▁█ |
| 🌿 | two-way-bind :: fabrica.html | 8,299 | 8,326 | +0.33% | -0.13% | 14.04% | medium | 0.12010 | 0.47% | 0.01% | ██▁ |
| 🌿 | two-way-bind :: lit.html | 12,633 | 12,985 | +2.78% | +2.31% | 16.39% | medium | 0.07701 | 0.72% | 0.73% | █▅▁ |
| 🧭 | two-way-bind :: manual.createElement | 42,209 | 42,403 | +0.46% | — | 11.64% | medium | 0.02358 | 0.84% | 0.26% | █▂▁ |
| ⚠️ | virtual-list-window :: fabrica.html | 522 | 516 | -1.04% | -3.14% | 18.03% | low | 1.93649 | 2.17% | 0.67% | █▇▁ |
| 🐢 | virtual-list-window :: lit.html | 1,144 | 1,128 | -1.32% | -3.42% | 3.08% | high | 0.88618 | 0.53% | 0.61% | █▁▅ |
| 🧭 | virtual-list-window :: manual.createElement | 2,171 | 2,219 | +2.18% | — | 3.00% | high | 0.45074 | 1.41% | 1.02% | █▁▃ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
