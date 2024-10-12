
class Column {
    index;
    name;
    hidden = false;
    formatter = x => x === undefined ? '' : x.toString();
    getDepth = x => 0;
    isKey = false;
}

function parseColumns(columns) {
    let results = []
    for (let i=0; i<columns.length; i++) {
        const col = columns[i];
        const c = new Column();
        c.index = i;
        if (typeof col === 'string') {
            c.name = col;
        } else {
            console.assert(col.name);
            Object.assign(c, col);
        }
        results.push(c);
    }
    return c;
}

function datagrid({columns, pagination, data}) {

}

function _parseRow(d) {
    if (typeof d === 'string') {
        return {name:d};
    } else {
        return d;
    }
}

function dropitem({name, path, pos, setsize, selected = false}) {
    // aria-setsize
    // aria-posinset
    // aria-expanded
    return h('div', {attribute:{tabindex: '-1'}}, [`<span>${name}</span>`]);
}

/*
data = []
selected = []
multiselectable = false
actived = null // 現在捲軸所在的位置?

*/
function menu({data = [], multiselectable = true}) {
    let style = multiselectable ? '--multiselectable: true' :
                                  '--allow-deselect: false';
    style += '--selection: 1;';
    let menu = h('div#xxm.menu', {style, 'data-menu': ''},
                 data.map(_parseRow).map(dropitem));
    h(menu, {"+onclick": function onclick(e) {
        selection_behavior(e);
        e.stopPropagation();
    }});
    // h(menu, {attribute:{'aria-hidden': 'true'}});
    return menu;
}

/*
## schema is object
## value is object
## transformers is object
*/

function fromSchema({schema, value, transformers, styler}) {
    // schema.title
    // schema.description
    // schema.type ("null", "boolean", "object", "array", "number", or "string")
    // schema.readOnly
    // schema.$present
    // schema.$data
    // schema.$type
    // schema.properties []
    // schema.const
    // schema.enum []

}


function dropdown({data = [], multiselectable = true}) {
    let style = multiselectable ? '--multiselectable: true' :
                                  '--allow-deselect: false';

    let menu = h('div#xxm.menu', {style, 'data-menu': ''},
                 data.map(_parseRow).map(dropitem));
    // h(menu, {"+onclick": function onclick(e) {selection_behavior(e);}});
    h(menu, {attribute:{'aria-hidden': 'true'}});
    let btn = h('div.btn', {attribute:{'aria-controls': 'xxm',
                                       tabindex: '-1'}},
                h('span', `placeholder`));
    let view = h('div.dropdown', {style: '--selection: 1;'}, btn, menu);
    h(view, {"+onclick": function onclick(e) {
        selection_behavior(e);
    }});

    return view;
}



/*
function _row({values}) {
    return Object.values(values).map(v => `<span aria-colspan="2">${v}</span>`).join('');
}
function _item({values}) {
    let content = values._content;
    delete values._content;
    if (typeof content === 'function') {
        content = content();
    }
    let r = `<div tabindex="-1" aria-setsize="-1">${_row({values})}`;
    if (content) {
        r += `<span tabindex="-1" aria-expanded="true" aria-selected="true">show</span>`;
        r += `<div data-content>${content}</div>`;
    }
    r += '</div>';
    return r;
}
function _group({label, aggregates, items}) {
    let values = items._values ?? [label];
    aggregates = items._aggregates ?? aggregates;
    delete items._values;
    let r = `<div tabindex="-1" aria-expanded="true" aria-selected="true">${_row({values})}</div>`;
    r += `<div data-subtree>${_content({items})}`
    if (aggregates) {
        r += `<div data-aggregates>${aggregates}</div>`;
    }
    r += `</div>`;
    return r;
}
function _content({items}) {
    let r = [];
    for (const i in items) {
        const k = parseInt(i).toString();
        if (k === i || `${k}%` === i) {
            r.push(_item({values: items[i]}));
        } else {
            r.push(_group({label:i, items: items[i]}));
        }
    }
    return r.join('');
}
function _table({headers, items}) {
    let widths, header_content
    if (Array.isArray(headers)) {
        widths = headers.map(() => '100px');
        header_content = headers.map(h => `<span role="columnheader">${h}</span>`).join('');
    } else {
        widths = [...(new Array(headers)).keys()].map(() => '100px');
    }
    let grid_columns = `grid-template-columns: ${widths.join(' ')}`;
    let r = '';
    r += `<div role="table">`
    if (header_content) {
        r += `<div data-menu-header-wrap>`;
        r += `<div data-menu-header style="${grid_columns};">`;
        r += `<div>${header_content}</div>`;
        r += '</div>';
        r += '</div>';
    }
    r += `<div data-menu style="${grid_columns};">`;
    r += _content({items});
    r += '</div>';
    r += '</div>';
    return r;
}
*/

