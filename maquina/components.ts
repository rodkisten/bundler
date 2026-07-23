import { configureFromCss, createStyled } from '@rodkisten/cipo'
import { maquinaCipoConfigCss } from '@rodkisten/maquina/cipo-config'
import { createFabrica } from '@rodkisten/fabrica'

// Source/package-module consumers need the same prefix and CSS-first contract
// that the Vite build lowers into a parser-free compiled configuration payload.
configureFromCss(maquinaCipoConfigCss)

/**
 * Maquina owns one isolated Fábrica registry shared by every editor instance.
 */
export const maquinaFabrica = createFabrica({
  name: 'maquina',
  isolated: true,
})

export const html = maquinaFabrica.html
export const component = maquinaFabrica.component
export const event = maquinaFabrica.event
export const ref = maquinaFabrica.ref

export const styled = createStyled({
  fabrica: maquinaFabrica,
})

styled.connectRegistry(maquinaFabrica)

export const MaquinaRoot = styled.div('MaquinaRoot').css`
  @with(
    bg(var(--maq-background)),
    color(var(--maq-foreground)),
    rounded(14px)
  )

  $$gutterWidth<length>: 0px
  $$scrollX<length>: 0px
  $$fontSize<length>: 16px
  $$tabSize<number>: 2

  relative
  isolate
  grid
  minw-0
  minh-0
  w-full
  h-full
  overflow-hidden

  contain: layout paint style
  grid-template-rows: minmax(0, 1fr)
  max-width: 100%
  max-height: 100%

  border: 1px solid var(--maq-border)

  shadow:
    0 16px 48px rgb(0 0 0 / 18%),
    inset 0 1px rgb(255 255 255 / 3.5%)
`

export const MaquinaViewport = styled.div('MaquinaViewport').css`
  relative
  minw-0
  minh-0
  w-full
  h-full
  overflow-hidden
`

/**
 * Visual code layer.
 *
 * The textarea remains the input and scroll authority. Logical rows let line
 * numbers and wrapped code share exactly the same height.
 */
export const MaquinaHighlight = styled.div('MaquinaHighlight').css`
  absolute-fill
  minw-full
  minh-full
  p: 14px 0 26px
  box-border
  overflow-hidden

  z: 0
  contain: paint
  pointer-events: none
  user-select: none

  text($$fontSize / 1.55 / 500)
  font-family: var(
    --maq-font,
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    monospace
  )

  tab-size: $$tabSize
  color: var(--maq-foreground)

  transform: translateY(var(--maq-scroll-y, 0px))
  will-change: transform

  & :token='comment' {
    color: var(--maq-comment)
  }

  & :token='string' {
    color: var(--maq-string)
  }

  & :token='number' {
    color: var(--maq-number)
  }

  & :token='boolean' {
    color: var(--maq-boolean)
  }

  & :token='keyword' {
    color: var(--maq-keyword)
  }

  & :token='property' {
    color: var(--maq-property)
  }

  & :token='tag' {
    color: var(--maq-tag)
  }

  & :token='attribute' {
    color: var(--maq-attribute)
  }

  & :token='punctuation' {
    color: var(--maq-punctuation)
  }
`

export const MaquinaLine = styled.div('MaquinaLine').css`
  grid
  minw-full

  grid-template-columns: $$gutterWidth minmax(0, 1fr)

  align-items: stretch
  min-height: 1.55em
`

export const MaquinaLineNumber = styled.span(
  'MaquinaLineNumber',
).css`
  relative
  block
  self-stretch
  box-border
  pr: 12px

  z: 2
  border-right: 1px solid var(--maq-border)
  bg: var(--maq-background)
  color: var(--maq-muted)
  text-align: right
  white-space: nowrap
  text(tabular)
`

export const MaquinaCodeClip = styled.span(
  'MaquinaCodeClip',
).css`
  block
  minw-0
  overflow-hidden
`

export const MaquinaLineCode = styled.span(
  'MaquinaLineCode',
).css`
  block
  minw-0
  box-border
  px: 16px

  white-space: var(--maq-white-space, pre-wrap)
  overflow-wrap: var(--maq-overflow-wrap, anywhere)

  transform: translateX($$scrollX)
`

/**
 * Native input layer.
 *
 * It always fills the viewport and shares exact text metrics and gutter
 * padding with the visual layer, keeping the native caret aligned with
 * highlighted glyphs on iOS and desktop browsers.
 */
export const MaquinaInput = styled.textarea(
  'MaquinaInput',
).css`
  absolute-fill
  block
  minw-0
  minh-0
  w-full
  h-full
  box-border
  overflow-auto

  z: 1
  max-width: 100%
  max-height: 100%
  m: 0

  p:
    14px
    16px
    26px
    calc($$gutterWidth + 16px)

  overscroll-behavior: contain
  scrollbar-gutter: stable
  resize: none

  @with($editor-reset)

  bg: transparent
  color: transparent
  caret-color: var(--maq-foreground)

  -webkit-text-fill-color: transparent

  text($$fontSize / 1.55 / 500)
  font-family: var(
    --maq-font,
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    monospace
  )

  tab-size: $$tabSize
  white-space: var(--maq-white-space, pre-wrap)
  overflow-wrap: var(--maq-overflow-wrap, anywhere)

  user-select: text
  -webkit-user-select: text

  touch-action: pan-y pan-x

  &::selection {
    bg: var(--maq-selection)
  }

  &::placeholder {
    color: var(--maq-muted)
    -webkit-text-fill-color: var(--maq-muted)
  }
`

export const MaquinaSuggestions = styled.div(
  'MaquinaSuggestions',
).css`
  absolute
  flex
  minw-0
  box-border
  overflow-x-hidden
  overflow-y-auto

  z: 20
  contain: layout paint style
  flex-direction: column

  width: fluid(280px, 280px)
  max-width: 100%
  max-height: 240px

  p: 6px

  touch-scroll
  touch-action: pan-y
  pointer-events: none

  peer(editor, open=true) {
    pointer-events: auto
  }

  border: 1px solid var(--maq-border)
  rounded: 12px

  bg: alpha(var(--maq-surface) / 96%)

  shadow:
    0 18px 50px rgb(0 0 0 / 35%),
    inset 0 1px rgb(255 255 255 / 4%)

  backdrop-filter: blur(18px) saturate(120%)

  &[hidden] {
    hidden
  }
`

/**
 * Options are non-focusable listbox rows.
 *
 * Keeping DOM focus on the textarea preserves the mobile keyboard while taps
 * and vertical gestures remain native.
 */
export const MaquinaSuggestion = styled.div(
  'MaquinaSuggestion',
).css`
  grid
  items-center
  minw-0
  w-full
  box-border

  grid-template-columns: minmax(0, 1fr) auto
  flex: 0 0 auto

  min-height: 42px
  gap: 12px

  m: 0
  p: 9px 11px

  border: 0
  rounded: 8px

  bg: transparent
  color: var(--maq-foreground)

  text-align: left
  font: inherit
  cursor: pointer

  user-select: none
  -webkit-user-select: none

  touch-action: pan-y

  state(active=true) {
    bg: alpha(var(--maq-accent) / 20%)
  }

  @media (hover: hover) {
    x:hover {
      bg: alpha(var(--maq-accent) / 16%)
    }
  }

  slot(label) {
    minw-0
    overflow-hidden

    text-overflow: ellipsis
    white-space: nowrap
  }

  slot(detail) {
    overflow-hidden

    max-width: 14ch
    color: var(--maq-muted)

    text-overflow: ellipsis
    white-space: nowrap
    font-size: 0.78em
  }
`

styled.flushRegistry()

/**
 * All Cipó artifacts created by this factory, collected automatically.
 */
export const maquinaStyleArtifacts = styled.registry.cssArtifacts
