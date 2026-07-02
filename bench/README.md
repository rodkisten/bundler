<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `a4ad0b3b` · baseline `06d2c815` · generated 2026-07-02T02:12:18.091Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000005199 · Linux · X64 |
| CPU | AMD EPYC 9V74 80-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.17.0 · V8 13.6.233.17-node.49 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.26 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.34% | +0.34% | 0 | 0 | 19 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 +0.20% | +0.58% | 1 | 0 | 37 | 6 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** +0.34%  
**Raw geometric mean:** +0.34%

### 🚀 Fastest reliable improvements

_None outside the reliability threshold._

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 192,718 | 195,101 | +1.24% | — | 3.00% | high | 0.00513 | 0.78% | 0.83% | █▁▅ |
| 🌿 | class name: privacy redaction and truncation | 149,374 | 152,616 | +2.17% | — | 3.00% | high | 0.00655 | 0.78% | 0.23% | █▁▇ |
| 🌿 | class name: readable property-value-context-hash | 193,709 | 194,559 | +0.44% | — | 3.00% | high | 0.00514 | 0.91% | 0.63% | █▁▆ |
| 🌿 | cold atomic.css: transform parse compile | 2,324 | 2,326 | +0.10% | — | 4.05% | high | 0.42994 | 0.39% | 0.39% | █▁▅ |
| 🌿 | cold css: atomic detection + compile | 2,430 | 2,459 | +1.17% | — | 3.69% | high | 0.40673 | 0.26% | 0.03% | ▁██ |
| 🌿 | cold css: configure parse + normalized apply | 14,119 | 13,953 | -1.18% | — | 5.95% | high | 0.07167 | 1.59% | 1.08% | ▃█▁ |
| 🌿 | cold css: sheet detection + compile | 2,705 | 2,730 | +0.92% | — | 3.18% | high | 0.36627 | 0.30% | 0.27% | █▁▄ |
| 🌿 | cold sheet.css: transform parse compile | 2,715 | 2,758 | +1.57% | — | 3.35% | high | 0.36260 | 1.59% | 1.74% | █▁▅ |
| 🌿 | stylis: nested stylesheet compile | 80,631 | 80,406 | -0.28% | — | 3.00% | high | 0.01244 | 0.34% | 0.27% | ▁█▃ |
| 🌿 | stylis: tiny declaration compile | 1,605,981 | 1,644,848 | +2.42% | — | 3.00% | high | 0.00061 | 0.61% | 0.46% | ▆█▁ |
| 🧭 | baseline: String.raw tiny css | 3,467,328 | 3,507,786 | +1.17% | — | 3.00% | high | 0.00029 | 1.86% | 1.88% | █▄▁ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 239,993 | 240,129 | +0.06% | — | 3.00% | high | 0.00416 | 0.27% | 0.16% | ▆█▁ |
| 🌿 | warm atomic.css: classic atomic compile | 413,191 | 411,975 | -0.29% | — | 3.00% | high | 0.00243 | 0.75% | 0.01% | █▁▁ |
| 🌿 | warm atomic.css.withImportant | 236,244 | 239,657 | +1.44% | — | 3.00% | high | 0.00417 | 0.22% | 0.10% | ▁█▂ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,442,398 | 1,437,190 | -0.36% | — | 3.00% | high | 0.00070 | 1.39% | 1.23% | ▁█▄ |
| 🌿 | warm css: polymorphic sheet identity hit | 658,315 | 647,925 | -1.58% | — | 3.00% | high | 0.00154 | 0.90% | 0.49% | ▃█▁ |
| 🌿 | warm css: prepared configure plan hit | 4,443,795 | 4,504,662 | +1.37% | — | 3.00% | high | 0.00022 | 1.70% | 1.60% | ▁█▄ |
| 🌿 | warm inline.css: inline style compile | 416,958 | 410,354 | -1.58% | — | 3.00% | high | 0.00244 | 1.02% | 0.70% | █▃▁ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 159,039 | 157,032 | -1.26% | — | 3.00% | high | 0.00637 | 0.93% | 0.16% | ▁▂█ |
| 🌿 | warm sheet.css.withImportant | 159,355 | 159,680 | +0.20% | — | 3.00% | high | 0.00626 | 0.11% | 0.03% | ▁▇█ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** +0.20%  
**Raw geometric mean:** +0.58%

### 🚀 Fastest reliable improvements

1. **forked-registry-resolution :: lit.html** · +3.34% normalized · high confidence

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 25.00% noise floor
3. **virtual-list-window :: fabrica.html** · 21.54% noise floor
4. **two-way-bind :: fabrica.html** · 21.42% noise floor
5. **nested-components :: fabrica.html** · 17.98% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 31,945 | control |
| complex-attributes | fabrica.html | 8,001 | 25.05% of manual throughput |
| complex-attributes | lit.html | 15,786 | 49.42% of manual throughput |
| conditional-component | manual.createElement | 7,851 | control |
| conditional-component | fabrica.html | 1,250 | 15.92% of manual throughput |
| conditional-component | lit.html | 5,313 | 67.67% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,717,798 | control |
| forked-registry-resolution | fabrica.html | 713,236 | 41.52% of manual throughput |
| forked-registry-resolution | lit.html | 13,437,414 | 782.25% of manual throughput |
| instance-named-render | manual.createElement | 84,432 | control |
| instance-named-render | fabrica.html | 10,859 | 12.86% of manual throughput |
| instance-named-render | lit.html | 48,278 | 57.18% of manual throughput |
| keyed-list-update | manual.createElement | 870 | control |
| keyed-list-update | fabrica.html | 122 | 13.98% of manual throughput |
| keyed-list-update | lit.html | 548 | 63.02% of manual throughput |
| named-component-definition | manual.createElement | 3,589,361 | control |
| named-component-definition | fabrica.html | 393,774 | 10.97% of manual throughput |
| named-component-definition | lit.html | 3,815,420 | 106.30% of manual throughput |
| named-instance-reuse | manual.createElement | 10,458,780 | control |
| named-instance-reuse | fabrica.html | 302,951 | 2.90% of manual throughput |
| named-instance-reuse | lit.html | 14,320,601 | 136.92% of manual throughput |
| named-styled-registry | manual.createElement | 65,864 | control |
| named-styled-registry | fabrica.html | 13,253 | 20.12% of manual throughput |
| named-styled-registry | lit.html | 45,173 | 68.58% of manual throughput |
| nested-components | manual.createElement | 9,423 | control |
| nested-components | fabrica.html | 1,176 | 12.48% of manual throughput |
| nested-components | lit.html | 4,642 | 49.26% of manual throughput |
| portable-definition-install | manual.createElement | 6,490,926 | control |
| portable-definition-install | fabrica.html | 134,139 | 2.07% of manual throughput |
| portable-definition-install | lit.html | 8,980,187 | 138.35% of manual throughput |
| portal-mount | manual.createElement | 53,366 | control |
| portal-mount | fabrica.html | 13,004 | 24.37% of manual throughput |
| portal-mount | lit.html | 22,003 | 41.23% of manual throughput |
| raw-html | manual.createElement | 16,666 | control |
| raw-html | fabrica.html | 15,802 | 94.82% of manual throughput |
| raw-html | lit.html | 10,754 | 64.53% of manual throughput |
| reactive-class-style | manual.createElement | 7,837 | control |
| reactive-class-style | fabrica.html | 3,744 | 47.77% of manual throughput |
| reactive-class-style | lit.html | 7,899 | 100.79% of manual throughput |
| reactive-text | manual.createElement | 60,249 | control |
| reactive-text | fabrica.html | 13,410 | 22.26% of manual throughput |
| reactive-text | lit.html | 14,689 | 24.38% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,513,546 | control |
| shared-registry-resolution | fabrica.html | 1,162,888 | 11.06% of manual throughput |
| shared-registry-resolution | lit.html | 14,764,529 | 140.43% of manual throughput |
| spread-props-events | manual.createElement | 30,903 | control |
| spread-props-events | fabrica.html | 10,812 | 34.99% of manual throughput |
| spread-props-events | lit.html | 13,374 | 43.28% of manual throughput |
| static-tree | manual.createElement | 16,554 | control |
| static-tree | fabrica.html | 13,342 | 80.60% of manual throughput |
| static-tree | lit.html | 13,971 | 84.39% of manual throughput |
| styled-artifact-composition | manual.createElement | 152,689 | control |
| styled-artifact-composition | fabrica.html | 77,795 | 50.95% of manual throughput |
| styled-artifact-composition | lit.html | 42,572 | 27.88% of manual throughput |
| styled-artifact-render | manual.createElement | 152,894 | control |
| styled-artifact-render | fabrica.html | 103,726 | 67.84% of manual throughput |
| styled-artifact-render | lit.html | 44,751 | 29.27% of manual throughput |
| styled-component-registration | manual.createElement | 827,085 | control |
| styled-component-registration | fabrica.html | 131,241 | 15.87% of manual throughput |
| styled-component-registration | lit.html | 2,595,135 | 313.77% of manual throughput |
| two-way-bind | manual.createElement | 55,209 | control |
| two-way-bind | fabrica.html | 18,240 | 33.04% of manual throughput |
| two-way-bind | lit.html | 19,142 | 34.67% of manual throughput |
| virtual-list-window | manual.createElement | 2,598 | control |
| virtual-list-window | fabrica.html | 730 | 28.10% of manual throughput |
| virtual-list-window | lit.html | 1,259 | 48.44% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 7,848 | 8,001 | +1.95% | +1.77% | 10.47% | medium | 0.12499 | 1.85% | 0.92% | ▁█▂ |
| 🌿 | complex-attributes :: lit.html | 16,126 | 15,786 | -2.11% | -2.28% | 3.00% | high | 0.06335 | 2.45% | 0.43% | █▁▂ |
| 🧭 | complex-attributes :: manual.createElement | 31,890 | 31,945 | +0.17% | — | 3.00% | high | 0.03130 | 0.61% | 0.65% | ▄▁█ |
| 🌿 | conditional-component :: fabrica.html | 1,242 | 1,250 | +0.61% | -0.51% | 10.78% | medium | 0.80006 | 0.92% | 1.12% | ▁█▄ |
| 🌿 | conditional-component :: lit.html | 5,267 | 5,313 | +0.87% | -0.26% | 3.00% | high | 0.18823 | 0.67% | 0.76% | ▅█▁ |
| 🧭 | conditional-component :: manual.createElement | 7,763 | 7,851 | +1.13% | — | 3.00% | high | 0.12737 | 0.63% | 0.26% | ▁█▂ |
| 🌿 | forked-registry-resolution :: fabrica.html | 724,101 | 713,236 | -1.50% | +0.14% | 3.00% | high | 0.00140 | 0.99% | 0.45% | ▁█▂ |
| 🚀 | forked-registry-resolution :: lit.html | 13,218,722 | 13,437,414 | +1.65% | +3.34% | 3.33% | high | 0.00007 | 3.42% | 1.03% | ▇▁█ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,746,349 | 1,717,798 | -1.63% | — | 3.00% | high | 0.00058 | 1.81% | 1.78% | ▁█▅ |
| 🌿 | instance-named-render :: fabrica.html | 10,788 | 10,859 | +0.66% | -0.18% | 7.62% | medium | 0.09209 | 1.31% | 0.47% | █▂▁ |
| 🌿 | instance-named-render :: lit.html | 48,107 | 48,278 | +0.36% | -0.48% | 3.00% | high | 0.02071 | 0.55% | 0.66% | ▁▅█ |
| 🧭 | instance-named-render :: manual.createElement | 83,729 | 84,432 | +0.84% | — | 3.00% | high | 0.01184 | 0.64% | 0.11% | ▁█▇ |
| 🌿 | keyed-list-update :: fabrica.html | 122 | 122 | -0.62% | -1.22% | 13.18% | medium | 8.22058 | 3.67% | 3.58% | ▁█▅ |
| 🌿 | keyed-list-update :: lit.html | 537 | 548 | +2.09% | +1.48% | 4.05% | high | 1.82425 | 0.09% | 0.07% | ▆▁█ |
| 🧭 | keyed-list-update :: manual.createElement | 865 | 870 | +0.61% | — | 3.00% | high | 1.14962 | 1.43% | 1.47% | ▄█▁ |
| 🌿 | named-component-definition :: fabrica.html | 377,220 | 393,774 | +4.39% | +2.73% | 4.86% | high | 0.00254 | 0.41% | 0.11% | ▇█▁ |
| 🌿 | named-component-definition :: lit.html | 3,590,442 | 3,815,420 | +6.27% | +4.57% | 4.86% | high | 0.00026 | 1.46% | 0.42% | ▇▁█ |
| 🧭 | named-component-definition :: manual.createElement | 3,532,196 | 3,589,361 | +1.62% | — | 4.86% | high | 0.00028 | 1.78% | 2.13% | █▁▅ |
| 🌿 | named-instance-reuse :: fabrica.html | 302,189 | 302,951 | +0.25% | -0.71% | 3.00% | high | 0.00330 | 0.24% | 0.20% | █▁▃ |
| 🌿 | named-instance-reuse :: lit.html | 13,565,541 | 14,320,601 | +5.57% | +4.56% | 5.60% | medium | 0.00007 | 6.10% | 0.09% | █▁█ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,358,662 | 10,458,780 | +0.97% | — | 3.00% | high | 0.00010 | 4.48% | 1.78% | ▇▁█ |
| 🌿 | named-styled-registry :: fabrica.html | 13,431 | 13,253 | -1.33% | -2.33% | 4.43% | high | 0.07545 | 0.50% | 0.14% | ▁▂█ |
| 🌿 | named-styled-registry :: lit.html | 44,410 | 45,173 | +1.72% | +0.69% | 3.00% | high | 0.02214 | 1.20% | 1.12% | █▅▁ |
| 🧭 | named-styled-registry :: manual.createElement | 65,197 | 65,864 | +1.02% | — | 3.00% | high | 0.01518 | 0.52% | 0.63% | ▄▁█ |
| ⚠️ | nested-components :: fabrica.html | 1,183 | 1,176 | -0.57% | -0.30% | 17.98% | low | 0.85039 | 1.18% | 0.51% | █▁▂ |
| 🌿 | nested-components :: lit.html | 4,683 | 4,642 | -0.87% | -0.61% | 3.00% | high | 0.21544 | 7.31% | 1.85% | ▁▇█ |
| 🧭 | nested-components :: manual.createElement | 9,448 | 9,423 | -0.27% | — | 3.00% | high | 0.10612 | 0.36% | 0.17% | ▁▇█ |
| ⚠️ | portable-definition-install :: fabrica.html | 134,998 | 134,139 | -0.64% | +3.37% | 25.00% | low | 0.00745 | 3.06% | 1.19% | ▇█▁ |
| 🌿 | portable-definition-install :: lit.html | 9,756,932 | 8,980,187 | -7.96% | -4.25% | 8.44% | medium | 0.00011 | 14.13% | 8.44% | ▁▆█ |
| 🧭 | portable-definition-install :: manual.createElement | 6,752,586 | 6,490,926 | -3.87% | — | 4.01% | high | 0.00015 | 4.65% | 4.01% | ▅▁█ |
| 🌿 | portal-mount :: fabrica.html | 12,985 | 13,004 | +0.15% | -0.13% | 10.46% | medium | 0.07690 | 1.42% | 0.88% | ▃█▁ |
| 🌿 | portal-mount :: lit.html | 22,036 | 22,003 | -0.15% | -0.43% | 3.00% | high | 0.04545 | 0.65% | 0.80% | ▁█▅ |
| 🧭 | portal-mount :: manual.createElement | 53,219 | 53,366 | +0.28% | — | 3.00% | high | 0.01874 | 1.21% | 0.37% | ▁▇█ |
| 🌿 | raw-html :: fabrica.html | 15,848 | 15,802 | -0.29% | -0.08% | 8.00% | medium | 0.06328 | 0.58% | 0.31% | ▃█▁ |
| 🌿 | raw-html :: lit.html | 10,680 | 10,754 | +0.69% | +0.91% | 3.00% | high | 0.09299 | 0.83% | 0.67% | ▆█▁ |
| 🧭 | raw-html :: manual.createElement | 16,702 | 16,666 | -0.21% | — | 3.00% | high | 0.06000 | 0.97% | 1.13% | ▁█▄ |
| 🌿 | reactive-class-style :: fabrica.html | 3,662 | 3,744 | +2.23% | +1.87% | 5.75% | high | 0.26711 | 1.88% | 0.39% | █▇▁ |
| 🌿 | reactive-class-style :: lit.html | 7,906 | 7,899 | -0.09% | -0.45% | 3.00% | high | 0.12660 | 0.48% | 0.23% | ▁▂█ |
| 🧭 | reactive-class-style :: manual.createElement | 7,809 | 7,837 | +0.36% | — | 3.00% | high | 0.12761 | 0.29% | 0.24% | █▃▁ |
| 🌿 | reactive-text :: fabrica.html | 13,141 | 13,410 | +2.04% | -0.07% | 12.91% | medium | 0.07457 | 1.39% | 0.85% | ▁█▆ |
| 🌿 | reactive-text :: lit.html | 14,802 | 14,689 | -0.77% | -2.82% | 11.40% | medium | 0.06808 | 11.66% | 2.46% | █▁▂ |
| 🧭 | reactive-text :: manual.createElement | 59,003 | 60,249 | +2.11% | — | 3.00% | high | 0.01660 | 0.31% | 0.24% | ▁█▆ |
| 🌿 | shared-registry-resolution :: fabrica.html | 1,151,374 | 1,162,888 | +1.00% | +1.33% | 3.00% | high | 0.00086 | 0.39% | 0.14% | █▁▇ |
| 🌿 | shared-registry-resolution :: lit.html | 14,765,927 | 14,764,529 | -0.01% | +0.32% | 3.00% | high | 0.00007 | 6.93% | 0.38% | █▁█ |
| 🧭 | shared-registry-resolution :: manual.createElement | 10,547,794 | 10,513,546 | -0.32% | — | 3.00% | high | 0.00010 | 3.69% | 0.14% | █▁█ |
| 🌿 | spread-props-events :: fabrica.html | 10,653 | 10,812 | +1.49% | +0.32% | 13.62% | medium | 0.09249 | 2.77% | 2.92% | ▁█▅ |
| ⚠️ | spread-props-events :: lit.html | 13,580 | 13,374 | -1.52% | -2.65% | 17.36% | low | 0.07477 | 1.43% | 1.63% | ▁▄█ |
| 🧭 | spread-props-events :: manual.createElement | 30,546 | 30,903 | +1.17% | — | 3.10% | high | 0.03236 | 0.61% | 0.33% | ▁▃█ |
| 🌿 | static-tree :: fabrica.html | 13,033 | 13,342 | +2.37% | +2.11% | 3.00% | high | 0.07495 | 0.57% | 0.12% | ▇█▁ |
| 🌿 | static-tree :: lit.html | 14,121 | 13,971 | -1.06% | -1.32% | 3.00% | high | 0.07158 | 1.04% | 0.47% | ▁█▂ |
| 🧭 | static-tree :: manual.createElement | 16,511 | 16,554 | +0.26% | — | 3.00% | high | 0.06041 | 0.78% | 0.03% | ▁██ |
| 🌿 | styled-artifact-composition :: fabrica.html | 77,089 | 77,795 | +0.92% | +1.02% | 3.00% | high | 0.01285 | 0.57% | 0.56% | ▁▅█ |
| 🌿 | styled-artifact-composition :: lit.html | 42,501 | 42,572 | +0.17% | +0.27% | 3.00% | high | 0.02349 | 0.32% | 0.10% | ▁▇█ |
| 🧭 | styled-artifact-composition :: manual.createElement | 152,851 | 152,689 | -0.11% | — | 3.00% | high | 0.00655 | 0.69% | 0.61% | ▅▁█ |
| 🌿 | styled-artifact-render :: fabrica.html | 104,197 | 103,726 | -0.45% | +0.14% | 3.00% | high | 0.00964 | 0.73% | 0.36% | ▁▂█ |
| 🌿 | styled-artifact-render :: lit.html | 45,227 | 44,751 | -1.05% | -0.46% | 3.00% | high | 0.02235 | 0.72% | 0.46% | █▁▃ |
| 🧭 | styled-artifact-render :: manual.createElement | 153,809 | 152,894 | -0.59% | — | 3.00% | high | 0.00654 | 0.40% | 0.05% | █▁█ |
| ⚠️ | styled-component-registration :: fabrica.html | 56,322 | 131,241 | +133.02% | +127.88% | 25.00% | low | 0.00762 | 29.92% | 1.87% | ██▁ |
| 🌿 | styled-component-registration :: lit.html | 2,516,834 | 2,595,135 | +3.11% | +0.84% | 3.25% | high | 0.00039 | 2.42% | 1.88% | █▁▆ |
| 🧭 | styled-component-registration :: manual.createElement | 808,860 | 827,085 | +2.25% | — | 3.00% | high | 0.00121 | 22.57% | 2.75% | █▁█ |
| ⚠️ | two-way-bind :: fabrica.html | 18,745 | 18,240 | -2.69% | -5.13% | 21.42% | low | 0.05483 | 29.05% | 3.74% | ▁██ |
| 🌿 | two-way-bind :: lit.html | 18,956 | 19,142 | +0.98% | -1.54% | 20.62% | medium | 0.05224 | 0.83% | 0.15% | ▁▇█ |
| 🧭 | two-way-bind :: manual.createElement | 53,829 | 55,209 | +2.56% | — | 13.81% | medium | 0.01811 | 0.76% | 0.32% | ▇█▁ |
| ⚠️ | virtual-list-window :: fabrica.html | 738 | 730 | -1.12% | -0.89% | 21.54% | low | 1.36962 | 1.89% | 0.96% | █▃▁ |
| 🌿 | virtual-list-window :: lit.html | 1,261 | 1,259 | -0.16% | +0.07% | 3.00% | high | 0.79440 | 0.41% | 0.17% | ▁█▂ |
| 🧭 | virtual-list-window :: manual.createElement | 2,604 | 2,598 | -0.23% | — | 3.00% | high | 0.38484 | 1.25% | 0.63% | █▁▆ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
