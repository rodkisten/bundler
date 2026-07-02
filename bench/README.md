<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `ed7f2049` · baseline `fdfef266` · generated 2026-07-02T20:47:36.248Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000005266 · Linux · X64 |
| CPU | AMD EPYC 9V74 80-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.18.0 · V8 13.6.233.17-node.50 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.23 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.39% | +0.39% | 0 | 0 | 19 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 -0.62% | +0.61% | 1 | 3 | 36 | 4 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** +0.39%  
**Raw geometric mean:** +0.39%

### 🚀 Fastest reliable improvements

_None outside the reliability threshold._

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 197,143 | 197,744 | +0.31% | — | 3.00% | high | 0.00506 | 0.64% | 0.18% | ▁▇█ |
| 🌿 | class name: privacy redaction and truncation | 151,126 | 153,190 | +1.37% | — | 3.00% | high | 0.00653 | 0.42% | 0.30% | ▃█▁ |
| 🌿 | class name: readable property-value-context-hash | 197,546 | 197,246 | -0.15% | — | 3.00% | high | 0.00507 | 0.56% | 0.38% | ▁█▃ |
| 🌿 | cold atomic.css: transform parse compile | 2,342 | 2,302 | -1.71% | — | 3.75% | high | 0.43443 | 2.34% | 0.79% | ▂▁█ |
| 🌿 | cold css: atomic detection + compile | 2,439 | 2,468 | +1.21% | — | 3.54% | high | 0.40512 | 0.79% | 0.09% | ▁▁█ |
| 🌿 | cold css: configure parse + normalized apply | 14,083 | 14,722 | +4.53% | — | 6.04% | high | 0.06793 | 2.21% | 0.42% | ▁█▇ |
| 🌿 | cold css: sheet detection + compile | 2,719 | 2,717 | -0.06% | — | 3.32% | high | 0.36805 | 0.46% | 0.20% | █▂▁ |
| 🌿 | cold sheet.css: transform parse compile | 2,740 | 2,765 | +0.89% | — | 3.38% | high | 0.36169 | 0.86% | 0.67% | ▆▁█ |
| 🌿 | stylis: nested stylesheet compile | 80,839 | 80,437 | -0.50% | — | 3.00% | high | 0.01243 | 0.73% | 0.50% | ▁▃█ |
| 🌿 | stylis: tiny declaration compile | 1,641,259 | 1,668,889 | +1.68% | — | 3.00% | high | 0.00060 | 0.79% | 0.82% | ▁█▅ |
| 🧭 | baseline: String.raw tiny css | 3,421,932 | 3,311,624 | -3.22% | — | 3.52% | high | 0.00030 | 3.99% | 3.52% | ▄▁█ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 235,396 | 235,688 | +0.12% | — | 3.00% | high | 0.00424 | 0.18% | 0.20% | █▁▄ |
| 🌿 | warm atomic.css: classic atomic compile | 409,001 | 407,457 | -0.38% | — | 3.00% | high | 0.00245 | 1.02% | 1.00% | ▁▄█ |
| 🌿 | warm atomic.css.withImportant | 235,579 | 236,249 | +0.28% | — | 3.00% | high | 0.00423 | 0.59% | 0.49% | ▁▆█ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,430,720 | 1,440,488 | +0.68% | — | 3.00% | high | 0.00069 | 3.26% | 1.14% | ▁▇█ |
| 🌿 | warm css: polymorphic sheet identity hit | 654,704 | 656,489 | +0.27% | — | 3.00% | high | 0.00152 | 3.41% | 1.50% | █▁▇ |
| 🌿 | warm css: prepared configure plan hit | 4,532,656 | 4,578,484 | +1.01% | — | 3.00% | high | 0.00022 | 0.44% | 0.19% | █▁▂ |
| 🌿 | warm inline.css: inline style compile | 410,211 | 400,358 | -2.40% | — | 3.00% | high | 0.00250 | 3.73% | 2.03% | ▆█▁ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 157,118 | 158,257 | +0.72% | — | 3.00% | high | 0.00632 | 0.29% | 0.31% | ▁▄█ |
| 🌿 | warm sheet.css.withImportant | 158,179 | 157,683 | -0.31% | — | 3.00% | high | 0.00634 | 0.05% | 0.05% | ▁█▅ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** -0.62%  
**Raw geometric mean:** +0.61%

### 🚀 Fastest reliable improvements

1. **virtual-list-window :: lit.html** · +3.27% normalized · high confidence

### 🐢 Largest reliable regressions

1. **forked-registry-resolution :: lit.html** · -8.70% normalized · high confidence
2. **forked-registry-resolution :: fabrica.html** · -5.12% normalized · high confidence
3. **portable-definition-install :: lit.html** · -4.00% normalized · high confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 24.54% noise floor
3. **virtual-list-window :: fabrica.html** · 21.44% noise floor
4. **nested-components :: fabrica.html** · 18.09% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 32,156 | control |
| complex-attributes | fabrica.html | 7,879 | 24.50% of manual throughput |
| complex-attributes | lit.html | 16,012 | 49.79% of manual throughput |
| conditional-component | manual.createElement | 7,998 | control |
| conditional-component | fabrica.html | 1,247 | 15.60% of manual throughput |
| conditional-component | lit.html | 5,396 | 67.47% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,814,655 | control |
| forked-registry-resolution | fabrica.html | 707,312 | 38.98% of manual throughput |
| forked-registry-resolution | lit.html | 13,105,556 | 722.21% of manual throughput |
| instance-named-render | manual.createElement | 84,774 | control |
| instance-named-render | fabrica.html | 11,030 | 13.01% of manual throughput |
| instance-named-render | lit.html | 47,816 | 56.40% of manual throughput |
| keyed-list-update | manual.createElement | 886 | control |
| keyed-list-update | fabrica.html | 121 | 13.64% of manual throughput |
| keyed-list-update | lit.html | 542 | 61.17% of manual throughput |
| named-component-definition | manual.createElement | 3,479,869 | control |
| named-component-definition | fabrica.html | 385,285 | 11.07% of manual throughput |
| named-component-definition | lit.html | 3,673,018 | 105.55% of manual throughput |
| named-instance-reuse | manual.createElement | 9,980,745 | control |
| named-instance-reuse | fabrica.html | 288,031 | 2.89% of manual throughput |
| named-instance-reuse | lit.html | 14,120,255 | 141.47% of manual throughput |
| named-styled-registry | manual.createElement | 66,603 | control |
| named-styled-registry | fabrica.html | 13,133 | 19.72% of manual throughput |
| named-styled-registry | lit.html | 44,585 | 66.94% of manual throughput |
| nested-components | manual.createElement | 9,329 | control |
| nested-components | fabrica.html | 1,181 | 12.66% of manual throughput |
| nested-components | lit.html | 4,724 | 50.64% of manual throughput |
| portable-definition-install | manual.createElement | 6,441,750 | control |
| portable-definition-install | fabrica.html | 131,975 | 2.05% of manual throughput |
| portable-definition-install | lit.html | 9,149,562 | 142.04% of manual throughput |
| portal-mount | manual.createElement | 53,561 | control |
| portal-mount | fabrica.html | 12,993 | 24.26% of manual throughput |
| portal-mount | lit.html | 21,930 | 40.94% of manual throughput |
| raw-html | manual.createElement | 16,845 | control |
| raw-html | fabrica.html | 15,718 | 93.31% of manual throughput |
| raw-html | lit.html | 10,852 | 64.42% of manual throughput |
| reactive-class-style | manual.createElement | 7,807 | control |
| reactive-class-style | fabrica.html | 3,645 | 46.69% of manual throughput |
| reactive-class-style | lit.html | 7,914 | 101.37% of manual throughput |
| reactive-text | manual.createElement | 60,590 | control |
| reactive-text | fabrica.html | 13,037 | 21.52% of manual throughput |
| reactive-text | lit.html | 14,842 | 24.50% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,114,771 | control |
| shared-registry-resolution | fabrica.html | 1,159,634 | 11.46% of manual throughput |
| shared-registry-resolution | lit.html | 14,124,830 | 139.65% of manual throughput |
| spread-props-events | manual.createElement | 31,602 | control |
| spread-props-events | fabrica.html | 11,031 | 34.91% of manual throughput |
| spread-props-events | lit.html | 13,574 | 42.95% of manual throughput |
| static-tree | manual.createElement | 16,705 | control |
| static-tree | fabrica.html | 13,255 | 79.34% of manual throughput |
| static-tree | lit.html | 13,922 | 83.34% of manual throughput |
| styled-artifact-composition | manual.createElement | 155,480 | control |
| styled-artifact-composition | fabrica.html | 77,114 | 49.60% of manual throughput |
| styled-artifact-composition | lit.html | 42,694 | 27.46% of manual throughput |
| styled-artifact-render | manual.createElement | 154,772 | control |
| styled-artifact-render | fabrica.html | 104,913 | 67.79% of manual throughput |
| styled-artifact-render | lit.html | 45,219 | 29.22% of manual throughput |
| styled-component-registration | manual.createElement | 793,674 | control |
| styled-component-registration | fabrica.html | 67,506 | 8.51% of manual throughput |
| styled-component-registration | lit.html | 2,521,096 | 317.65% of manual throughput |
| two-way-bind | manual.createElement | 54,313 | control |
| two-way-bind | fabrica.html | 18,568 | 34.19% of manual throughput |
| two-way-bind | lit.html | 18,690 | 34.41% of manual throughput |
| virtual-list-window | manual.createElement | 2,578 | control |
| virtual-list-window | fabrica.html | 720 | 27.95% of manual throughput |
| virtual-list-window | lit.html | 1,271 | 49.30% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 7,909 | 7,879 | -0.38% | -1.16% | 10.56% | medium | 0.12692 | 0.82% | 0.84% | █▅▁ |
| 🌿 | complex-attributes :: lit.html | 15,626 | 16,012 | +2.47% | +1.66% | 3.00% | high | 0.06245 | 0.78% | 0.14% | ▂█▁ |
| 🧭 | complex-attributes :: manual.createElement | 31,904 | 32,156 | +0.79% | — | 3.00% | high | 0.03110 | 0.82% | 0.13% | ██▁ |
| 🌿 | conditional-component :: fabrica.html | 1,222 | 1,247 | +2.09% | -0.36% | 10.97% | medium | 0.80169 | 2.38% | 2.43% | ▅█▁ |
| 🌿 | conditional-component :: lit.html | 5,292 | 5,396 | +1.97% | -0.47% | 3.00% | high | 0.18531 | 0.65% | 0.03% | █▁▁ |
| 🧭 | conditional-component :: manual.createElement | 7,807 | 7,998 | +2.45% | — | 3.00% | high | 0.12503 | 0.56% | 0.41% | █▆▁ |
| 🐢 | forked-registry-resolution :: fabrica.html | 707,395 | 707,312 | -0.01% | -5.12% | 3.00% | high | 0.00141 | 2.34% | 2.57% | ▁█▄ |
| 🐢 | forked-registry-resolution :: lit.html | 13,621,182 | 13,105,556 | -3.79% | -8.70% | 3.00% | high | 0.00008 | 5.55% | 0.93% | ▁▇█ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,721,988 | 1,814,655 | +5.38% | — | 3.00% | high | 0.00055 | 5.77% | 1.67% | ▁█▇ |
| 🌿 | instance-named-render :: fabrica.html | 10,946 | 11,030 | +0.76% | -0.80% | 7.40% | medium | 0.09067 | 0.72% | 0.24% | ▁█▂ |
| 🌿 | instance-named-render :: lit.html | 47,798 | 47,816 | +0.04% | -1.52% | 3.00% | high | 0.02091 | 1.11% | 1.15% | █▄▁ |
| 🧭 | instance-named-render :: manual.createElement | 83,457 | 84,774 | +1.58% | — | 3.00% | high | 0.01180 | 0.45% | 0.37% | █▃▁ |
| 🌿 | keyed-list-update :: fabrica.html | 120 | 121 | +0.72% | -2.31% | 14.14% | medium | 8.27427 | 0.94% | 0.19% | █▂▁ |
| 🌿 | keyed-list-update :: lit.html | 542 | 542 | -0.05% | -3.06% | 4.15% | high | 1.84465 | 0.78% | 0.53% | ▃█▁ |
| 🧭 | keyed-list-update :: manual.createElement | 860 | 886 | +3.10% | — | 3.00% | high | 1.12831 | 1.33% | 1.47% | █▄▁ |
| 🌿 | named-component-definition :: fabrica.html | 384,673 | 385,285 | +0.16% | +1.14% | 4.51% | high | 0.00260 | 1.28% | 0.60% | ▇█▁ |
| 🌿 | named-component-definition :: lit.html | 3,667,116 | 3,673,018 | +0.16% | +1.14% | 4.89% | high | 0.00027 | 1.25% | 0.95% | ▃█▁ |
| 🧭 | named-component-definition :: manual.createElement | 3,513,989 | 3,479,869 | -0.97% | — | 3.68% | high | 0.00029 | 4.69% | 0.59% | ▁██ |
| 🌿 | named-instance-reuse :: fabrica.html | 295,918 | 288,031 | -2.67% | -0.29% | 4.50% | high | 0.00347 | 4.01% | 4.50% | ▅█▁ |
| 🌿 | named-instance-reuse :: lit.html | 14,213,446 | 14,120,255 | -0.66% | +1.77% | 3.00% | high | 0.00007 | 6.88% | 1.13% | ▁▇█ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,224,407 | 9,980,745 | -2.38% | — | 3.00% | high | 0.00010 | 3.52% | 0.84% | ▁▇█ |
| 🌿 | named-styled-registry :: fabrica.html | 12,933 | 13,133 | +1.55% | -0.14% | 4.74% | high | 0.07615 | 1.36% | 0.54% | ▂▁█ |
| 🌿 | named-styled-registry :: lit.html | 44,115 | 44,585 | +1.07% | -0.61% | 3.00% | high | 0.02243 | 1.02% | 0.33% | █▁▂ |
| 🧭 | named-styled-registry :: manual.createElement | 65,496 | 66,603 | +1.69% | — | 3.00% | high | 0.01501 | 0.59% | 0.25% | █▇▁ |
| ⚠️ | nested-components :: fabrica.html | 1,185 | 1,181 | -0.30% | -4.33% | 18.09% | low | 0.84659 | 1.19% | 0.92% | ▆█▁ |
| 🌿 | nested-components :: lit.html | 4,669 | 4,724 | +1.19% | -2.91% | 5.10% | medium | 0.21167 | 1.97% | 1.57% | ▆█▁ |
| 🧭 | nested-components :: manual.createElement | 8,952 | 9,329 | +4.21% | — | 5.10% | medium | 0.10719 | 1.50% | 0.11% | ▁█▁ |
| ⚠️ | portable-definition-install :: fabrica.html | 130,506 | 131,975 | +1.13% | +3.22% | 25.00% | low | 0.00758 | 8.86% | 5.47% | ▆█▁ |
| 🐢 | portable-definition-install :: lit.html | 9,728,585 | 9,149,562 | -5.95% | -4.00% | 3.00% | high | 0.00011 | 2.82% | 1.54% | ▁█▆ |
| 🧭 | portable-definition-install :: manual.createElement | 6,575,176 | 6,441,750 | -2.03% | — | 3.00% | high | 0.00016 | 2.28% | 2.17% | ▁█▅ |
| 🌿 | portal-mount :: fabrica.html | 12,699 | 12,993 | +2.31% | +1.86% | 10.77% | medium | 0.07697 | 0.64% | 0.69% | █▅▁ |
| 🌿 | portal-mount :: lit.html | 21,622 | 21,930 | +1.42% | +0.98% | 3.00% | high | 0.04560 | 0.37% | 0.07% | █▇▁ |
| 🧭 | portal-mount :: manual.createElement | 53,326 | 53,561 | +0.44% | — | 3.00% | high | 0.01867 | 0.55% | 0.19% | █▁▂ |
| 🌿 | raw-html :: fabrica.html | 15,638 | 15,718 | +0.52% | -2.34% | 8.14% | medium | 0.06362 | 0.81% | 0.80% | ▄█▁ |
| 🌿 | raw-html :: lit.html | 10,810 | 10,852 | +0.39% | -2.47% | 3.00% | high | 0.09215 | 0.36% | 0.12% | ▇▁█ |
| 🧭 | raw-html :: manual.createElement | 16,367 | 16,845 | +2.93% | — | 3.00% | high | 0.05936 | 1.84% | 1.34% | ▆█▁ |
| 🌿 | reactive-class-style :: fabrica.html | 3,619 | 3,645 | +0.70% | -0.19% | 6.21% | high | 0.27436 | 0.74% | 0.72% | ▁█▄ |
| 🌿 | reactive-class-style :: lit.html | 7,907 | 7,914 | +0.09% | -0.80% | 3.00% | high | 0.12636 | 0.70% | 0.29% | █▁▂ |
| 🧭 | reactive-class-style :: manual.createElement | 7,738 | 7,807 | +0.89% | — | 3.00% | high | 0.12809 | 0.46% | 0.19% | ▂█▁ |
| 🌿 | reactive-text :: fabrica.html | 12,998 | 13,037 | +0.30% | -3.00% | 12.92% | medium | 0.07670 | 2.07% | 0.53% | ▂█▁ |
| 🌿 | reactive-text :: lit.html | 14,735 | 14,842 | +0.73% | -2.59% | 10.94% | medium | 0.06738 | 0.12% | 0.14% | ▄▁█ |
| 🧭 | reactive-text :: manual.createElement | 58,597 | 60,590 | +3.40% | — | 3.00% | high | 0.01650 | 0.34% | 0.01% | █▁█ |
| 🌿 | shared-registry-resolution :: fabrica.html | 1,159,080 | 1,159,634 | +0.05% | +2.48% | 3.00% | high | 0.00086 | 0.74% | 0.29% | ▁█▇ |
| 🌿 | shared-registry-resolution :: lit.html | 14,490,291 | 14,124,830 | -2.52% | -0.15% | 4.41% | high | 0.00007 | 7.18% | 4.41% | ▁▆█ |
| 🧭 | shared-registry-resolution :: manual.createElement | 10,360,945 | 10,114,771 | -2.38% | — | 3.00% | high | 0.00010 | 5.19% | 0.08% | ▁██ |
| 🌿 | spread-props-events :: fabrica.html | 10,490 | 11,031 | +5.16% | +3.22% | 14.17% | medium | 0.09065 | 1.56% | 0.70% | ▇▁█ |
| 🌿 | spread-props-events :: lit.html | 13,435 | 13,574 | +1.03% | -0.83% | 16.54% | medium | 0.07367 | 0.67% | 0.06% | ▁█▁ |
| 🧭 | spread-props-events :: manual.createElement | 31,018 | 31,602 | +1.88% | — | 3.43% | high | 0.03164 | 1.41% | 1.49% | ▄█▁ |
| 🌿 | static-tree :: fabrica.html | 13,181 | 13,255 | +0.56% | -0.24% | 3.00% | high | 0.07544 | 0.97% | 0.97% | ▁▅█ |
| 🌿 | static-tree :: lit.html | 13,877 | 13,922 | +0.32% | -0.48% | 3.00% | high | 0.07183 | 0.86% | 0.77% | ▄█▁ |
| 🧭 | static-tree :: manual.createElement | 16,572 | 16,705 | +0.80% | — | 3.00% | high | 0.05986 | 1.37% | 1.23% | ▅█▁ |
| 🌿 | styled-artifact-composition :: fabrica.html | 77,867 | 77,114 | -0.97% | -2.26% | 3.00% | high | 0.01297 | 0.47% | 0.33% | █▁▃ |
| 🌿 | styled-artifact-composition :: lit.html | 42,154 | 42,694 | +1.28% | -0.04% | 3.00% | high | 0.02342 | 1.38% | 1.40% | █▁▄ |
| 🧭 | styled-artifact-composition :: manual.createElement | 153,458 | 155,480 | +1.32% | — | 3.00% | high | 0.00643 | 0.83% | 0.66% | ▆█▁ |
| 🌿 | styled-artifact-render :: fabrica.html | 104,835 | 104,913 | +0.07% | -0.77% | 3.00% | high | 0.00953 | 0.33% | 0.19% | ▁▃█ |
| 🌿 | styled-artifact-render :: lit.html | 44,684 | 45,219 | +1.20% | +0.34% | 3.00% | high | 0.02211 | 0.99% | 0.76% | █▃▁ |
| 🧭 | styled-artifact-render :: manual.createElement | 153,462 | 154,772 | +0.85% | — | 3.00% | high | 0.00646 | 0.80% | 0.58% | █▁▆ |
| ⚠️ | styled-component-registration :: fabrica.html | 109,482 | 67,506 | -38.34% | -38.65% | 24.54% | low | 0.01481 | 4.69% | 3.26% | ▁█▆ |
| 🌿 | styled-component-registration :: lit.html | 2,375,983 | 2,521,096 | +6.11% | +5.58% | 7.43% | medium | 0.00040 | 0.86% | 0.84% | █▅▁ |
| 🧭 | styled-component-registration :: manual.createElement | 789,745 | 793,674 | +0.50% | — | 3.00% | high | 0.00126 | 1.55% | 1.61% | █▁▄ |
| 🌿 | two-way-bind :: fabrica.html | 17,566 | 18,568 | +5.70% | +3.46% | 21.54% | medium | 0.05386 | 4.08% | 4.86% | ▁█▅ |
| 🌿 | two-way-bind :: lit.html | 18,781 | 18,690 | -0.48% | -2.60% | 21.04% | medium | 0.05350 | 6.53% | 4.56% | █▁▆ |
| 🧭 | two-way-bind :: manual.createElement | 53,159 | 54,313 | +2.17% | — | 14.02% | medium | 0.01841 | 2.33% | 0.81% | ▁▇█ |
| ⚠️ | virtual-list-window :: fabrica.html | 735 | 720 | -1.92% | -1.28% | 21.44% | low | 1.38793 | 2.14% | 1.28% | █▁▃ |
| 🚀 | virtual-list-window :: lit.html | 1,239 | 1,271 | +2.60% | +3.27% | 3.00% | high | 0.78692 | 1.21% | 0.32% | ▇█▁ |
| 🧭 | virtual-list-window :: manual.createElement | 2,595 | 2,578 | -0.65% | — | 3.00% | high | 0.38792 | 1.13% | 0.73% | ▁█▃ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
