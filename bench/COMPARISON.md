<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `d888dc5d` · baseline `2e0ba345` · generated 2026-06-28T00:21:43.891Z.

The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | GitHub Actions 1000004897 · Linux · X64 |
| CPU | AMD EPYC 7763 64-Core Processor · 4 logical cores · 0 MHz |
| Runtime | Node v24.17.0 · V8 13.6.233.17-node.49 · pnpm 11.5.1 · Vitest 4.1.8 |
| Memory | 15.61 GB total · 14.12 GB free at capture |
| Method | 3 round(s) · median · same runner A/B |
| Run order | R1:baseline → R1:current → R2:current → R2:baseline → R3:baseline → R3:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 -0.30% | -0.30% | 0 | 1 | 16 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌿 +0.40% | +0.34% | 1 | 1 | 18 | 2 | 22 | 0 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** -0.30%  
**Raw geometric mean:** -0.30%

### 🚀 Fastest reliable improvements

_None outside the reliability threshold._

### 🐢 Largest reliable regressions

1. **warm css: polymorphic atomic identity hit** · -8.09% raw · high confidence

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | Round variation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 🌿 | class name: compact prefix-a-hash | 188,029 | 187,495 | -0.28% | — | 3.00% | high | 0.00533 | 0.05% |
| 🌿 | class name: privacy redaction and truncation | 144,724 | 144,828 | +0.07% | — | 3.00% | high | 0.00690 | 0.28% |
| 🌿 | class name: readable property-value-context-hash | 187,363 | 187,041 | -0.17% | — | 3.00% | high | 0.00535 | 0.01% |
| 🌿 | cold atomic.css: transform parse compile | 2,161 | 2,137 | -1.11% | — | 3.41% | high | 0.46791 | 0.18% |
| 🌿 | cold css: atomic detection + compile | 2,262 | 2,264 | +0.06% | — | 3.14% | high | 0.44178 | 0.21% |
| 🌿 | cold css: configure parse + normalized apply | 11,263 | 11,361 | +0.87% | — | 4.81% | high | 0.08802 | 0.03% |
| 🌿 | cold css: sheet detection + compile | 2,498 | 2,502 | +0.19% | — | 3.00% | high | 0.39962 | 0.22% |
| 🌿 | cold sheet.css: transform parse compile | 2,493 | 2,529 | +1.43% | — | 3.04% | high | 0.39543 | 0.12% |
| 🧭 | baseline: String.raw tiny css | 3,163,102 | 3,254,310 | +2.88% | — | 3.00% | high | 0.00031 | 0.19% |
| 🌿 | warm atomic.css: aliases helpers comments variants | 245,619 | 244,133 | -0.61% | — | 3.00% | high | 0.00410 | 0.45% |
| 🌿 | warm atomic.css: classic atomic compile | 412,175 | 415,073 | +0.70% | — | 3.00% | high | 0.00241 | 0.83% |
| 🌿 | warm atomic.css.withImportant | 244,857 | 244,485 | -0.15% | — | 3.00% | high | 0.00409 | 0.24% |
| 🐢 | warm css: polymorphic atomic identity hit | 1,487,454 | 1,367,081 | -8.09% | — | 3.00% | high | 0.00073 | 0.39% |
| 🌿 | warm css: polymorphic sheet identity hit | 702,607 | 697,679 | -0.70% | — | 3.00% | high | 0.00143 | 0.80% |
| 🌿 | warm css: prepared configure plan hit | 4,683,662 | 4,822,619 | +2.97% | — | 5.12% | medium | 0.00021 | 1.65% |
| 🌿 | warm inline.css: inline style compile | 408,385 | 409,963 | +0.39% | — | 3.00% | high | 0.00244 | 0.66% |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 163,882 | 163,986 | +0.06% | — | 3.00% | high | 0.00610 | 0.01% |
| 🌿 | warm sheet.css.withImportant | 163,767 | 163,266 | -0.31% | — | 3.00% | high | 0.00612 | 0.05% |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

**Normalized geometric mean:** +0.40%  
**Raw geometric mean:** +0.34%

### 🚀 Fastest reliable improvements

1. **shared-registry-resolution :: fabrica.html** · +5.54% normalized · high confidence

### 🐢 Largest reliable regressions

1. **complex-attributes :: fabrica.html** · -3.43% normalized · high confidence

### ⚠️ Noisy cases to rerun

1. **portable-definition-install :: fabrica.html** · 25.00% noise floor
2. **styled-component-registration :: fabrica.html** · 19.70% noise floor

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 22,942 | control |
| complex-attributes | fabrica.html | 5,010 | 21.84% of manual throughput |
| conditional-component | manual.createElement | 7,303 | control |
| conditional-component | fabrica.html | 1,202 | 16.46% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,703,893 | control |
| forked-registry-resolution | fabrica.html | 567,580 | 33.31% of manual throughput |
| instance-named-render | manual.createElement | 80,940 | control |
| instance-named-render | fabrica.html | 5,530 | 6.83% of manual throughput |
| keyed-list-update | manual.createElement | 872 | control |
| keyed-list-update | fabrica.html | 93 | 10.67% of manual throughput |
| named-component-definition | manual.createElement | 3,627,281 | control |
| named-component-definition | fabrica.html | 394,588 | 10.88% of manual throughput |
| named-instance-reuse | manual.createElement | 10,830,433 | control |
| named-instance-reuse | fabrica.html | 265,356 | 2.45% of manual throughput |
| named-styled-registry | manual.createElement | 60,967 | control |
| named-styled-registry | fabrica.html | 5,603 | 9.19% of manual throughput |
| nested-components | manual.createElement | 8,751 | control |
| nested-components | fabrica.html | 725 | 8.29% of manual throughput |
| portable-definition-install | manual.createElement | 6,785,267 | control |
| portable-definition-install | fabrica.html | 105,969 | 1.56% of manual throughput |
| portal-mount | manual.createElement | 50,065 | control |
| portal-mount | fabrica.html | 8,106 | 16.19% of manual throughput |
| raw-html | manual.createElement | 13,844 | control |
| raw-html | fabrica.html | 6,084 | 43.94% of manual throughput |
| reactive-class-style | manual.createElement | 7,100 | control |
| reactive-class-style | fabrica.html | 2,626 | 36.99% of manual throughput |
| reactive-text | manual.createElement | 58,024 | control |
| reactive-text | fabrica.html | 7,314 | 12.61% of manual throughput |
| shared-registry-resolution | manual.createElement | 10,854,555 | control |
| shared-registry-resolution | fabrica.html | 827,844 | 7.63% of manual throughput |
| spread-props-events | manual.createElement | 22,519 | control |
| spread-props-events | fabrica.html | 5,887 | 26.14% of manual throughput |
| static-tree | manual.createElement | 14,334 | control |
| static-tree | fabrica.html | 5,875 | 40.99% of manual throughput |
| styled-artifact-composition | manual.createElement | 154,062 | control |
| styled-artifact-composition | fabrica.html | 73,176 | 47.50% of manual throughput |
| styled-artifact-render | manual.createElement | 154,142 | control |
| styled-artifact-render | fabrica.html | 100,534 | 65.22% of manual throughput |
| styled-component-registration | manual.createElement | 799,512 | control |
| styled-component-registration | fabrica.html | 129,852 | 16.24% of manual throughput |
| two-way-bind | manual.createElement | 46,442 | control |
| two-way-bind | fabrica.html | 8,401 | 18.09% of manual throughput |
| virtual-list-window | manual.createElement | 1,576 | control |
| virtual-list-window | fabrica.html | 548 | 34.79% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | Round variation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 🐢 | complex-attributes :: fabrica.html | 5,176 | 5,010 | -3.20% | -3.43% | 3.00% | high | 0.19960 | 0.56% |
| 🧭 | complex-attributes :: manual.createElement | 22,887 | 22,942 | +0.24% | — | 3.00% | high | 0.04359 | 1.37% |
| 🌿 | conditional-component :: fabrica.html | 1,206 | 1,202 | -0.35% | +0.59% | 3.00% | high | 0.83199 | 0.96% |
| 🧭 | conditional-component :: manual.createElement | 7,372 | 7,303 | -0.93% | — | 3.00% | high | 0.13693 | 2.10% |
| 🌿 | forked-registry-resolution :: fabrica.html | 566,038 | 567,580 | +0.27% | +0.73% | 3.00% | high | 0.00176 | 0.29% |
| 🧭 | forked-registry-resolution :: manual.createElement | 1,711,609 | 1,703,893 | -0.45% | — | 3.00% | high | 0.00059 | 0.40% |
| 🌿 | instance-named-render :: fabrica.html | 5,546 | 5,530 | -0.28% | -2.09% | 3.00% | high | 0.18084 | 0.00% |
| 🧭 | instance-named-render :: manual.createElement | 79,477 | 80,940 | +1.84% | — | 3.00% | high | 0.01235 | 0.66% |
| 🌿 | keyed-list-update :: fabrica.html | 95 | 93 | -1.74% | -2.67% | 11.36% | medium | 10.75256 | 0.84% |
| 🧭 | keyed-list-update :: manual.createElement | 864 | 872 | +0.96% | — | 3.00% | high | 1.14708 | 0.49% |
| 🌿 | named-component-definition :: fabrica.html | 397,529 | 394,588 | -0.74% | -1.08% | 3.00% | high | 0.00253 | 0.61% |
| 🧭 | named-component-definition :: manual.createElement | 3,614,739 | 3,627,281 | +0.35% | — | 3.00% | high | 0.00028 | 0.96% |
| 🌿 | named-instance-reuse :: fabrica.html | 260,955 | 265,356 | +1.69% | +0.72% | 3.00% | high | 0.00377 | 0.27% |
| 🧭 | named-instance-reuse :: manual.createElement | 10,727,225 | 10,830,433 | +0.96% | — | 3.00% | high | 0.00009 | 2.97% |
| 🌿 | named-styled-registry :: fabrica.html | 5,527 | 5,603 | +1.36% | +0.74% | 3.00% | high | 0.17848 | 0.83% |
| 🧭 | named-styled-registry :: manual.createElement | 60,592 | 60,967 | +0.62% | — | 3.00% | high | 0.01640 | 1.69% |
| 🌿 | nested-components :: fabrica.html | 719 | 725 | +0.93% | +0.89% | 13.28% | medium | 1.37864 | 0.64% |
| 🧭 | nested-components :: manual.createElement | 8,748 | 8,751 | +0.04% | — | 3.00% | high | 0.11427 | 0.81% |
| ⚠️ | portable-definition-install :: fabrica.html | 106,910 | 105,969 | -0.88% | +1.28% | 25.00% | low | 0.00944 | 0.42% |
| 🧭 | portable-definition-install :: manual.createElement | 6,932,843 | 6,785,267 | -2.13% | — | 3.52% | high | 0.00015 | 3.52% |
| 🌿 | portal-mount :: fabrica.html | 8,089 | 8,106 | +0.21% | -0.41% | 7.15% | medium | 0.12336 | 0.22% |
| 🧭 | portal-mount :: manual.createElement | 49,757 | 50,065 | +0.62% | — | 3.00% | high | 0.01997 | 1.43% |
| 🌿 | raw-html :: fabrica.html | 5,910 | 6,084 | +2.95% | -0.03% | 3.00% | high | 0.16437 | 2.16% |
| 🧭 | raw-html :: manual.createElement | 13,444 | 13,844 | +2.97% | — | 3.00% | high | 0.07223 | 1.62% |
| 🌿 | reactive-class-style :: fabrica.html | 2,595 | 2,626 | +1.22% | +2.23% | 4.76% | high | 0.38075 | 2.04% |
| 🧭 | reactive-class-style :: manual.createElement | 7,171 | 7,100 | -0.99% | — | 3.00% | high | 0.14084 | 0.30% |
| 🌿 | reactive-text :: fabrica.html | 7,234 | 7,314 | +1.11% | +0.98% | 8.86% | medium | 0.13672 | 1.04% |
| 🧭 | reactive-text :: manual.createElement | 57,953 | 58,024 | +0.12% | — | 3.00% | high | 0.01723 | 0.17% |
| 🚀 | shared-registry-resolution :: fabrica.html | 825,069 | 827,844 | +0.34% | +5.54% | 3.00% | high | 0.00121 | 0.25% |
| 🧭 | shared-registry-resolution :: manual.createElement | 11,417,924 | 10,854,555 | -4.93% | — | 3.00% | high | 0.00009 | 0.41% |
| 🌿 | spread-props-events :: fabrica.html | 5,937 | 5,887 | -0.86% | -1.50% | 7.25% | medium | 0.16988 | 0.60% |
| 🧭 | spread-props-events :: manual.createElement | 22,372 | 22,519 | +0.65% | — | 3.00% | high | 0.04441 | 0.61% |
| 🌿 | static-tree :: fabrica.html | 5,752 | 5,875 | +2.14% | +1.96% | 3.20% | high | 0.17022 | 2.46% |
| 🧭 | static-tree :: manual.createElement | 14,309 | 14,334 | +0.18% | — | 3.00% | high | 0.06976 | 2.73% |
| 🌿 | styled-artifact-composition :: fabrica.html | 73,679 | 73,176 | -0.68% | +0.21% | 3.00% | high | 0.01367 | 0.20% |
| 🧭 | styled-artifact-composition :: manual.createElement | 155,442 | 154,062 | -0.89% | — | 3.00% | high | 0.00649 | 1.27% |
| 🌿 | styled-artifact-render :: fabrica.html | 99,351 | 100,534 | +1.19% | +1.33% | 3.00% | high | 0.00995 | 1.20% |
| 🧭 | styled-artifact-render :: manual.createElement | 154,359 | 154,142 | -0.14% | — | 3.00% | high | 0.00649 | 0.77% |
| ⚠️ | styled-component-registration :: fabrica.html | 130,692 | 129,852 | -0.64% | -1.47% | 19.70% | low | 0.00770 | 0.16% |
| 🧭 | styled-component-registration :: manual.createElement | 792,886 | 799,512 | +0.84% | — | 3.00% | high | 0.00125 | 0.61% |
| 🌿 | two-way-bind :: fabrica.html | 8,350 | 8,401 | +0.62% | +1.69% | 6.10% | high | 0.11903 | 0.02% |
| 🧭 | two-way-bind :: manual.createElement | 46,939 | 46,442 | -1.06% | — | 3.00% | high | 0.02153 | 1.12% |
| 🌿 | virtual-list-window :: fabrica.html | 543 | 548 | +0.90% | +1.90% | 22.07% | medium | 1.82408 | 1.30% |
| 🧭 | virtual-list-window :: manual.createElement | 1,591 | 1,576 | -0.98% | — | 14.24% | medium | 0.63467 | 1.34% |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
