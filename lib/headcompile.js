
const STORE = {};

async function fetch_icons(prefix, names, store) {
    store ??= STORE;
    if (!names) {
        let [_prefix, name] = prefix.split('/');
        prefix = _prefix;
        names = [name];
    }
    let path = (`https://api.iconify.design/` +
                `${prefix}.json?icons=${names.join(',')}`);
    const response = await fetch(path);
    const data = await response.json();
    const result = [];
    for (const [name, icon] of Object.entries(data.icons)) {
        let body = icon.body.replace('fill="currentColor"', '');
        let key = `${data.prefix}/${name}`;
        result.push(store.icons[key] = {
            key,
            id: `${data.prefix}-${name}`,
            width: data.width,
            height: data.height,
            symbol: `<symbol id="${data.prefix}-${name}" viewBox="0 0 ${data.width} ${data.height}">${body}</symbol>`
        });
    }
    return result;
}

async function* make_icons({variables, global}) {
    const store = global?.store ?? STORE;
    const {icons} = variables;
    if (!icons) return;
    const collections = {};
    const loaded = new Set();
    store.icons ||= {};
    for (const name of icons) {
        if (store.icons[name]) {
            loaded.add(name);
        } else {
            const [prefix, ...other] = name.split('/');
            (collections[prefix] ||= []).push(other.join('-'));
        }
    }
    // TODO: animate rotate
    // inside <p> <animateTransform attributeName="transform" attributeType="XML" type="rotate" dur="1s" from="0 50 50" to="360 50 50" repeatCount="indefinite"></animateTransform>

    const make = () => `<svg class="defs" style="display: none" mlns="http://www.w3.org/2000/svg">
${[...loaded.values()].map(n => store.icons[n]?.symbol ?? '').join('\n')}</svg>`;

    yield h(make());
    for (const [prefix, names] of Object.entries(collections)) {
        let icondatas = await fetch_icons(prefix, names, store);
        icondatas.map(d => d.key).forEach(name => loaded.add(name));
        yield h(make());
    }
}


// async function* make_style({variables, global}) {
//     const store = global.store;
//     const layer = variables.layer.slice();

//     function parse_all_style() {
//         const parser = new CSSParser();
//         const styles = [...layer.map(s => s.styletext)];
//         const styletext = parser.parse(styles);
//         return `<style>\n${styletext}\n</style>`;
//     }

//     for (const s of layer) {
//         if (s.styletext === undefined) {
//             const response = await fetch(s.path);
//             s.styletext = await response.text();
//         }
//         yield h(parse_all_style());
//     }
// }


async function* make_viewport({variables, global}) {
    const store = global?.store ?? STORE;
    store.userAgent = Navigator.userAgent;
    yield h(`<meta name="viewport" content="width=device-width, initial-scale=1" />`);
}

async function* make_manifest({variables, global}) {
    const store = global?.store ?? STORE;
    const {web_app, favicon} = variables;

    if (!web_app) return;
    const manifest = {
        name: web_app.name || 'React Doc',
        short_name: web_app.name || 'React',
        start_url: ".",
        theme_color: web_app.theme_color || '#ff00ff',
        display: web_app.display || 'standalone',
        lang: web_app.lang || 'en-us',
    };

    if (favicon) {
        // await finished(make_icons);
        // const ico = store.icons[favicon];
        const ico = (await fetch_icons(favicon))[0];
        let svg = `<svg mlns="http://www.w3.org/2000/svg" viewport="0 0 ${ico.width} ${ico.height}">${ico.body}</svg>`;
        manifest.icons = [{
            type: 'image/svg+xml',
            size: '72x72',
            src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        }]
    }
    yield `<link rel="manifest" href='data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}' />`;
}

async function* make_favicon({variables, global}) {
    const store = global?.store ?? STORE;
    const {favicon} = variables;
    if (!favicon) return;
    // await finished(make_icons);
    // const ico = store.icons[favicon];
    const ico = (await fetch_icons(favicon))[0];
    let svg = `<svg mlns="http://www.w3.org/2000/svg" viewport="0 0 ${ico.width} ${ico.height}">${ico.body}</svg>`;
    yield `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}" type="image/svg+xml" />`;
}


async function* make_fontface({variables, global}) {
    const store = global?.store ?? STORE;
    const {fontfaces} = variables;
    if (!fontfaces) return;

    // U+4E00..U+9FFF                   CJK Unified Ideographs
    // U+3400..U+4DBF                   CJK Unified Ideographs Extension A 罕見字
    // U+3000..U+303F                   CJK Symbols and Punctuation
    // U+3100..U+312F, U+31A0..U+31BF   Bopomofo
    // U+FE10..U+FE1F                   Vertical Forms 垂直括號
    // U+FE30..U+FE4F                   CJK Compatibility Forms  括號
    // U+FE50..U+FE6F                   Small Form Variants 全形括號
    // U+2000..U+2BFF                   Symbols

    const ranges = {
        latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
        cjk: 'U+4E00-9FFF, U+3000-303F, U+3100-312F, U+31A0-31BF, U+FE10-FE1F, U+FE30-FE4F, U+FE50-FE6F',
        symbol: 'U+2000-2BFF',
    }
    if (!store.fonts) {
        const response = await fetch('./os-font-list/os-font-list.json');
        store.fonts = await response.json();
    }
    let styletext = ''
    for (const fontface of fontfaces) {
        for (const fff of fontface.fonts) {
            let text = '';
            if (fff.weight) {
                text += `font-weight: ${fff.weight};\n`;
            }
            if (Object.keys(ranges).includes(fff.charset)) {
                text += `unicode-range: ${ranges[fff.charset]};\n`;
            }

            // property
            //   font-weight
            //   font-style
            //   font-stretch
            // metrics overriding
            //   size-adjust
            //   ascent-override
            //   descent-override
            // font-variant
            //   font-variant-ligatures
            //   font-variant-east-asian: traditional full-width;
            //   font-variant-numeric
            // render
            //   font-smooth: never
            //   text-rendering: optimizeLegibility
            //   -webkit-font-smoothing: antialiased
            //   -moz-osx-font-smoothing: grayscale

            const font = store.fonts[fff.font];
            if (font) {
                if (font.files['GoogleFont'] && font.files['GoogleFont'].startsWith('http://')) {
                    let file = font.files['GoogleFont'];
                    let format = file.split('.');
                    format = format[format.length-1];
                    src = `url(${file}) format('${format}')`;
                } else {
                    // src = `"${Object.values(font.files)[0]}"`;
                    src = `local("${font.family}")`;
                }
                styletext += `
                @font-face {
                    font-family: '${fontface.family}';
                    ${text}
                    src: ${src};
                }
                `;
            } else {
                throw `font '${fff.font}' not found`;
            }
        }
    }
    yield h(`<style>${styletext}</style>`);
}


async function* make_js({variables, global}) {
    const store = global?.store ?? STORE;
    const {script} = variables;
    const tags = [];
    for (const s of script) {
        if (s.path) {
            tags.push(`<script src="${s.path}"></script>`);
        } else if (s.text) {
            tags.push(`<script>${s.text}</script>`);
        }
    }
    yield h(tags);
}



function PageHead({variables, global, externals}) {
    // TODO: cache to localStorage
    // TODO: walk error? 為什麼沒有傳遞props
    let makers = [
       make_icons,
       make_viewport,
       make_manifest,
       make_favicon,
       make_fontface,
    ]
    makers.push(...externals ?? []);
    return h(makers.map(m => h(m)(p => p)));

    // return h([
    //     h(make_icons)(p => p),
    //     h(make_viewport)(p => p),
    //     h(make_manifest)(p => p),
    //     h(make_favicon)(p => p),
    //     h(make_fontface)(p => p),
    // ]);
    // let makers = {}
    // for (const m of filter_key_by_regex(variables, /make\.(.*)/)) {
    //     const maker_name = m[1];
    //     if (!makers[maker_name]) {
    //         const maker_renderer = globalThis[`maker_${maker_name}`];
    //         if (maker_renderer) {
    //             // TODO: combine getter early
    //             let r = h(maker_renderer);
    //             r = r(maker_name, r.getter);
    //             makers[maker_name] = r;
    //             // makers[maker_name] = h(maker_renderer)(maker_name, {variables});
    //         }
    //     }
    // }
    // return h([...Object.values(makers)]);
}






function jsRunner(html) {
    const state = {};
    state.done = false;
    state.id = '' + Date.now();
    state.p = new Promise((resolve, reject) => {
        state.resolve = resolve;
        state.reject = reject;
    });
    const f = (event) => {
        // if (event.origin !== "http://example.org:8080") return;
        const payload = event.data;
        if (payload.id !== state.id) return;
        if (payload.error) {
            state.reject(payload.error);
            state.done = true;
        } else {
            state.resolve(payload.data);
            if (payload.continues) {
                state.p = new Promise((resolve, reject) => {
                    state.resolve = resolve;
                    state.reject = reject;
                });
            } else {
                state.done = true;
            }
        }
    }

    window.addEventListener("message", f, false);
    html = html.replace('__STATE_ID__', `'${state.id}'`);

    state.iframe = document.createElement('iframe');
    state.iframe.setAttribute('sandbox', 'allow-scripts');
    // state.iframe.setAttribute('srcdoc', `<!DOCTYPE html><html><script>${script}</script></html>`);
    state.iframe.setAttribute('srcdoc', html);
    state.iframe.setAttribute('style', 'display: none;');
    state.run = async function* () {
        document.body.append(state.iframe);
        try {
            while(!state.done) {
                yield await state.p;
            }
        } finally {
            document.body.removeChild(state.iframe);
            window.removeEventListener("message", f, false);
        }
    }
    return state;
}




function* filter_key_by_regex(object, re) {
    for (let k of Object.keys(object)) {
        let m = re.match(k);
        if (m[0].length > 0) {
            yield m;
        }
    }
}


// Page
//   id
//   metadata
//   hash
//   text
//   renderers : ({pageId, pages, datas, variables, heads, ...}) => node



// function bootstrap() {
//     document.addEventListener("DOMContentLoaded", function() {
//         console.log('DOMContentLoaded');
//         window.addEventListener("message", function(event) {
//             console.log(event);
//             const payload = event.data;
//             if (payload.id !== STATE_ID) return;
//             const data = payload.data;
//             render(data);
//         }, false);
//     });
// }

// let ejs = new URL('../../fogy/engine.js', window.location).href;
// let html = `
// <!DOCTYPE html>
// <html>
// <script src="${ejs}"><\/script>
// <script>
// STATE_ID = __STATE_ID__;
// ${bootstrap}
// bootstrap();
// <\/script>
// </html>
// `;


// TODO: 刪除這個

class _CompileUnit {
    // 第一階段建造的部分
    // 1. text-hash heads(variables + repositories)
    //   a. binary-hash resources
    //   b. json-hash datas
    // 2. text-hash pages
    // 3. text-hash template.js
    // (X)4. json-hash build.json

    // 第二階段
    // 根據build.json設定
    // 把heads, datas, pages帶入template.js做jsRunner


    constructor(project, dirname) {
        this.project = project;
        this.dirname = dirname;

        this.subunits = [];

        // this.repositories = {};
        // this.data_sources = {};

        this.variables = {};
        this.heads = [];
        this.pages = {};
        this.runners = {};

        const renderer = h(this._makers_renderer)({variables: {}})
        this.slot = render(renderer);
        this.slot.seq.renderDoneHook = this._renderDoneHook;

    }

    open(basename) {
        let runner = this.runners[basename];
        if (!runner) {
            runner = this.runners[basename] = jsRunner(html);
            (async () => {
                for await (const data of runner.run()) {
                    console.log(data);
                    if (data.type === 'output') {
                        this.finishRunner(data.outputPath, data.text);
                    }
                }
            })();
        }
        this.send();
    }

    complie(basename) {
        const path = `${this.dirname}/${basename}`;
        const sha = this.project.flattree.getSHA(path);
        console.assert(sha !== undefined);
        let page = this.pages[basename];
        if (!page || page.sha !== sha) {
            let raw_text = this.project.flattree.read(path);
            page = this.pages[basename] = {
                // TODO:
            }
        }
    }

    send(basename) {
        const runner = this.runners[basename];
        console.assert(runner !== undefined);

        this.complie(basename);

        const metadata = this.project.metadatas[this.dirname];
        const path = `${this.dirname}/${basename}`;
        const data = {
            path: path,
            outputPath: metadata[basename].outputPath,
            page: this.pages[basename],
            heads: this.heads,
            metadata: metadata,
            metadatas: this.metadatas,
        };
        const win = runner.iframe.contentWindow;
        win.postMessage({id: runner.id, data}, '*');
    }

    finishRunner(outputPath, text) {
        this.project.output[outputPath] = text;
    }

    finishHeads() {
        this.heads = []
        for (const node of this.slot.parentNode.childNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                 this.heads.push(node.outerHTML);
            }
        }
        for (const [basename, runner] of Object.entries(this.runners)) {
            this.send(basename);
        }
    }

    _renderDoneHook(seq) {
        for (const slot of seq.asyncRunningSlots) {

        }
        if (seq.asyncRunningSlots.size === 0) {
            this.finishHeads();
        }
    }

    _makers_renderer({variables, global}) {

        let makers = {}
        for (const m of filter_key_by_regex(variables, /make\.(.*)/)) {
            const maker_name = m[1];
            if (!makers[maker_name]) {
                const maker_renderer = globalThis[`maker_${maker_name}`];
                if (maker_renderer) {
                    // TODO: combine getter early
                    let r = h(maker_renderer);
                    r = r(maker_name, r.getter);
                    makers[maker_name] = r;
                    // makers[maker_name] = h(maker_renderer)(maker_name, {variables});
                }
            }
        }
        return h([...Object.values(makers)]);
    }

    async _getter() {
        let variables = Object.assign({}, this.variables);
        let filters = {}
        for (const m of filter_key_by_regex(variables, /filter\.(.*)/)) {
            const filter_name = m[1];
            if (!filters[filter_name]) {
                const filter = globalThis[`filter_${maker_name}`];
                if (filter) {
                    variables = await filter(variables);
                    filters[filter_name] = true;
                }
            }
        }
        return variables;
    }

    setVariables(variables) {
        for (const [key, value] of Object.entries(variables)) {
            this.variables[key] = value;
        }
        this._getter.then((variables) => {
            const renderer = h(this._makers_renderer)({variables});
            render(renderer, this.slot);
        });
    }
}
