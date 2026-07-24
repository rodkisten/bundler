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
    bg($colors.background),
    color($colors.foreground),
    rounded($radius.editor)
  )

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

  $$gutterWidth<length>: 0px
  $$fontSize<length>: 16px

  border: 1px solid $colors.border

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

  p:
    $spacing.editor-top
    0
    $spacing.editor-bottom

  box-border
  overflow-hidden

  z: 0
  contain: paint
  pointer-events: none
  user-select: none

  text($$fontSize / 1.55 / 500)

  font-family: $fonts.code

  tab-size: $$tabSize
  color: $colors.foreground

  transform: translateY(var(--maq-scroll-y, 0px))
  will-change: transform

  & :token='comment' {
    color: $colors.syntax-comment
  }

  & :token='string' {
    color: $colors.syntax-string
  }

  & :token='number' {
    color: $colors.syntax-number
  }

  & :token='boolean' {
    color: $colors.syntax-boolean
  }

  & :token='keyword' {
    color: $colors.syntax-keyword
  }

  & :token='property' {
    color: $colors.syntax-property
  }

  & :token='tag' {
    color: $colors.syntax-tag
  }

  & :token='attribute' {
    color: $colors.syntax-attribute
  }

  & :token='punctuation' {
    color: $colors.syntax-punctuation
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

  pr: $spacing.line-number-inline

  z: 2

  border-right: 1px solid $colors.border

  bg: $colors.background
  color: $colors.muted

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

  px: $spacing.editor-inline

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
    $spacing.editor-top
    $spacing.editor-inline
    $spacing.editor-bottom
    calc($$gutterWidth + 16px)

  overscroll-behavior: contain
  scrollbar-gutter: stable
  resize: none

  @with($editor-reset)

  bg: transparent
  color: transparent

  caret-color: $colors.foreground
  -webkit-text-fill-color: transparent

  text(
    $$fontSize /
    $typography.editor-line-height /
    $typography.editor-weight
  )

  font-family: $fonts.code

  tab-size: $$tabSize

  white-space: var(--maq-white-space, pre-wrap)
  overflow-wrap: var(--maq-overflow-wrap, anywhere)

  user-select: text
  -webkit-user-select: text

  touch-action: pan-y pan-x

  &::selection {
    bg: $colors.selection
  }

  &::placeholder {
    color: $colors.muted
    -webkit-text-fill-color: $colors.muted
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

  width: fluid(
    $sizes.suggestions-width,
    $sizes.suggestions-width
  )

  max-width: 100%
  max-height: $sizes.suggestions-max-height

  p: $spacing.suggestions

  touch-scroll
  touch-action: pan-y
  pointer-events: none

  peer(editor, open=true) {
    pointer-events: auto
  }

  border: 1px solid $colors.border
  rounded: $radius.suggestions

  bg: alpha(
    $colors.surface /
    $opacity.surface
  )

  shadow:
    0 18px 50px rgb(0 0 0 / 35%),
    inset 0 1px rgb(255 255 255 / 4%)

  backdrop-filter:
    blur($effects.suggestions-blur)
    saturate($effects.suggestions-saturation)

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

  min-height: $sizes.suggestion-min-height
  gap: $spacing.suggestion-gap

  m: 0

  p:
    $spacing.suggestion-block
    $spacing.suggestion-inline

  border: 0
  rounded: $radius.suggestion

  bg: transparent
  color: $colors.foreground

  text-align: left
  font: inherit
  cursor: pointer

  user-select: none
  -webkit-user-select: none

  touch-action: pan-y

  state(active=true) {
    bg: alpha(
      $colors.accent /
      $opacity.suggestion-active
    )
  }

  @media (hover: hover) {
    x:hover {
      bg: alpha(
        $colors.accent /
        $opacity.suggestion-hover
      )
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

    max-width: $sizes.suggestion-detail-max-width
    color: $colors.muted

    text-overflow: ellipsis
    white-space: nowrap

    font-size: $typography.suggestion-detail-size
  }
`

styled.flushRegistry()

/**
 * All Cipó artifacts created by this factory, collected automatically.
 */
export const maquinaStyleArtifacts = styled.registry.cssArtifacts
