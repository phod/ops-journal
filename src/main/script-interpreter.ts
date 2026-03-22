// Simple, safe script interpreter for function tools.
// Supports: var declarations, string literals, string concatenation (+),
// variable references, copy() and openLink() built-in calls.
// No eval/Function — fully parsed and evaluated.

export interface ScriptAction {
  type: 'copy' | 'openLink'
  value: string
}

// --- Tokenizer ---

type TokenType =
  | 'var' | 'identifier' | 'string' | 'plus' | 'equals'
  | 'semicolon' | 'lparen' | 'rparen' | 'eof'

interface Token {
  type: TokenType
  value: string
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < source.length) {
    // Skip whitespace
    if (/\s/.test(source[i])) { i++; continue }

    // Skip single-line comments
    if (source[i] === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++
      continue
    }

    // String literals
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i]
      i++
      let str = ''
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < source.length) {
          i++
          if (source[i] === 'n') str += '\n'
          else if (source[i] === 't') str += '\t'
          else str += source[i]
        } else {
          str += source[i]
        }
        i++
      }
      if (i >= source.length) throw new Error('Unterminated string literal')
      i++ // closing quote
      tokens.push({ type: 'string', value: str })
      continue
    }

    // Single-char tokens
    if (source[i] === '+') { tokens.push({ type: 'plus', value: '+' }); i++; continue }
    if (source[i] === '=') { tokens.push({ type: 'equals', value: '=' }); i++; continue }
    if (source[i] === ';') { tokens.push({ type: 'semicolon', value: ';' }); i++; continue }
    if (source[i] === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue }
    if (source[i] === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue }

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(source[i])) {
      let ident = ''
      while (i < source.length && /[a-zA-Z0-9_$]/.test(source[i])) {
        ident += source[i]
        i++
      }
      tokens.push({ type: ident === 'var' ? 'var' : 'identifier', value: ident })
      continue
    }

    throw new Error(`Unexpected character: '${source[i]}'`)
  }

  tokens.push({ type: 'eof', value: '' })
  return tokens
}

// --- Parser ---

type Expr = { kind: 'string'; value: string } | { kind: 'variable'; name: string } | { kind: 'concat'; left: Expr; right: Expr }
type Statement = { kind: 'varDecl'; name: string; expr: Expr } | { kind: 'call'; name: string; arg: Expr }

function parse(tokens: Token[]): Statement[] {
  let pos = 0
  const statements: Statement[] = []

  function peek(): Token { return tokens[pos] }
  function advance(): Token { return tokens[pos++] }
  function expect(type: TokenType): Token {
    const t = advance()
    if (t.type !== type) throw new Error(`Expected ${type}, got ${t.type} ('${t.value}')`)
    return t
  }

  function parseExpr(): Expr {
    let left = parsePrimary()
    while (peek().type === 'plus') {
      advance()
      const right = parsePrimary()
      left = { kind: 'concat', left, right }
    }
    return left
  }

  function parsePrimary(): Expr {
    const t = peek()
    if (t.type === 'string') {
      advance()
      return { kind: 'string', value: t.value }
    }
    if (t.type === 'identifier') {
      advance()
      return { kind: 'variable', name: t.value }
    }
    throw new Error(`Unexpected token: ${t.type} ('${t.value}')`)
  }

  while (peek().type !== 'eof') {
    const t = peek()

    if (t.type === 'var') {
      advance()
      const name = expect('identifier').value
      expect('equals')
      const expr = parseExpr()
      expect('semicolon')
      statements.push({ kind: 'varDecl', name, expr })
    } else if (t.type === 'identifier') {
      const name = advance().value
      expect('lparen')
      const arg = parseExpr()
      expect('rparen')
      expect('semicolon')
      statements.push({ kind: 'call', name, arg })
    } else {
      throw new Error(`Unexpected token: ${t.type} ('${t.value}')`)
    }
  }

  return statements
}

// --- Evaluator ---

function evaluate(statements: Statement[], paramValues: Record<string, string>): ScriptAction[] {
  const scope: Record<string, string> = { ...paramValues }
  const actions: ScriptAction[] = []

  function evalExpr(expr: Expr): string {
    switch (expr.kind) {
      case 'string': return expr.value
      case 'variable': {
        if (!(expr.name in scope)) throw new Error(`Undefined variable: '${expr.name}'`)
        return scope[expr.name]
      }
      case 'concat': return evalExpr(expr.left) + evalExpr(expr.right)
    }
  }

  for (const stmt of statements) {
    if (stmt.kind === 'varDecl') {
      scope[stmt.name] = evalExpr(stmt.expr)
    } else {
      const value = evalExpr(stmt.arg)
      if (stmt.name === 'copy') {
        actions.push({ type: 'copy', value })
      } else if (stmt.name === 'openLink') {
        actions.push({ type: 'openLink', value })
      } else {
        throw new Error(`Unknown function: '${stmt.name}'`)
      }
    }
  }

  return actions
}

// --- Public API ---

export function interpretScript(source: string, paramValues: Record<string, string>): ScriptAction[] {
  const tokens = tokenize(source)
  const statements = parse(tokens)
  return evaluate(statements, paramValues)
}
