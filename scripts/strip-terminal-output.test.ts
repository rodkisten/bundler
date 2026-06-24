import { describe, expect, it } from 'vitest'
import { stripTerminalOutput } from './strip-terminal-output'

describe('stripTerminalOutput', () => {
  it('removes valid ANSI CSI and OSC sequences', () => {
    const input = '\u001B[33mwarning\u001B[39m\u001B]0;title\u0007 done'
    expect(stripTerminalOutput(input)).toBe('warning done')
  })

  it('removes ANSI sequences whose ESC byte became a replacement character', () => {
    const input = '�[1m�[30m�[46m RUN �[49m�[39m�[22m Café Cipó'
    expect(stripTerminalOutput(input)).toBe(' RUN  Café Cipó')
  })

  it('preserves accents, emoji and ordinary brackets', () => {
    const input = 'Cipó [rápido] 🌿\r\nSão Paulo'
    expect(stripTerminalOutput(input)).toBe('Cipó [rápido] 🌿\nSão Paulo')
  })
})
