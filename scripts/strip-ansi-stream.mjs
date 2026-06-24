import { Transform } from "node:stream";

/* ******************** */
/* ANSI sanitization    */
/* ******************** */

const ANSI_PATTERN =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

/**
 * Handles logs where the ESC byte has already become U+FFFD:
 *
 *   �[33m
 *   �[1m
 *   �[39m
 */
const CORRUPTED_ANSI_PATTERN =
  /\uFFFD\[(?:\d{1,4}(?:[;:]\d{0,4})*)?[A-PR-TZcf-nq-uy=><~]/g;

const transform = new Transform({
  transform(chunk, _encoding, callback) {
    try {
      const output = chunk
        .toString("utf8")
        .replace(ANSI_PATTERN, "")
        .replace(CORRUPTED_ANSI_PATTERN, "");

      callback(null, output);
    } catch (error) {
      callback(error);
    }
  },
});

process.stdin.pipe(transform).pipe(process.stdout);

process.stdin.on("error", error => {
  console.error("[strip-ansi-stream] Input error:", error);
  process.exitCode = 1;
});

process.stdout.on("error", error => {
  if (error?.code === "EPIPE") {
    process.exit(0);
  }

  console.error("[strip-ansi-stream] Output error:", error);
  process.exitCode = 1;
});
