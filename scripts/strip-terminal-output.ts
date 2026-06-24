import { readFile, writeFile } from 'node:fs/promises'

const OSC_SEQUENCE = /\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g
const CSI_SEQUENCE = /(?:\u001B\[|\u009B)[0-?]*[ -/]*[@-~]/g
const TWO_BYTE_ESCAPE = /\u001B[@-_]/g
const CORRUPTED_CSI_SEQUENCE = /(?:\u00C2)?\uFFFD\[[0-?]*[ -/]*[@-~]/g
const LITERAL_ESCAPE_SEQUENCE = /\\u001[bB]\[[0-?]*[ -/]*[@-~]/g

/**
 * Removes valid ANSI escapes and the replacement-character form produced when
 * an ESC byte is decoded incorrectly, while preserving Unicode text and accents.
 */
export function stripTerminalOutput(input: string): string {
  return input
    .replace(OSC_SEQUENCE, '')
    .replace(CSI_SEQUENCE, '')
    .replace(TWO_BYTE_ESCAPE, '')
    .replace(CORRUPTED_CSI_SEQUENCE, '')
    .replace(LITERAL_ESCAPE_SEQUENCE, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

async function main(): Promise<void> {
  const [, , inputPath, outputPath] = process.argv
  if (!inputPath) {
    throw new Error('Usage: strip-terminal-output <input-file> [output-file]')
  }

  const input = await readFile(inputPath, 'utf8')
  const clean = stripTerminalOutput(input)
  await writeFile(outputPath || inputPath, clean, 'utf8')
}

const entryPath = process.argv[1] ?? ''
if (/strip-terminal-output\.(?:[cm]?[jt]s)$/.test(entryPath)) {
  void main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
