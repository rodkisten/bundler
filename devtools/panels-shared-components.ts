import type { CipoCssArtifact } from "@rodkisten/cipo";
import { filterArray, flatMap } from "@rodkisten/nascente";
import { styled } from "@rodkisten/devtools/core/runtime";

/* ******************** */
/* Shared panel layout  */
/* ******************** */

export const SharedPanelLayout = styled.div("RodSharedPanelLayout").css`
  relative
  w-full
  h-full
  minw-0
  minh-0
  overflow-hidden
`;

export const SharedPanelRoot = styled.section("RodSharedPanelRoot").css`
  relative
  w-full
  h-full
  minw-0
  minh-0
  overflow-hidden
  bg: $background
`;

export const SharedControlBar = styled.div("RodSharedControlBar").css`
  position: absolute;
  inset: 0 0 auto 0;
  z-index: var(--rd-z-toolbar, 2147483530);
  display: flex;
  align-items: center;
  gap: 5px;
  height: $$controlHeight;
  padding: 7px 8px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
`;

export const SharedControlSpacer = styled.div("RodSharedControlSpacer").css`
  flex: 1 1 auto;
  min-width: 4px;
`;

export const SharedHeader = styled.header("RodSharedHeader").css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 9px 10px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font-weight: 600;
`;

export const SharedActions = styled.div("RodSharedActions").css`
  display: flex;
  gap: 4px;
`;

/* ******************** */
/* Shared interactions  */
/* ******************** */

export const SharedButton = styled.button("RodSharedButton").css`
  @with($control-reset)
  interactive-surface

  min-width: 28px
  min-height: 28px
  p: 4px 8px
  rounded: $control
  color: $primary
  bg: transparent
  font: inherit
  text(12px)
  transition: color .18s, background .18s, transform .1s

  x:hover {
    color: $selectedForeground
    bg: $highlight
  }

  x:focus-visible {
    color: $selectedForeground
    bg: $highlight
  }

  x:active {
    transform: scale(.96)
    color: $accent
  }
`;

/* ******************** */
/* Shared content       */
/* ******************** */

export const SharedPanelBody = styled.div("RodSharedPanelBody").css`
  absolute
  inset: 38px 0 0
  minw-0
  minh-0
  overflow-auto
  padding-bottom: var(--rd-safe-bottom)
  overscroll-behavior: contain
  touch-action: pan-y pan-x
  -webkit-overflow-scrolling: touch
`;

export const SharedScrollableBody = styled.div("RodSharedScrollableBody").css`
  w-full
  h-full
  minw-0
  minh-0
  padding-bottom: var(--rd-safe-bottom)
  overflow-auto
  overscroll-behavior: contain
  touch-action: pan-y pan-x
  -webkit-overflow-scrolling: touch
`;

export const SharedDetailTitle = styled.div("RodSharedDetailTitle").css`
  flex: 1 1 auto
  minw-0
  color: $primary
  text(12px, ellipsis)
`;

export const SharedEmptyState = styled.div("RodSharedEmptyState").css`
  display: grid;
  min-height: 180px;
  place-content: center;
  padding: 24px;
  color: $foreground;
  text-align: center;
`;

export const SharedCard = styled.article("RodSharedCard").css`
  margin: 10px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $section;
  background: $background;
`;

export const SharedSection = styled.section("RodSharedSection").css`
  margin: 10px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $md;
  background: $background;
`;

export const SharedTableWrap = styled.div("RodSharedTableWrap").css`
  w-full
  overflow-auto
  touch-scroll
`;

export const SharedPreBlock = styled.pre("RodSharedPreBlock").css`
  m: 0
  p: 10px
  overflow-auto
  color: $foreground
  text(12px / 1.5)
  font-family: $font.mono
  white-space: pre-wrap
  word-break: break-word
  user-select: text
`;

/* ******************** */
/* Style artifacts      */
/* ******************** */


const SHARED_STYLED_COMPONENTS = Object.freeze([
  SharedPanelLayout,
  SharedPanelRoot,
  SharedControlBar,
  SharedControlSpacer,
  SharedHeader,
  SharedActions,
  SharedButton,
  SharedPanelBody,
  SharedScrollableBody,
  SharedDetailTitle,
  SharedEmptyState,
  SharedCard,
  SharedSection,
  SharedTableWrap,
  SharedPreBlock,
]);

/** Static Cipó artifacts emitted by shared panel primitives. */
export const sharedStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  filterArray(
    flatMap(SHARED_STYLED_COMPONENTS, (styledComponent) => styledComponent.artifacts),
    (artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css",
  ),
);
