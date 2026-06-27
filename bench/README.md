<!-- rod-benchmark-report -->
# ⚡ Performance Observatory

> Current `unknown` · baseline `unknown` · generated 2026-06-27T20:42:24.018Z.

This is a local or first-run baseline snapshot. It records the complete runner fingerprint and per-case measurements; the CI workflow will replace it with an alternating same-runner A/B comparison. 🧪

## 🖥️ Runner fingerprint

| Field | Value |
| --- | --- |
| Runner | local · linux · x64 |
| CPU | unknown · 56 logical cores · 0 MHz |
| Runtime | Node v22.16.0 · V8 12.4.254.21-node.26 · pnpm unknown · Vitest 4.1.8 |
| Memory | 4.00 GB total · 3.09 GB free at capture |
| Method | 1 round(s) · median · single revision |
| Run order | R1:current |

## 🌳 Forest overview

| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 🌿 **Cipó CSS runtime** | 🌿 +0.00% | +0.00% | 2 | 2 | 13 | 0 | 1 | 0 | 0 |
| 🏭 **Fabrica DOM runtime** | 🌱 baseline | — | 0 | 0 | 0 | 0 | 0 | 44 | 0 |

## 🌿 Cipó CSS runtime

Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.

**Normalized geometric mean:** +0.00%  
**Raw geometric mean:** +0.00%

### 🚀 Fastest reliable improvements

1. **cold atomic.css: transform parse compile** · +7.42% raw · low confidence
2. **cold css: atomic detection + compile** · +3.91% raw · low confidence

### 🐢 Largest reliable regressions

1. **class name: compact prefix-a-hash** · -3.53% raw · low confidence
2. **warm css: polymorphic atomic identity hit** · -3.02% raw · low confidence

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | Round variation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 🐢 | class name: compact prefix-a-hash | 237,249 | 228,875 | -3.53% | — | 3.00% | low | 0.00437 | 0.00% |
| 🌿 | class name: privacy redaction and truncation | 179,742 | 179,590 | -0.08% | — | 3.00% | low | 0.00557 | 0.00% |
| 🌿 | class name: readable property-value-context-hash | 235,844 | 235,201 | -0.27% | — | 3.00% | low | 0.00425 | 0.00% |
| 🚀 | cold atomic.css: transform parse compile | 2,360 | 2,535 | +7.42% | — | 3.63% | low | 0.39451 | 0.00% |
| 🚀 | cold css: atomic detection + compile | 2,302 | 2,392 | +3.91% | — | 3.76% | low | 0.41810 | 0.00% |
| 🌿 | cold css: configure parse + normalized apply | 14,998 | 15,481 | +3.22% | — | 4.56% | low | 0.06460 | 0.00% |
| 🌿 | cold css: sheet detection + compile | 2,502 | 2,548 | +1.85% | — | 4.10% | low | 0.39248 | 0.00% |
| 🌿 | cold sheet.css: transform parse compile | 2,721 | 2,657 | -2.36% | — | 3.57% | low | 0.37639 | 0.00% |
| 🧭 | baseline: String.raw tiny css | 3,894,247 | 3,864,328 | -0.77% | — | 3.00% | low | 0.00026 | 0.00% |
| 🌿 | warm atomic.css: aliases helpers comments variants | 268,873 | 267,395 | -0.55% | — | 4.81% | low | 0.00374 | 0.00% |
| 🌿 | warm atomic.css: classic atomic compile | 475,153 | 470,625 | -0.95% | — | 3.00% | low | 0.00212 | 0.00% |
| 🌿 | warm atomic.css.withImportant | 271,065 | 271,185 | +0.04% | — | 3.00% | low | 0.00369 | 0.00% |
| 🐢 | warm css: polymorphic atomic identity hit | 1,795,551 | 1,741,373 | -3.02% | — | 3.00% | low | 0.00057 | 0.00% |
| 🌿 | warm css: polymorphic sheet identity hit | 825,968 | 825,884 | -0.01% | — | 3.00% | low | 0.00121 | 0.00% |
| 🌿 | warm css: prepared configure plan hit | 5,120,026 | 5,241,034 | +2.36% | — | 3.00% | low | 0.00019 | 0.00% |
| 🌿 | warm inline.css: inline style compile | 464,583 | 453,695 | -2.34% | — | 3.00% | low | 0.00220 | 0.00% |
| 🌿 | warm sheet.css: nested sheet runtime DSL | 182,322 | 175,815 | -3.57% | — | 5.11% | low | 0.00569 | 0.00% |
| 🌿 | warm sheet.css.withImportant | 178,098 | 175,688 | -1.35% | — | 3.00% | low | 0.00569 | 0.00% |

</details>

## 🏭 Fabrica DOM runtime

Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.

> 🌱 **Baseline created.** 44 benchmark cases are ready for the next same-runner comparison.

### 🥊 Current paired controls

| Case | Adapter | Ops/s | Efficiency versus manual |
| --- | --- | ---: | ---: |
| complex-attributes | manual.createElement | 33,366 | control |
| complex-attributes | fabrica.html | 5,700 | 17.08% of manual throughput |
| conditional-component | manual.createElement | 7,197 | control |
| conditional-component | fabrica.html | 1,215 | 16.89% of manual throughput |
| forked-registry-resolution | manual.createElement | 1,686,250 | control |
| forked-registry-resolution | fabrica.html | 724,208 | 42.95% of manual throughput |
| instance-named-render | manual.createElement | 90,534 | control |
| instance-named-render | fabrica.html | 7,071 | 7.81% of manual throughput |
| keyed-list-update | manual.createElement | 706 | control |
| keyed-list-update | fabrica.html | 89 | 12.58% of manual throughput |
| named-component-definition | manual.createElement | 2,091,847 | control |
| named-component-definition | fabrica.html | 419,853 | 20.07% of manual throughput |
| named-instance-reuse | manual.createElement | 2,584,497 | control |
| named-instance-reuse | fabrica.html | 273,726 | 10.59% of manual throughput |
| named-styled-registry | manual.createElement | 73,650 | control |
| named-styled-registry | fabrica.html | 7,417 | 10.07% of manual throughput |
| nested-components | manual.createElement | 9,873 | control |
| nested-components | fabrica.html | 658 | 6.67% of manual throughput |
| portable-definition-install | manual.createElement | 6,197,292 | control |
| portable-definition-install | fabrica.html | 129,856 | 2.10% of manual throughput |
| portal-mount | manual.createElement | 51,963 | control |
| portal-mount | fabrica.html | 8,326 | 16.02% of manual throughput |
| raw-html | manual.createElement | 13,844 | control |
| raw-html | fabrica.html | 6,797 | 49.10% of manual throughput |
| reactive-class-style | manual.createElement | 7,656 | control |
| reactive-class-style | fabrica.html | 2,919 | 38.13% of manual throughput |
| reactive-text | manual.createElement | 56,582 | control |
| reactive-text | fabrica.html | 8,034 | 14.20% of manual throughput |
| shared-registry-resolution | manual.createElement | 2,696,341 | control |
| shared-registry-resolution | fabrica.html | 1,058,312 | 39.25% of manual throughput |
| spread-props-events | manual.createElement | 29,616 | control |
| spread-props-events | fabrica.html | 6,278 | 21.20% of manual throughput |
| static-tree | manual.createElement | 21,422 | control |
| static-tree | fabrica.html | 7,844 | 36.62% of manual throughput |
| styled-artifact-composition | manual.createElement | 163,320 | control |
| styled-artifact-composition | fabrica.html | 80,566 | 49.33% of manual throughput |
| styled-artifact-render | manual.createElement | 172,266 | control |
| styled-artifact-render | fabrica.html | 118,555 | 68.82% of manual throughput |
| styled-component-registration | manual.createElement | 909,974 | control |
| styled-component-registration | fabrica.html | 125,843 | 13.83% of manual throughput |
| two-way-bind | manual.createElement | 58,820 | control |
| two-way-bind | fabrica.html | 10,590 | 18.00% of manual throughput |
| virtual-list-window | manual.createElement | 2,490 | control |
| virtual-list-window | fabrica.html | 509 | 20.43% of manual throughput |

<details>
<summary><strong>📊 All benchmark deltas</strong></summary>

| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | Round variation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 🆕 | complex-attributes :: fabrica.html | — | 5,700 | baseline | — | — | — | 0.17544 | 0.00% |
| 🆕 | complex-attributes :: manual.createElement | — | 33,366 | baseline | — | — | — | 0.02997 | 0.00% |
| 🆕 | conditional-component :: fabrica.html | — | 1,215 | baseline | — | — | — | 0.82286 | 0.00% |
| 🆕 | conditional-component :: manual.createElement | — | 7,197 | baseline | — | — | — | 0.13896 | 0.00% |
| 🆕 | forked-registry-resolution :: fabrica.html | — | 724,208 | baseline | — | — | — | 0.00138 | 0.00% |
| 🆕 | forked-registry-resolution :: manual.createElement | — | 1,686,250 | baseline | — | — | — | 0.00059 | 0.00% |
| 🆕 | instance-named-render :: fabrica.html | — | 7,071 | baseline | — | — | — | 0.14143 | 0.00% |
| 🆕 | instance-named-render :: manual.createElement | — | 90,534 | baseline | — | — | — | 0.01105 | 0.00% |
| 🆕 | keyed-list-update :: fabrica.html | — | 89 | baseline | — | — | — | 11.25391 | 0.00% |
| 🆕 | keyed-list-update :: manual.createElement | — | 706 | baseline | — | — | — | 1.41598 | 0.00% |
| 🆕 | named-component-definition :: fabrica.html | — | 419,853 | baseline | — | — | — | 0.00238 | 0.00% |
| 🆕 | named-component-definition :: manual.createElement | — | 2,091,847 | baseline | — | — | — | 0.00048 | 0.00% |
| 🆕 | named-instance-reuse :: fabrica.html | — | 273,726 | baseline | — | — | — | 0.00365 | 0.00% |
| 🆕 | named-instance-reuse :: manual.createElement | — | 2,584,497 | baseline | — | — | — | 0.00039 | 0.00% |
| 🆕 | named-styled-registry :: fabrica.html | — | 7,417 | baseline | — | — | — | 0.13482 | 0.00% |
| 🆕 | named-styled-registry :: manual.createElement | — | 73,650 | baseline | — | — | — | 0.01358 | 0.00% |
| 🆕 | nested-components :: fabrica.html | — | 658 | baseline | — | — | — | 1.51898 | 0.00% |
| 🆕 | nested-components :: manual.createElement | — | 9,873 | baseline | — | — | — | 0.10129 | 0.00% |
| 🆕 | portable-definition-install :: fabrica.html | — | 129,856 | baseline | — | — | — | 0.00770 | 0.00% |
| 🆕 | portable-definition-install :: manual.createElement | — | 6,197,292 | baseline | — | — | — | 0.00016 | 0.00% |
| 🆕 | portal-mount :: fabrica.html | — | 8,326 | baseline | — | — | — | 0.12010 | 0.00% |
| 🆕 | portal-mount :: manual.createElement | — | 51,963 | baseline | — | — | — | 0.01924 | 0.00% |
| 🆕 | raw-html :: fabrica.html | — | 6,797 | baseline | — | — | — | 0.14713 | 0.00% |
| 🆕 | raw-html :: manual.createElement | — | 13,844 | baseline | — | — | — | 0.07223 | 0.00% |
| 🆕 | reactive-class-style :: fabrica.html | — | 2,919 | baseline | — | — | — | 0.34257 | 0.00% |
| 🆕 | reactive-class-style :: manual.createElement | — | 7,656 | baseline | — | — | — | 0.13062 | 0.00% |
| 🆕 | reactive-text :: fabrica.html | — | 8,034 | baseline | — | — | — | 0.12447 | 0.00% |
| 🆕 | reactive-text :: manual.createElement | — | 56,582 | baseline | — | — | — | 0.01767 | 0.00% |
| 🆕 | shared-registry-resolution :: fabrica.html | — | 1,058,312 | baseline | — | — | — | 0.00094 | 0.00% |
| 🆕 | shared-registry-resolution :: manual.createElement | — | 2,696,341 | baseline | — | — | — | 0.00037 | 0.00% |
| 🆕 | spread-props-events :: fabrica.html | — | 6,278 | baseline | — | — | — | 0.15928 | 0.00% |
| 🆕 | spread-props-events :: manual.createElement | — | 29,616 | baseline | — | — | — | 0.03377 | 0.00% |
| 🆕 | static-tree :: fabrica.html | — | 7,844 | baseline | — | — | — | 0.12748 | 0.00% |
| 🆕 | static-tree :: manual.createElement | — | 21,422 | baseline | — | — | — | 0.04668 | 0.00% |
| 🆕 | styled-artifact-composition :: fabrica.html | — | 80,566 | baseline | — | — | — | 0.01241 | 0.00% |
| 🆕 | styled-artifact-composition :: manual.createElement | — | 163,320 | baseline | — | — | — | 0.00612 | 0.00% |
| 🆕 | styled-artifact-render :: fabrica.html | — | 118,555 | baseline | — | — | — | 0.00843 | 0.00% |
| 🆕 | styled-artifact-render :: manual.createElement | — | 172,266 | baseline | — | — | — | 0.00580 | 0.00% |
| 🆕 | styled-component-registration :: fabrica.html | — | 125,843 | baseline | — | — | — | 0.00795 | 0.00% |
| 🆕 | styled-component-registration :: manual.createElement | — | 909,974 | baseline | — | — | — | 0.00110 | 0.00% |
| 🆕 | two-way-bind :: fabrica.html | — | 10,590 | baseline | — | — | — | 0.09443 | 0.00% |
| 🆕 | two-way-bind :: manual.createElement | — | 58,820 | baseline | — | — | — | 0.01700 | 0.00% |
| 🆕 | virtual-list-window :: fabrica.html | — | 509 | baseline | — | — | — | 1.96561 | 0.00% |
| 🆕 | virtual-list-window :: manual.createElement | — | 2,490 | baseline | — | — | — | 0.40166 | 0.00% |

</details>

## 🧭 Reading the numbers

- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.
- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.
- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.
- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.
- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.
- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.
