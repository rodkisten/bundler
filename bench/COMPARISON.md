<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `4efe6b95` · baseline `ed7f2049` · generated 2026-07-02T21:15:39.954Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000005268 · Linux · X64 |
| CPU | AMD EPYC 7763 64-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.18.0 · V8 13.6.233.17-node.50 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.21 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.20% | +0.20% | 0 | 0 | 19 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 +0.60% | +0.87% | 4 | 2 | 35 | 3 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** +0.20%  
**Raw geometric mean:** +0.20%

### 🚀 Fastest reliable improvements

_None outside the reliability threshold._

### 🐢 Largest reliable regressions

_None outside the reliability threshold._

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | class name: compact prefix-a-hash | 192,037 | 191,703 | -0.17% | — | 3.00% | high | 0.00522 | 0.49% | 0.07% | █▁█ |
| 🌿 | class name: privacy redaction and truncation | 148,517 | 146,781 | -1.17% | — | 3.00% | high | 0.00681 | 0.57% | 0.11% | █▂▁ |
| 🌿 | class name: readable property-value-context-hash | 192,732 | 191,777 | -0.50% | — | 3.00% | high | 0.00521 | 0.33% | 0.04% | █▁█ |
| 🌿 | cold atomic.css: transform parse compile | 2,187 | 2,176 | -0.49% | — | 3.42% | high | 0.45946 | 1.55% | 1.59% | ▅█▁ |
| 🌿 | cold css: atomic detection + compile | 2,265 | 2,277 | +0.51% | — | 3.33% | high | 0.43917 | 0.47% | 0.12% | ▁█▇ |
| 🌿 | cold css: configure parse + normalized apply | 11,465 | 11,443 | -0.20% | — | 4.92% | high | 0.08739 | 0.99% | 1.01% | █▁▅ |
| 🌿 | cold css: sheet detection + compile | 2,486 | 2,487 | +0.05% | — | 3.00% | high | 0.40209 | 0.77% | 0.06% | ▁▁█ |
| 🌿 | cold sheet.css: transform parse compile | 2,527 | 2,514 | -0.54% | — | 3.00% | high | 0.39781 | 0.56% | 0.17% | ▂█▁ |
| 🌿 | stylis: nested stylesheet compile | 75,819 | 76,694 | +1.15% | — | 3.00% | high | 0.01304 | 0.95% | 0.27% | ▁▇█ |
| 🌿 | stylis: tiny declaration compile | 1,527,952 | 1,554,131 | +1.71% | — | 3.00% | high | 0.00064 | 1.24% | 0.12% | ▁██ |
| 🧭 | baseline: String.raw tiny css | 3,240,451 | 3,279,071 | +1.19% | — | 3.00% | high | 0.00030 | 1.79% | 0.70% | ▇▁█ |
| 🌿 | warm atomic.css: aliases helpers comments variants | 244,710 | 244,382 | -0.13% | — | 3.00% | high | 0.00409 | 1.46% | 0.91% | ▁█▆ |
| 🌿 | warm atomic.css: classic atomic compile | 414,672 | 420,038 | +1.29% | — | 3.00% | high | 0.00238 | 1.25% | 0.30% | ▁█▇ |
| 🌿 | warm atomic.css.withImportant | 245,783 | 245,848 | +0.03% | — | 3.00% | high | 0.00407 | 2.17% | 0.39% | ▁▇█ |
| 🌿 | warm css: polymorphic atomic identity hit | 1,437,992 | 1,440,654 | +0.19% | — | 3.00% | high | 0.00069 | 1.12% | 0.60% | █▁▃ |
| 🌿 | warm css: polymorphic sheet identity hit | 693,996 | 696,187 | +0.32% | — | 3.00% | high | 0.00144 | 0.76% | 0.80% | █▄▁ |
| 🌿 | warm css: prepared configure plan hit | 4,522,204 | 4,552,111 | +0.66% | — | 3.00% | high | 0.00022 | 4.02% | 1.97% | ▁▂█ |
| 🌿 | warm inline.css: inline style compile | 415,112 | 418,005 | +0.70% | — | 3.00% | high | 0.00239 | 0.56% | 0.38% | █▆▁ |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 163,469 | 164,116 | +0.40% | — | 3.00% | high | 0.00609 | 2.05% | 0.14% | ▁██ |
| 🌿 | warm sheet.css.withImportant | 163,939 | 163,981 | +0.03% | — | 3.00% | high | 0.00610 | 2.56% | 0.10% | ▁██ |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** +0.60%  
**Raw geometric mean:** +0.87%

### 🚀 Fastest reliable improvements

1. **named-instance-reuse :: fabrica.html** · +8.02% normalized · high confidence
2. **named-instance-reuse :: lit.html** · +7.25% normalized · medium confidence
3. **forked-registry-resolution :: lit.html** · +6.31% normalized · high confidence
4. **forked-registry-resolution :: fabrica.html** · +3.91% normalized · high confidence

### 🐢 Largest reliable regressions

1. **raw-html :: lit.html** · -3.69% normalized · high confidence
2. **portable-definition-install :: lit.html** · -3.52% normalized · high confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 21.24% noise floor
3. **virtual-list-window :: fabrica.html** · 19.11% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 24,691 | control |
| complex-attributes | fabrica.html | 5,933 | 24.03% of manual throughput |
| complex-attributes | lit.html | 12,116 | 49.07% of manual throughput |
| conditional-component | manual.createElement | 7,532 | control |
| conditional-component | fabrica.html | 1,091 | 14.49% of manual throughput |
| conditional-component | lit.html | 4,886 | 64.86% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,800,067 | control |
| forked-registry-resolution | fabrica.html | 743,732 | 41.32% of manual throughput |
| forked-registry-resolution | lit.html | 14,004,712 | 778.01% of manual throughput |
| instance-named-render | manual.createElement | 82,958 | control |
| instance-named-render | fabrica.html | 9,308 | 11.22% of manual throughput |
| instance-named-render | lit.html | 44,296 | 53.40% of manual throughput |
| keyed-list-update | manual.createElement | 899 | control |
| keyed-list-update | fabrica.html | 115 | 12.81% of manual throughput |
| keyed-list-update | lit.html | 500 | 55.58% of manual throughput |
| named-component-definition | manual.createElement | 3,871,235 | control |
| named-component-definition | fabrica.html | 397,847 | 10.28% of manual throughput |
| named-component-definition | lit.html | 3,636,865 | 93.95% of manual throughput |
| named-instance-reuse | manual.createElement | 10,470,790 | control |
| named-instance-reuse | fabrica.html | 318,850 | 3.05% of manual throughput |
| named-instance-reuse | lit.html | 14,681,100 | 140.21% of manual throughput |
| named-styled-registry | manual.createElement | 61,011 | control |
| named-styled-registry | fabrica.html | 10,238 | 16.78% of manual throughput |
| named-styled-registry | lit.html | 39,488 | 64.72% of manual throughput |
| nested-components | manual.createElement | 8,854 | control |
| nested-components | fabrica.html | 1,026 | 11.58% of manual throughput |
| nested-components | lit.html | 4,297 | 48.53% of manual throughput |
| portable-definition-install | manual.createElement | 6,671,410 | control |
| portable-definition-install | fabrica.html | 147,310 | 2.21% of manual throughput |
| portable-definition-install | lit.html | 9,641,983 | 144.53% of manual throughput |
| portal-mount | manual.createElement | 50,830 | control |
| portal-mount | fabrica.html | 10,326 | 20.31% of manual throughput |
| portal-mount | lit.html | 19,582 | 38.52% of manual throughput |
| raw-html | manual.createElement | 14,031 | control |
| raw-html | fabrica.html | 13,151 | 93.73% of manual throughput |
| raw-html | lit.html | 9,538 | 67.98% of manual throughput |
| reactive-class-style | manual.createElement | 7,330 | control |
| reactive-class-style | fabrica.html | 2,982 | 40.69% of manual throughput |
| reactive-class-style | lit.html | 5,206 | 71.03% of manual throughput |
| reactive-text | manual.createElement | 57,244 | control |
| reactive-text | fabrica.html | 10,342 | 18.07% of manual throughput |
| reactive-text | lit.html | 16,752 | 29.26% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,696,151 | control |
| shared-registry-resolution | fabrica.html | 1,121,290 | 10.48% of manual throughput |
| shared-registry-resolution | lit.html | 14,865,258 | 138.98% of manual throughput |
| spread-props-events | manual.createElement | 23,393 | control |
| spread-props-events | fabrica.html | 7,758 | 33.16% of manual throughput |
| spread-props-events | lit.html | 10,150 | 43.39% of manual throughput |
| static-tree | manual.createElement | 14,531 | control |
| static-tree | fabrica.html | 12,222 | 84.11% of manual throughput |
| static-tree | lit.html | 12,913 | 88.87% of manual throughput |
| styled-artifact-composition | manual.createElement | 161,125 | control |
| styled-artifact-composition | fabrica.html | 75,599 | 46.92% of manual throughput |
| styled-artifact-composition | lit.html | 37,523 | 23.29% of manual throughput |
| styled-artifact-render | manual.createElement | 160,588 | control |
| styled-artifact-render | fabrica.html | 102,526 | 63.84% of manual throughput |
| styled-artifact-render | lit.html | 40,957 | 25.50% of manual throughput |
| styled-component-registration | manual.createElement | 836,334 | control |
| styled-component-registration | fabrica.html | 124,993 | 14.95% of manual throughput |
| styled-component-registration | lit.html | 1,732,861 | 207.20% of manual throughput |
| two-way-bind | manual.createElement | 42,918 | control |
| two-way-bind | fabrica.html | 11,495 | 26.78% of manual throughput |
| two-way-bind | lit.html | 13,553 | 31.58% of manual throughput |
| virtual-list-window | manual.createElement | 2,270 | control |
| virtual-list-window | fabrica.html | 652 | 28.72% of manual throughput |
| virtual-list-window | lit.html | 1,150 | 50.69% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 🌿 | complex-attributes :: fabrica.html | 5,886 | 5,933 | +0.79% | +0.37% | 8.52% | medium | 0.16856 | 1.93% | 2.18% | ▅▁█ |
| 🌿 | complex-attributes :: lit.html | 12,122 | 12,116 | -0.05% | -0.47% | 3.00% | high | 0.08253 | 2.77% | 1.98% | ▃▁█ |
| 🧭 | complex-attributes :: manual.createElement | 24,587 | 24,691 | +0.42% | — | 3.00% | high | 0.04050 | 0.22% | 0.15% | ▃▁█ |
| 🌿 | conditional-component :: fabrica.html | 1,048 | 1,091 | +4.10% | +3.49% | 9.04% | medium | 0.91651 | 1.24% | 1.49% | █▅▁ |
| 🌿 | conditional-component :: lit.html | 4,811 | 4,886 | +1.54% | +0.95% | 3.00% | high | 0.20469 | 1.70% | 1.50% | ▁▅█ |
| 🧭 | conditional-component :: manual.createElement | 7,488 | 7,532 | +0.59% | — | 3.00% | high | 0.13277 | 0.55% | 0.38% | ▁▃█ |
| 🚀 | forked-registry-resolution :: fabrica.html | 715,994 | 743,732 | +3.87% | +3.91% | 3.00% | high | 0.00134 | 1.94% | 0.22% | ██▁ |
| 🚀 | forked-registry-resolution :: lit.html | 13,177,127 | 14,004,712 | +6.28% | +6.31% | 3.00% | high | 0.00007 | 2.66% | 2.13% | ▆█▁ |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,800,612 | 1,800,067 | -0.03% | — | 3.00% | high | 0.00056 | 3.77% | 1.73% | ▇█▁ |
| 🌿 | instance-named-render :: fabrica.html | 9,238 | 9,308 | +0.76% | +0.99% | 6.47% | high | 0.10743 | 2.10% | 1.03% | ▁█▇ |
| 🌿 | instance-named-render :: lit.html | 44,615 | 44,296 | -0.71% | -0.48% | 3.00% | high | 0.02258 | 2.01% | 0.54% | ▁▇█ |
| 🧭 | instance-named-render :: manual.createElement | 83,153 | 82,958 | -0.23% | — | 3.00% | high | 0.01205 | 2.08% | 1.32% | ▁█▆ |
| 🌿 | keyed-list-update :: fabrica.html | 111 | 115 | +4.12% | +2.65% | 12.77% | medium | 8.68551 | 1.04% | 0.94% | ▅█▁ |
| 🌿 | keyed-list-update :: lit.html | 497 | 500 | +0.43% | -0.99% | 4.19% | high | 2.00171 | 1.24% | 0.80% | ▁▆█ |
| 🧭 | keyed-list-update :: manual.createElement | 886 | 899 | +1.44% | — | 3.00% | high | 1.11250 | 1.59% | 0.59% | ▁█▇ |
| 🌿 | named-component-definition :: fabrica.html | 398,650 | 397,847 | -0.20% | -0.92% | 3.24% | high | 0.00251 | 0.44% | 0.28% | ▆█▁ |
| 🌿 | named-component-definition :: lit.html | 3,632,095 | 3,636,865 | +0.13% | -0.59% | 3.28% | high | 0.00027 | 3.13% | 2.66% | █▁▃ |
| 🧭 | named-component-definition :: manual.createElement | 3,843,534 | 3,871,235 | +0.72% | — | 3.00% | high | 0.00026 | 1.76% | 1.28% | █▁▆ |
| 🚀 | named-instance-reuse :: fabrica.html | 306,693 | 318,850 | +3.96% | +8.02% | 3.69% | high | 0.00314 | 0.58% | 0.13% | █▇▁ |
| 🚀 | named-instance-reuse :: lit.html | 14,222,036 | 14,681,100 | +3.23% | +7.25% | 5.82% | medium | 0.00007 | 1.23% | 0.70% | ▃█▁ |
| 🧭 | named-instance-reuse :: manual.createElement | 10,878,818 | 10,470,790 | -3.75% | — | 3.00% | high | 0.00010 | 3.09% | 0.87% | ▂█▁ |
| 🌿 | named-styled-registry :: fabrica.html | 10,020 | 10,238 | +2.17% | +3.66% | 4.17% | high | 0.09768 | 1.99% | 0.53% | ▁▇█ |
| 🌿 | named-styled-registry :: lit.html | 39,868 | 39,488 | -0.95% | +0.49% | 3.00% | high | 0.02532 | 2.16% | 2.34% | ▁█▅ |
| 🧭 | named-styled-registry :: manual.createElement | 61,899 | 61,011 | -1.43% | — | 3.00% | high | 0.01639 | 2.31% | 2.25% | ▁█▅ |
| 🌿 | nested-components :: fabrica.html | 1,030 | 1,026 | -0.41% | -0.40% | 15.70% | medium | 0.97508 | 2.02% | 1.59% | ▃█▁ |
| 🌿 | nested-components :: lit.html | 4,191 | 4,297 | +2.53% | +2.55% | 3.00% | high | 0.23272 | 0.57% | 0.53% | ▁▄█ |
| 🧭 | nested-components :: manual.createElement | 8,856 | 8,854 | -0.02% | — | 3.00% | high | 0.11294 | 1.88% | 0.09% | ▁▁█ |
| ⚠️ | portable-definition-install :: fabrica.html | 149,088 | 147,310 | -1.19% | -1.27% | 25.00% | low | 0.00679 | 1.89% | 0.85% | █▂▁ |
| 🐢 | portable-definition-install :: lit.html | 9,985,674 | 9,641,983 | -3.44% | -3.52% | 3.00% | high | 0.00010 | 2.82% | 1.25% | ▂█▁ |
| 🧭 | portable-definition-install :: manual.createElement | 6,666,183 | 6,671,410 | +0.08% | — | 3.00% | high | 0.00015 | 2.77% | 1.98% | ▁█▃ |
| 🌿 | portal-mount :: fabrica.html | 10,512 | 10,326 | -1.77% | -0.63% | 8.93% | medium | 0.09685 | 0.62% | 0.23% | ▂█▁ |
| 🌿 | portal-mount :: lit.html | 19,942 | 19,582 | -1.81% | -0.67% | 3.00% | high | 0.05107 | 2.50% | 1.49% | ▁█▃ |
| 🧭 | portal-mount :: manual.createElement | 51,419 | 50,830 | -1.14% | — | 3.00% | high | 0.01967 | 1.20% | 1.09% | ▁█▄ |
| 🌿 | raw-html :: fabrica.html | 13,158 | 13,151 | -0.05% | -1.54% | 7.14% | medium | 0.07604 | 1.45% | 1.64% | ▁█▄ |
| 🐢 | raw-html :: lit.html | 9,755 | 9,538 | -2.23% | -3.69% | 3.00% | high | 0.10485 | 0.73% | 0.02% | ▁█▁ |
| 🧭 | raw-html :: manual.createElement | 13,821 | 14,031 | +1.52% | — | 3.00% | high | 0.07127 | 1.56% | 1.19% | ▃█▁ |
| 🌿 | reactive-class-style :: fabrica.html | 3,015 | 2,982 | -1.10% | -0.91% | 5.62% | high | 0.33533 | 2.35% | 2.34% | ▁█▄ |
| 🌿 | reactive-class-style :: lit.html | 5,233 | 5,206 | -0.52% | -0.33% | 8.77% | medium | 0.19209 | 2.36% | 1.22% | ▁▃█ |
| 🧭 | reactive-class-style :: manual.createElement | 7,343 | 7,330 | -0.19% | — | 3.00% | high | 0.13643 | 0.93% | 0.83% | ▅▁█ |
| 🌿 | reactive-text :: fabrica.html | 10,525 | 10,342 | -1.74% | -2.83% | 11.11% | medium | 0.09669 | 1.49% | 0.91% | ▃█▁ |
| 🌿 | reactive-text :: lit.html | 16,605 | 16,752 | +0.88% | -0.24% | 3.00% | high | 0.05970 | 1.80% | 0.02% | ▁██ |
| 🧭 | reactive-text :: manual.createElement | 56,608 | 57,244 | +1.12% | — | 3.00% | high | 0.01747 | 0.77% | 0.23% | ▁█▇ |
| 🌿 | shared-registry-resolution :: fabrica.html | 1,123,796 | 1,121,290 | -0.22% | +1.40% | 3.00% | high | 0.00089 | 0.16% | 0.18% | █▅▁ |
| 🌿 | shared-registry-resolution :: lit.html | 14,930,613 | 14,865,258 | -0.44% | +1.18% | 3.00% | high | 0.00007 | 1.48% | 1.04% | █▆▁ |
| 🧭 | shared-registry-resolution :: manual.createElement | 10,869,964 | 10,696,151 | -1.60% | — | 3.00% | high | 0.00009 | 1.14% | 1.25% | █▅▁ |
| 🌿 | spread-props-events :: fabrica.html | 7,806 | 7,758 | -0.61% | -1.41% | 10.57% | medium | 0.12890 | 2.23% | 0.86% | ▂▁█ |
| 🌿 | spread-props-events :: lit.html | 10,134 | 10,150 | +0.15% | -0.65% | 13.98% | medium | 0.09852 | 1.55% | 0.53% | █▇▁ |
| 🧭 | spread-props-events :: manual.createElement | 23,205 | 23,393 | +0.81% | — | 3.00% | high | 0.04275 | 0.71% | 0.48% | ▁▃█ |
| 🌿 | static-tree :: fabrica.html | 12,002 | 12,222 | +1.83% | -1.73% | 3.05% | high | 0.08182 | 1.14% | 0.17% | ▁██ |
| 🌿 | static-tree :: lit.html | 12,743 | 12,913 | +1.34% | -2.21% | 3.00% | high | 0.07744 | 1.52% | 1.08% | ▁▆█ |
| 🧭 | static-tree :: manual.createElement | 14,022 | 14,531 | +3.63% | — | 3.00% | high | 0.06882 | 1.82% | 2.17% | ▅▁█ |
| 🌿 | styled-artifact-composition :: fabrica.html | 72,377 | 75,599 | +4.45% | +2.52% | 3.00% | high | 0.01323 | 1.26% | 1.05% | ▁█▆ |
| 🌿 | styled-artifact-composition :: lit.html | 37,376 | 37,523 | +0.40% | -1.46% | 3.00% | high | 0.02665 | 1.87% | 0.11% | ▁██ |
| 🧭 | styled-artifact-composition :: manual.createElement | 158,145 | 161,125 | +1.88% | — | 3.00% | high | 0.00621 | 1.62% | 0.06% | ▁██ |
| 🌿 | styled-artifact-render :: fabrica.html | 101,938 | 102,526 | +0.58% | -0.49% | 3.09% | high | 0.00975 | 2.86% | 3.09% | ▅█▁ |
| 🌿 | styled-artifact-render :: lit.html | 40,616 | 40,957 | +0.84% | -0.23% | 3.00% | high | 0.02442 | 2.63% | 1.03% | ▁█▇ |
| 🧭 | styled-artifact-render :: manual.createElement | 158,877 | 160,588 | +1.08% | — | 3.00% | high | 0.00623 | 1.59% | 0.31% | ▁▇█ |
| ⚠️ | styled-component-registration :: fabrica.html | 122,905 | 124,993 | +1.70% | +1.35% | 21.24% | low | 0.00800 | 2.00% | 0.46% | █▁▂ |
| 🌿 | styled-component-registration :: lit.html | 1,588,149 | 1,732,861 | +9.11% | +8.74% | 13.16% | low | 0.00058 | 4.82% | 0.43% | █▁█ |
| 🧭 | styled-component-registration :: manual.createElement | 833,444 | 836,334 | +0.35% | — | 3.00% | high | 0.00120 | 0.31% | 0.08% | ▁▂█ |
| 🌿 | two-way-bind :: fabrica.html | 11,751 | 11,495 | -2.18% | -2.76% | 17.10% | medium | 0.08700 | 2.91% | 0.38% | ▁▁█ |
| 🌿 | two-way-bind :: lit.html | 13,370 | 13,553 | +1.37% | +0.77% | 17.72% | medium | 0.07378 | 2.26% | 2.25% | ▁▅█ |
| 🧭 | two-way-bind :: manual.createElement | 42,666 | 42,918 | +0.59% | — | 12.25% | medium | 0.02330 | 2.10% | 1.52% | ▃█▁ |
| ⚠️ | virtual-list-window :: fabrica.html | 649 | 652 | +0.43% | +0.48% | 19.11% | low | 1.53436 | 0.96% | 0.31% | ▁▂█ |
| 🌿 | virtual-list-window :: lit.html | 1,147 | 1,150 | +0.30% | +0.35% | 3.00% | high | 0.86924 | 0.64% | 0.21% | ▁█▂ |
| 🧭 | virtual-list-window :: manual.createElement | 2,271 | 2,270 | -0.05% | — | 3.00% | high | 0.44060 | 0.64% | 0.34% | █▁▆ |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
