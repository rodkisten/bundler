import type {
  MaquinaCompletionItem,
} from "@rodkisten/maquina/types";

const MAX_RUNTIME_PROTOTYPE_DEPTH = 16;
const MAX_COMPLETIONS = 100;
const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;
const SAFE_GLOBAL_NAMES = [
  "console",
  "document",
  "globalThis",
  "self",
  "window",
] as const;
const NOISY_RUNTIME_PROPERTY_NAMES = new Set([
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  "__proto__",
  "constructor",
]);

export interface CompletionResultLike {
  readonly from: number;
  readonly options: readonly MaquinaCompletionItem[];
}

export interface RuntimeCompletionResult extends CompletionResultLike {
  readonly memberAccess: boolean;
}

export interface ScopeCompletionResult extends CompletionResultLike {
  readonly memberAccess: boolean;
}

interface ScopeBinding {
  readonly name: string;
  readonly kind: string;
  readonly scopePath: readonly number[];
  readonly declaredAt: number;
  readonly properties?: readonly string[];
  readonly runtimePath?: string;
}

interface LexicalToken {
  readonly value: string;
  readonly start: number;
  readonly end: number;
  scopePath: number[];
  openedScopeId?: number;
}

interface ScopeAnalysis {
  readonly bindings: readonly ScopeBinding[];
  readonly activeScopePath: readonly number[];
}

/**
 * Creates completion items for lexical bindings visible at the current cursor.
 */
export function createScopeCompletionResult(
  value: string,
  cursor: number,
): ScopeCompletionResult | null {
  const prefix = value.slice(0, cursor);
  const memberMatch =
    /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.([\w$]*)$/
      .exec(prefix);
  const analysis = analyzeScope(value, cursor);

  if (memberMatch) {
    const expression = memberMatch[1] ?? "";
    const propertyPrefix = memberMatch[2] ?? "";
    const rootName = expression.split(".")[0] ?? "";
    const binding = findVisibleBinding(analysis, rootName);

    if (
      binding?.properties &&
      expression === rootName
    ) {
      return {
        from: cursor - propertyPrefix.length,
        options: createPropertyCompletionItems(
          binding.properties,
          propertyPrefix,
          "scope",
        ),
        memberAccess: true,
      };
    }

    return null;
  }

  const identifierMatch = /[A-Za-z_$][\w$]*$/.exec(prefix);

  if (!identifierMatch) return null;

  const identifier = identifierMatch[0];
  const visible = collectVisibleBindings(analysis);
  const options = visible
    .filter((binding) => matchesPrefix(binding.name, identifier))
    .sort((left, right) => compareBindings(left, right, identifier))
    .slice(0, MAX_COMPLETIONS)
    .map((binding) => ({
      label: binding.name,
      type: binding.kind,
      detail: "scope",
    }));

  return {
    from: cursor - identifier.length,
    options,
    memberAccess: false,
  };
}

/**
 * Creates browser-runtime completions without evaluating properties merely to
 * discover their type. Accessor-only properties are intentionally omitted.
 */
export function createRuntimeCompletionResult(
  value: string,
  cursor: number,
  runtimeRoot: Window,
): RuntimeCompletionResult | null {
  const prefix = value.slice(0, cursor);
  const memberMatch =
    /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.([\w$]*)$/
      .exec(prefix);

  if (memberMatch) {
    const expression = memberMatch[1] ?? "";
    const propertyPrefix = memberMatch[2] ?? "";
    const aliasedExpression = resolveRuntimeAlias(
      value,
      cursor,
      expression,
    );
    const target = resolveRuntimeTarget(
      runtimeRoot,
      aliasedExpression,
    );

    if (target === null || target === undefined) {
      return null;
    }

    return {
      from: cursor - propertyPrefix.length,
      options: createRuntimeCompletionItems(
        target,
        propertyPrefix,
        target === runtimeRoot,
      ),
      memberAccess: true,
    };
  }

  const identifierMatch = /[A-Za-z_$][\w$]*$/.exec(prefix);

  if (!identifierMatch) return null;

  const identifier = identifierMatch[0];

  return {
    from: cursor - identifier.length,
    options: createRuntimeCompletionItems(
      runtimeRoot,
      identifier,
      true,
    ),
    memberAccess: false,
  };
}

/**
 * Merges provider, lexical-scope, and runtime completions in relevance order.
 */
export function resolveCompletionResult(
  external: CompletionResultLike | null | undefined,
  scope: ScopeCompletionResult | null,
  runtime: RuntimeCompletionResult | null,
): CompletionResultLike | null {
  const candidates = [scope, external, runtime].filter(
    (result): result is CompletionResultLike =>
      Boolean(result?.options.length),
  );

  if (candidates.length === 0) return null;

  const memberResult = scope?.memberAccess && scope.options.length
    ? scope
    : runtime?.memberAccess && runtime.options.length
      ? runtime
      : null;
  const from = memberResult?.from ?? candidates[0]?.from ?? 0;
  const compatible = candidates.filter((result) => result.from === from);

  return {
    from,
    options: mergeCompletionItems(
      ...compatible.map((result) => result.options),
    ),
  };
}

/**
 * Enumerates runtime data properties while omitting getters and setters.
 */
export function createRuntimeCompletionItems(
  target: unknown,
  prefix: string,
  includeSafeGlobals = false,
): MaquinaCompletionItem[] {
  if (target === null || target === undefined) return [];

  const descriptors = collectRuntimePropertyDescriptors(target);
  const items: MaquinaCompletionItem[] = [];
  const seen = new Set<string>();

  if (includeSafeGlobals) {
    for (const name of SAFE_GLOBAL_NAMES) {
      if (!matchesPrefix(name, prefix)) continue;

      seen.add(name);
      items.push({
        label: name,
        type: "global",
        detail: "runtime",
      });
    }
  }

  for (const [name, descriptor] of descriptors) {
    if (seen.has(name) || !matchesPrefix(name, prefix)) continue;

    seen.add(name);
    items.push({
      label: name,
      type: describeRuntimeValue(descriptor.value),
      detail: "runtime",
    });
  }

  return items
    .sort((left, right) => compareCompletionItems(left, right, prefix))
    .slice(0, MAX_COMPLETIONS);
}

function analyzeScope(
  value: string,
  cursor: number,
): ScopeAnalysis {
  const source = value.slice(0, cursor);
  const tokens = scanJavaScript(source);
  const activeScopePath = assignScopePaths(tokens);
  const bindings: ScopeBinding[] = [];

  collectVariableBindings(tokens, bindings);
  collectFunctionBindings(tokens, bindings);
  collectClassBindings(tokens, bindings);
  collectCatchBindings(tokens, bindings);
  collectArrowBindings(tokens, bindings);

  return {
    bindings,
    activeScopePath,
  };
}

function scanJavaScript(source: string): LexicalToken[] {
  const tokens: LexicalToken[] = [];
  let index = 0;

  while (index < source.length) {
    const code = source.charCodeAt(index);
    const next = source.charCodeAt(index + 1);

    if (code === 10 || code === 13) {
      const start = index;

      if (code === 13 && next === 10) index += 1;
      index += 1;
      tokens.push(createToken("\n", start, index));
      continue;
    }

    if (isWhitespace(code)) {
      index += 1;
      continue;
    }

    if (code === 47 && next === 47) {
      index += 2;

      while (
        index < source.length &&
        source.charCodeAt(index) !== 10 &&
        source.charCodeAt(index) !== 13
      ) {
        index += 1;
      }

      continue;
    }

    if (code === 47 && next === 42) {
      index += 2;

      while (
        index < source.length &&
        !(
          source.charCodeAt(index) === 42 &&
          source.charCodeAt(index + 1) === 47
        )
      ) {
        index += 1;
      }

      index = Math.min(source.length, index + 2);
      continue;
    }

    if (code === 34 || code === 39 || code === 96) {
      index = skipQuotedValue(source, index, code);
      continue;
    }

    if (isIdentifierStart(code)) {
      const start = index;
      index += 1;

      while (
        index < source.length &&
        isIdentifierPart(source.charCodeAt(index))
      ) {
        index += 1;
      }

      tokens.push(createToken(source.slice(start, index), start, index));
      continue;
    }

    if (code === 61 && next === 62) {
      tokens.push(createToken("=>", index, index + 2));
      index += 2;
      continue;
    }

    tokens.push(createToken(source[index] ?? "", index, index + 1));
    index += 1;
  }

  return tokens;
}

function createToken(
  value: string,
  start: number,
  end: number,
): LexicalToken {
  return {
    value,
    start,
    end,
    scopePath: [],
  };
}

function assignScopePaths(tokens: LexicalToken[]): number[] {
  const stack: number[] = [];
  let nextScopeId = 1;

  for (const token of tokens) {
    token.scopePath = [...stack];

    if (token.value === "{") {
      const scopeId = nextScopeId;
      nextScopeId += 1;
      token.openedScopeId = scopeId;
      stack.push(scopeId);
      continue;
    }

    if (token.value === "}") {
      stack.pop();
    }
  }

  return [...stack];
}

function collectVariableBindings(
  tokens: readonly LexicalToken[],
  bindings: ScopeBinding[],
): void {
  for (let index = 0; index < tokens.length; index += 1) {
    const keyword = tokens[index];

    if (
      !keyword ||
      !["const", "let", "var"].includes(keyword.value)
    ) {
      continue;
    }

    const declarationScope = keyword.scopePath;
    let expectName = true;
    let parenthesisDepth = 0;
    let bracketDepth = 0;

    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      const token = tokens[cursor];

      if (!token) break;

      if (token.scopePath.length < declarationScope.length) {
        break;
      }

      if (!sameScope(token.scopePath, declarationScope)) {
        continue;
      }

      if (token.value === "(") {
        parenthesisDepth += 1;
        continue;
      }

      if (token.value === ")") {
        parenthesisDepth = Math.max(0, parenthesisDepth - 1);
        continue;
      }

      if (token.value === "[") {
        bracketDepth += 1;
        continue;
      }

      if (token.value === "]") {
        bracketDepth = Math.max(0, bracketDepth - 1);
        continue;
      }

      const atDeclarationLevel =
        parenthesisDepth === 0 && bracketDepth === 0;

      if (
        atDeclarationLevel &&
        (token.value === ";" || token.value === "\n")
      ) {
        break;
      }

      if (atDeclarationLevel && token.value === ",") {
        expectName = true;
        continue;
      }

      if (!expectName || !IDENTIFIER_PATTERN.test(token.value)) {
        continue;
      }

      const metadata = readVariableMetadata(
        tokens,
        cursor,
        declarationScope,
      );

      bindings.push({
        name: token.value,
        kind: keyword.value,
        scopePath: declarationScope,
        declaredAt: token.start,
        properties: metadata.properties,
        runtimePath: metadata.runtimePath,
      });

      expectName = false;
    }
  }
}

function readVariableMetadata(
  tokens: readonly LexicalToken[],
  nameIndex: number,
  declarationScope: readonly number[],
): {
  readonly properties?: readonly string[];
  readonly runtimePath?: string;
} {
  const equals = tokens[nameIndex + 1];

  if (
    !equals ||
    equals.value !== "=" ||
    !sameScope(equals.scopePath, declarationScope)
  ) {
    return {};
  }

  const firstValue = tokens[nameIndex + 2];

  if (!firstValue) return {};

  if (firstValue.value === "{" && firstValue.openedScopeId) {
    return {
      properties: collectObjectProperties(
        tokens,
        nameIndex + 2,
        firstValue.openedScopeId,
      ),
    };
  }

  const path: string[] = [];
  let expectIdentifier = true;

  for (let index = nameIndex + 2; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (!token || !sameScope(token.scopePath, declarationScope)) break;

    if (expectIdentifier) {
      if (!IDENTIFIER_PATTERN.test(token.value)) break;
      path.push(token.value);
      expectIdentifier = false;
      continue;
    }

    if (token.value !== ".") break;
    expectIdentifier = true;
  }

  if (path.length === 0 || expectIdentifier) return {};

  return {
    runtimePath: path.join("."),
  };
}

function collectObjectProperties(
  tokens: readonly LexicalToken[],
  openIndex: number,
  scopeId: number,
): string[] {
  const objectPath = [
    ...(tokens[openIndex]?.scopePath ?? []),
    scopeId,
  ];
  const properties = new Set<string>();

  for (let index = openIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (!token) break;

    if (
      token.value === "}" &&
      token.scopePath.length === objectPath.length &&
      sameScope(token.scopePath, objectPath)
    ) {
      break;
    }

    if (
      !sameScope(token.scopePath, objectPath) ||
      !IDENTIFIER_PATTERN.test(token.value)
    ) {
      continue;
    }

    const previous = findPreviousInScope(tokens, index, objectPath);
    const next = findNextInScope(tokens, index, objectPath);
    const startsProperty =
      !previous ||
      previous.value === "{" ||
      previous.value === "," ||
      previous.value === "\n";
    const propertyShape =
      next?.value === ":" ||
      next?.value === "(" ||
      next?.value === "," ||
      next?.value === "}";

    if (startsProperty && propertyShape) {
      properties.add(token.value);
    }
  }

  return Array.from(properties).sort();
}

function collectFunctionBindings(
  tokens: readonly LexicalToken[],
  bindings: ScopeBinding[],
): void {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token?.value !== "function") continue;

    const name = tokens[index + 1];
    const openParenIndex = findToken(tokens, index + 1, "(");

    if (name && IDENTIFIER_PATTERN.test(name.value)) {
      bindings.push({
        name: name.value,
        kind: "function",
        scopePath: token.scopePath,
        declaredAt: name.start,
      });
    }

    if (openParenIndex < 0) continue;

    const closeParenIndex = findMatchingPair(
      tokens,
      openParenIndex,
      "(",
      ")",
    );

    if (closeParenIndex < 0) continue;

    const bodyIndex = findToken(tokens, closeParenIndex + 1, "{");
    const body = tokens[bodyIndex];

    if (!body?.openedScopeId) continue;

    const bodyScope = [...body.scopePath, body.openedScopeId];

    collectParameterBindings(
      tokens,
      openParenIndex + 1,
      closeParenIndex,
      bodyScope,
      bindings,
    );
  }
}

function collectClassBindings(
  tokens: readonly LexicalToken[],
  bindings: ScopeBinding[],
): void {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    const name = tokens[index + 1];

    if (
      token?.value === "class" &&
      name &&
      IDENTIFIER_PATTERN.test(name.value)
    ) {
      bindings.push({
        name: name.value,
        kind: "class",
        scopePath: token.scopePath,
        declaredAt: name.start,
      });
    }
  }
}

function collectCatchBindings(
  tokens: readonly LexicalToken[],
  bindings: ScopeBinding[],
): void {
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== "catch") continue;

    const openParenIndex = findToken(tokens, index + 1, "(");

    if (openParenIndex < 0) continue;

    const closeParenIndex = findMatchingPair(
      tokens,
      openParenIndex,
      "(",
      ")",
    );
    const bodyIndex = findToken(tokens, closeParenIndex + 1, "{");
    const body = tokens[bodyIndex];

    if (closeParenIndex < 0 || !body?.openedScopeId) continue;

    const bodyScope = [...body.scopePath, body.openedScopeId];

    collectParameterBindings(
      tokens,
      openParenIndex + 1,
      closeParenIndex,
      bodyScope,
      bindings,
    );
  }
}

function collectArrowBindings(
  tokens: readonly LexicalToken[],
  bindings: ScopeBinding[],
): void {
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== "=>") continue;

    const body = tokens[index + 1];

    if (!body?.openedScopeId || body.value !== "{") continue;

    const bodyScope = [...body.scopePath, body.openedScopeId];
    const previous = tokens[index - 1];

    if (!previous) continue;

    if (IDENTIFIER_PATTERN.test(previous.value)) {
      bindings.push({
        name: previous.value,
        kind: "parameter",
        scopePath: bodyScope,
        declaredAt: previous.start,
      });
      continue;
    }

    if (previous.value !== ")") continue;

    const openParenIndex = findMatchingPairBackward(
      tokens,
      index - 1,
      "(",
      ")",
    );

    if (openParenIndex < 0) continue;

    collectParameterBindings(
      tokens,
      openParenIndex + 1,
      index - 1,
      bodyScope,
      bindings,
    );
  }
}

function collectParameterBindings(
  tokens: readonly LexicalToken[],
  from: number,
  to: number,
  scopePath: readonly number[],
  bindings: ScopeBinding[],
): void {
  for (let index = from; index < to; index += 1) {
    const token = tokens[index];

    if (
      token &&
      IDENTIFIER_PATTERN.test(token.value) &&
      token.value !== "this"
    ) {
      bindings.push({
        name: token.value,
        kind: "parameter",
        scopePath,
        declaredAt: token.start,
      });
    }
  }
}

function collectVisibleBindings(
  analysis: ScopeAnalysis,
): ScopeBinding[] {
  const byName = new Map<string, ScopeBinding>();

  for (const binding of analysis.bindings) {
    if (!isScopePrefix(binding.scopePath, analysis.activeScopePath)) {
      continue;
    }

    const existing = byName.get(binding.name);

    if (
      !existing ||
      binding.scopePath.length >= existing.scopePath.length
    ) {
      byName.set(binding.name, binding);
    }
  }

  return Array.from(byName.values());
}

function findVisibleBinding(
  analysis: ScopeAnalysis,
  name: string,
): ScopeBinding | undefined {
  return collectVisibleBindings(analysis).find(
    (binding) => binding.name === name,
  );
}

function resolveRuntimeAlias(
  value: string,
  cursor: number,
  expression: string,
): string {
  const root = expression.split(".")[0] ?? "";
  const analysis = analyzeScope(value, cursor);
  const binding = findVisibleBinding(analysis, root);

  if (!binding?.runtimePath) return expression;

  return expression === root
    ? binding.runtimePath
    : `${binding.runtimePath}${expression.slice(root.length)}`;
}

function resolveRuntimeTarget(
  runtimeRoot: Window,
  expression: string,
): unknown {
  const segments = expression.split(".");
  let current: unknown = runtimeRoot;
  let index = 0;

  switch (segments[0]) {
    case "window":
    case "self":
    case "globalThis":
    case "this":
      index = 1;
      break;
  }

  for (; index < segments.length; index += 1) {
    const segment = segments[index];

    if (!segment || current === null || current === undefined) {
      return undefined;
    }

    try {
      current = Reflect.get(Object(current), segment);
    } catch {
      return undefined;
    }
  }

  return current;
}

function collectRuntimePropertyDescriptors(
  target: unknown,
): Map<string, PropertyDescriptor & { value: unknown }> {
  const descriptors = new Map<
    string,
    PropertyDescriptor & { value: unknown }
  >();
  let current: object | null = Object(target);
  let depth = 0;

  while (current && depth < MAX_RUNTIME_PROTOTYPE_DEPTH) {
    try {
      for (const name of Object.getOwnPropertyNames(current)) {
        if (
          descriptors.has(name) ||
          NOISY_RUNTIME_PROPERTY_NAMES.has(name) ||
          !IDENTIFIER_PATTERN.test(name)
        ) {
          continue;
        }

        const descriptor = Object.getOwnPropertyDescriptor(current, name);

        if (!descriptor || descriptor.get || descriptor.set) {
          continue;
        }

        if ("value" in descriptor) {
          descriptors.set(
            name,
            descriptor as PropertyDescriptor & { value: unknown },
          );
        }
      }

      current = Object.getPrototypeOf(current);
    } catch {
      break;
    }

    depth += 1;
  }

  return descriptors;
}

function createPropertyCompletionItems(
  properties: readonly string[],
  prefix: string,
  detail: string,
): MaquinaCompletionItem[] {
  return properties
    .filter((name) => matchesPrefix(name, prefix))
    .sort((left, right) => compareNames(left, right, prefix))
    .slice(0, MAX_COMPLETIONS)
    .map((name) => ({
      label: name,
      type: "property",
      detail,
    }));
}

function mergeCompletionItems(
  ...collections: readonly (readonly MaquinaCompletionItem[])[]
): MaquinaCompletionItem[] {
  const result: MaquinaCompletionItem[] = [];
  const labels = new Set<string>();

  for (const collection of collections) {
    for (const item of collection) {
      if (labels.has(item.label)) continue;

      labels.add(item.label);
      result.push(item);

      if (result.length >= MAX_COMPLETIONS) {
        return result;
      }
    }
  }

  return result;
}

function compareBindings(
  left: ScopeBinding,
  right: ScopeBinding,
  prefix: string,
): number {
  const scopeDifference =
    right.scopePath.length - left.scopePath.length;

  if (scopeDifference !== 0) return scopeDifference;

  return compareNames(left.name, right.name, prefix);
}

function compareCompletionItems(
  left: MaquinaCompletionItem,
  right: MaquinaCompletionItem,
  prefix: string,
): number {
  return compareNames(left.label, right.label, prefix);
}

function compareNames(
  left: string,
  right: string,
  prefix: string,
): number {
  const leftExact = left.startsWith(prefix) ? 0 : 1;
  const rightExact = right.startsWith(prefix) ? 0 : 1;

  if (leftExact !== rightExact) return leftExact - rightExact;

  const lengthDifference = left.length - right.length;

  if (lengthDifference !== 0) return lengthDifference;

  return left.localeCompare(right);
}

function matchesPrefix(name: string, prefix: string): boolean {
  return name.toLowerCase().startsWith(prefix.toLowerCase());
}

function describeRuntimeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";

  return typeof value;
}

function findPreviousInScope(
  tokens: readonly LexicalToken[],
  from: number,
  scopePath: readonly number[],
): LexicalToken | undefined {
  for (let index = from - 1; index >= 0; index -= 1) {
    const token = tokens[index];

    if (token && sameScope(token.scopePath, scopePath)) {
      return token;
    }
  }

  return undefined;
}

function findNextInScope(
  tokens: readonly LexicalToken[],
  from: number,
  scopePath: readonly number[],
): LexicalToken | undefined {
  for (let index = from + 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token && sameScope(token.scopePath, scopePath)) {
      return token;
    }
  }

  return undefined;
}

function findToken(
  tokens: readonly LexicalToken[],
  from: number,
  value: string,
): number {
  for (let index = from; index < tokens.length; index += 1) {
    if (tokens[index]?.value === value) return index;
  }

  return -1;
}

function findMatchingPair(
  tokens: readonly LexicalToken[],
  openIndex: number,
  open: string,
  close: string,
): number {
  let depth = 0;

  for (let index = openIndex; index < tokens.length; index += 1) {
    const value = tokens[index]?.value;

    if (value === open) depth += 1;
    if (value === close) depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

function findMatchingPairBackward(
  tokens: readonly LexicalToken[],
  closeIndex: number,
  open: string,
  close: string,
): number {
  let depth = 0;

  for (let index = closeIndex; index >= 0; index -= 1) {
    const value = tokens[index]?.value;

    if (value === close) depth += 1;
    if (value === open) depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

function sameScope(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return left.length === right.length && isScopePrefix(left, right);
}

function isScopePrefix(
  prefix: readonly number[],
  value: readonly number[],
): boolean {
  if (prefix.length > value.length) return false;

  for (let index = 0; index < prefix.length; index += 1) {
    if (prefix[index] !== value[index]) return false;
  }

  return true;
}

function skipQuotedValue(
  source: string,
  start: number,
  quote: number,
): number {
  let index = start + 1;

  while (index < source.length) {
    const code = source.charCodeAt(index);

    if (code === 92) {
      index += 2;
      continue;
    }

    index += 1;

    if (code === quote) break;
  }

  return index;
}

function isWhitespace(code: number): boolean {
  return code === 9 || code === 11 || code === 12 || code === 32;
}

function isIdentifierStart(code: number): boolean {
  return (
    code === 36 ||
    code === 95 ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isIdentifierPart(code: number): boolean {
  return isIdentifierStart(code) || (code >= 48 && code <= 57);
}
