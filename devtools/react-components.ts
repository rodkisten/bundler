import type { CipoCssArtifact } from "@rodkisten/cipo";
import { createRequiredFabricaContext } from "@rodkisten/fabrica";
import type { ReactDetailTab, ReactPanelContextValue } from "@rodkisten/devtools/panels/react";
import { component, event, html, repeat, styled, when } from "@rodkisten/devtools/core/runtime";
import { icon } from "@rodkisten/devtools/utils";
import "@rodkisten/devtools/panels/shared-components";
import { filterArray, flatMap } from "@rodkisten/nascente";

export const ReactPanelContext = createRequiredFabricaContext<ReactPanelContextValue>("ReactPanelContext");

const ReactLayout = styled.section("RodReactLayout").css`
  relative
  w-full
  h-full
  minw-0
  minh-0
  overflow-hidden
  bg: $background
  color: $foreground
  touch-action: auto
`;

const ReactToolbar = styled.header("RodReactToolbar").css`
  position: absolute;
  inset: 0 0 auto 0;
  z-index: var(--rd-z-toolbar, 2147483530);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: 36px 30px;
  gap: 4px 6px;
  min-width: 0;
  min-height: 70px;
  padding: 6px 7px 5px;
  border-bottom: 1px solid $border;
  background: $backgroundDark;

  x:md {
    grid-template-columns: minmax(180px, 1fr) auto auto;
    grid-template-rows: 34px;
    align-items: center;
    min-height: 46px;
    padding: 6px 8px;
  }
`;

const ReactSearch = styled.input("RodReactSearch").css`
  min-width: 0;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid $border;
  border-radius: $control;
  color: $primary;
  background: $background;
  outline: none;

  /* 16px prevents Safari/iOS from zooming the page when this receives focus. */
  font-size: 16px !important;
  line-height: 1;
  transform: none !important;
  scale: 1 !important;

  x:focus {
    border-color: $accent
  }

  &::placeholder {
    color: $comment;
  }
`;

const ReactActionGroup = styled.div("RodReactActionGroup").css`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  min-width: 0;
`;

const ReactActionButton = styled.button("RodReactActionButton").css`
  @with($control-reset)
  interactive-surface

  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  min-width: 34px;
  min-height: 34px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: $control;
  color: $primary;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  touch-action: manipulation;

  svg {
    width: 18px;
    height: 18px;
  }

  x:hover {
    bg: $highlight
    color: $selectedForeground
  }

  x:active {
    transform: scale(.96)
    color: $accent
  }

  state(active=true) {
    color: $accent
    bg: $highlight
    border-color: mix($accent, transparent, 28%)
  }
`;

const ReactStats = styled.div("RodReactStats").css`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;

  &::-webkit-scrollbar { display: none; }

  x:md {
    grid-column: auto;
    justify-content: flex-end;
  }
`;

const ReactStat = styled.span("RodReactStat").css`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 7px;
  border: 1px solid $border;
  border-radius: $pill;
  color: $comment;
  background: $background;
  text(10px / 1, tabular)

  strong {
    color: $primary;
    font-weight: 700;
  }
`;

const ReactWorkspace = styled.div("RodReactWorkspace").css`
  position: absolute;
  inset: 72px 0 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  touch-action: auto;

  x:md {
    inset: 47px 0 0;
    display: grid;
    grid-template-columns: minmax(280px, 42%) minmax(0, 1fr);
  }
`;

const ReactTreePane = styled.section("RodReactTreePane").css`
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: 34px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: $background;
  touch-action: auto;

  x:md {
    position: relative;
    border-right: 1px solid $border;
  }
`;

const ReactTreeTools = styled.div("RodReactTreeTools").css`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  height: 34px;
  padding: 3px 6px;
  border-bottom: 1px solid $border;
  background: $backgroundDark;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { display: none; }
`;

const ReactMiniButton = styled.button("RodReactMiniButton").css`
  @with($control-reset)
  interactive-surface

  flex: 0 0 auto;
  min-height: 27px;
  padding: 0 8px;
  border-radius: $control;
  color: $primary;
  background: transparent;
  font: inherit;
  text(11px / 1 / 600)
  touch-action: manipulation;

  x:hover { bg: $highlight }
  x:active { color: $accent; transform: scale(.97); }
  state(active=true) { color: $accent; bg: $highlight }
`;

const ReactTreeScroller = styled.div("RodReactTreeScroller").css`
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 4px 0 calc(84px + var(--rd-safe-bottom));
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: auto;
  overflow-anchor: none;
`;

const ReactTreeRow = styled.div("RodReactTreeRow").css`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  min-width: 100%;
  min-height: 31px;
  padding: 2px 7px 2px calc(5px + var(--rd-react-depth, 0) * 13px);
  border-bottom: 1px solid mix($border, transparent, 45%);
  color: $foreground;
  cursor: default;
  touch-action: manipulation;
  content-visibility: auto;
  contain-intrinsic-size: auto 31px;
  contain: layout style paint;

  x:hover { bg: $highlight }

  state(selected=true) {
    color: $selectedForeground;
    bg: $contrast;
  }

  state(changed=true) {
    box-shadow: inset 2px 0 0 $accent;
  }
`;

const ReactToggle = styled.button("RodReactToggle").css`
  @with($control-reset)
  interactive-surface

  display: grid;
  place-items: center;
  width: 24px;
  height: 27px;
  color: $comment;
  background: transparent;
  border-radius: $sm;
  font: inherit;
  font-size: 13px;
  touch-action: manipulation;

  x:active { color: $accent; bg: $highlight }
`;

const ReactRowMain = styled.div("RodReactRowMain").css`
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 5px;
  overflow: hidden;
`;

const ReactComponentName = styled.span("RodReactComponentName").css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: $primary;
  text(12px / 1.25 / 600)
  font-family: $font.mono
`;

const ReactKey = styled.span("RodReactKey").css`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: $string;
  text(10px / 1.2)
  font-family: $font.mono
`;

const ReactKind = styled.span("RodReactKind").css`
  justify-self: end;
  max-width: 82px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: $comment;
  text(9px / 1.2 / 600)
`;

const ReactEmpty = styled.div("RodReactEmpty").css`
  display: grid;
  min-height: 100%;
  place-content: center;
  gap: 9px;
  padding: 24px 20px calc(80px + var(--rd-safe-bottom));
  color: $foreground;
  text-align: center;

  strong {
    color: $primary;
    text(15px / 1.25 / 700)
  }

  p {
    max-width: 390px;
    margin: 0 auto;
    color: $comment;
    text(12px / 1.5)
  }
`;

const ReactStrategyList = styled.div("RodReactStrategyList").css`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  max-width: 440px;
  margin: 2px auto 0;
`;

const ReactStrategy = styled.span("RodReactStrategy").css`
  display: inline-flex;
  padding: 3px 7px;
  border: 1px solid $border;
  border-radius: $pill;
  color: $comment;
  background: $backgroundDark;
  text(9px / 1.2)
`;

const ReactDetailPane = styled.section("RodReactDetailPane").css`
  position: absolute;
  inset: 0;
  z-index: var(--rd-z-dropdown, 2147483550);
  display: none;
  grid-template-rows: auto auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: $background;
  touch-action: auto;

  state(active=true) { display: grid; }

  x:md {
    position: relative;
    display: grid;
    z-index: auto;
  }
`;

const ReactDetailHeader = styled.header("RodReactDetailHeader").css`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 5px 7px;
  border-bottom: 1px solid $border;
  background: $backgroundDark;
`;

const ReactBackButton = styled.button("RodReactBackButton").css`
  @with($control-reset)
  interactive-surface

  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: $control;
  color: $primary;
  background: transparent;
  touch-action: manipulation;

  x:active { bg: $highlight; color: $accent; }

  x:md { display: none; }
`;

const ReactDetailIdentity = styled.div("RodReactDetailIdentity").css`
  min-width: 0;
  overflow: hidden;
`;

const ReactDetailName = styled.div("RodReactDetailName").css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: $primary;
  text(12px / 1.3 / 700)
  font-family: $font.mono
`;

const ReactDetailMeta = styled.div("RodReactDetailMeta").css`
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: $comment;
  text(9px / 1.25)
`;

const ReactDetailActions = styled.div("RodReactDetailActions").css`
  display: flex;
  align-items: center;
  gap: 2px;
`;

const ReactDetailIcon = styled.button("RodReactDetailIcon").css`
  @with($control-reset)
  interactive-surface

  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: $control;
  color: $primary;
  background: transparent;
  touch-action: manipulation;

  svg { width: 16px; height: 16px; }
  x:active { bg: $highlight; color: $accent; transform: scale(.95); }
`;

const ReactTabs = styled.nav("RodReactTabs").css`
  display: flex;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid $border;
  background: $backgroundDark;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;

  &::-webkit-scrollbar { display: none; }
`;

const ReactTab = styled.button("RodReactTab").css`
  @with($control-reset)
  interactive-surface

  flex: 1 0 auto;
  min-width: 66px;
  min-height: 36px;
  padding: 7px 9px;
  border-bottom: 2px solid transparent;
  color: $comment;
  background: transparent;
  font: inherit;
  text(11px / 1.1 / 600)
  touch-action: manipulation;

  state(active=true) {
    color: $accent;
    border-bottom-color: $accent;
  }
`;

const ReactDetailScroller = styled.div("RodReactDetailScroller").css`
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 8px 8px calc(88px + var(--rd-safe-bottom));
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: auto;
`;

const ReactValueCard = styled.section("RodReactValueCard").css`
  margin: 0 0 8px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $md;
  background: $background;
`;

const ReactValueHeader = styled.div("RodReactValueHeader").css`
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 31px;
  padding: 5px 8px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  text(10px / 1.2 / 700)
`;

const ReactValueBody = styled.div("RodReactValueBody").css`
  min-width: 0;
  padding: 8px;
  overflow: auto;
  color: $foreground;
  font-size: 11px;
  line-height: 1.45;
  font-family: $font.mono;
  user-select: text;
  -webkit-user-select: text;
  touch-action: auto;

  .roderuda-object,
  .roderuda-object-body,
  .roderuda-object-row,
  .roderuda-value {
    user-select: text;
    -webkit-user-select: text;
  }
`;

const ReactPath = styled.div("RodReactPath").css`
  margin: 0 0 8px;
  padding: 7px 8px;
  border: 1px solid $border;
  border-radius: $control;
  color: $comment;
  background: $backgroundDark;
  text(9px / 1.4)
  font-family: $font.mono
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
`;

const ReactDiagnostic = styled.div("RodReactDiagnostic").css`
  margin-top: 8px;
  color: $comment;
  text(10px / 1.45)
`;

const REACT_STYLED_COMPONENTS = Object.freeze([
  ReactLayout,
  ReactToolbar,
  ReactSearch,
  ReactActionGroup,
  ReactActionButton,
  ReactStats,
  ReactStat,
  ReactWorkspace,
  ReactTreePane,
  ReactTreeTools,
  ReactMiniButton,
  ReactTreeScroller,
  ReactTreeRow,
  ReactToggle,
  ReactRowMain,
  ReactComponentName,
  ReactKey,
  ReactKind,
  ReactEmpty,
  ReactStrategyList,
  ReactStrategy,
  ReactDetailPane,
  ReactDetailHeader,
  ReactBackButton,
  ReactDetailIdentity,
  ReactDetailName,
  ReactDetailMeta,
  ReactDetailActions,
  ReactDetailIcon,
  ReactTabs,
  ReactTab,
  ReactDetailScroller,
  ReactValueCard,
  ReactValueHeader,
  ReactValueBody,
  ReactPath,
  ReactDiagnostic,
]);

export const reactStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  filterArray(
    flatMap(REACT_STYLED_COMPONENTS, (styledComponent) => styledComponent.artifacts),
    (artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css",
  ),
);

const DETAIL_TABS: readonly { id: ReactDetailTab; label: string }[] = Object.freeze([
  { id: "props", label: "Props" },
  { id: "state", label: "State" },
  { id: "hooks", label: "Hooks" },
  { id: "context", label: "Context" },
  { id: "fiber", label: "Fiber" },
]);

component("RodReactPanelView", function RodReactPanelView(_props, ctx) {
  const react = ctx.useRequiredContext(ReactPanelContext);

  return html`
    <RodReactLayout :reactLayout>
      <RodReactToolbar>
        <RodReactSearch
          :reactSearch
          type="search"
          inputmode="search"
          enterkeyhint="search"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Componente, key, prop, state…"
          aria-label="Buscar React Fibers"
          .value=${react.filterValue}
          @input=${event.input((input) => react.setFilterFromEvent(input))}
        />

        <RodReactActionGroup>
          <RodReactActionButton type="button" title="Selecionar elemento da página" :active=${react.picking} @click=${event.click((click) => { click.preventDefault(); react.action("picker"); })}>${icon("inspect")}</RodReactActionButton>
          <RodReactActionButton type="button" title="Executar todos os fallbacks" @click=${event.click((click) => { click.preventDefault(); react.action("scan"); })}>${icon("refresh")}</RodReactActionButton>
        </RodReactActionGroup>

        <RodReactStats>
          ${() => {
            const stats = react.stats();
            return html`
              <RodReactStat><strong>${stats.renderers}</strong> renderers</RodReactStat>
              <RodReactStat><strong>${stats.roots}</strong> roots</RodReactStat>
              <RodReactStat><strong>${stats.visible}</strong>/${stats.fibers} fibers</RodReactStat>
              ${stats.scanDuration == null ? null : html`<RodReactStat><strong>${stats.scanDuration}</strong> ms</RodReactStat>`}
            `;
          }}
        </RodReactStats>
      </RodReactToolbar>

      <RodReactWorkspace>
        <RodReactTreePane>
          <RodReactTreeTools>
            <RodReactMiniButton type="button" @click=${event.click((click) => { click.preventDefault(); react.action("expand-all"); })}>Expand</RodReactMiniButton>
            <RodReactMiniButton type="button" @click=${event.click((click) => { click.preventDefault(); react.action("collapse-all"); })}>Collapse</RodReactMiniButton>
            <RodReactMiniButton type="button" @click=${event.click((click) => { click.preventDefault(); react.action("toggle-host"); })}>DOM Fibers</RodReactMiniButton>
            <RodReactMiniButton type="button" @click=${event.click((click) => { click.preventDefault(); react.action("copy-diagnostics"); })}>Diagnostics</RodReactMiniButton>
          </RodReactTreeTools>

          <RodReactTreeScroller :reactTree>
            ${when(
              () => react.rows().length > 0,
              () => repeat(
                react.rows,
                (row) => row.id,
                ({ item }) => html`
                  <RodReactTreeRow
                    :reactRow
                    :fiberId=${() => item().id}
                    :selected=${() => item().selected}
                    :changed=${() => item().changed}
                    style=${() => `--rd-react-depth:${item().depth}`}
                    title=${() => `${item().workTag}${item().key ? ` · key=${item().key}` : ""}`}
                    @click=${event.click((click) => {
                      click.preventDefault();
                      react.selectById(item().id);
                    })}
                  >
                    <RodReactToggle
                      type="button"
                      aria-label="Expandir ou recolher"
                      @click=${event.click((click) => {
                        click.preventDefault();
                        click.stopPropagation();
                        if (item().hasChildren) react.toggleById(item().id);
                      })}
                    >${() => item().hasChildren ? (item().expanded ? "▾" : "▸") : "·"}</RodReactToggle>
                    <RodReactRowMain>
                      <RodReactComponentName>${() => item().name}</RodReactComponentName>
                      ${() => item().key ? html`<RodReactKey>key=${item().key}</RodReactKey>` : null}
                    </RodReactRowMain>
                    <RodReactKind>${() => item().kind}${() => item().hasDom ? " · DOM" : ""}</RodReactKind>
                  </RodReactTreeRow>
                `,
              ),
              () => {
                const report = react.report();
                return html`
                  <RodReactEmpty>
                    <strong>Nenhuma Fiber root detectada.</strong>
                    <p>
                      O painel já tenta hook global, commits, renderers, __reactFiber$, __reactContainer$,
                      _reactRootContainer, ReactDOM root APIs, WeakMap host→Fiber, globals, Text/Comment nodes,
                      Shadow DOM e iframes same-origin. Se o userscript estiver num isolated world sem acesso ao
                      page realm, carregue o bundle em document-start/page world ou exponha unsafeWindow.
                    </p>
                    <RodReactActionGroup style="justify-content:center">
                      <RodReactActionButton type="button" @click=${event.click((click) => { click.preventDefault(); react.action("scan"); })}>Scan</RodReactActionButton>
                      <RodReactActionButton type="button" @click=${event.click((click) => { click.preventDefault(); react.action("picker"); })}>Picker</RodReactActionButton>
                      <RodReactActionButton type="button" @click=${event.click((click) => { click.preventDefault(); react.action("copy-diagnostics"); })}>Copy diag</RodReactActionButton>
                    </RodReactActionGroup>
                    ${report?.strategies?.length
                      ? html`<RodReactStrategyList>${report.strategies.map((strategy) => html`<RodReactStrategy>${strategy}</RodReactStrategy>`)}</RodReactStrategyList>`
                      : null}
                    ${report?.errors?.length
                      ? html`<RodReactDiagnostic>${report.errors.join(" · ")}</RodReactDiagnostic>`
                      : null}
                  </RodReactEmpty>
                `;
              },
            )}
          </RodReactTreeScroller>
        </RodReactTreePane>

        <RodReactDetailPane :reactDetail :active=${react.detailOpen}>
          ${() => {
            const selected = react.selected();
            if (!selected) {
              return html`
                <RodReactEmpty>
                  <strong>Selecione uma Fiber.</strong>
                  <p>Toque na árvore ou use o picker para ligar um elemento da página ao componente React mais próximo.</p>
                </RodReactEmpty>
              `;
            }

            return html`
              <RodReactDetailHeader>
                <RodReactBackButton type="button" aria-label="Voltar para árvore" @click=${event.click((click) => { click.preventDefault(); react.action("close-detail"); })}>${icon("back")}</RodReactBackButton>
                <RodReactDetailIdentity>
                  <RodReactDetailName>${selected.name}</RodReactDetailName>
                  <RodReactDetailMeta>${selected.workTag}${selected.key ? ` · key=${selected.key}` : ""} · ${selected.kind}</RodReactDetailMeta>
                </RodReactDetailIdentity>
                <RodReactDetailActions>
                  <RodReactDetailIcon type="button" title="Highlight DOM" @click=${event.click((click) => { click.preventDefault(); react.action("highlight"); })}>${icon("eye")}</RodReactDetailIcon>
                  <RodReactDetailIcon type="button" title="Abrir Elements" @click=${event.click((click) => { click.preventDefault(); react.action("elements"); })}>${icon("elements")}</RodReactDetailIcon>
                  <RodReactDetailIcon type="button" title="Copiar Fiber path" @click=${event.click((click) => { click.preventDefault(); react.action("copy-path"); })}>${icon("copy")}</RodReactDetailIcon>
                </RodReactDetailActions>
              </RodReactDetailHeader>

              <RodReactTabs>
                ${DETAIL_TABS.map((tab) => html`
                  <RodReactTab
                    type="button"
                    :active=${() => react.activeTab() === tab.id}
                    @click=${event.click((click) => { click.preventDefault(); react.setDetailTab(tab.id); })}
                  >${tab.label}${tab.id === "hooks" && selected.hooks.length ? ` (${selected.hooks.length})` : ""}</RodReactTab>
                `)}
              </RodReactTabs>

              <RodReactDetailScroller>
                <RodReactPath>${selected.path}</RodReactPath>
                ${() => detailContent(react, selected)}
              </RodReactDetailScroller>
            `;
          }}
        </RodReactDetailPane>
      </RodReactWorkspace>
    </RodReactLayout>
  `;
});

function detailContent(react: ReactPanelContextValue, selected: NonNullable<ReturnType<ReactPanelContextValue["selected"]>>) {
  switch (react.activeTab()) {
    case "props":
      return valueCard("memoizedProps", selected.props, react);

    case "state":
      return html`
        ${valueCard(selected.kind === "Class" ? "instance.state" : "memoizedState", selected.state, react)}
        ${selected.kind === "Class" ? valueCard("instance", selected.instance, react) : null}
      `;

    case "hooks":
      if (!selected.hooks.length) {
        return html`<RodReactEmpty><strong>Sem Hook list detectável.</strong><p>Class/host Fibers não possuem a linked list de hooks de Function Components.</p></RodReactEmpty>`;
      }
      return repeat(
        () => selected.hooks,
        (hook) => hook.index,
        ({ item }) => html`
          <RodReactValueCard>
            <RodReactValueHeader>#${() => item().index + 1} · ${() => item().kind}</RodReactValueHeader>
            <RodReactValueBody>${() => react.renderValue({
              memoizedState: item().memoizedState,
              baseState: item().baseState,
              baseQueue: item().baseQueue,
              queue: item().queue,
            })}</RodReactValueBody>
          </RodReactValueCard>
        `,
      );

    case "context":
      if (!selected.contexts.length) {
        const classContext = selected.instance && typeof selected.instance === "object"
          ? (selected.instance as Record<string, unknown>).context
          : undefined;
        return classContext !== undefined
          ? valueCard("instance.context", classContext, react)
          : html`<RodReactEmpty><strong>Sem Context dependencies.</strong><p>Nenhuma entrada em fiber.dependencies.firstContext foi encontrada.</p></RodReactEmpty>`;
      }
      return repeat(
        () => selected.contexts,
        (context) => context.index,
        ({ item }) => html`
          <RodReactValueCard>
            <RodReactValueHeader>${() => item().name}</RodReactValueHeader>
            <RodReactValueBody>${() => react.renderValue({ value: item().value, context: item().context })}</RodReactValueBody>
          </RodReactValueCard>
        `,
      );

    case "fiber":
      return valueCard("Fiber internals", react.detailFiberMetadata(), react);
  }
}

function valueCard(title: string, value: unknown, react: ReactPanelContextValue) {
  return html`
    <RodReactValueCard>
      <RodReactValueHeader>${title}</RodReactValueHeader>
      <RodReactValueBody>${() => react.renderValue(value)}</RodReactValueBody>
    </RodReactValueCard>
  `;
}
