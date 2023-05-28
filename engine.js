(function() {

// Node.contains()

function cache_into_frame(object) {
    return Frame.currentFrame.cache_into_frame(object);
}

function _renderer_to_slothtml(r) {
    let renderer_name = cache_into_frame(r.renderer);
    let getter_name = r.getter ? cache_into_frame(r.getter) : '';
    return `<slot key="${r.key || ''}" renderer="${renderer_name}" getter="${getter_name}"></slot>`;
}

function place(node) {
    if (node == null) {
        return '';
    } else if (typeof node === 'string') {
        return node;
    } else if (Array.isArray(node)) {
        return node.map(place).join('');
    } else if (node instanceof NodeList) {
        return `<slot node="${cache_into_frame(h('fragment', ...node))}"></slots>`
    } else if (node instanceof Node && !node.slots) {
        return `<slot node="${cache_into_frame(node)}"></slots>`
    } else if (node.renderer) {
        return _renderer_to_slothtml(node);
    } else if (typeof node == 'function') {
        if (!node.prototype) {
            const old_func = node;
            node = (e) => {
                update(e.target);
                return old_func(e);
            };
        }
        return `"${cache_into_frame(node)}"`;
    // } else if (node.renderer || typeof node == 'function') {
    //     frame.objectCache || throw new Error('place() must call in renderer');
    //     return _renderer_to_slothtml(node);
    // } else if (node.__proto__.constructor.name === 'Object') { // (node._place) {
    } else if (Object.prototype.isPrototypeOf(node)) {
        return `"${cache_into_frame(node)}"`
    } else { // also node.slots
        return node.toString();
        // throw new Error('node argument is unknown type in place()');
    }
}

// function _html(strings, ...args) {
//     let results = []
//     for (let i=0; i < strings.length-1; i++) {
//         results.push(place(strings[i]));
//         if(i < args.length) results.push(place(args[i]));
//     }
//     strings.length && results.push(place(strings[strings.length - 1]));
//     return results.join('')
// }

const _html = (strings, ...args) => strings.flatMap(
    (v, i) => i < args.length ? [v, args[i]] : v).map(place).join('');

const _make_renderer_hvalue = (renderer, key, getter) => {
    const x = function(arg1, arg2) {
        let [key, getter] = (arg2 === undefined ? [ this.key, arg1 ] : [ arg1, arg2 ]);
        return _make_renderer_hvalue(this.renderer, key, getter);
    }
    x.renderer = renderer;
    x.key = key;
    x.getter = getter;
    return x;
}

const _template = (text) => {
    let tpl = create('template');
    tpl.innerHTML = text;
    return tpl.content;
}

function h(e, ...args) {
    const assertArgsZero = () => console.assert(args.length === 0);
    const create = document.createElement;
    if (e === 'fragment') {
        if (args.length === 1 && args[0] instanceof DocumentFragment) {
            return args[0];
        }
        e = new DocumentFragment();
    } else if (e instanceof NodeList) {
        e.forEach(c => h(c, ...args));
        return e;
    } else if (typeof e === 'function') {
        assertArgsZero();
        return e.renderer ? e : _make_renderer_hvalue(e);
    } else if (Array.isArray(e)) {
        assertArgsZero();
        return _html(e, ...args);
        // return Object.create(h.prototype, {_html: _html(e, ...args)});
    } else if (e === 'template') {
        return h('fragment', args.map(n => {
            return typeof n === 'string' ? _template(n) :
                   node instanceof NodeList ? h('fragment', node) :
                   node.renderer ? _template(_renderer_to_slothtml(node)) : n;
        }));
    } else if ('string' === typeof e) {
        if (e.startsWith('<')) {
            assertArgsZero();
            return h([e]);
        } else {
            let m, string = e;
            e = null;
            while(m = string.match(/([> ]*(?!$)|\[([^\]=]+)(?:=([^\]]+))?\]|(?:.)[^\[\.#]+)/)) {
                string = string.substring(m.lastIndex);
                switch(m[1][0]) {
                    case ' ':
                    case '>': return h(e || 'div', h(string, ...args));
                    case '#': (e ||= create('div')).setAttribute('id', m[1].substring(1)); break;
                    case '.': (e ||= create('div')).classList.add(m[1].substring(1)); break;
                    case '[': (e ||= create('div')).setAttribute(m[2], m[3] || ''); break;
                    default:  (e ||= create(m[1]));
                }
            }
        }
    }
    let func, children;
    if (args[0] && args[0] === h) {
        args.shift();
        func = e.append;
    } else if (args[args.length-1] && args[args.length-1] === h) {
        args.pop();
        func = e.prepend;
    } else {
        // children = e.childNodes?.length ? h(fragment, ...e.childNodes) : null;
        children = e.childNodes || null;
        func = e.append;
    }
    func(...args.flatMap(l => {
        if (l === h) {
            return children;
        } else if (Array.isArray(l)) {
            return h('template', ...l);
        } else if('string' === typeof l) {
            return l;
            // return e instanceof DocumentFragment ? l : document.createTextNode(l);
        } else if (l instanceof NodeList) {
            return l;
        } else if ('object' === typeof l && l) {
            if (!(e instanceof Element)) return;
            for (let [k, v] of Object.entries(l)) {
                if ('function' === typeof v) {
                    /^on\w+/.test(k) && e.addEventListener(k.substring(2), v, false);
                } else if (k === 'style') {
                    if('string' === typeof v) {
                      e.style.cssText = v
                    } else {
                        for (let [sk, sv] of Object.entries(v)) {
                            let match = sv.match(/(.*)\W+!important\W*$/);
                            e.style.setProperty(sk, match ? match[1] : sv,
                                                    match ? 'important' : undefined);
                        }
                    }
                } else if (k === 'attribute') {
                    Object.entries(v).forEach(([k, v]) =>
                        v !== undefined ? e.setAttribute(k, v) : e.removeAttribute(k));
                } else if (k.startsWith('data-')) {
                    e.setAttribute(k, v);
                } else {
                    e[k] = v;
                }
            }
        } else {
            return l;
        }
    }));
    return e;
}

h.html = function (...args) { return h(args); }


function* selectAll(slot) {
    let current = slot;
    while ((current = current.nextSibling) !== slot.endslot) yield current;
}



class WeakSlotSet extends Set {
    add(v) {
        console.assert(v?.core?.slot);
        super.add(slot.core);
    }
    *values() {
        for (const core of super.values()) {
            if (!isInDocument(core.slot)) {
                this.afterUnmount && this.afterUnmount.call(core.slot);
                super.delete(core);
            } else yield core.slot;
        }
    }
}

// 更換成不同renderer造成同一個core卻有著不同的slot.events時，可能會有問題。



const make_handler = (isCapture) => function handler(e) {
    let p = e.currentTarget;
    let registers = p[`${isCapture}Registers`][e.type];
    let triggers = new Set();
    for (const slot of registers || []) {
        for (const [selector, isMethod, t, capture] of slot.events[e.type] || []) {
            if ( (capture ? e.eventPhase <= 2 : e.eventPhase >= 2 ) &&
                 (selector === 'window' && p === window) ||
                 (selector === 'document' && p === document) ||
                 (slot.parentElement === p && !selector || e.target.matches(selector)) ) {
                !t.prototype && update.auto && update(slot);
                isMethod ? t.call(slot.isInstance ? slot.instance : slot, e, slot) :
                           triggers.add(t);
            }
        }
    }
    triggers.forEach(t => t(e));
    (window.actions ||= []).push(e);
    if (registers?.size === 0) {
        delete registers[e.type];
        p.removeEventListener(e.type, handlers[isCapture], isCapture === 'capture');
    }
}

const handlers = {
    capture: make_handler('capture'),
    bubble: make_handler('bubble')
};

function installEvents(slot) {
    // install event handler in parent
    let p = slot?.parentElement;
    if (!p) return;
    for (const [eventType, [selector, isMethod, t, capture]] of Object.entries(slot.events)) {
        let isCapture = capture ? 'capture' : 'bubble';
        let pp = selector === 'window' || selector === 'document' ? window[selector] : p;
        let registers = pp[`${isCapture}Registers`] ||= {};
        if (!registers[eventType]) {
            registers[eventType] = new WeakSlotSet();
            pp.addEventListener(eventType, handlers[isCapture], capture);
        }
        registers[eventType].add(slot);
    }
}


function isInDocument(target) {
    if (!target.parentElement) return false;
    const root = target.getRootNode();
    return root === document || root.toString() === '[object ShadowRoot]';
}

function nearestSlot(node) {
    let meetedEndSlots = new Set();
    let p = node;
    while(p.previousSibling ? (p = p.previousSibling) : (p = p.parentNode)) {
        if (p.key) meetedEndSlots.add(p);
        if (p.slots && !meetedEndSlots.has(p.endslot)) return p;
    }
}



function renderer_proto(renderer) {

    let cachekey, proto, isInstance;
    if (typeof renderer === 'function') {
        if (renderer.prototype) {
            cachekey = proto = renderer.prototype;
        } else {
            // arrow function has no prototype
            cachekey = renderer;
            proto = null;
        }
    } else {
        cachekey = proto = Object.getPrototypeOf(renderer);
        isInstance = true;
    }

    // 將這些計算結果快取起來，以免每次重複計算
    let cache = window.renderer_proto_cache ||= new Map();
    let attrs = cache.get(cachekey);
    if (!attrs) {
        class _attrs extends Comment {
            render(frame, props, ...args) {
                // TODO:
                props = { frame: frame, global: frame?.global, ...props};
                return this.isInstance ? this.instance.render(props, ...args) :
                       (proto.render || renderer).call(this, props, ...args);
            }
            // shouldUpdate(from, slot) {}
            // toString() {
            //     return frame.objectCache ? _renderer_to_slothtml(this) :
            //                             Node.prototype.toString.call(this); }
            selectAll() { return selectAll(this); }
            ensureCallAfterUnmount() {
                if (!this.alreadyUnmount) {
                    this.alreadyUnmount = true;
                    let afterUnmount = this.isInstance ? this.instance.afterUnmount :
                                                         this.afterUnmount;
                    if (afterUnmount) {
                        (this.isInstance ? this.instance.afterUnmount :
                                           this.afterUnmount)();
                    }
                }
            }

            get key() { return this._key || this.isInstance && this.instance.key }
            get getter() { return this._getter || this.isInstance && this.instance.getter }
            get state() { return this.core.state; }
            get core() { return this._core; }
            get isPure() { return proto ? this.pure === true : !(this.pure === false) }
            get setEntry() {
                return this.isInstance ? !(this.entry === false) : this.entry === true;
            }
            get isEntry() {
                let t = typeof this.getter;
                return t !== 'undefined' && t !== 'function' && this.setEntry;
            }
            get parentSlot() { return nearestSlot(this); }
            get nearestEntry() {
                if (!this._nearestEntry === undefined) {
                    let parent = this.parentSlot;
                    if (parent) {
                        this._nearestEntry = parent.isEntry ? parent : parent.nearestEntry;
                    } else {
                        this._nearestEntry = null;
                    }
                }
                return this._nearestEntry;
            }
            // get frame() {
            //     this._state._frame ||= {};
            //     return this._state._frame;
            // }
        }
        attrs = _attrs;
        attrs.prototype.name = isInstance ?
                renderer.constructor.name : renderer.name;
        attrs.prototype.renderer = renderer;
        attrs.prototype.isInstance = isInstance;
        isInstance || Object.assign(attrs.prototype, proto);

        function make_events(obj, target, isMethod) {
            let events = {...target.events,
                          ...Object.fromEntries(Object.entries(target)
                                    .filter(k => /^on\W{2}.+/.test(k))
                                    .map((k, v) => [k.slice(2), v]))};
            for (let [eventType, handler] of Object.entries(events)) {
                let [eventType, ...selector] = eventType.split(' ');
                selector = selector.join('');
                let capture = false;
                if (eventType.startsWith('+')) {
                    capture = true
                    eventType = eventType.slice(1);
                }
                eventType = eventType.toLowerCase();
                (obj[eventType] ||= []).push([
                    selector || null, isMethod, handler, capture
                ])
            }
        }
        let events = {};
        proto && make_events(events, proto, false);
        make_events(events, renderer, true);
        attrs.prototype.events = Object.freeze(events);
        cache.set(cachekey, attrs);

    }
    return attrs;
}



const insertBefore = (ref, pos, e) => {
    return (pos || ref).parentElement.insertBefore(e, pos);
}

function sloting(p, position, n1) {
    switch(position) {
        case 'replace':
            if (p.slots) throw new Error(`cannot replace slot`);
            insertBefore(p, p, n1);
            p.parentNode.removeChild(p);
            break;
        case 'before':
            insertBefore(p, p, n1);
            break;
        case 'contentOf':
        case 'headOf':
            if (p.slots) {
                insertBefore(p, p.nextSibling, n1);
            } else {
                p.insertBefore(n1, p.firstChild);
            }
            break;
        case 'tailOf':
            if (p.slots) {
                insertBefore(p, p.endslot, n1);
            } else {
                p.insertBefore(n1, null);
            }
            break;
        case 'after':
            insertBefore(p, p.slots ? p.endslot.nextSibling : p.nextSibling, n1);
            break;
        default:
            throw new Error(`position = '${position}' is undefined`);
    }
    if (position === 'contentOf') {
        if (p.slots) {
            insertBefore(p, p.endslot, n1.endslot);
        } else {
            p.insertBefore(n1.endslot, null);
        }
    } else {
        insertBefore(n1, n1.nextSibling, n1.endslot);
    }
}




function mount_into(target, renderer, getter, key, to, position = 'replace') {
    let klass = renderer_proto(renderer);
    let n1 = new klass();
    if (klass.prototype.isInstance) {
        n1.instance = renderer;
    }
    n1._key = key;
    // instance沒設定getter的情形自動變成entry
    n1._getter = n1.setEntry ? getter || null : getter;
    n1._core = { slot: n1, state: {}, };
    if (!n1.key) {
        // if (!to) throw new Error('must provide {key} at toplevel slot');
        for (let i=0; i<10000; i++) {
            if (!to.slots[n1._key = n1.name + (i || '')]) break;
        }
    }
    let n2 = new Comment(`%end=${n1.key}`);
    n2.key = n1.key;
    n1.data = `%start=${n1.key}`;
    n1.slots = {};
    n1.endslot = n2;

    if (target) {
        // if (shadow) {
        //     target.attachShadow({mode: 'open'});
        //     target = target.shadowRoot;
        //     position = 'content';
        // }
        sloting(target, position, n1);
        to.slots[key] = n1;
        installEvents(to);
    }
    return n1;
}



function QueryablePromise(promise) {
    // Don't create a wrapper for promises that can already be queried.
    if (promise.isResolved) return promise;

    let isResolved = false;
    let isRejected = false;

    // Observe the promise, saving the fulfillment in a closure scope.
    let p = promise.then(
       function(v) { isResolved = true; p.result = v; return v; },
       function(e) { isRejected = true; p.exception = e; throw e; });
    p.isFulfilled = function() { return isResolved || isRejected; };
    p.isResolved = function() { return isResolved; }
    p.isRejected = function() { return isRejected; }
    return p;
}


function handle_async(to, promise) {

    let w = to.core.asyncRendering;
    if (promise) {
        console.assert(!w);
        w = to.core.asyncRendering = QueryablePromise(promise).then(() => {
            if (w !== null) to.update();
        });
    }
    if (w.isFulfilled()) {
        let asynciter = to.core.asyncIterator;
        if (asynciter) {
            if (w.result.done) {
                delete to.core.asyncIterator;
            } else {
                to.core.asyncRendering = QueryablePromise(asynciter.next()).then(() => {
                    to.update();
                });
                return [w.result.value, null];
            }
        }
        delete to.core.asyncRendering;
        if (w.exception) {
            return [null, w.exception];
        } else {
            return [asynciter ? w.result.value : w.result, null];
        }
    }
    return null;
}


function get_render_async(from, to, data, force_rerender) {
    // TODO: force_rerender?
    force_rerender = force_rerender === undefined ?
                     (to.hash ? to.hash(data, from, to) : null) : force_rerender;

    if (to.asyncRendering) {
        if (force_rerender === true) {
            // data與上次不一樣時，asyncgen.return()並且重新執行render
            if (to.core.asyncIterator) {
                to.core.asyncIterator.return();
                delete to.core.asyncIterator;
            }
            delete to.core.asyncRendering;
            return get_render_async(from, to, data, force_rerender);
        } else {
            return handle_async(to);
        }
    } else if (force_rerender === false) {
        return null;
    } else {
        let result, exp;
        try {
            result = to.render(data, from, to);
        } catch (e) {
            exp = e;
        }
        if (result && result[Symbol.asyncIterator]) {
            to.core.asyncIterator = result;
            return handle_async(to, to.core.asyncIterator.next());
        } else if (result && typeof result.then === 'function') {
            return handle_async(to, result);
        } else {
            return [result, exp];
        }
    }
}




const LINKS = Symbol('links');


function parent_props(target, prop) {
    do { if (Object.prototype.hasOwnProperty.call(target, prop)) return target; }
    while (target = Object.getPrototypeOf(target));
}

function setOnTree(t, prop, value) {
    if (t[prop] !== value) {
        update.auto && (t[LINKS][prop] || []).forEach(slot => slot && slot.update());
        t[prop] = value;
    }
}
const setExists = (target) => (prop, value) => {
    const t = parent_props(target, prop);
    if (!t) return false;
    setOnTree(t. prop, value);
    return true;
}
const proxyBlueprint = {
    get(target, prop, receiver) {
        if (prop === 'setExists') return setExists(target);
        if (prop === 'raw') return target;
        const t = parent_props(target, prop);
        if (!t) return;
        if (Frame.currentSeq?.currentSlot) {
            (t[LINKS][prop] ||= new WeakSlotSet()).add(Frame.currentSeq.currentSlot);
        }
        return t[prop];
    },
    set(target, prop, value, receiver) {
        const t = parent_props(target, prop);
        setOnTree(t || target, prop, value);
    },
}

function resolve_data(data, getter) {
    switch (typeof getter) {
        case 'undefined':   return data;
        case 'function':    return getter(data);
        case 'object':      return getter;
    }
}

class Seq {
    // 並且建立sequence串，甚至根據這個串來reslove_data

    constructor(rootFrame, allowUpdate) {
        this.slotStack = new Map();
        this.rootFrame = rootFrame || Frame.rootFrame;

        this.time = Date.now();
        this.framecount = 0;
        this.renderQueue = allowUpdate ? new Set() : null;
        this.renderEntries = allowUpdate ? new Set() : null;
        this.monitorAfterUnmount = new Set();
        this.animationFunc = null;
    }

    get currentSlot() {
        let stack = [...this.slotStack.keys()];
        return stack.length ? stack[stack.length - 1] : null;
    }

    update(slot) {
        if (slot) {
            this.renderQueue.add(slot)
            this.renderEntries.add(slot.isEntry ? slot : slot.nearestEntry);
        }
        if (!this.animationFunc && this.renderQueue.size > 0) {
            const func = this.animationFunc = () => {
                if (this.animationFunc !== func) return;
                this.redraw(mount.defaultToplevel);
                this.animationFunc = null;
                this.update();
            }
            requestAnimationFrame(func);
        }
    }

    redraw(root) {
        console.assert(root.slots);
        this.lastTime = this.time;
        this.time = Date.now();
        this.framecount += 1;
        this.renderEntries = new Set(
                [...this.renderQueue].map(slot => slot.isEntry ? slot : slot.nearestEntry));
        this.render2(root);
        [...this.renderQueue.values()].filter(
            slot => !isInDocument(slot)).forEach(this.renderQueue.delete);
        this.renderEntries = new Set();
        for (const core of this.monitorAfterUnmount) {
            if (!isInDocument(core.slot)) {
                core.slot.afterUnmount();
                this.monitorAfterUnmount.delete(core);
            }
        }
    }


    render_stages(frame, from, to, dataResolved) {
        this.renderQueue && this.renderQueue.delete(to);

        if (from !== to) {
            Object.assign(to, from);
            to.core.slot = to;
        }
        to._proc = this.slotStack[to] = {
            frame: frame,
            dataResolved,
            dataPass: { from, frame:frame, global: frame.global, ...dataResolved },
            oldSlots: Object.assign({}, from?.slots),
            _already_attach_hvalue: false,
            _already_render_children: false,
        }

        let [hvalue, exc] = get_render_async(from, to, to._proc.dataPass);
        if (exc) {
            to.onerror && to.onerror(exc);
            to.dispatchEvent(new CustomEvent('RenderError', { detail: { error: exc } }));
        } else if (!to._proc?._already_attach_hvalue) {
            frame.render_stage_attach_hvalue(from, to, hvalue);
        }
        frame.render_stage_render_children(to);

        // leave frame
        delete to._proc;
        this.slotStack.delete(to);
        // if (to !== from) {
        //     to.afteradd && to.afteradd(from, to);
        // }
        if (to.afterUnmount) {
            this.monitorAfterUnmount.add(to.core);
        }
    }

    render1(slot) {
        if (this.slotStack.has(slot))
            throw new Error(`cannot render ancestor slot`);
        let stack = [];
        let p_proc, p;
        while (p = slot.nearestSlot) {
            if (this.slotStack.contains(p)) {
                p_proc = this.slotStack.get(p);
                break;
            }
            stack.push(p);
        }
        for (const s of stack.reverse()) {
            this.slotStack.set(s, p_proc = {
                frame: resolve_frame(s, p_proc?.frame || this.rootFrame),
                dataResolved: resolve_data(p_proc?.dataResolved, s.getter),
            });
        }

        (p_proc?.frame || this.rootFrame).walk(this, slot, p_proc?.dataResolved,
                                               this.renderQueue, slot);
        // let frame = resolve_frame(slot, p_proc?.frame || this.rootFrame);
        // let dataResolved = resolve_data(slot, p_proc?.dataResolved);
        // this.render_stages(frame, slot, slot, dataResolved);
        stack.forEach(this.slotStack.delete);
    }

    render2(slot) {
        Frame.redrawSeqStack.push(this);
        try {
            this.render1(slot);
        } finally {
            Frame.redrawSeqStack.pop();
        }
    }
}


function resolve_slot(slot, container) {
    const fromcache = Frame.currentFrame.fromcache;
    const isSlotContain = node => slot && nearestSlot(node) !== slot;
    container.querySelectorAll('slot').forEach(s_node => {
        // if (isSlotContain(s_node)) return;
        let node, renderer;
        if (node = fromcache(s_node, 'node')) {
            s_node.parentElement.insertBefore(node, s_node);
            s_node.parentElement.removeChild(s_node);
        } else if (renderer = fromcache(s_node, 'renderer'))  {
            key ||= s_node && s_node.getAttribute('key');
            getter ||= fromcache(s_node, 'getter');
            // mount_into(s_node, {to: slot, key, renderer, getter})
            mount_into(s_node, renderer, getter, key, slot, 'replace');
        }
    });
    container.querySelectorAll('[style^=":"]').forEach(a_node => {
        // if (isSlotContain(a_node)) return;
        let style = fromcache(a_node, 'style');
        a_node.removeAttribute(`style`);
        Object.assign(a_node.style, style);
    });
    for (const eventType of ['click', 'keypress', 'input']) {
        container.querySelectorAll(`[on${eventType}^=":"]`).forEach(a_node => {
            // if (isSlotContain(a_node)) return;
            let callback = fromcache(a_node, `on${eventType}`);
            a_node.removeAttribute(`on${eventType}`);
            a_node[`on${eventType}`] = callback;
        });
    }
    return container;
}


function moveSlot(slot, position, target, new_content) {
    position && console.assert(nearestSlot(slot) === nearestSlot(target));
    let old_content = h('fragment', ...selectAll(slot));
    new_content ||= old_content;
    position && sloting(target, position, slot);
    slot.parentNode.insertBefore(new_content, slot.endslot);
}



function resolve_frame(slot, frame) {
    if (slot === mount.defaultToplevel) {
        return frame;
    }
    return !slot.core.frame ? frame :
           frame.isPrototypeOf(slot.core.frame) ? slot.core.frame :
           (slot.core.frame = Object.create(frame, slot.core.frame));
}


class Frame {
    static cacheIndex = 0;
    static redrawSeqStack = [];

    constructor() {
        let local = this.local;
    }

    static get currentSeq() {
        let stack = this.redrawSeqStack;
        // return stack.length ? stack[stack.length-1] : this.rootFrame;
        return stack.length ? stack[stack.length-1] : null;
    }

    static get currentFrame() {
        return this.currentSeq ?
                this.currentSeq.currentSlot ? this.currentSeq.currentSlot.core.frame :
                this.currentSeq.rootFrame :
            this.rootFrame;
    }

    fromcache(element, attr) {
        let key = element && element.getAttribute(attr);
        if (this.hasOwnProperty('objectCache') && this.objectCache[key]) {
            return this.objectCache[attr];
        } else if (Frame.prototype.isPrototypeOf(Object.getPrototypeOf(this))) {
            return super.fromcache(element, attr);
        }
    }

    cache_into_frame(object) {
        let k = ':' + (++this.cacheIndex);
        if (!this.hasOwnProperty('objectCache')) {
            this.objectCache = {};
        }
        this.objectCache[k] = object;
        return k;
    }

    get local() {
        if (!this.hasOwnProperty('_local')) {
            this._local = { [LINKS]: {} };
            Object.setPrototypeOf(this._local, super._local || null);
            this.global = new Proxy(this._local, proxyBlueprint);
        }
        return this._local;
    }

    checkHash = (slot, data) => slot.hash && slot.hash(data, slot, slot);

    walk(seq, slot, data, queue, from) {
        let slots, dataResolved, frame;
        frame = resolve_frame(slot, this);
        if (seq.renderEntries?.size && slot.isEntry && !seq.renderEntries.has(slot)) {
            seq.slotStack.set(slot, { frame, dataResolved });
            for (const s of Object.values(slot.slots)) {
                if (!s.isEntry) continue;
                frame.walk(seq, s, null, queue, s);
            }
            seq.slotStack.delete(slot);
        } else if (!slot._proc?.oldSlots &&
            (queue && queue.has(slot)) ||
            (slot.isPure &&
             checkHash(slot, dataResolved = resolve_data(data, slot.getter))) ||
            !queue
           ) {
            dataResolved ||= resolve_data(data, slot.getter);
            seq.render_stages(frame, from, slot, dataResolved);
        } else if ((slots = Object.entries(slot.slots)).length > 0) {
            // Skip render slot, but render his children

            dataResolved ||= resolve_data(data, slot.getter);
            // seq.slotStack.set(slot, { frame, dataResolved });
            // resovle children, use `from` children, or make new children
            for (const [key, s] of slots) {
                from = slot._proc?.oldSlots ? slot._proc.oldSlots[key] : s;
                frame.walk(seq, s, dataResolved, queue, from);
            }
            // seq.slotStack.delete(slot);
        }
    }

    render_stage_attach_hvalue(from, to, hvalue) {
        if (to._proc?._already_render_children) return;
        to._proc && (to._proc._already_attach_hvalue = true);

        if (hvalue !== undefined) {
            let frag = resolve_slot(to, h('template', hvalue));
            moveSlot(to, null, null, frag);
        } else if (from !== to) {
            let frag = h('fragment', ...selectAll(from));
            moveSlot(to, null, null, frag);
        } else {
            resolve_slot(to, to.parentElement);
            return;
        }
    }

    render_stage_render_children(to) {
        if(to._proc._already_render_children) return;
        to._proc._already_render_children = true;

        // 20230528 新增
        let seq = Frame.currentSeq;
        let slots;
        if ((slots = Object.entries(to.slots)).length > 0) {
            for (const [key, s] of slots) {
                let from = to._proc.oldSlots[key] || s;
                to._proc.frame.walk(seq, to, to._proc.dataResolved, seq.renderQueue, from);
            }
        }

        let new_slot_array = new Set(Object.values(to.slots));
        for (const oldslot of Object.values(to._proc.oldSlots)) {
            if (!new_slot_array.has(oldslot)) {
                oldslot.ensureCallAfterUnmount();
            }
        }
        if (to.core.asyncIterator) {
            // TODO: to.core.asyncIterator.return() after unmount
            to.core.asyncIterator.return();
        }
        // TODO: after asyncComplete
    }


}

Frame.rootFrame = new Frame();
Frame.mainSeq = new Seq(Frame.rootFrame, true);

const isRenderer = (renderer) => typeof renderer === 'function' || renderer?.renderer;

function resolve_target(target, position = null) {
    if (Array.isArray(target)) {
        [position, target] = target;
    } else if (target && (position = Object.keys(target)[0]) &&
                         (target = target[position]) instanceof Node) {
    } else {
        // return [null, null];
    }
    if (typeof target === 'string') {
        target = document.querySelector(target);
        if (!target) throw new Error(`element '${target}' not found`);
    }
    return [target, position];
}

// (X)mount(slot);             === mount(undefined, slot);
// mount(slot, target2);    move
// mount(renderer);
// mount(hValue, target);
// mount(hValue)    //, 'fragment');
// mount(target1, target2);

// mount(undefined, target);
// mount(renderer, target);
// mount(renderer, 'element-id');
// mount(renderer, ['contentOf', e]);
// mount(renderer, {headOf: document});
// mount(renderer, {headOf: 'element-id'});

function mount(renderer, target) {
    let position, key;
    // if (target === 'fragment') {
    //     let frag;
    //     if (isRenderer(renderer)) {
    //         frag = h('template', _renderer_to_slothtml(renderer));
    //     } else {
    //         // TODO: hValue to fragment
    //     }
    //     return frag.querySelector('slot');
    // } else
    if (renderer?.slots) {
        let slot = renderer;
        [target, position] = resolve_target(target);
        moveSlot(slot, position, target)
        return slot;
    } else if (target === null) {
        [target, position, key] = renderer.renderer.defaultMount;
        [target, position] = resolve_target(target, position);
    } else if (target.slots) {
        let slot = target;
        if (isRenderer(renderer)) {
            if (slot.renderer === renderer.renderer) {
                // change getter
                slot.getter = renderer.getter;
                if (update.auto) update(slot);
                return slot;
            } else {
                // remount
                umount(slot);
                position = 'contentOf';
            }
        } else {
            // mount hValue
            Frame.currentFrame.render_stage_attach_hvalue(slot, slot, renderer);
            // TODO: resolve slots order
            return slot;
        }
    } else {
        [target, position] = resolve_target(target);
    }

    position ||= 'contentOf';
    key ||= renderer.key;
    if (position === 'replace' || position === 'contentOf') {
        key = target.key || target.id || target.className;
    }
    let to = nearestSlot(target);
    if (!to) {
        to = mount.defaultToplevel;
        to.slots ||= {};
    }
    let slot = mount_into(target, renderer.renderer, renderer.getter, key, to, position);
    if (update.auto) update(slot);
    return slot;
}

mount.defaultToplevel = document.firstChild;

// umount(slot)
// umount(renderer)
// function unmount(slot, { clear = true, recusive = false } = {}) {
//     if (target.renderer || typeof target == 'function') {
//         // TODO: umount default location;
//     } else {
//         console.assert(slot.slots);
//         for (const subslot of (recusive ? slot.slots : [])) {
//             unmount(subslot, {clear, recusive});
//         }
//         // revert to origin node
//         swapSlot(slot,
//                  slot.origin && slot.origin.tagName !== 'SLOT' ? slot.origin : undefined,
//                  !clear);
//     }
// }



// render(slot=this)                    render all subslots
// render(slot)
// render(hvalue)
// render(hvalue, target)
// render(renderer)
// render(renderer, target)

function render(renderer, target) {
    let slot;
    [renderer, target] = renderer?.slots ? [undefined, renderer] : [renderer, target];
    if (target?.slots) {
        slot = target;
        if (Frame.currentSeq?.currentSlot === slot) {
            if (renderer !== undefined) {
                Frame.currentFrame.render_stage_attach_hvalue(slot, slot, renderer);
            }
            Frame.currentFrame.render_stage_render_children(slot);
            return;
        } else if (renderer !== undefined) {
            // renderer is any hValue?
            mount(renderer, slot);
        }
    } else if (target) {
        slot = mount(renderer, target);
    } else if (renderer) {
        slot = mount(renderer, 'fragment');
        (new Seq()).render2(slot);
        return slot.parentNode;
    } else {
        throw new Error('render nothing');
    }
    if (Frame.currentSeq) {
        Frame.currentSeq.render1(slot);
    } else {
        (new Seq()).render2(slot);
    }
}


const update = slot => Frame.mainSeq.update(slot);
update.auto = true;
const sleep = ms => new Promise(r => setTimeout(r, ms));

Object.assign(window, {h, mount, render, update, sleep, nearestSlot});

})();


