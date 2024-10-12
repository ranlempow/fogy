

const {EditorState, StateField} = CM['@codemirror/state'];
const {EditorView, keymap, drawSelection, dropCursor, runScopeHandlers,
       highlightActiveLine, highlightSpecialChars, ViewPlugin} = CM['@codemirror/view'];
const {defaultKeymap, indentWithTab, history, historyField,
        undoDepth, redoDepth, undo, redo,
        cursorLineUp,  cursorLineDown} = CM['@codemirror/commands'];
const {indentOnInput, indentUnit, LanguageDescription, bracketMatching,
       syntaxTree, ParseContext,
       syntaxHighlighting, defaultHighlightStyle} = CM['@codemirror/language'];
const {javascript} = CM['@codemirror/lang-javascript'];
const {markdown, markdownLanguage} = CM['@codemirror/lang-markdown'];
const {css} = CM["@codemirror/lang-css"];
const {tagHighlighter, tags, classHighlighter, highlightTree} = CM['@lezer/highlight'];
const {parseMixed} = CM['@lezer/common'];

const t = tags;
const javascriptLanguage = javascript();
const cssLanguage = css();



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



// TODO: need test
const tagNameRegex = /^<(\w+)[^>]*>\s*$/;
const RawHTMLTags = [
    'title', 'textarea', 'style', 'xmp', 'iframe', 'noembed', 'noframes',
    'script', 'plaintext',
]
const BlockHtmlConfig = {
    // Disallowed Raw HTML Extension
    // <title>
    // <textarea>
    // <style>
    // <xmp>
    // <iframe>
    // <noembed>
    // <noframes>
    // <script>
    // <plaintext>
    parseBlock: [{
        name: "BlockHtml",
        parse(cx, line) {
            if (!line.next === 60 /* '<' */) return false;
            let m = line.text.match(tagNameRegex);
            if (!m) return false;
            const tagname = m[1];
            if (!RawHTMLTags.includes(tagname)) return false;

            const start = cx.lineStart + line.pos;

            for (; cx.nextLine();) {
                if (line.text.endsWith(`</${tagname}>`)) {
                    cx.nextLine();
                    break;
                }
            }
            cx.addNode('HTMLBlock', start, cx.lineStart + line.pos);
            return true;
        },
        after: "SetextHeading",
    }],
}


function parse_attrs(cx, string, start) {
    let re = /\s*([.#]\w+|\w+=\w+|\w+="[^"]*"|\w+|)/g, m;
    let attrs = [];
    while(re.lastIndex < string.length && (m = re.exec(string))) {
        if (m[1].length === 0) break;
        let pos = start + m.index + m[0].length - m[1].length;
        let range = [pos, pos + m[1].length];
        let e;
        switch(m[1][0]) {
            case '#':
                e = cx.elt("ElementID", ...range);
                break
            case '.':
                e = cx.elt("ElementClass", ...range);
                break
            default:
                e = cx.elt("ElementAttribute", ...range);
        }
        attrs.push(e);
    }
    if (re.lastIndex >= string.length) {
        return attrs;
    }
}

class AttributeParser {
    nextLine() { return true; }

    finish(cx, leaf) {
        const attrs = parse_attrs(cx, leaf.content.slice(1, -1), leaf.start + 1);
        if (attrs === undefined) {
            return false;
        } else {
            cx.addLeafElement(leaf, cx.elt('Attribute', leaf.start, leaf.start + leaf.content.length, [
                ...attrs,
            ]));
            return true;
        }
    }
}
// 規格書: https://mb21.github.io/stmd/spec.html#attributes
// 但因為簡化，其實並沒有符合規格，不能斷行
// {hidden no-render}
const AttributeConfig = {
    defineNodes: [
        {name: "Attribute", block: true, style: t.list},
        {name: "InlineAttribute", style: t.list},
        {name: "ElementID", style: t.atom},
        {name: "ElementClass", style: t.atom},
        {name: "ElementAttribute", style: t.atom},
    ],
    parseBlock: [{
        name: "Attribute",
        leaf(cx, leaf) {
            return /^\{[^}]+\}$/.test(leaf.content) ? new AttributeParser : null
        },
        endLeaf(cx, line, leaf) {
            return true;
        },
        after: "SetextHeading"
    }],
    parseInline: [{
        name: "InlineAttribute",
        parse(cx, next, pos) {
            let left = 1, right = 0;
            let p = pos;
            if (cx.char(p) != 123 /* '{' */) return -1;
            while((p += 1) < cx.end) {
                const c = cx.char(p);
                if (c == 123  /* '{' */) left += 1;
                if (c == 125  /* '}' */) right += 1;
                if (left == right) {
                    const string = cx.text.slice(pos + 1 - cx.offset, p - cx.offset);
                    const attrs = parse_attrs(cx, string, pos + 1);
                    return cx.addElement(cx.elt("InlineAttribute", pos, p + 1, [
                        ...attrs
                    ]));
                }
            }
            return -1;
        },
    }],
};

const InterpolationConfig = {
    defineNodes: [
        {name: "Interpolation", style: t.character},
        {name: "JsCode", style: t.character},
    ],
    parseInline: [{
        name: "Interpolation",
        parse(cx, next, pos) {
            let left = 1, right = 0;
            if (next != 36 /* '$' */) return -1;
            let p = pos + 1;
            if (cx.char(p) != 123 /* '{' */) return -1;

            while((p += 1) < cx.end) {
                const c = cx.char(p);
                if (c == 123  /* '{' */) left += 1;
                if (c == 125  /* '}' */) right += 1;
                if (left == right) {
                    return cx.addElement(cx.elt("Interpolation", pos, p + 1, [
                        cx.elt("JsCode", pos + 2, p),
                    ]));
                }
            }
            return -1;
        },
    }],
    wrap: parseMixed((node) => {
        if (node.type.name === 'JsCode') {
            return { parser: javascriptLanguage.language.parser };
        }
        // console.log('parseMixed', node.type.name);
        return null;
    }),
};

const markdownSupport = markdown({ base: markdownLanguage });

const languages = [
  LanguageDescription.of({
    name: "JavaScript",
    alias: ["ecmascript","js","node"],
    extensions: ["js", "mjs", "cjs"],
    support: javascriptLanguage,
    load() {
      return Promise.resolve(javascriptLanguage);
    }
  }),
  LanguageDescription.of({
    name: "CSS",
    extensions: ["css"],
    support: cssLanguage,
    load() {
      return Promise.resolve(cssLanguage);
    }
  }),
  LanguageDescription.of({
    name: "Markdown",
    extensions: ["md", "markdown", "mkd"],
    support: markdownSupport,
    load() {
        return Promise.resolve(markdownSupport);
    }
  }),
]


// let found = LanguageDescription.matchLanguageName(languages, 'js', true);
// console.log(found);
// console.log(found.support.language.parser);
// found = ParseContext.getSkippingParser(found.load())
// console.log(found);

function ExtraLanguageConfig(languages) {
    let codeParser = (info) => {
        if (info && languages) {
          let found = null
          // Strip anything after whitespace
          let xinfo = /\S*/.exec(info)
          info = xinfo ? xinfo[0] : info;
          if (typeof languages == "function") found = languages(info)
          else found = LanguageDescription.matchLanguageName(languages, info, true)
          if (found instanceof LanguageDescription)
            return found.support ? found.support.language.parser : ParseContext.getSkippingParser(found.load())
          else if (found)
            return found.parser
        }
        return null;
        // return defaultLanguage ? defaultLanguage.parser : null
    };
    let wrap = parseMixed((node, input) => {
        // if (codeParser && (node.type.name === 'CodeBlock' ||
        //                    node.type.name === 'FencedCode')) {
        if (codeParser && node.type.name === 'CodeText') {
            let block = node.node.parent;
            console.log(node.node.parent);
            let info = ""
            let infoNode = block.getChild('CodeInfo')
            if (infoNode) info = input.read(infoNode.from, infoNode.to)
            let parser = codeParser(info)
            if (parser) {
                return {parser}
            }
        }
        return null;
    })
    return {wrap};
}

const markdownLangSupport =
    markdown({
        // codeLanguages: languages,
        // codeLanguages: (info) => found.support.language.parser,
        base: markdownLanguage,
        extensions:[AttributeConfig, InterpolationConfig,
                    ExtraLanguageConfig(languages)]});


function _test() {
    let parser = markdownLangSupport.language.parser;
    const text = `
<div class="a" b=\${c}>\${d}<div>

a

</div>

b

</div>

\`\`\`markdown xbb=1
## bbb
\`\`\`
\${a + 1}\${''}
xxx **yyy**{ #a c="b" .x.y } cc
> ## a
> b
`

    const tree = parser.parse(text);
    const cursor = tree.cursor();
    do {
        console.log(cursor.type.name, cursor.from, cursor.to,
                    text.slice(cursor.from, cursor.to));
        // enter
        if (cursor.type.name === 'HTMLBlock') {
            cursor.enter(cursor.to, -1);
            continue;
        } else if (cursor.type.name === 'CodeText') {
            cursor.enter(cursor.to, -1);
            continue;
        }
    } while(cursor.next());

    // console.log(tree.resolveInner(1, -1).parent);
    // let n = tree.resolveInner(3, -1);
    // while (n) {
    //     console.log('name', n.name);
    //     n = n.parent;
    // }
    // console.log(tree.resolveInner(2, -1).name);
    // console.log(tree.resolveInner(3, -1).name);
    // console.log(tree.resolveInner(4, -1).name);
    // console.log(tree.resolveInner(6, -1).name);
    // console.log(tree.resolveInner(7, -1).name);
}













const scrollableEditorStyle = EditorView.theme({
    "&": {maxHeight: "100%"},
    ".cm-scroller": {overflow: "auto"},
})

const docSizePlugin = ViewPlugin.fromClass(class {
    constructor(view) {
        // this.dom = view.dom.appendChild(document.createElement("div"))
        // this.dom.style.cssText =
        //     "position: absolute; inset-block-start: 2px; inset-inline-end: 5px"
        // this.dom.textContent = view.state.doc.length
    }

    update(update) {

        // console.log('update', update);
        if (update.docChanged) {

        }
        //     this.dom.textContent = update.state.doc.length
    }
    destroy() {
        // this.dom.remove()
    }
}, {
    eventHandlers: {
        scroll: function (e, view) {
            // console.log('scroll', e);
            view.requestMeasure({
                read(view) {
                    // console.log(view.state.doc);
                    // const range = view.state.selection.ranges[view.state.selection.mainIndex];
                    const height = view.scrollDOM.scrollTop;
                    const pos = view.lineBlockAtHeight(height).from;
                    const {number: lineno, text} = view.state.doc.lineAt(pos);
                    // console.log(range.from, height, lineno);
                    view.scrollPos = {
                        size: view.state.doc.length,
                        pos,
                        lineno,
                    }
                },
                key: 'mm',
            });
        }
    }
});



function computeUsableCommand(state) {
    const usable = {};
    const head = state.selection.main.head;
    const tree = syntaxTree(state);
    let nodeBefore = tree.resolveInner(head, -1);
    while (nodeBefore) {
        if (nodeBefore.name.startsWith('ATXHeading')) {

        } else if (nodeBefore.name === 'Emphasis') {    // *

        } else if (nodeBefore.name === 'StrongEmphasis') {    // **

        } else if (nodeBefore.name === 'Strikethrough') {    // ~~

        } else if (nodeBefore.name === 'Blockquote') {  // >

        } else if (nodeBefore.name === 'InlineCode') {  // `

        } else if (nodeBefore.name === 'FencedCode') {  // ```

        } else if (nodeBefore.name === 'BulletList') {  // -

        } else if (nodeBefore.name === 'OrderedList') {  // 1.

        } else if (nodeBefore.name === 'Link') {

        } else if (nodeBefore.name === 'Image') {

        } else if (nodeBefore.name === 'Table') {

        } else if (nodeBefore.name === 'HorizontalRule') {

        } else if (nodeBefore.name === 'Document') {

        }
        nodeBefore = nodeBefore.parent;
    }

    if (undoDepth(state) > 0) {
        usable.undo = { stateCommand: undo };
    }
    if (undoDepth(state) > 0) {
        usable.redo = { stateCommand: redo };
    }
}


const usableCommand = StateField.define({
    create(state) {
        return computeUsableCommand(state);
    },
    update(value, tr) {
        const state = tr.state;
        return computeUsableCommand(state);
    },
})


class ExtendedState {
    static fields = {history: historyField};
    static extensions = [
        markdownLangSupport,
        // syntaxHighlighting(defaultHighlightStyle),
        syntaxHighlighting(classHighlighter2),
        keymap.of(indentWithTab),
        keymap.of(defaultKeymap),
        indentOnInput(),
        drawSelection(),
        dropCursor(),
        history(),
        highlightActiveLine(),
        highlightSpecialChars(),
        EditorState.tabSize.of(4),
        indentUnit.of('    '),
        bracketMatching(),
        EditorView.theme(),
        // EditorView.updateListener.of((v) => {
        //     if (v.docChanged) {
        //         console.log(v);
        //     }
        // }),
        scrollableEditorStyle,
        docSizePlugin,
    ];
    constructor({viewstate, scrollPos, stateData, text}) {
        this.dirty = false;
        this.viewstate = viewstate;
        this.scrollPos = scrollPos;
        this.extensions = ExtendedState.extensions.slice();
        this.extensions.push(EditorView.updateListener.of((v) => {
            if (v.docChanged) {
                this.dirty = true;
            }
            if (this.project) {
                this.project.update(v);
            }
        }))
        if (!this.viewstate) {
            if (stateData) {
                this.viewstate = EditorState.fromJSON(stateData, {
                    extensions: this.extensions,
                }, ExtendedState.fields);
            } else if (text) {
                this.viewstate = EditorState.create({
                    doc: text,
                    extensions: this.extensions,
                });
            } else {
                throw new Error('viewstate not given');
            }
        }
    }
    static fromText(text) {
        scrollPos = { size: text.length, pos:0, lineno:1 };
        return new ExtendedState({text, scrollPos});
    }

    static fromView(view) {
        const { scrollPos = null } = view;
        scrollPos ||= { size: view.state.doc.length, pos:0, lineno:1 };
        return new ExtendedState({viewstate:view.state, scrollPos});
    }
    static fromJSON(object) {
        return new ExtendedState(object);
    }

    updateFromView(view) {
        const { scrollPos = null } = view;
        this.scrollPos = view.scrollPos || { size: view.state.doc.length, pos:0, lineno:1 };
        this.viewstate = view.state;
    }

    toJSON() {
        return {
            stateData: this.viewstate.toJSON(fields),
            scrollPos: this.scrollPos,
        };
    }

    setViewState(view) {
        const {viewstate, scrollPos} = this;
        view.setState(viewstate);
        let pos;
        if (scrollPos.size === viewstate.doc.length) {
            pos = scrollPos.pos;
        } else {
            const line = viewstate.doc.line(scrollPos.lineno);
            pos = line.from;
        }
        view.update([
            EditorView.scrollIntoView(pos, {y:'start', x:'start'})
        ])
    }
}

class RunnerState {

}




class PageMeta {
    constructor() {
        // origin commit
        this.base_commit = null;
        // current commit. if commit is 'null', file content is in dirty state.
        this.commit = null;
        // list of recent commits.
        this.history = [];
        // anyone that is not owner change file content, may cause a waring.
        this.owner = null;
        this._path = '';
        this.sha = '';
        this.title = '';
        this.tags = [];

        // for collab function in the future.
        // updates from base commit to now.
        this._updates = [];

        // other metadata
        this.data = {};
    }
    get path() {
        return this._path;
    }
}


// TODO: new item
//       move/delete item
//       rename item
//       select item

class ProjectState {
    constructor(name) {
        this.name = name
        this.key = `project-state-${name}`;
        this.flattree = LocalStorageFlatTree.fetch(`${this.key}.flattree`);
        // this.opened 裡面也可以有 RunnerState
        // 左邊tabs
        this.opened = {};
        // 右邊tabs
        this.previews = {};

        this.focused = null;
        this.view = null;

        // TODO:
        // metadata包含build資訊
        // metadata是一種cache
        this.metadatas = {};
        this.compileUnits = {};

        this.runners = {};
        this.output = {};
    }

    async sync() {
        const folders = this.flattree.fold();
        // unit/..
        // unit/<subunit>
        // unit/variable.json
        // unit/<plugin>.variable.json
        // unit/<page>.page.md
        // unit/<build>.build.json
        // unit/<build>.render.js
        // unit/<file>
        for (const [dirname, items] of folders.entries()) {
            if (items.includes('variables.json')) {
                // make compile unit
                if (!this.compileUnits[dirname]) {
                    this.compileUnits[dirname] = new CompileUnit(this, dirname);
                }
                const unit = this.compileUnits[dirname];
                const metadata = this.metadatas[dirname] ||= {};
                // make metadata
                for (const basename of items) {
                    const path = `${dirname}/${basename}`;
                    if (basename.endsWith('.page.md')) {
                        const sha = this.flattree.getSHA(path);
                        console.assert(sha !== undefined);
                        const meta = metadata[basename];
                        if (!meta || meta.sha !== sha) {
                            // compile and update metadata

                        }
                    } else if (basename.endsWith('.variable.json')) {

                    } else if (basename.endsWith('build.json')) {

                    } else {
                        unit.otherFiles.push(basename);
                    }

                }
            }
        }
    }

    static async fetch(name) {
        const project = new ProjectState(name);
        const str = window.localStorage.getItem(project.key);
        let data = {}
        if (str !== undefined) {
            data = JSON.parse(str);
        }
        for (const [path, extdata] of Object.entries(data.opened || {})) {
            const text = await FlatTreeBase.dbget(extdata.stateData.sha);
            extdata.stateData.doc = text;
            const extstate = ExtendedState.fromJSON(extdata);
            extstate.project = project;
            project.opened[path] = extstate;
        }
        if (data.focused) {
            project.focus(data.focused);
        }
        if (data.metadatas) {
            project.metadatas = data.metadatas;
        }
        await project.sync();
    }

    async focus(path) {
        const old_focused = this.focused;
        this.focused = path;
        if (!this.opened[this.focused]) {
            this.focused = null;
        }
        if (old_focused && this.opened[old_focused]) {
            this.opened[old_focused].updateFromView(this.view);
        }
        if (!this.focused) {
            if (this.view) {
                this.view.destroy();
                this.view = null;
            }
        } else {
            if (!this.view) {
                this.view = new EditorView({
                    parent: document.getElementById('editor'),
                });
            }
            this.opened[this.focused].setViewState(this.view);
            this.view.focus();
        }
    }

    async close(path) {
        // TODO: save?
        let paths = Object.keys(this.opened);
        let index = paths.indexOf(path)
        if (index != -1) {
            delete this.opened[path];
        }
        if (paths.length === 1) {
            this.focus(null);
        } else if (index === 0) {
            this.focus(paths[1]);
        } else {
            this.focus(paths[index - 1]);
        }
    }

    async open(path, focused = true, commit = null) {
        if (!this.opened[path]) {
            const text = await this.flattree.read(path);
            const extstate = ExtendedState.fromText(text);
            extstate.project = this;
            this.opened[path] = extstate;
        }
        if (focused) {
            this.focus(path);
        }
    }

    async save(path) {
        if (!this.opened[path] || !this.opened[path].dirty) return;
        const state = this.opened[path].viewstate;
        await this.flattree.write(path, state.doc);
        await this.flattree.commit();
        this.opened[path].dirty = false;
    }

    async commit() {
        if (this.focused) {
            this.opened[this.focused].updateFromView(this.view);
        }
        const opened = {};
        const pages = Object.entries(this.opened).map(
            ([path, extstate]) => [path, extstate.toJSON()])
        const keys = await FlatTreeBase.dbkeys();

        for (const [path, extdata] of pages) {
            const text = extdata.stateData.doc;
            delete extdata.stateData.doc;
            const file_sha = await FlatTreeBase.gitDigestMessage(text);
            if (!keys.includes(file_sha)) {
                await FlatTreeBase.dbset(file_sha, text);
                keys.push(file_sha);
            }
            extdata.stateData.sha = file_sha;
            opened[path] = extdata;
        }
        const str = JSON.stringify({opened, focused: this.focused});
        window.localStorage.setItem(this.key, str);
    }

    update(v) {
        this.commit();
    }

    register() {
        this.state = emptyStateWithKeymap;
        this.el.addEventListener('keydown', (event) => {
            // runScopeHandlers(view: EditorView, event: KeyboardEvent, scope: string) → boolean
            if (runScopeHandlers(this, event, 'editor')) {
                evnet.preventDefault();
            }
        });
    }
}


// let myState = EditorState.create({
//     doc: "Hello World\n".repeat(10000),
//     extensions: ExtendedState.extensions,
// });
// const text = "Hello World\n".repeat(10000);
// document.addEventListener("DOMContentLoaded", function() {
//     let myView = new EditorView({
//         state: myState,
//         parent: document.getElementById('editor'),
//     });
//     // console.time('setState');
//     // let myState2 = EditorState.create({
//     //     doc: text,
//     //     extensions,
//     // });
//     // myView.setState(myState2);
//     // console.timeEnd('setState');
//     // editor.scrollDOM.getBoundingClientRect().top
//     // console.log(myState.toJSON({'undo': historyField}));
// });

// eval('"use strict"; e=4');

