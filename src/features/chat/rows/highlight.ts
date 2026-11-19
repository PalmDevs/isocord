import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import lua from 'highlight.js/lib/languages/lua'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import type { SyntaxToken } from './rows'

// The reference client does not highlight code; this is a small addition, so only common languages are bundled.
const languages = {
    bash,
    c,
    cpp,
    csharp,
    css,
    diff,
    go,
    ini,
    java,
    javascript,
    json,
    kotlin,
    lua,
    markdown,
    php,
    python,
    ruby,
    rust,
    sql,
    swift,
    typescript,
    xml,
    yaml,
}
for (const [name, definition] of Object.entries(languages))
    hljs.registerLanguage(name, definition)

/** highlight.js class to the handful of colours the renderer's theme defines. */
const TOKENS: Record<string, SyntaxToken> = {
    keyword: 'keyword',
    'selector-tag': 'keyword',
    tag: 'keyword',
    name: 'keyword',
    string: 'string',
    regexp: 'string',
    symbol: 'string',
    addition: 'string',
    number: 'number',
    literal: 'number',
    bullet: 'number',
    comment: 'comment',
    quote: 'comment',
    doctag: 'comment',
    title: 'title',
    section: 'title',
    attr: 'title',
    attribute: 'title',
    property: 'title',
    variable: 'title',
    'selector-class': 'title',
    'selector-id': 'title',
    meta: 'meta',
    built_in: 'meta',
    type: 'meta',
    deletion: 'meta',
}

const ENTITIES: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#x27;': "'",
}
const decodeEntities = (text: string) =>
    text.replace(
        /&(?:lt|gt|amp|quot|#x27);/g,
        entity => ENTITIES[entity] ?? entity,
    )

interface CodeRun {
    text: string
    token?: SyntaxToken
}

/** Colours `code` as `language`, or returns it as one plain run when the language is unknown. */
export function highlightCode(
    code: string,
    language: string | undefined,
): CodeRun[] {
    if (!language || !hljs.getLanguage(language)) return [{ text: code }]
    let html: string
    try {
        html = hljs.highlight(code, { language, ignoreIllegals: true }).value
    } catch {
        return [{ text: code }]
    }
    const runs: CodeRun[] = []
    const stack: Array<SyntaxToken | undefined> = []
    for (const part of html.split(/(<span class="[^"]*">|<\/span>)/)) {
        if (part === '') continue
        if (part === '</span>') {
            stack.pop()
            continue
        }
        const open = /^<span class="([^"]*)">$/.exec(part)
        if (open) {
            const classes = (open[1] ?? '')
                .split(' ')
                .map(name => name.replace(/^hljs-/, ''))
            const mapped = classes
                .map(name => TOKENS[name])
                .find(token => token !== undefined)
            // Unmapped spans (substitutions, punctuation) keep the colour around them.
            stack.push(mapped ?? stack.at(-1))
            continue
        }
        const token = stack.at(-1)
        const text = decodeEntities(part)
        const previous = runs.at(-1)
        if (previous && previous.token === token) previous.text += text
        else runs.push(token ? { text, token } : { text })
    }
    return runs
}
