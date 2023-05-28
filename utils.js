
/*

mount(function() {
    for (const event of window.actions || []) {
        switch(event.type) {
            case 'DOMContentLoaded':
                setup_behavior();
                for (const setup of this.setups || []) {
                    setup();
                }
                break;
            case 'PageLoaded':
                if (url.href !== window.location.href) {
                    if (without_hash(url) !== without_hash(window.location)) {
                        history.pushState({}, title, url.href);
                    }
                    let scroll_to = document.querySelector(window.location.hash);
                    scroll_to && setTimeout(() => scroll_to.scrollIntoView(), 0);
                }
                break;
        }
    }
    // TODO: assign location
}, document, { to:null, under: true, dontRenderChild: true, alwaysRedraw: true,
     attributes: {events: {DOMContentLoaded: redrawLoop}} });

function redrawLoop() {
    update(document.firstChild);
    let frame = window.mainframe = function redraw_every_frame() {
        if (window.mainframe === frame) {
            requestAnimationFrame(window.mainframe);
            redraw();
        }
    }
    requestAnimationFrame(window.mainframe);
}

window.addEventListener("DOMContentLoaded", redrawLoop, {once: true});


function setup_behavior(e) {
    let root = window.document.body;
    let usable = Object.fromEntries(
        (window.behaviors || []).map(b => [b.name, b]));
    let style_behaviors = getComputedStyle(root).getPropertyValue('--behaviors');

    let behaviors = [...(new Set((style_behaviors || '').split(',').map( bname =>
        usable[bname] || usable[bname + '_behavior'])))]

    for (const bah of (root.behaviors || [])) {
        for (const event of bah.listen_on) {
            window.document.removeEventListener(event, bah);
        }
    }
    for (const bah of behaviors) {
        for (const event of bah.listen_on) {
            if (event == 'DOMContentLoaded') {
                bah(e);
            } else {
                window.document.addEventListener(
                    event, bah, {passive: true, capture: bah.capture});
            }
        }
    }
    root.behaviors = behaviors;
}


*/














/*
async function require(path) {
    // load CJS/ESM script
    // <meta http-equiv="Content-Security-Policy" content="default-src https:;script-src 'unsafe-inline'">
    let _module = window.module;
    let temp = window.module = {};
    let es_exports = await import(path);
    let cjs_exports = temp.exports;
    cjs_exports && ((window.__modules ||= {})[path] = cjs_exports);
    window.module = _module;
    return cjs_exports || window.__modules[path] || es_exports;
}

// function loadModuleJS(src, text) {
//     const promise1 = new Promise((resolve, reject) => {
//     });
//     return Object.assign(
//         document.createElement('script'), {
//             type: 'module',
//             onerror: function(e) { this.exports = false; },
//             text: `${ src ? `import * as exports from "${src}"` : '' };
//                    ${text}
//                    window.findthis.exports = exports;`,
//     });
// }
// function loadJS() {}
// function loadpage() {}


const without_hash = (loc) => loc.origin + loc.pathname + local.search;
function Router(table) {
    this.table = table || [];
}


Router.prototype.render = function(props, from, slot) {
    // 應該要拆成兩個功能 router/pagereplacer
    // router.currentSlot/this.liveSlot
    // router.new_slot_strategy
    // router.requesting [url, replacedSlot_key, pageRenderer]
    // router.cacheLimit
    if (!from) {
        this.pagestore = element('div', {style: {display: 'none'}});
        // slot.parentNode.insertBefore(pagestore, this);
        this.mountpoint = element('div', {style: {display: 'none'}});
        slot.afteradd = () => {
            this.mountedToplevelSlot = slot;
            Router.routers.add(this);
        }
        slot.afterremove = () => {
            this.mountedToplevelSlot = null;
            Router.routers.delete(this);
        }
    }

    for (const e of [...this.actions, ...window.actions]) {
        switch(e.type) {
            case 'GotoPage':
                let mountpoint = element('div');
                this.pagestore.append(mountpoint);
                let slot = mount_into(mountpoint, {
                                      renderer: e.detail.renderer,
                                      shadow: true,
                                      getter: (router) => e.detail.paramaters,
                                      key: href, to: this});
                render(slot, router);
                break;
        }
    }

    if (!from) return h([this.pagestore, this.mountpoint?.xxx]);
    // let pagestore = this.nextSibling
    // if (!pagestore) {
    //     let pagestore = element('div', {style: {display: 'none'}});
    //     this.parentNode.insertBefore(pagestore, this);
    //     let crown = element('div');
    //     pagestore.append(crown);
    //     mount_into(crown, { renderer: () => {}, shadow: true,
    //                         key: '$crown', to: this});
    // }
    // for (const href of router.requested) {
    //     if (this.slots[href] === undefined && router.currentSlot.key !== href) {
    //         let mountpoint = element('div');
    //         pagestore.append(mountpoint);
    //         let slot = mount_into(mountpoint, {renderer, shadow: true,
    //                               getter: (router) => router,
    //                               key: href, to: this});
    //         render(slot, router);
    //     }
    // }
    for (const href of router.requested) {
        let slot = this.slots[href];
        if (href === router.currentSlot.key) {
            router.requested = [];
            break;
        } else if (slot && !slot.asyncRendering) {
            let crown = this.slots['$crown']
            crown.swapSlot(router.currentSlot);
            slot.swapSlot(crown);
            router.currentSlot = slot;
            update(slot);

            router.requested = [];
            break;
        }
    }
}


Router.routers = new WeakSet();
Router.dispatch = function(location) {
    for (const router of Router.routers) {
        let result;
        if (router.mountedToplevelSlot && result = router.match(location.href)){
            let {renderer, paramaters} = result;
            e.preventDefault();
            router.mountedToplevelSlot.dispatchEvent(
                    new CustomEvent('GotoPage',
                        { detail: { router, renderer, paramaters } });
            return true;
        }
    }
    return false;
}

Router.prototype.events = {}
Router.prototype.events['GotoPage'] = function(e, slot) {
    slot.update();
}


Router.events = {}
Router.events['+click window'] = function (e) {
    const safeExternalLink = /(noopener|noreferrer) (noopener|noreferrer)/
    const protocolLink = /^[\w-_]+:/

    if ((e.button && e.button !== 0) ||
        e.ctrlKey || e.metaKey || e.altKey || e.shiftKey ||
        e.defaultPrevented) return;

    let anchor = (function traverse (node) {
        if (!node || node === root) return;
        if (node.localName !== 'a' || node.href === undefined) {
            return traverse(node.parentNode);
        }
        return node;
    })(e.target);

    if (!anchor) return;

    if (window.location.protocol !== anchor.protocol ||
        window.location.hostname !== anchor.hostname ||
        window.location.port !== anchor.port ||
        anchor.hasAttribute('data-nanohref-ignore') ||
        anchor.hasAttribute('download') ||
        (anchor.getAttribute('target') === '_blank' &&
        safeExternalLink.test(anchor.getAttribute('rel'))) ||
        protocolLink.test(anchor.getAttribute('href'))) return;

    let href = anchor.href
    let hash = anchor.hash
    if (href === window.location.href) {
        // TODO: move this under next condition
        e.preventDefault();
        if (!self._hashEnabled && hash) {
            let el = document.querySelector(hash)
            if (el) el.scrollIntoView();
        }
    } else if (Router.dispatch(location)) {
        e.preventDefault();
    }
}

Router.events['popstate window'] = function(e) {
    Router.dispatch(location)
}
*/


class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject)=> {
      this.reject = reject
      this.resolve = resolve
    })
  }
}

async function* race(array, options) {
    const agens = new Map();
    const add = (p) => promise.push(p.then(res => [p]));
    const agen_next = (agen) => {
        let next = agen.next();
        agens[next] = agen;
        return next;
    };
    const promise = array.map(v => v && v[Symbol.asyncIterator] ? agen_next(v) : v).map(add);
    let agen;
    while (promises.length) {
        let [completed] = await Promise.race(promises);
        promises.splice(promises.indexOf(completed), 1);
        if (agen = agens[completed]) {
            delete agens[completed];
            if (!completed.done) add(agen_next(agent));
            yield [completed, agen];
        } else {
            yield [completed, completed];
        }
    }
}
