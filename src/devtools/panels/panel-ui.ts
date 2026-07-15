import { asNode, event, html,  styled } from "../core/runtime";
import { renderPanelShell, panelHeaderTemplate, panelActionTemplate, attrs } from "./shared.functions";
export { renderPanelShell } from "./shared.functions";


export interface PanelAction {
  readonly label: string;
  readonly action: string;
  readonly title?: string;
  readonly className?: string;
  readonly attrs?: Record<string, string | number | boolean | null | undefined>;
}

export interface PanelShellOptions {
  readonly className?: string;
  readonly title?: string;
  readonly bodyAttr?: string;
  readonly bodyClassName?: string;
  readonly scroll?: boolean;
  readonly actions?: readonly PanelAction[];
  readonly onAction?: (event: Event, action: string) => void;
}

export interface PanelShellRefs {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
}

const PanelShell = styled.section("RodPanelShell").css`
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
`;

const PanelHeader = styled.header("RodPanelHeader").css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 9px 10px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font: inherit;
  font-weight: 600;
`;

const PanelTitle = styled.span("RodPanelTitle").css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PanelActions = styled.div("RodPanelActions").css`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
`;

const PanelTextButton = styled.button("RodPanelTextButton").css`
  appearance: none;
  padding: 4px 8px;
  border: 1px solid $border;
  border-radius: $sm;
  color: $primary;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;

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

const PanelBody = styled.div("RodPanelBody").css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;

  &[data-scroll="true"] {
    overflow: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
`;
