

const {EditorState} = CM['@codemirror/state'];
const {EditorView, keymap, drawSelection, dropCursor,
       highlightActiveLine, highlightSpecialChars} = CM['@codemirror/view'];
const {defaultKeymap, indentWithTab, history} = CM['@codemirror/commands'];
const {indentOnInput, indentUnit, LanguageDescription, bracketMatching,
       syntaxHighlighting, defaultHighlightStyle} = CM['@codemirror/language'];
const {javascriptLanguage} = CM['@codemirror/lang-javascript'];
const {markdown, markdownLanguage} = CM['@codemirror/lang-markdown'];
const {tagHighlighter, tags, classHighlighter, highlightTree} = CM['@lezer/highlight'];




const languages = [
  LanguageDescription.of({
    name: "JavaScript",
    alias: ["ecmascript","js","node"],
    extensions: ["js", "mjs", "cjs"],
    load() {
      return Promise.resolve(CM["@codemirror/lang-javascript"].javascript());
    }
  }),
  LanguageDescription.of({
    name: "CSS",
    extensions: ["css"],
    load() {
      return Promise.resolve(CM["@codemirror/lang-css"].css());
    }
  }),

]

// 參考 https://github.com/lezer-parser/highlight/blob/main/src/highlight.ts#L396
const classHighlighter2 = tagHighlighter([
  {tag: tags.link, class: "tok-link"},
  {tag: tags.heading, class: "tok-heading"},
  {tag: tags.emphasis, class: "tok-emphasis"},
  {tag: tags.strong, class: "tok-strong"},
  {tag: tags.keyword, class: "tok-keyword"},
  {tag: tags.atom, class: "tok-atom"},
  {tag: tags.bool, class: "tok-bool"},
  {tag: tags.url, class: "tok-url"},
  {tag: tags.labelName, class: "tok-labelName"},
  {tag: tags.inserted, class: "tok-inserted"},
  {tag: tags.deleted, class: "tok-deleted"},
  {tag: tags.literal, class: "tok-literal"},
  {tag: tags.string, class: "tok-string"},
  {tag: tags.number, class: "tok-number"},
  {tag: [tags.regexp, tags.escape, tags.special(tags.string)], class: "tok-string2"},
  {tag: tags.variableName, class: "tok-variableName"},
  {tag: tags.local(tags.variableName), class: "tok-variableName tok-local"},
  {tag: tags.definition(tags.variableName), class: "tok-variableName tok-definition"},
  {tag: tags.special(tags.variableName), class: "tok-variableName2"},
  {tag: tags.definition(tags.propertyName), class: "tok-propertyName tok-definition"},
  {tag: tags.typeName, class: "tok-typeName"},
  {tag: tags.namespace, class: "tok-namespace"},
  {tag: tags.className, class: "tok-className"},
  {tag: tags.macroName, class: "tok-macroName"},
  {tag: tags.propertyName, class: "tok-propertyName"},
  {tag: tags.operator, class: "tok-operator"},
  {tag: tags.comment, class: "tok-comment"},
  {tag: tags.meta, class: "tok-meta"},
  {tag: tags.invalid, class: "tok-invalid"},
  {tag: tags.punctuation, class: "tok-punctuation"},
  {tag: tags.monospace, class: "tok-monospace"},
])


// function runmode(textContent: string,
//                  language: Language,
//                  callback: (text: string, style: string, from: number, to: number) => void) {
function runmode(textContent, language, callback) {
    language = language?.language || language;
    const tree = language.parser.parse(textContent);
    let pos = 0;
    highlightTree(tree, classHighlighter2, (from, to, classes) => {
        from > pos && callback(textContent.slice(pos, from), null, pos, from);
        callback(textContent.slice(from, to), classes, from, to);
        pos = to;
    });
    pos != tree.length && callback(textContent.slice(pos, tree.length), null, pos, tree.length);
}


// let result = [];
// runmode('let i = 1;\n function a() {};', javascriptLanguage, (...args) => result.push(args));
// console.log(result);
// console.log(markdown({codeLanguages: languages, base: markdownLanguage}));

let myState = EditorState.create({
    doc: "Hello World",
    extensions: [
        markdown({codeLanguages: languages, base: markdownLanguage}),
        // syntaxHighlighting(defaultHighlightStyle),
        syntaxHighlighting(classHighlighter2),
        keymap.of([defaultKeymap, indentWithTab]),
        indentOnInput(),
        drawSelection(),
        dropCursor(),
        history(),
        highlightActiveLine(),
        highlightSpecialChars(),
        // EditorState.tabSize.of(8),
        indentUnit.of('    '),
        bracketMatching(),
        EditorView.theme(),
        EditorView.updateListener.of((v) => {
            if (v.docChanged) {
                console.log(v);
            }
        })
    ]
});

let myView = new EditorView({
    state: myState,
    parent: document.body
});