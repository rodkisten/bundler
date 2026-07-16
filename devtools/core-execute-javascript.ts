
import { at, concatArrays, joinArray, mapArray, mapJoinArray, noop, objectToMap, someArray, splitLines, toArray } from "@rodkisten/nascente";
/* ******************** */
/* Public types         */
/* ******************** */

export type JavaScriptExecutionRoot =
  | Document
  | DocumentFragment
  | Element;

export type JavaScriptGlobals =
  | ReadonlyMap<string, unknown>
  | Readonly<Record<string, unknown>>;

export type JavaScriptExecutionStrategy =
  | "async-function"
  | "blob-module"
  | "blob-script"
  | "function"
  | "eval";

export interface ExecuteJavaScriptContext {
  /**
   * Result of the previous console evaluation.
   */
  $_?: unknown;

  /**
   * Currently selected DOM element.
   */
  $0?: Element | null;

  /**
   * Public DevTools instance or API.
   */
  devtools?: unknown;

  /**
   * Additional values exposed as variables inside the evaluated code.
   */
  globals?: JavaScriptGlobals;

  /**
   * Document used by the `$` and `$$` helpers.
   */
  document?: Document;
}

export interface ExecuteJavaScriptOptions {
  /**
   * Evaluation strategies attempted in order.
   */
  strategies?: readonly JavaScriptExecutionStrategy[];

  /**
   * Maximum execution time for asynchronous strategies.
   *
   * This cannot forcibly interrupt synchronous infinite loops.
   */
  timeoutMs?: number;

  /**
   * Attempts to evaluate the source as an expression first.
   */
  expressionFirst?: boolean;

  /**
   * Tries to return the final simple expression from statement code.
   */
  returnLastExpression?: boolean;

  /**
   * Adds a sourceURL comment to generated code for readable stack traces.
   */
  sourceURL?: string;

  /**
   * Window used by script-based fallback strategies.
   */
  window?: Window;

  /**
   * Signal used to cancel pending asynchronous execution.
   */
  signal?: AbortSignal;
}

export interface ExecuteJavaScriptResult<TResult = unknown> {
  value: TResult;
  strategy: JavaScriptExecutionStrategy;
}

export interface QueryOne {
  <TElement extends Element = Element>(
    selector: string,
    root?: JavaScriptExecutionRoot | null,
  ): TElement | null;
}

export interface QueryAll {
  <TElement extends Element = Element>(
    selector: string,
    root?: JavaScriptExecutionRoot | null,
  ): TElement[];
}

export class JavaScriptExecutionError extends Error {
  readonly code: string;
  readonly strategy?: JavaScriptExecutionStrategy;
  readonly attempts: readonly JavaScriptExecutionAttempt[];
  override readonly cause?: unknown;

  constructor(options: {
    message: string;
    code: string;
    strategy?: JavaScriptExecutionStrategy;
    attempts?: readonly JavaScriptExecutionAttempt[];
    cause?: unknown;
  }) {
    super(options.message);

    this.name = "JavaScriptExecutionError";
    this.code = options.code;
    this.strategy = options.strategy;
    this.attempts = options.attempts ?? [];
    this.cause = options.cause;
  }
}

export interface JavaScriptExecutionAttempt {
  strategy: JavaScriptExecutionStrategy;
  error: unknown;
}

/* ******************** */
/* Internal types       */
/* ******************** */

type AsyncExecutor = (...args: unknown[]) => Promise<unknown>;

type AsyncFunctionConstructor = new (
  ...args: string[]
) => AsyncExecutor;

type DynamicFunction = (...args: unknown[]) => unknown;

type DynamicFunctionConstructor = new (
  ...args: string[]
) => DynamicFunction;

interface NormalizedExecutionContext {
  document: Document;
  window: Window;
  globals: ReadonlyMap<string, unknown>;
  names: string[];
  values: unknown[];
}

interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

interface BlobMessageSuccess {
  channel: string;
  ok: true;
  value: unknown;
}

interface BlobMessageFailure {
  channel: string;
  ok: false;
  error: SerializedError;
}

type BlobMessage = BlobMessageSuccess | BlobMessageFailure;

/* ******************** */
/* Constants            */
/* ******************** */

const DEFAULT_STRATEGIES: readonly JavaScriptExecutionStrategy[] = [
  "async-function",
  "blob-module",
  "blob-script",
  "function",
  "eval",
];

const DEFAULT_TIMEOUT_MS = 15_000;

const DEFAULT_SOURCE_URL = "rod-devtools-evaluation.js";

const RESERVED_CONTEXT_NAMES = new Set([
  "$_",
  "$0",
  "$",
  "$$",
  "devtools",
  "document",
  "window",
  "globalThis",
]);

const VALID_IDENTIFIER_PATTERN =
  /^[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*$/u;

const ASYNC_FUNCTION_CONSTRUCTOR = Object.getPrototypeOf(
  async function noop(): Promise<void> {
    return undefined;
  },
).constructor as AsyncFunctionConstructor;

const FUNCTION_CONSTRUCTOR =
  Function as unknown as DynamicFunctionConstructor;

/* ******************** */
/* Public API           */
/* ******************** */

/**
 * Executes JavaScript using a DevTools-like context.
 *
 * The function attempts multiple execution strategies because browsers and
 * Content Security Policies may allow one dynamic mechanism while blocking
 * another.
 */
export async function executeJavaScript<TResult = unknown>(
  code: string,
  context: ExecuteJavaScriptContext = {},
  options: ExecuteJavaScriptOptions = {},
): Promise<TResult> {
  const result = await executeJavaScriptDetailed<TResult>(
    code,
    context,
    options,
  );

  return result.value;
}

/**
 * Executes JavaScript and returns the strategy that successfully evaluated it.
 */
export async function executeJavaScriptDetailed<TResult = unknown>(
  code: string,
  context: ExecuteJavaScriptContext = {},
  options: ExecuteJavaScriptOptions = {},
): Promise<ExecuteJavaScriptResult<TResult>> {
  assertCode(code);

  const source = code.trim();

  if (!source) {
    return {
      value: undefined as TResult,
      strategy: "async-function",
    };
  }

  throwIfAborted(options.signal);

  const normalizedContext = normalizeExecutionContext(context, options);
  const strategies = normalizeStrategies(options.strategies);
  const attempts: JavaScriptExecutionAttempt[] = [];

  for (const strategy of strategies) {
    throwIfAborted(options.signal);

    try {
      const value = await runStrategy<TResult>(
        strategy,
        source,
        normalizedContext,
        options,
      );

      return {
        value,
        strategy,
      };
    } catch (error: unknown) {
      attempts.push({
        strategy,
        error,
      });

      if (isAbortError(error)) {
        throw error;
      }
    }
  }

  throw createAggregateExecutionError(source, attempts);
}

/* ******************** */
/* Strategy dispatch    */
/* ******************** */

async function runStrategy<TResult>(
  strategy: JavaScriptExecutionStrategy,
  code: string,
  context: NormalizedExecutionContext,
  options: ExecuteJavaScriptOptions,
): Promise<TResult> {
  switch (strategy) {
    case "async-function":
      return executeWithAsyncFunction<TResult>(code, context, options);

    case "blob-module":
      return executeWithBlobModule<TResult>(code, context, options);

    case "blob-script":
      return executeWithBlobScript<TResult>(code, context, options);

    case "function":
      return executeWithFunction<TResult>(code, context, options);

    case "eval":
      return executeWithIndirectEval<TResult>(code, context, options);

    default:
      return assertNever(strategy);
  }
}

/* ******************** */
/* AsyncFunction        */
/* ******************** */

/**
 * Uses the AsyncFunction constructor.
 *
 * This is normally the fastest and cleanest strategy, but it is commonly
 * blocked by CSP rules that omit `unsafe-eval`.
 */
async function executeWithAsyncFunction<TResult>(
  code: string,
  context: NormalizedExecutionContext,
  options: ExecuteJavaScriptOptions,
): Promise<TResult> {
  const body = createAsyncFunctionBody(code, options);

  let executor: AsyncExecutor;

  try {
    executor = new ASYNC_FUNCTION_CONSTRUCTOR(
      ...context.names,
      body,
    );
  } catch (error: unknown) {
    throw createStrategyError(
      "async-function",
      code,
      error,
      "Unable to compile code with AsyncFunction.",
    );
  }

  try {
    const execution = executor(...context.values);

    return await withExecutionGuards<TResult>(
      execution as Promise<TResult>,
      options,
    );
  } catch (error: unknown) {
    throw createStrategyError(
      "async-function",
      code,
      error,
      "AsyncFunction execution failed.",
    );
  }
}

/* ******************** */
/* Blob module          */
/* ******************** */

/**
 * Executes code through a dynamically imported Blob module.
 *
 * The runtime context is temporarily exposed through a unique global key
 * because imported modules cannot receive arbitrary constructor arguments.
 */
async function executeWithBlobModule<TResult>(
  code: string,
  context: NormalizedExecutionContext,
  options: ExecuteJavaScriptOptions,
): Promise<TResult> {
  const globalKey = createUniqueGlobalKey("module-context");
  const targetGlobal = context.window as unknown as Record<string, unknown>;
  const sourceURL = normalizeSourceURL(
    options.sourceURL,
    "blob-module",
  );

  const moduleSource = createBlobModuleSource(
    code,
    context.names,
    globalKey,
    options,
    sourceURL,
  );

  const blob = new Blob([moduleSource], {
    type: "text/javascript;charset=utf-8",
  });

  const blobURL = URL.createObjectURL(blob);

  targetGlobal[globalKey] = context.values;

  try {
    const modulePromise = import(
      /* @vite-ignore */
      blobURL
    ) as Promise<{
      default: () => Promise<TResult>;
    }>;

    const module = await withExecutionGuards(
      modulePromise,
      options,
    );

    if (!module || typeof module.default !== "function") {
      throw new TypeError(
        "Blob module did not export a default executor.",
      );
    }

    return await withExecutionGuards(
      module.default(),
      options,
    );
  } catch (error: unknown) {
    throw createStrategyError(
      "blob-module",
      code,
      error,
      "Blob module execution failed.",
    );
  } finally {
    delete targetGlobal[globalKey];
    URL.revokeObjectURL(blobURL);
  }
}

/* ******************** */
/* Blob classic script  */
/* ******************** */

/**
 * Executes code by injecting a classic script backed by a Blob URL.
 *
 * The script communicates its result through `window.postMessage`.
 */
async function executeWithBlobScript<TResult>(
  code: string,
  context: NormalizedExecutionContext,
  options: ExecuteJavaScriptOptions,
): Promise<TResult> {
  const channel = createUniqueGlobalKey("blob-channel");
  const contextKey = createUniqueGlobalKey("blob-context");
  const targetGlobal = context.window as unknown as Record<
    string,
    unknown
  >;

  const sourceURL = normalizeSourceURL(
    options.sourceURL,
    "blob-script",
  );

  const scriptSource = createBlobScriptSource(
    code,
    context.names,
    contextKey,
    channel,
    options,
    sourceURL,
  );

  const blob = new Blob([scriptSource], {
    type: "text/javascript;charset=utf-8",
  });

  const blobURL = URL.createObjectURL(blob);
  const script = context.document.createElement("script");

  script.async = true;
  script.src = blobURL;

  targetGlobal[contextKey] = context.values;

  const resultPromise = new Promise<TResult>((resolve, reject) => {
    const cleanup = (): void => {
      context.window.removeEventListener(
        "message",
        handleMessage,
      );

      script.remove();
      delete targetGlobal[contextKey];
      URL.revokeObjectURL(blobURL);
    };

    const handleMessage = (event: MessageEvent): void => {
      if (event.source !== context.window) {
        return;
      }

      if (!isBlobMessage(event.data, channel)) {
        return;
      }

      cleanup();

      if (event.data.ok) {
        resolve(event.data.value as TResult);
        return;
      }

      reject(deserializeError(event.data.error));
    };

    context.window.addEventListener(
      "message",
      handleMessage,
    );

    script.addEventListener(
      "error",
      () => {
        cleanup();

        reject(
          new Error(
            "The Blob-backed script could not be loaded.",
          ),
        );
      },
      {
        once: true,
      },
    );

    const parent =
      context.document.head ??
      context.document.documentElement ??
      context.document.body;

    if (!parent) {
      cleanup();

      reject(
        new Error(
          "No document container is available for script injection.",
        ),
      );

      return;
    }

    parent.appendChild(script);
  });

  try {
    return await withExecutionGuards(
      resultPromise,
      options,
    );
  } catch (error: unknown) {
    script.remove();
    delete targetGlobal[contextKey];
    URL.revokeObjectURL(blobURL);

    throw createStrategyError(
      "blob-script",
      code,
      error,
      "Blob script execution failed.",
    );
  }
}

/* ******************** */
/* Function constructor */
/* ******************** */

/**
 * Uses the standard Function constructor.
 *
 * Async support is provided by returning an immediately invoked async
 * function from the generated function body.
 */
async function executeWithFunction<TResult>(
  code: string,
  context: NormalizedExecutionContext,
  options: ExecuteJavaScriptOptions,
): Promise<TResult> {
  const body = createFunctionBody(code, options);

  let executor: DynamicFunction;

  try {
    executor = new FUNCTION_CONSTRUCTOR(
      ...context.names,
      body,
    );
  } catch (error: unknown) {
    throw createStrategyError(
      "function",
      code,
      error,
      "Unable to compile code with Function.",
    );
  }

  try {
    const execution = Promise.resolve(
      executor(...context.values),
    );

    return await withExecutionGuards<TResult>(
      execution as Promise<TResult>,
      options,
    );
  } catch (error: unknown) {
    throw createStrategyError(
      "function",
      code,
      error,
      "Function execution failed.",
    );
  }
}

/* ******************** */
/* Indirect eval        */
/* ******************** */

/**
 * Uses indirect eval.
 *
 * Context values are temporarily written to a unique global location. The
 * generated source then copies them into local variables before evaluating
 * the user code.
 */
async function executeWithIndirectEval<TResult>(
  code: string,
  context: NormalizedExecutionContext,
  options: ExecuteJavaScriptOptions,
): Promise<TResult> {
  const contextKey = createUniqueGlobalKey("eval-context");
  const targetGlobal = context.window as unknown as Record<
    string,
    unknown
  >;

  targetGlobal[contextKey] = context.values;

  const sourceURL = normalizeSourceURL(
    options.sourceURL,
    "eval",
  );

  const source = createIndirectEvalSource(
    code,
    context.names,
    contextKey,
    options,
    sourceURL,
  );

  try {
    const indirectEval = (context.window as Window & { eval(source: string): unknown }).eval;
    const execution = indirectEval(source) as Promise<TResult>;

    return await withExecutionGuards(
      Promise.resolve(execution),
      options,
    );
  } catch (error: unknown) {
    throw createStrategyError(
      "eval",
      code,
      error,
      "Indirect eval execution failed.",
    );
  } finally {
    delete targetGlobal[contextKey];
  }
}

/* ******************** */
/* Code generation      */
/* ******************** */

function createAsyncFunctionBody(
  code: string,
  options: ExecuteJavaScriptOptions,
): string {
  const sourceURL = normalizeSourceURL(
    options.sourceURL,
    "async-function",
  );

  const executableCode = createExecutableCode(code, options);

  return joinArray([
    '"use strict";',
    executableCode,
    `//# sourceURL=${sourceURL}`,
  ], "\n");
}

function createFunctionBody(
  code: string,
  options: ExecuteJavaScriptOptions,
): string {
  const sourceURL = normalizeSourceURL(
    options.sourceURL,
    "function",
  );

  const executableCode = createExecutableCode(code, options);

  return joinArray([
    '"use strict";',
    "return (async () => {",
    indentCode(executableCode, 2),
    "})();",
    `//# sourceURL=${sourceURL}`,
  ], "\n");
}

function createBlobModuleSource(
  code: string,
  names: readonly string[],
  contextKey: string,
  options: ExecuteJavaScriptOptions,
  sourceURL: string,
): string {
  const declarations = createContextDeclarations(
    names,
    `globalThis[${JSON.stringify(contextKey)}]`,
  );

  const executableCode = createExecutableCode(code, options);

  return joinArray([
    "export default async function executeBlobModule() {",
    '  "use strict";',
    indentCode(declarations, 2),
    indentCode(executableCode, 2),
    "}",
    `//# sourceURL=${sourceURL}`,
  ], "\n");
}

function createBlobScriptSource(
  code: string,
  names: readonly string[],
  contextKey: string,
  channel: string,
  options: ExecuteJavaScriptOptions,
  sourceURL: string,
): string {
  const declarations = createContextDeclarations(
    names,
    `window[${JSON.stringify(contextKey)}]`,
  );

  const executableCode = createExecutableCode(code, options);

  return joinArray([
    "(async function executeBlobScript() {",
    '  "use strict";',
    "  try {",
    indentCode(declarations, 4),
    "    const __rodValue = await (async () => {",
    indentCode(executableCode, 6),
    "    })();",
    "    window.postMessage({",
    `      channel: ${JSON.stringify(channel)},`,
    "      ok: true,",
    "      value: __rodValue,",
    '    }, "*");',
    "  } catch (__rodError) {",
    "    window.postMessage({",
    `      channel: ${JSON.stringify(channel)},`,
    "      ok: false,",
    "      error: {",
    '        name: __rodError instanceof Error ? __rodError.name : "Error",',
    "        message:",
    "          __rodError instanceof Error",
    "            ? __rodError.message",
    "            : String(__rodError),",
    "        stack:",
    "          __rodError instanceof Error",
    "            ? __rodError.stack",
    "            : undefined,",
    "      },",
    '    }, "*");',
    "  }",
    "})();",
    `//# sourceURL=${sourceURL}`,
  ], "\n");
}

function createIndirectEvalSource(
  code: string,
  names: readonly string[],
  contextKey: string,
  options: ExecuteJavaScriptOptions,
  sourceURL: string,
): string {
  const declarations = createContextDeclarations(
    names,
    `globalThis[${JSON.stringify(contextKey)}]`,
  );

  const executableCode = createExecutableCode(code, options);

  return joinArray([
    "(async function executeIndirectEval() {",
    '  "use strict";',
    indentCode(declarations, 2),
    indentCode(executableCode, 2),
    "})();",
    `//# sourceURL=${sourceURL}`,
  ], "\n");
}

function createExecutableCode(
  code: string,
  options: ExecuteJavaScriptOptions,
): string {
  const expressionFirst =
    options.expressionFirst ?? true;

  if (!expressionFirst) {
    return createStatementCode(code, options);
  }

  return joinArray([
    "try {",
    `  return await (${code});`,
    "} catch (__rodExpressionError) {",
    "  if (!(",
    "    __rodExpressionError instanceof SyntaxError",
    "  )) {",
    "    throw __rodExpressionError;",
    "  }",
    "}",
    createStatementCode(code, options),
  ], "\n");
}

function createStatementCode(
  code: string,
  options: ExecuteJavaScriptOptions,
): string {
  if (!options.returnLastExpression) {
    return code;
  }

  return transformLastExpressionIntoReturn(code);
}

function createContextDeclarations(
  names: readonly string[],
  sourceExpression: string,
): string {
  if (names.length === 0) {
    return "";
  }

  return mapJoinArray(names, (name, index) =>
        `const ${name} = ${sourceExpression}[${index}];`, "\n");
}

/* ******************** */
/* Context              */
/* ******************** */

function normalizeExecutionContext(
  context: ExecuteJavaScriptContext,
  options: ExecuteJavaScriptOptions,
): NormalizedExecutionContext {
  const executionWindow =
    options.window ??
    context.document?.defaultView ??
    globalThis.window;

  if (!executionWindow) {
    throw new JavaScriptExecutionError({
      message:
        "executeJavaScript requires a browser Window instance.",
      code: "",
    });
  }

  const executionDocument =
    context.document ?? executionWindow.document;

  if (!executionDocument) {
    throw new JavaScriptExecutionError({
      message:
        "executeJavaScript requires a browser Document instance.",
      code: "",
    });
  }

  const globals = normalizeGlobals(context.globals);

  validateGlobalNames(globals);

  const queryOne: QueryOne = <
    TElement extends Element = Element,
  >(
    selector: string,
    root: JavaScriptExecutionRoot | null =
      executionDocument,
  ): TElement | null => {
    if (!root) {
      return null;
    }

    return root.querySelector<TElement>(selector);
  };

  const queryAll: QueryAll = <
    TElement extends Element = Element,
  >(
    selector: string,
    root: JavaScriptExecutionRoot | null =
      executionDocument,
  ): TElement[] => {
    if (!root) {
      return [];
    }

    return toArray(root.querySelectorAll<TElement>(selector));
  };

  const names = concatArrays(
    ["$_", "$0", "$", "$$", "devtools", "document", "window"],
    toArray(globals.keys()),
  );

  const values: unknown[] = concatArrays(
    [context.$_, context.$0 ?? null, queryOne, queryAll, context.devtools, executionDocument, executionWindow],
    toArray(globals.values()),
  );

  return {
    document: executionDocument,
    window: executionWindow,
    globals,
    names,
    values,
  };
}

function normalizeGlobals(
  globals: JavaScriptGlobals | undefined,
): ReadonlyMap<string, unknown> {
  if (!globals) {
    return new Map<string, unknown>();
  }

  if (globals instanceof Map) {
    return new Map(globals);
  }

  return objectToMap(globals);
}

function validateGlobalNames(
  globals: ReadonlyMap<string, unknown>,
): void {
  for (const name of globals.keys()) {
    if (!VALID_IDENTIFIER_PATTERN.test(name)) {
      throw new SyntaxError(
        `Invalid JavaScript global name "${name}". ` +
          "Global names must be valid JavaScript identifiers.",
      );
    }

    if (RESERVED_CONTEXT_NAMES.has(name)) {
      throw new SyntaxError(
        `The global name "${name}" is reserved by executeJavaScript.`,
      );
    }
  }
}

/* ******************** */
/* Execution guards     */
/* ******************** */

async function withExecutionGuards<TResult>(
  execution: Promise<TResult>,
  options: ExecuteJavaScriptOptions,
): Promise<TResult> {
  const timeoutMs =
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const guards: Promise<TResult>[] = [execution];

  if (
    Number.isFinite(timeoutMs) &&
    timeoutMs > 0
  ) {
    guards.push(
      createTimeoutPromise<TResult>(timeoutMs),
    );
  }

  if (options.signal) {
    guards.push(
      createAbortPromise<TResult>(options.signal),
    );
  }

  return Promise.race(guards);
}

function createTimeoutPromise<TResult>(
  timeoutMs: number,
): Promise<TResult> {
  return new Promise<TResult>((_, reject) => {
    const timeoutID = globalThis.setTimeout(() => {
      reject(
        new DOMException(
          `JavaScript execution exceeded ${timeoutMs} ms.`,
          "TimeoutError",
        ),
      );
    }, timeoutMs);

    void Promise.resolve().finally(() => {
      globalThis.clearTimeout(timeoutID);
    });
  });
}

function createAbortPromise<TResult>(
  signal: AbortSignal,
): Promise<TResult> {
  return new Promise<TResult>((_, reject) => {
    if (signal.aborted) {
      reject(createAbortError(signal));
      return;
    }

    signal.addEventListener(
      "abort",
      () => {
        reject(createAbortError(signal));
      },
      {
        once: true,
      },
    );
  });
}

function throwIfAborted(
  signal: AbortSignal | undefined,
): void {
  if (signal?.aborted) {
    throw createAbortError(signal);
  }
}

function createAbortError(
  signal: AbortSignal,
): DOMException {
  const reason =
    "reason" in signal
      ? signal.reason
      : undefined;

  return new DOMException(
    reason == null
      ? "JavaScript execution was aborted."
      : String(reason),
    "AbortError",
  );
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

/* ******************** */
/* Statement transform  */
/* ******************** */

/**
 * Converts the final simple expression into an awaited return.
 *
 * This is intentionally conservative and is not a replacement for a parser.
 */
function transformLastExpressionIntoReturn(
  code: string,
): string {
  const lines = mapArray(splitLines(code), (line) => line.trimEnd());

  let lastIndex = lines.length - 1;

  while (
    lastIndex >= 0 &&
    !lines[lastIndex]?.trim()
  ) {
    lastIndex -= 1;
  }

  if (lastIndex < 0) {
    return code;
  }

  const finalLine = lines[lastIndex]!.trim();

  if (!canBecomeReturnedExpression(finalLine)) {
    return code;
  }

  const expression = finalLine.replace(/;$/, "");

  lines[lastIndex] =
    `return await (${expression});`;

  return joinArray(lines, "\n");
}

function canBecomeReturnedExpression(
  line: string,
): boolean {
  if (!line) {
    return false;
  }

  const blockedPrefixes = [
    "const ",
    "let ",
    "var ",
    "function ",
    "async function ",
    "class ",
    "if ",
    "if(",
    "for ",
    "for(",
    "while ",
    "while(",
    "do ",
    "switch ",
    "switch(",
    "try ",
    "try{",
    "catch ",
    "finally ",
    "throw ",
    "return ",
    "break",
    "continue",
    "import ",
    "export ",
    "debugger",
  ];

  if (
    someArray(blockedPrefixes, (prefix) =>
      line.startsWith(prefix))
  ) {
    return false;
  }

  if (
    line === "{" ||
    line === "}" ||
    line.endsWith("{") ||
    line.startsWith("}")
  ) {
    return false;
  }

  return true;
}

/* ******************** */
/* Errors               */
/* ******************** */

function createStrategyError(
  strategy: JavaScriptExecutionStrategy,
  code: string,
  cause: unknown,
  message: string,
): JavaScriptExecutionError {
  return new JavaScriptExecutionError({
    message: `${message}\n\nExecuted code:\n${createCodePreview(code)}`,
    code,
    strategy,
    cause,
  });
}

function createAggregateExecutionError(
  code: string,
  attempts: readonly JavaScriptExecutionAttempt[],
): JavaScriptExecutionError {
  const details = mapJoinArray(attempts, ({ strategy, error }) => {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      return `- ${strategy}: ${message}`;
    }, "\n");

  return new JavaScriptExecutionError({
    message: joinArray([
      "All JavaScript execution strategies failed.",
      "",
      details,
      "",
      "Executed code:",
      createCodePreview(code),
    ], "\n"),
    code,
    attempts,
    cause: at(attempts, -1)?.error,
  });
}

function serializeError(
  error: unknown,
): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "Error",
    message: String(error),
  };
}

function deserializeError(
  error: SerializedError,
): Error {
  const restored = new Error(error.message);

  restored.name = error.name;

  if (error.stack) {
    restored.stack = error.stack;
  }

  return restored;
}

function createCodePreview(
  code: string,
  maxLength = 1_000,
): string {
  const normalized = code.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}\n…`;
}

/* ******************** */
/* Blob messages        */
/* ******************** */

function isBlobMessage(
  value: unknown,
  channel: string,
): value is BlobMessage {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const candidate = value as Partial<BlobMessage>;

  return (
    candidate.channel === channel &&
    typeof candidate.ok === "boolean"
  );
}

/* ******************** */
/* Utilities            */
/* ******************** */

function normalizeStrategies(
  strategies:
    | readonly JavaScriptExecutionStrategy[]
    | undefined,
): readonly JavaScriptExecutionStrategy[] {
  const normalized =
    strategies?.length
      ? toArray(new Set(strategies))
      : toArray(DEFAULT_STRATEGIES);

  if (normalized.length === 0) {
    throw new TypeError(
      "At least one JavaScript execution strategy is required.",
    );
  }

  return normalized;
}

function normalizeSourceURL(
  sourceURL: string | undefined,
  strategy: JavaScriptExecutionStrategy,
): string {
  const base =
    sourceURL?.trim() || DEFAULT_SOURCE_URL;

  const sanitized = base.replace(
    /[\r\n\u2028\u2029]/g,
    "",
  );

  const extensionIndex = sanitized.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return `${sanitized}-${strategy}.js`;
  }

  return joinArray([
    sanitized.slice(0, extensionIndex),
    `-${strategy}`,
    sanitized.slice(extensionIndex),
  ], "");
}

function createUniqueGlobalKey(
  prefix: string,
): string {
  const randomPart =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random()
          .toString(36)
          .slice(2);

  return `__rod_execute_${prefix}_${randomPart.replaceAll("-", "_")}__`;
}

function indentCode(
  code: string,
  spaces: number,
): string {
  if (!code) {
    return "";
  }

  const indentation = " ".repeat(spaces);

  return mapJoinArray(splitLines(code), (line) =>
      line ? `${indentation}${line}` : line, "\n");
}

function assertCode(code: unknown): asserts code is string {
  if (typeof code !== "string") {
    throw new TypeError(
      `executeJavaScript expected a string, received ${typeof code}.`,
    );
  }
}

function assertNever(value: never): never {
  throw new TypeError(
    `Unsupported execution strategy: ${String(value)}`,
  );
}

/* ******************** */
/* Optional helper      */
/* ******************** */

/**
 * Creates a reusable executor that automatically stores the previous result
 * in `$_`, closely matching browser console behavior.
 */
export function createJavaScriptExecutor(
  baseContext: ExecuteJavaScriptContext = {},
  baseOptions: ExecuteJavaScriptOptions = {},
): {
  execute<TResult = unknown>(
    code: string,
    context?: ExecuteJavaScriptContext,
    options?: ExecuteJavaScriptOptions,
  ): Promise<TResult>;

  getLastResult(): unknown;

  setLastResult(value: unknown): void;

  clearLastResult(): void;
} {
  let lastResult = baseContext.$_;

  return {
    async execute<TResult = unknown>(
      code: string,
      context: ExecuteJavaScriptContext = {},
      options: ExecuteJavaScriptOptions = {},
    ): Promise<TResult> {
      const result = await executeJavaScript<TResult>(
        code,
        {
          ...baseContext,
          ...context,
          $_:
            context.$_ !== undefined
              ? context.$_
              : lastResult,
          globals: mergeGlobals(
            baseContext.globals,
            context.globals,
          ),
        },
        {
          ...baseOptions,
          ...options,
        },
      );

      lastResult = result;

      return result;
    },

    getLastResult(): unknown {
      return lastResult;
    },

    setLastResult(value: unknown): void {
      lastResult = value;
    },

    clearLastResult(): void {
      lastResult = undefined;
    },
  };
}

function mergeGlobals(
  baseGlobals: JavaScriptGlobals | undefined,
  overrideGlobals: JavaScriptGlobals | undefined,
): ReadonlyMap<string, unknown> {
  return new Map(concatArrays(
    toArray(normalizeGlobals(baseGlobals)),
    toArray(normalizeGlobals(overrideGlobals)),
  ));
}

/* ******************** */
/* Usage examples       */
/* ******************** */

/*
const value = await executeJavaScript<number>("1 + 2");

const title = await executeJavaScript<string>(
  '$("h1")?.textContent ?? ""',
);

const result = await executeJavaScript<number>(
  "price * quantity",
  {
    $0: document.body,
    devtools: window.devtools,
    globals: {
      price: 19.9,
      quantity: 3,
    },
  },
  {
    timeoutMs: 5_000,
    expressionFirst: true,
    returnLastExpression: true,
    sourceURL: "rod-console-input.js",
  },
);

const executor = createJavaScriptExecutor({
  devtools: window.devtools,
});

await executor.execute("10 + 20");
await executor.execute("$_ * 2");
*/
