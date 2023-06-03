
function computePos(src_size, dest, options) {
    options = options || {};
    let axis = options.axis || 'x';
    let main = options.main || 'start';
    let cross = options.cross || 'start';
    let closeup = options.closeup || 20;
    let offset = options.offset || 2;

    const [src_length, src_cross_length] = axis == 'x' ?
          [src_size.width, src_size.height] :
          [src_size.height, src_size.width] ;

    const [dest_start, dest_end, dest_cross_start, dest_cross_end] = axis == 'x' ?
          [dest.left, dest.right, dest.top, dest.bottom] :
          [dest.top, dest.bottom, dest.left, dest.right] ;

    let main_grab = main == 'center' ? src_length / 2 :
                    main == 'start' || main == 'align-end' ? src_length : 0;

    let main_place = main == 'center' ? (dest_start + dest_end) / 2 :
                     main == 'start' || main == 'align-start' ?
                        dest_start + closeup : dest_end - closeup;

    let cross_place = cross == 'start' ?
                      dest_cross_start - src_cross_length - offset :
                      dest_cross_end + offset;

    let pos = {
        x: axis == 'x' ? main_place - main_grab : cross_place,
        y: axis == 'x' ? cross_place : main_place - main_grab,
    };
    return pos;
}

const mergeRect = (r1, r2) => {
    // r2 在 r1 中的相交區域
    let left =   Math.min(r1.right, Math.max(r1.left, r2.left));
    let top =    Math.min(r1.bottom, Math.max(r1.top, r2.top));
    let right =  Math.max(r1.left, Math.min(r1.right, r2.right));
    let bottom = Math.max(r1.top, Math.min(r1.bottom, r2.bottom));
    return {
        left, top, right, bottom,
        width: Math.abs(right - left),
        height: Math.abs(bottom - top),
    }
};

const isRectVisible = (r1) => !(
    r1.left == 0 && r1.top == 0 && r1.width == 0 && r1.height == 0);

const isRectHasVolumn = (r1) => !(r1.width == 0 && r1.height == 0);


function* getAncestors(element, condition, attribute) {
    let ancestor;
    while(ancestor = (ancestor || element)[attribute || 'parentElement']) {
        if (!condition || condition(ancestor)) {
            yield ancestor;
        }
    }
}

function getViewport(target, depth) {
    if (target.tagName === 'BODY') {
        return { closestAncestor: null,
                 viewport: target.getBoundingClientRect()};
    }
    let ancestors = [...getAncestors(target)].filter(ancestor => {
        const {overflow, overflowX, overflowY} = window.getComputedStyle(ancestor);
        return ancestor.tagName === 'BODY' ||
               /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
    });
    console.assert(ancestors.length > 0)
    if (depth) {
        ancestors = ancestors.slice(0, depth);
    }
    ancestors.reverse();
    let viewports = ancestors.map(el => el.getBoundingClientRect());
    let viewport = viewports.reduce(
        mergeRect, {left:-Infinity, right: Infinity, top: -Infinity, bottom:Infinity},
    );
    return { closestAncestor: ancestors[ancestors.length-1], viewport };
}

function viewportRatio(target, depth) {
    let boundingClientRect = target.getBoundingClientRect();
    let intersectionRect = mergeRect(getViewport(target, depth).viewport, boundingClientRect);
    return [intersectionRect, boundingClientRect];
}

function isInViewport(target, depth) {
    const [intersectionRect, boundingClientRect] = viewportRatio(target, depth);
    return isRectVisible(boundingClientRect) &&
           isRectHasVolumn(intersectionRect);
}


function computePosition(target, describedby, options) {
    let {closestAncestor, viewport} = getViewport(target);
    let source = describedby.getBoundingClientRect();
    let dest = target.getBoundingClientRect();

    function try_error() {
        let opposite = (a) => a == 'cetner' ? 'cetner' :
            a.startsWith('align-') ?
            ( a.endsWith('start') ? 'align-end' : 'align-start') :
            ( a.endsWith('start') ? 'end' : 'start') ;

        let main = options.main || 'start';
        let cross = options.cross || 'start';
        for (const try_cross of [cross, opposite(cross)]) {
            for (const try_main of [main, opposite(main), 'start', 'end', 'cetner']) {
                let {x, y} = computePos(source, dest, {...options,
                    main: try_main,
                    cross: try_cross,
                });
                let [width, height] = [source.width, source.height];
                if (isRectHasVolumn(mergeRect(viewport, {left:x, top:y, width, height},
                                              ))) {
                    return {x, y};
                }
                // if (x >= viewport.left && x + source.width <= viewport.right &&
                //     y >= viewport.top  && y + source.height <= viewport.bottom) {
                //     return {x, y};
                // }
            }
        }
        return computePos(source, dest, options);
    }

    let {x, y} = try_error();

    // 有三件事情
    // 1. relative關聯性，offsetParent可以找到定位的父元素
    // 2. The stacking context，shader會把同一圖層一起運算，可用isolation: isolate;獨立。
    //    absolute or relative 時設定 z-index 也能獨立。
    // 3. overflow 捲動框架
    // 這三件事情看似接近，但卻毫不相關，實際上又會稍微互相影響。
    // 捲動框架與relative設定在同一元件時，子元件不能超出捲動框架。
    // getBoundingClientRect取得的是相對最高層viewport的座標。


    // fixed 才可以超出 overflow 捲動框架
    // 雖然不推薦，不希望超出捲動框架時，可用(relative, absolute)
    // check 'describedby' is fixed or (relative, absolute)
    let [relativeOffsetX, relativeOffsetY] = [0, 0];
    if (window.getComputedStyle(describedby).position !== 'fixed') {
        [relativeOffsetX, relativeOffsetY] =
          [closestAncestor.scrollLeft - closestAncestor.getBoundingClientRect().left,
           closestAncestor.scrollTop - closestAncestor.getBoundingClientRect().top];
    }
    let result = {
        x: x + relativeOffsetX,
        y: y + relativeOffsetY,
    };
    return result;
}


function process_scrollspy(root) {
    // 使用方式:
    // 對標題選單加入 <div class="menu" data-scrollspy=[CONTAONER_ID]>
    // 或是，對容器加入 <div class="container" data-scrollspy="self">


    // 可滾動內容與鍵盤相容性:
    // 如果要製作可滾動容器（<body> 除外，
    // 請確定已經設定 height 和 overflow-y: scroll; 旁邊帶有 tabindex="0"，以確保鍵盤相容性。


    let containers = new Map();
    for (let menu of root.querySelectorAll('[data-scrollspy]')) {
        let id = menu.dataset.scrollspy;
        let container = null;
        if (id === 'self') {
            [container, menu] = [menu, null];
        } else if (id) {
            container = root.getElementById(id);
        }
        if (container) {
            let menus = containers.get(container);
            if (!menus) {
                menus = [];
                containers.set(container, menus);
            }
            if (menu) {
                menus.push(menu);
            }
        }
    }
    const changes = [];
    for (const [container, menus] of containers.entries()) {
        let winner = {
            target: null,
            link_elements: null,
            ratio: 0,
            top: Infinity,
            left: Infinity,
        };
        let change = {
            all_links: [],
            targets: [],
            winner
        };
        changes.push(change)

        function set_winner(target, ratio, top, left, menu_elements) {
            winner.target = target;
            winner.ratio = ratio;
            winner.top = top;
            winner.left =left;
            winner.menu_elements = menu_elements;
        }

        for (const target of container.querySelectorAll(':scope > [id]')) {
            let menu_elements = menus.flatMap(m =>
                        [...menu.querySelectorAll(`[href="#${target.id}"]`)]);
            change.all_links.push(...menu_elements);

            let ratio = 0;
            if (isInViewportFast(target)) {
                // 與overflow的比例，而不是與viewport的比例
                // depth = 1
                const [intersectionRect, boundingClientRect] =
                    viewportRatioFast(target);

                ratio = Math.abs(intersectionRect.width * intersectionRect.height) /
                        Math.abs(boundingClientRect.width * boundingClientRect.height);
                // console.log(target, ratio,
                //             [intersectionRect.width, intersectionRect.height],
                //             [boundingClientRect.width, boundingClientRect.height]);
                if (ratio > winner.ratio) {
                    set_winner(target, ratio,
                               intersectionRect.top, intersectionRect.left,
                               menu_elements);
                } else if (ratio == winner.ratio) {
                    if (intersectionRect.top < winner.top) {
                        set_winner(target, ratio,
                               intersectionRect.top, intersectionRect.left,
                               menu_elements);
                    }
                }
            }
            change.targets.push(target);
        }
    }

    for (const change of changes) {
        for (const target of change.targets) {
            target.classList.remove('active');
        }
        for (const link of change.all_links) {
            link.classList.remove('active');
            // link.removeAttribute('aria-selected');
        }
        if (change.winner.target) {
            for (const link of change.winner.menu_elements) {
                link.classList.add('showed');
                link.classList.add('active');
                // link.setAttribute('aria-selected', 'true');
            }
            change.winner.target.classList.add('showed');
            change.winner.target.classList.add('active');
        }
    }
}




// let root_observer = new IntersectionObserver(entries => {
//     entries.forEach(entry => {
//         entry.target.isIntersecting = entry.isIntersecting;
//         entry.target.intersectionRect = entry.intersectionRect;
//         entry.target.boundingClientRect = entry.boundingClientRect;
//     });
//     process_fixedpos();
// })
// root_observer.elements = new WeakSet();

// function ensure_ob(el) {
//     if (!root_observer.elements.has(el)) {
//         root_observer.observe(el);
//         root_observer.elements.add(el);
//         return false;
//     }
//     return el.isIntersecting !== undefined;
// }
const ensure_ob = null;

// 分成有加入IntersectionObserver與還沒加入IntersectionObserver的模式
const isInViewportFast = el =>
    ensure_ob && ensure_ob(el) ? el.isIntersecting :
            // fast path
            // 利用IntersectionObserver的結果，快速剔除不在螢幕中的元素
    isInViewport(el);   // slow path
                        // 必須要自己與所有父元素都沒有設定display:none，才能滿足可視性探測

const viewportRatioFast = el => ensure_ob && ensure_ob(el) ?
                                [ el.intersectionRect, el.boundingClientRect ] :
                                viewportRatio(el, 1);


function process_fixedpos(root) {
    // 使用方式:
    // 對於要浮動的元件加入 data-fixedpos[=TARGET]
    // 未設定TARGET時，對齊上一個元素
    // TARGET="parent"時，對齊父元素
    // TARGET="#<ID>"時，對齊該元素
    // TARGET="<SELECTOR>"，對齊浮動元素底下的特定元素


    root.body.fp_target = root.body;

    // 選取兩端元素
    let s = new Set();
    for (const fp_source of root.querySelectorAll('[data-fixedpos]')) {
        let fp_target = !fp_source.dataset.fixedpos ? fp_source.previousElementSibling :
                         fp_source.dataset.fixedpos === 'parent' ? fp_source.parentElement :
                         fp_source.dataset.fixedpos.startsWith('#') ?
                            root.getElementById(fp_source.dataset.fixedpos.slice(1)) :
                            fp_source.querySelector(fp_source.dataset.fixedpos);
        if (fp_target) {
            fp_source.fp_target = fp_target;
            s.add(fp_source);
            s.add(fp_target);
        }
    }
    for (const el of s) {
        // 如果元素的 fp_target 不存在，沿著 el.offsetParent 往上找 fp_source
        let fp_target = el.fp_target ||
            getAncestors(el, el => el.fp_target, 'offsetParent').next().value;
        // 組織有向圖
        (fp_target.fp_children ||= []).push(el);
    }

    function delete_one(el) {
        (el.fp_children || []).forEach(delete_one);
        delete el.fp_target;
        delete el.fp_children;
    }

    // 廣度優先演算法，並且批次設定el.style，以顯著減少reflow次數
    function bfs() {
        let stack = [root.body];
        while (stack.length > 0) {
            const changes = [];
            const next_stack = [];
            for (const el of stack) {
                if (!isInViewportFast(el)) {
                    // 必須沒有被捲動到任何viewport之外，才能滿足範圍探測，否則剪枝
                    delete_one(el);
                    // 4.如果父端被剔除，子端也會被剔除。被剔除的子端標記data-fixedpos-target-offscreen=true

                    // TODO: 無法顯示時，自動關閉 --collapse-on-target-disappear
                    // 目標離開視野 (這個計算可能會有點複雜?) 必須要監測scroll resize
                    // TODO: 目標關閉時 `display: none` (因此可以循環進行)
                    continue
                }
                if (el.dataset.fixedpos !== undefined) {
                    let style = getComputedStyle(el);
                    let options = {
                        axis: style.getPropertyValue('--fixedpos-axis'),
                        main: style.getPropertyValue('--fixedpos-main'),
                        cross: style.getPropertyValue('--fixedpos-cross'),
                        closeup: style.getPropertyValue('--fixedpos-closeup'),
                        offset: style.getPropertyValue('--fixedpos-offset'),
                    }
                    let {x, y} = computePosition(el.fp_target, el, options);
                    changes.push({el, x, y});
                }
                next_stack.push(...(el.fp_children || []));
                delete el.fp_target;
                delete el.fp_children;
            }

            for (const {el, x, y} of changes) {
                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
            }
            stack = next_stack;
        }
    }

    bfs();
}




// the scroll event won't be intercepted.
// As such, Event.preventDefault() will not be called,
// guving us an optimization opportunity.
//
// for (const event of ['DOMContentLoaded', 'scroll', 'resize']) {
//     window.addEventListener(event, (e) => {
//         // let root = e.target.getRootNode();
//         process_scrollspy(document);
//         process_fixedpos(document);
//     }, { passive: true });
// }


function selection_behavior(e) {
    let root = e.target.getRootNode();
    let style = getComputedStyle(e.target);

    function isChildOfParent(target, parent) {
        while(target && (target = target.parentNode)) {
            if(target === parent) return true;
        }
        return false;
    }

    function get_all_options(target) {
        if (target.hasAttribute('data-menu')) {
            let menu = target.dataset.menu;
            let options = menu ? [...target.querySelectorAll(menu)] : [...target.children];
            options.filter(opt => {
                return opt.closest('[data-menu]') === target;
            });
            return options;
        }
    }

    function do_unset(target, unset) {
        unset(target);
        let style = getComputedStyle(target);
        if (style.getPropertyValue('--unset-children') === 'true') {
            const options = get_all_options(target) || [];
            options.map(do_unset);
        }
    }

    const detect = d => d.getAttribute('aria-selected') !== 'true';
    function set(d) {
        d.setAttribute('tabindex', '0');
        d.setAttribute('aria-selected', 'true');
        toggle_control(d);
    }
    function unset(d) {
        d.setAttribute('tabindex', '-1');
        d.removeAttribute('aria-selected');
        toggle_control(d)
    }
    function toggle_target(target) {
        let style = getComputedStyle(target);
        let selection;
        if (target.getAttribute('aria-disabled') === true ||
            target.hasAttribute('disabled')) {
            return;
        }
        if (detect(target)) {
            const multiselect = target.getAttribute('aria-multiselectable') === 'true';
            if (!multiselect) {
                const parent = target.closest('[data-menu]');
                const options = (parent ? get_all_options(parent) : null) || [];
                options.map(opt => do_unset(opt, unset));
            }
            set(target);
        } else if (!style.getPropertyValue('--allow-deselect', 'false')) {
            do_unset(target, unset);
        }
    }

    function toggle_control(target, selected) {
        let style = getComputedStyle(target);
        let toggle = style.getPropertyValue('--toggle-controls');
        let control;
        if (toggle === 'href') {
            control = root.querySelector(target.href);
        } else if (toggle) {
            control = e.querySelector(toggle);
        } else if (target.hasAttribute('aria-controls')) {
            control = root.getElementById(target.getAttribute('aria-controls'));
        }
        if (control) {
            if (selected === undefined) {
                selected = target.getAttribute('aria-selected');
            }
            if (selected === 'true') {
                control.setAttribute('aria-hidden', 'false');
                control.removeAttribute('hidden');
            } else {
                control.setAttribute('aria-hidden', 'true');
                control.setAttribute('hidden', '');
            }
        }
    }

    // 不是在輸入法中
    if (e.isComposing) return;

    if (style.getPropertyValue('--selection')) {

        const parent = e.target.closest('[data-menu]');
        let options = (parent ? get_all_options(parent) : null) || [];
        options = options.filter(opt => opt.hasAttribute('tabindex'));
        let index = options.indexOf(e.target);
        if (index !== -1) {
            if (e.code === 'ArrowLeft')         index -= 1;
            else if (e.code === 'ArrowRight')   index += 1;
            else                                index = -99;
            if (index >= 0 && index < options.length) {
                toggle_target(options[index]);
                options[index].focus();
            }
        }
        if (e.code === 'Space' || e.code === 'Enter' || e.button === 0) {
            toggle_target(e.target);
        }
    }

    if (e.code === 'Space' || e.code === 'Enter' || e.button === 0) {

        // 按下按鈕而關閉
        if (e.target.ariaLabel == 'Close') {
            toggle_control(e.target);
            // function find_parent_until(target) {
            //     while (target = target.parentNode) {
            //         let style = getComputedStyle(target);
            //         if (style.getPropertyValue('--collapse-by-close-label')) {
            //             return target;
            //         }
            //     }
            // }
            // let control = e.target.getAttribute('aria-controls');
            // control ||= find_parent_until(e.target)
            // if (control) {
            // toggle_target(parent);
            // }
        }

        // 按到元素之外而關閉
        // [aria-expanded="true"]
        for (const expand of root.querySelectorAll('[aria-hidden="false"]')) {
            if (!isChildOfParent(e.target, expand)) {
                let style = getComputedStyle(expand);
                if (style.getPropertyValue('--collapse-on-click-outside')) {
                    toggle_target(expand);
                }
            }
        }
    } else if (e.keyCode === 27) {
        // ESC鍵
        const expands = [];
        for (const expand of root.activeElement.querySelectorAll('[aria-hidden="false"]')) {
            let style = getComputedStyle(expand);
            if (style.getPropertyValue('--collapse-on-esc')) {
                expands.push(expand);
            }
        }
        // 對聚焦元件下，所有展開並且設定有--collapse-on-esc的元素中
        // 選取最後一個最內層的元素，把它關閉。
        for (const expand of expands.reverse()) {
            if (expands.all(exp => !isChildOfParent(exp, expand))) {
                toggle_target(expand);
                break;
            }
        }
    }
}


class Router {
    static defaultMount = [document.documentElement, 'headOf', 'Router'];

    '+onclick window'(e) {
        const safeExternalLink = /(noopener|noreferrer) (noopener|noreferrer)/
        const protocolLink = /^[\w-_]+:/

        if ((e.button && e.button !== 0) ||
            e.ctrlKey || e.metaKey || e.altKey || e.shiftKey ||
            e.defaultPrevented) return;

        let anchor = (function traverse (node) {
            if (!node || node === node.getRootNode()) return;
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

        if (anchor.href === window.location.href) {
            // TODO: move this under next condition
            // let hash = anchor.hash
            // e.preventDefault();
            // if (!self._hashEnabled && hash) {
            //     let el = document.querySelector(hash)
            //     if (el) el.scrollIntoView();
            // }
        } else if (this.dispatch(anchor)) {
            e.preventDefault();
            History.pushState(null, null, anchor.href);
        }
    }
    'onpopstate window'(e) {
        // e.state
        this.load(new URL(window.location.href));
    }
    'onDOMContentLoaded window'(e) {
        if (e.target !== document) return;
        if (this.dispatch(new URL(window.location.href))) {
            this.load(new URL(window.location.href));
        }
    }
    dispatch(url) {
        return false;
    }
    load(url) {}
    render() {}
}



