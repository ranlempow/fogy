const {EditorState, StateField} = CM['@codemirror/state'];
// const {EditorView, keymap, drawSelection, dropCursor, runScopeHandlers,
//        highlightActiveLine, highlightSpecialChars, ViewPlugin} = CM['@codemirror/view'];
// highlightActiveLine(),
// highlightSelectionMatches(),
const {keymap, highlightActiveLine} = CM['@codemirror/view'];
const {EditorView, basicSetup, minimalSetup} = CM['codemirror'];
const {highlightSelectionMatches} = CM['@codemirror/search'];
const {defaultKeymap, history, historyKeymap} = CM['@codemirror/commands'];
const {javascript} = CM['@codemirror/lang-javascript'];
const {css} = CM["@codemirror/lang-css"];
const {oneDarkTheme} = CM["@codemirror/theme-one-dark"];
const {defaultHighlightStyle, syntaxHighlighting, bracketMatching} = CM['@codemirror/language'];

function createCodeMirrorEditor(change, doc) {
    let baseTheme = EditorView.baseTheme({
      ".cm-o-replacement": {
        display: "inline-block",
        width: ".5em",
        height: ".5em",
        borderRadius: ".25em"
      },
      "&light .cm-o-replacement": {
        backgroundColor: "#04c"
      },
      "&dark .cm-o-replacement": {
        backgroundColor: "#5bf"
      }
    });
    let state = EditorState.create({
        // doc: output,
        extensions: [
            // oneDarkTheme,
            history(),
            syntaxHighlighting(defaultHighlightStyle),
            bracketMatching(),
            css(),
            EditorState.tabSize.of(4),
            EditorView.updateListener.of(e => {
                change && change(e);
                // if (e.docChanged) {
                //     console.log(e);
                //     console.log(e.state.doc.toString())
                // }
            }),
            highlightActiveLine(),
            highlightSelectionMatches(),
            keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
            ]),
        ]
    })

    let view = new EditorView({
        state,
    });
    view.dispatch({changes: {
      from: 0,
      to: view.state.doc.length,
      insert: doc ?? '',
    }})
    return view;
}

