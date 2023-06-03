/*

profile = variables + repository(s) 儲存在Window.localStorage之中，可匯出成網址
variable 是覆蓋設定檔的變數
repository 主要提供text(case)/renderer/variable/style

plugin 要載入maker，設定在variable之內
case 包含變體variant

製作的成品，除了可以即時預覽以外，也能夠上傳到網頁服務器host，或是下載壓縮檔
也可以將修改之後的variable上傳到host

markright綜合性語法，與jsx類似，但是比起jsx把重點放在script，markright重點在於markup
HTML + markdown + Template literals + js 四合一

以一個檔案作為進入點
1. (T)引入外部profile
2. 設定內部profile
3. 設定template
4. 引入外部其他內容
一次性的編譯，製作成多個檔案

分為三階段
1. make階段，執行檔案，這包含make profile，建立renderer以及import(subtree)其他檔案
   這包含建立subtree執行submake
2. render階段，從上到下，集體編譯render
3. file階段，分配之後歸檔到<template data-url="xxx">的render

*/



// document.head.insertAdjacentHTML('afterbegin',
//         '<style> body { display: none; } </style> ');


function split_mjs(text) {
    const regexs = {
        fence: /(?:^|\n)( {0,3}(?:`|~){3,}).*?\n\1(?:^$|\n)/gm,
        jsf: /(?:^|\n)(class|function) .*?\n};?(?:^$|\n)/gm,
        jse: /(?:^|\n)\(function .*?\n}\)\(\);?(?:^$|\n)/gm,
        yaml: /(?:^|\n)---\n.*?\n---(?:^$|\n)/gm,
        css: /(?:^|\n)@layer .*?\n}(?:^$|\n)/gm,
        import: /(?:^|\n)!INCLUDE.*?(?:^$|\n)/gm,
    }
    let m;
    let pos = 0;
    result = [];
    while (pos <= text.length) {
        let not_found = true;
        for (const block_name of Object.keys(regexs)) {
            regexs[block_name].lastIndex = pos;
            if (m = regexs[block_name].exec(text)) {
                result.push(['md', pos, index]);
                let end = index + m[0].length;
                result.push([block_name, index, end]);
                pos = end;
                not_found = false;
                break;
            }
        }
        if (not_found) {
            result.push(['md', pos, text.length]);
            break;
        }
    }
    return result;
}


function subtree({text, profile, path, ...props}) {
    let render_markdown;

    if (window.markdownit) {
        const md = window.markdownit({
            html: true,
            linkify: true,
            typographer: true,
            highlight: function (str, lang) {
                let value;
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        value = hljs.highlight(str, { language: lang,
                                                      ignoreIllegals: true }).value;
                    } catch (__) {}
                }
                if (!value) {
                    value ||= md.utils.escapeHtml(str);
                    lang = 'escape';
                }
                return `<pre class="hljs ${lang}"><code>${value}</code></pre>`;
            },
        });
        render_markdown = (text) => md.render(text);
    } else if (window.marked) {
        window.marked.use({
            gfm: true,
            mangle: false,
            headerIds: false,
            headerPrefix: false,
        })
        render_markdown = (text) => marked.parse(text);
        // .use(markedHighlight({
        //   langPrefix: 'hljs language-',
        //   highlight(code, lang) {
        //     const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        //     return hljs.highlight(code, { language }).value;
        //   }
        // }));

    }

    let output = '';
    for (const [type, begin, end] of split_mjs(text)) {
        const subtext = text.slice(begin, end);
        let result = ''
        switch (type) {
            case 'import':

                break;
            case 'md':
                // TODO: mount
                result = render_markdown(subtext);
                break;
            case 'fence':
                const firstline = subtext.split('\n')[0];
                if (!/.*?\*.*?/.test(firstline)) {
                    result = render_markdown(subtext);
                    break;
                }
                subtext = subtext.split('\n').slice(1,-2).join('\n');
            case 'jsf':
            case 'jse':
                // TODO: mount
                result = eval(subtext);
                result = result ? '' + result : '';
                break;
            // case 'yaml':
            //     break
            // case 'css':
            //     result = `<style>${subtext}</style>`;
            //     break
        }
        output += result;
    }
    render(h(output), this);
    Prism.highlightAllUnder(this.parentElement);
}



















const _iframe_cache = {};

class CSSParser {
    constructor() {
        this.layers = {};
        this.selector_unsolve = {};
        this.selector_non_recursive = {};
        this.selectors = {};
    }

    css_parser_stage1(sheet, current_layer) {
        current_layer ||= '';
        const layer = this.layers[current_layer] ||= {
            rules: [],
            deps: [],
            selectors: [],
            resolved: false,
        };
        for (const rule of sheet.cssRules) {
            if (rule instanceof CSSLayerBlockRule) {
                this.css_parser_stage1(rule, `${current_layer}.${rule.name}`);
            } else if (rule instanceof CSSLayerStatementRule) {
                layer.deps.push(...rule.nameList);
            } else if (rule instanceof CSSSupportsRule &&
                       rule.conditionText.startsWith('selector(--')) {
                let m;
                if (m = /^selector\((--[A-Za-z0-9-]+) (.*?)\)$/.exec(rule.conditionText)) {
                    layer.selectors.push([m[1], m[2]]);
                }
            } else {
                layer.rules.push(rule);
            }
        }
    }
    resolve_selector_expr(expr, match_func) {
        match_func ||= (match) => this.reslove_selector_variable(match);
        let m, re = /--[A-Za-z0-9-_]+/g;
        let last_vend = 0;
        let parts = [];
        while (m = re.exec(expr)) {
            parts.push(expr.slice(last_vend, m.index), match_func(m[0]));
            last_vend = m.index + m[0].length;
        }
        parts.push(expr.slice(last_vend));
        return parts.join('');
    }

    reslove_selector_variable(selector_variable) {
        // TODO: cycle reference
        let value;
        if (!(value = this.selectors[selector_variable])) {
            let expr = this.selector_non_recursive[selector_variable] || '__UNDEF__';
            value = this.resolve_selector_expr(expr);
            this.selectors[selector_variable] = value;
        }
        return value;
    }

    css_generator_stage1(layername) {
        // TODO: cycle reference
        let layer;
        if ( !(layer = this.layers[layername]) || layer.resolved) return '';
        for (const [varname, setten] of layer.selectors) {
            (this.selector_unsolve[varname] ||= []).push(setten);
        }
        layer.resolved = true;
        // 過濾掉 -layer
        layer.deps.
                filter(d => d.startsWith('-')).
                map(d => this.css_generator_stage1(d.slice(1)));
        let sublayer_text = layer.deps.map(d => this.css_generator_stage1(d)).join('\n');
        let text = layer.rules.map(rule => rule.cssText).join('\n');
        return sublayer_text + text;
    }

    css_generator_stage2(sheet, docStyle) {
        let texts = [];
        for (const rule of sheet.cssRules) {
            if (rule instanceof CSSMediaRule) {
                let re = /(([A-Za-z0-9-_]+)\s*:\s*)[A-Za-z0-9-_]+/g;
                let m;
                let last_vend = 0;
                const parts = [];
                while (m = re.exec(rule.conditionText)) {
                    let vstart = m.index + m[1].length;
                    let vend = m.index + m[0].length;
                    let prop = m[2];
                    let value = rule.conditionText.slice(vstart, vend);
                    let newvalue = docStyle.getPropertyValue(`--media-${prop}-${value}`);
                    parts.push(...[rule.conditionText.slice(last_vend, vstart),
                                   newvalue || value]);
                    last_vend = vend;
                }
                parts.push(rule.conditionText.slice(last_vend));
                const new_conditionText = parts.join('');
                let children = this.css_generator_stage2(rule, docStyle);
                children = children ? '\n' + children + '\n' : ' ';
                texts.push(`@media ${new_conditionText} {${children}}`);
            } else if (rule instanceof CSSStyleRule) {
                let attributes = /\{.*?\}/m.exec(rule.cssText)[0];
                let selectorText = rule.selectorText;
                selectorText = this.resolve_selector_expr(selectorText);
                texts.push(`${selectorText} ${attributes}`);
            } else {
                texts.push(rule.cssText);
            }
        }
        return texts.join('\n');
    }

    create_iframe(styletext) {
        let iframe = document.createElement('iframe');
        iframe.style.visibility = 'hidden';
        document.querySelector('body').appendChild(iframe);

        let win = iframe.contentWindow;
        let doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>${styletext}</style>
            </head><body>
            </body></html>`);
        doc.close();

        return {
            iframe, win, doc,
            close: () => document.querySelector('body').removeChild(iframe),
        }
    }

    parse(styletexts) {
        const ROOT_LAYER = '';

        // let stage1_iframes = styletexts.map(this.create_iframe);
        // const sheets = stage1_iframes.map(iframe => iframe.doc.styleSheets[0]);
        // sheets.forEach(sheet => this.css_parser_stage1(sheet, ROOT_LAYER));
        // stage1_iframes.forEach(iframe => iframe.close());
        for (const s of styletexts) {
            _iframe_cache[s] ||= this.create_iframe(s).doc.styleSheets[0];
        }
        const sheets = styletexts.map(s => this.css_parser_stage1(_iframe_cache[s], ROOT_LAYER));

        const stage1_text = this.css_generator_stage1(ROOT_LAYER);
        for (const selector_variable in this.selector_unsolve) {
            let value = '__NONE__';
            const settens = (this.selector_unsolve[selector_variable] || []).reverse();
            for (const expr of settens) {
                value = this.resolve_selector_expr(expr,
                        (match) => match == selector_variable ? value : match);
            }
            this.selector_non_recursive[selector_variable] = value;
        }

        const stage2_iframe = this.create_iframe(stage1_text);
        let sheet = stage2_iframe.doc.styleSheets[0];
        let root = stage2_iframe.doc.querySelector('html');
        let docStyle = stage2_iframe.win.getComputedStyle(root);
        const stage2_text = this.css_generator_stage2(sheet, docStyle);
        stage2_iframe.close();
        return stage2_text;

    }
}












function codebase_renderer(props) {
    const body = props.html || props.renderer(props.data);
    return h('html',
             h('head', props.prepends),
             h('body', props.html || h(props.renderer)(props.data),
                       props.additional_script || null),
             );
}

function iframe_renderer(props, from) {
    if (!from) {
        this.iframe = this.documentElement.createElement('iframe');
        this.iframe.src = 'about:blank';
    }

    this.iframe = this.nextElementSibling.querySelector('iframe');
    this.iframe.style.width = props.profile.width || '100%';
    this.iframe.style.height = props.profile.height || '400px';

    let doc = this.iframe.contentWindow.document;
    let frag = render(h(codebase_renderer)(props));
    let html = Array.prototype.reduce.call(
        frag.childNodes,
        (result, node) => result + (node.outerHTML || node.nodeValue),
        '');

    doc.open();
    doc.write(`<!DOCTYPE html><html>${html}</html>`);
    doc.close();
    return this.iframe;
}

function showcase_renderer(props) {
    return h`<figure class="case">
                <h4>${props.name}</h4>
                <p>${props.describe || ''}</p>
                ${h(iframe_renderer)}
            </figure>`;
}













function shell(funcname, func, html) {
    let el = document.createElement('iframe');
    // el.style.display = 'none';
    el.style.visibility = 'hidden';
    document.querySelector('body').appendChild(el);
    let doc = el.contentWindow.document;
    el.contentWindow[funcname] = function(...args) {
        func(el.contentWindow, ...args);
        el.parentNode.removeChild(el);
    }
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
        </head><body>
        ${html}
        </body></html>`);
    doc.close();

}


function make_icons({icons}, store) {
    return new Promise(resolve => {
        const collections = {};
        store.icons ||= {};

        function cb() {
            resolve([`\
<svg class="defs" style="display: none" mlns="http://www.w3.org/2000/svg">\
${icons.map(name => store.icons[name].symbol).join('\n')}</svg>`]);
        }

        for (const name of icons) {
            if (!store.icons[name]) {
                const [prefix, ...other] = name.split('-');
                (collections[prefix] ||= []).push(other.join('-'));
            }
        }
        // TODO: animate rotate
        // inside <p> <animateTransform attributeName="transform" attributeType="XML" type="rotate" dur="1s" from="0 50 50" to="360 50 50" repeatCount="indefinite"></animateTransform>
        if (Object.keys(collections).length > 0) {
        for (const [prefix, names] of Object.entries(collections)) {
            let path = `https://api.iconify.design/${prefix}.js?icons=${names.join(',')}&pretty=1&callback=define_icon`;
            shell('define_icon', (win, data) => {
                for (const [name, icon] of Object.entries(data.icons)) {
                    // Object.assign(result_icons[`${data.prefix}-${name}`] ||= {}, icon, {
                    store.icons[`${data.prefix}-${name}`] = {
                        width: data.width,
                        height: data.height,
                        symbol: `<symbol id="${data.prefix}-${name}" viewBox="0 0 ${data.width} ${data.height}">${icon.body}</symbol>`
                    };
                }
                if (icons.every(n => store.icons[n])) {
                    cb();
                }
            }, `<script type="text/javascript" src="${path}"><${'/script>'}`);
        }
        } else {
            cb();
        }
    });
}

function make_style({layer, style}, store) {
    return new Promise(resolve => {
        function parse_all_style() {
            const parser = new CSSParser();
            const styles = [...layer.map(s => s.styletext), style || ''];
            const styletext = parser.parse(styles);
            resolve([`<style>\n${styletext}\n</style>`]);
        }
        let any_path = false;

        for (const s of layer) {
            if (s.styletext === undefined) {
                any_path = true;
                shell('define_css', (win, csstext) => {
                    s.styletext = csstext;
                    if (layer.every(s => s.styletext !== undefined)) {
                        parse_all_style();
                    }
                }, `<script type="text/javascript" src="${s.path}"><${'/script>'}`);
            }
        }
        if (!any_path) {
            parse_all_style();
        }
    });
}


function make_viewport({}, store) {
    return new Promise(resolve => {
        store.userAgent = Navigator.userAgent;
        resolve([`<meta name="viewport" content="width=device-width, initial-scale=1" />`]);
    });
}

function make_manifest({web_app, favicon}, store) {
    if (!web_app) return '';
    const manifest = {
            name: web_app.name || 'React Doc',
            short_name: web_app.name || 'React',
            start_url: ".",
            theme_color: web_app.theme_color || '#ff00ff',
            display: web_app.display || 'standalone',
            lang: web_app.lang || 'en-us',
        };
    if (favicon) {
        const ico = store.icons[favicon];
        let svg = `<svg mlns="http://www.w3.org/2000/svg" viewport="0 0 ${ico.width} ${ico.height}">${ico.body}</svg>`;
        manifest.icons = [{
            type: 'image/svg+xml',
            size: '72x72',
            src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        }]
    }
    return new Promise(resolve => {
        resolve([`<link rel="manifest" href='data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}' />`]);
    });
}

function make_favicon({favicon}, store) {
    return new Promise(resolve => {
        if (!favicon) return resolve(['']);
        const ico = store.icons[favicon];
        let svg = `<svg mlns="http://www.w3.org/2000/svg" viewport="0 0 ${ico.width} ${ico.height}">${ico.body}</svg>`;
        resolve([`<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}" type="image/svg+xml" />`]);
    });
}


function make_fontface({fontfaces}, store) {
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
    function _make_fontface() {
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
        return [`<style>${styletext}</style>`];
    }
    return new Promise(resolve => {
        if (store.fonts) {
            resolve(_make_fontface());
        } else {
            shell('define_fonts', (win, fonts) => {
                store.fonts = fonts;
                resolve(_make_fontface());
            }, `<script type="text/javascript" src="./os-font-list/os-font-list.jsonp"><${'/script>'}`);
        }
    });
}

function make_js({script}) {
    return new Promise(resolve => {
        let tags = [];
        for (const s of script) {
            if (s.path) {
                tags.push(`<script src="${s.path}">XXX</script>`);
            } else if (s.text) {
                tags.push(`<script>${s.text}</script>`);
            }
        }
        resolve(tags);
    });
}

function make_color() {
    return new Promise(resolve => resolve(['']));
}

// new profile format
//
// favicon          [icon-list]
// lang             [str-list]
// icons.$name      [icon-list]
// app.name         [str]
// app.display      [str-list]
// color.theme      [rgba]
// color.background [rgba]
// style            [text]
// style.$name      [text]
// style.$name.path [str]
// script           [text]
// script.$name     [text]
// script.$name.path [str]
// fontface.$ffname.$fname.weight [int]
// fontface.$ffname.$fname.charset [str-list]
// $modname.$configs



// data
const profiles = {
    default: {
        favicon: 'mdi-account-box',
        icons: ['mdi-account-box', 'mdi-account-cash', 'mdi-account', 'mdi-home'],
        lang: 'en-us',
        web_app: {
            name: 'Maker',
            display: 'standalone',
        },
        layer: [
            {
                path: './basic.css',
            },
            {
                styletext: '@layer default { @layer custom; }',
            },
        ],
        style: '@layer default',
        script: [
            {
                path: 'engine.js',
            },
            {
                path: 'behaviors.js',
            },
        ],
        fontfaces: [{
            family: 'myfont',
            fonts: [
                {weight: 400, font: 'Lekton regular', charset: 'latin'},
                {weight: 400, font: 'PingFangTC-Thin', charset: 'cjk'},
                {weight: 400, font: 'Noto Sans Symbols 2 regular', charset: 'symbol'},
            ],
        }]
    },
}


function* filter_key_by_regex(object, re) {
    for (let k of Object.keys(object)) {
        let m = re.match(k);
        if (m[0].length > 0) {
            yield m;
        }
    }
}

async function build_to_nodes(profile) {
    // <!-- autogenerated by webber begin -->
    // <!-- autogenerated by webber end -->
    let makers = {}
    while(!done) {
        done = true;
        for (const m of filter_key_by_regex(profile, /make\.(.*)/)) {
            const maker_name = m[1];
            if (!makers[maker_name]) {
                const maker = makers[maker_name] = globalThis[`make_${maker_name}`];
                let new_profile = await maker(profile);
                Object.assign(profile, new_profile);
                done = false;
                break
            }
        }
    }

    const nodes = [];
    for (const m of filter_key_by_regex(profile, /html\..*/)) {
        const html = profile[m];
        let doc = (new DOMParser).parseFromString(html, 'application/xhtml+xml');
        for (let i=0; i<doc.children.length; i++) {
            let node = doc.children[i];
            nodes.push(node);
        }
    }
    return nodes;
}


// function case_variant(profile, thecase, variant) {
//     // c.profile.style 尤其重要，裡面有著指定要援用的layer
//     // c.profile.icons 列出case要使用的icon
//     // c.data 有著要傳給 c.renderer的預設資料

//     let vp = {...thecase.profile, ...variant.profile};
//     let p = {...profile, ...vp};
//     p.icons = [...(profile.icons || []), ...(vp.icons || [])];
//     let result = {...thecase,
//             name: variant.name || thecase.name + (variant.postfix || ''),
//             profile: p,
//             data: {...vp.data, ...thecase.data, ...(variant.profile||{}).data} };
//     return result;
// }
