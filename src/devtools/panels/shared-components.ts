import type { CipoCssArtifact } from "../../cipo";
import { styled } from "../components/runtime";

/* ******************** */
/* Shared panel layout  */
/* ******************** */

export const SharedPanelLayout = styled.div("RodSharedPanelLayout").css`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

export const SharedPanelRoot = styled.section("RodSharedPanelRoot").css`
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: $background;
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
  appearance: none;
  min-width: 28px;
  min-height: 28px;
  padding: 4px 8px;
  border: 0;
  border-radius: $control;
  color: $primary;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color .18s, background .18s, transform .1s;

  &:hover,
  &:focus-visible {
    color: $selectedForeground;
    background: $highlight;
  }

  &:active {
    transform: scale(.96);
    color: $accent;
  }
`;

/* ******************** */
/* Shared content       */
/* ******************** */

export const SharedPanelBody = styled.div("RodSharedPanelBody").css`
  width: 100%;
  height: calc(100% - 38px);
  overflow: auto;
  padding-bottom: var(--rd-safe-bottom);
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

export const SharedScrollableBody = styled.div("RodSharedScrollableBody").css`
  height: 100%;
  padding-bottom: var(--rd-safe-bottom);
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

export const SharedDetailTitle = styled.div("RodSharedDetailTitle").css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: $primary;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  width: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

export const SharedPreBlock = styled.pre("RodSharedPreBlock").css`
  margin: 0;
  padding: 10px;
  overflow: auto;
  color: $foreground;
  font: 12px / 1.5 $font.mono;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
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

export const sharedStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  SHARED_STYLED_COMPONENTS.flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);
