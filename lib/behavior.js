
// TODO: 採用 checkVisibility ?

function computePos(src_size, dest, options) {
    options = options || {};
    let axis = options.axis || 'x';
    let main = options.main || 'start';
    let cross = options.cross || 'start';
    let closeup = parseFloat(options.closeup || 20);
    let offset = parseFloat(options.offset || 2);
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
const resizeRect = (r1, w, h) => {
    const r2 = {left: r1.left,
                top: r1.top,
                right: r1.left + w,
                bottom: r1.top + h,
                width: w,
                height: h};
    return r2;
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

function getAncestor(...args) {
    for (const ancestor of getAncestors(...args)) {
        return ancestor;
    }
}

const ROOT_TAG_NAME = 'HTML';

function getViewport(target, depth) {
    if (target.tagName === ROOT_TAG_NAME) {
        return { closestAncestor: null,
                 viewport: target.getBoundingClientRect()};
    }
    let ancestors = [...getAncestors(target)].filter(ancestor => {
        const {overflow, overflowX, overflowY} = window.getComputedStyle(ancestor);
        return ancestor.tagName === ROOT_TAG_NAME ||
               /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
    });
    console.assert(ancestors.length > 0)
    if (depth) {
        ancestors = ancestors.slice(0, depth);
    }
    ancestors.reverse();
    let viewports = ancestors.map(el => {
        let rect = el.getBoundingClientRect();

        // 扣掉 scrollbars 寬度
        if (el.clientWidth !== rect.width || el.clientHeight !== rect.height) {
            rect = resizeRect(rect, el.clientWidth, el.clientHeight);
        }
        if (el.tagName === ROOT_TAG_NAME) {
            let width = window.visualViewport.width;
            let height = window.visualViewport.height;
            return {left: 0, top: 0, width, height, right:width, bottom:height };
        } else {
            return rect;
        }
    });
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
    // source 代表有著 data-flip 的元素
    // dest 代表瞄準對齊的目標

    const axis = options.axis || 'x';
    function try_error() {
        if (!options.dodge || options.dodge === 'false') {
            return computePos(source, dest, options);
        } else if (options.dodge === 'flip') {
            let cs, cd;
            if (axis == 'x') {
                cs = (dest.top + dest.bottom) / 2;
                cd = (viewport.top + viewport.bottom) / 2;
            } else {
                cs = (dest.left + dest.right) / 2;
                cd = (viewport.left + viewport.right) / 2;
            }
            let flip = cs > cd ? 'start' : 'end';
            return computePos(source, dest, {
                ...options,
                cross: flip,
            });
        }
        let opposite = (a) => a == 'cetner' ? 'cetner' :
            a.startsWith('align-') ?
            ( a.endsWith('start') ? 'align-end' : 'align-start') :
            ( a.endsWith('start') ? 'end' : 'start') ;

        let main = options.main || 'start';
        let cross = options.cross || 'start';
        let largestVolumn = 0;
        const try_result = {}
        for (const try_cross of [cross, opposite(cross)]) {
            for (const try_main of [main, opposite(main), 'start', 'end', 'cetner']) {
                let {x, y} = computePos(source, dest, {...options,
                    main: try_main,
                    cross: try_cross,
                });
                let [width, height] = [source.width, source.height];
                const s = {left:x, top:y, width, height,
                           right:x+width, bottom:y+height}
                const merge = mergeRect(viewport, s);
                const volumn = merge.width * merge.height;
                if (volumn > largestVolumn) largestVolumn = volumn;
                try_result[`${try_cross}-${try_main}`] = {
                    x, y, volumn,
                };
            }
        }
        for (const {x, y, volumn} of Object.values(try_result)) {
            if (volumn === largestVolumn) {
                return {x, y};
            }
        }
    }

    let {x, y} = try_error();

    if (options.shift === 'true') {
        // 限制不要超過邊框
        let [left, top] = [x, y];
        let [right, bottom] = [x + source.width, y + source.height];
        if (left < viewport.left) {
            x += viewport.left - left;
        }
        else if (right > viewport.right) {
            x -= right - viewport.right;
        }
        if (top < viewport.top) {
            y += viewport.top - top;
        } else if (bottom > viewport.bottom) {
            y -= bottom - viewport.bottom;
        }
    }

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
        let {scrollLeft, scrollTop} = closestAncestor;
        relativeOffsetX += scrollLeft;
        relativeOffsetY += scrollTop;
        let closestPositionedAncestor =
            // getAncestor(describedby, el => el.style.position &&
            //                          el.style.position !== 'static');
            getAncestor(describedby, el => getComputedStyle(el).position !== 'static');
        if (closestPositionedAncestor) {
            let {left, top} = closestPositionedAncestor.getBoundingClientRect();
            // relativeOffsetX -= left;
            // relativeOffsetY -= top;
            relativeOffsetX = -left;
            relativeOffsetY = -top;
        }
        // else {
        //     relativeOffsetX += closestAncestor.scrollLeft;
        //     relativeOffsetY += closestAncestor.scrollTop;
        //     // relativeOffsetX += closestAncestor.scrollLeft - closestAncestor.getBoundingClientRect().left;
        //     // relativeOffsetY += closestAncestor.scrollTop - closestAncestor.getBoundingClientRect().top;
        // }
    }
    
    let result = {
        x: x + relativeOffsetX,
        y: y + relativeOffsetY,
    };
    return result;
}

function process_scrollspy_spy(root) {
    for (const target of root.querySelectorAll('[data-scrollspy-spy]')) {
        const viewport = getViewport(target).viewport;
        const boundingClientRect = target.getBoundingClientRect();
        if (boundingClientRect.top > viewport.bottom) {
            target.dataset.scrollspyVisible = 'above';
        } else if (boundingClientRect.bottom < viewport.top) {
            target.dataset.scrollspyVisible = 'below';
        } else if (boundingClientRect.top > viewport.top &&
                   boundingClientRect.bottom < viewport.bottom) {
            target.dataset.scrollspyVisible = 'cover';
        } else {
            target.dataset.scrollspyVisible = 'intersect'
        }
    }
}

function process_scrollspy(root) {
    // 使用方式:
    // 對標題選單加入 <div class="menu" data-scrollspy=[CONTAONER_ID]>
    // 或是，對容器加入 <div class="container" data-scrollspy="self">


    // 可滾動內容與鍵盤相容性:
    // 如果要製作可滾動容器（<body> 除外，
    // 請確定已經設定 height 和 overflow-y: scroll; 旁邊帶有 tabindex="0"，以確保鍵盤相容性。

    process_scrollspy_spy(root);

    let containers = new Map();
    for (let menu of root.querySelectorAll('[data-scrollspy]')) {
        let id = menu.dataset.scrollspy;
        let container = null;
        if (id === 'self') {
            [container, menu] = [menu, null];
        } else if (id === "body") {
            container = root.body;
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
        let viewport;
        let all_above = true;
        let all_below = true;
        for (const target of container.querySelectorAll(':scope > :is(h1,h2,h3,h4,h5,h6)[id]')) {
            let menu_elements = menus.flatMap(menu =>
                        [...menu.querySelectorAll(`[href="#${target.id}"]`)]);
            change.all_links.push(...menu_elements);

            viewport ??= getViewport(target).viewport;
            const boundingClientRect = target.getBoundingClientRect();
            all_above &&= boundingClientRect.top > viewport.bottom;
            all_below &&= boundingClientRect.bottom < viewport.top;

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
        for (const menu of menus) {
            menu.classList.remove('all-above');
            menu.classList.remove('all-below');
        }
        if (viewport) {
            for (const menu of menus) {
                all_above && menu.classList.add('all-above');
                all_below && menu.classList.add('all-below');
            }
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
        if (change.winner.target && change.winner.ratio) {
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
        let fp_target =  fp_source.dataset.fixedpos === "" ? fp_source.previousElementSibling :
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
        // let fp_target = el.fp_target ||
        //     getAncestors(el, el => el.fp_target, 'offsetParent').next().value;
        let fp_target = el.fp_target ||
            getAncestors(el, el => el.fp_target).next().value;

        // 組織有向圖
        (fp_target.fp_children ||= []).push(el);

        let style = getComputedStyle(el);
        const shift = style.getPropertyValue('--fixedpos-shift');
        const display = style.getPropertyValue('display');
        if (shift && display !== 'none') {
            el.fp_force = true
            fp_target.fp_force = true
            let iter_fp_target = fp_target;
            while(iter_fp_target = iter_fp_target.fp_target) {
                // 如果子元素有設定shift，所有的父元素不能被跳過。
                iter_fp_target.fp_force = true;
            }
        }
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
                if (!el.fp_force && !isInViewportFast(el)) {
                    // 必須是沒有指定裁減的元素
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
                    // --fixedpos-axis: y;
                    // --fixedpos-cross: start;
                    let options = {
                        axis: style.getPropertyValue('--fixedpos-axis'),
                        main: style.getPropertyValue('--fixedpos-main'),
                        cross: style.getPropertyValue('--fixedpos-cross'),
                        closeup: style.getPropertyValue('--fixedpos-closeup'),
                        offset: style.getPropertyValue('--fixedpos-offset'),
                        dodge: style.getPropertyValue('--fixedpos-dodge'),
                        shift: style.getPropertyValue('--fixedpos-shift'),
                    }
                    const placement = style.getPropertyValue('--fixedpos-placement');
                    let [dir, align] = placement.split('-');
                    switch (dir) {
                    case 'top':
                        [options.axis, options.cross] = ['x', 'start']; break;
                    case 'bottom':
                        [options.axis, options.cross] = ['x', 'end']; break;
                    case 'left':
                        [options.axis, options.cross] = ['y', 'start']; break;
                    case 'right':
                        [options.axis, options.cross] = ['y', 'end']; break;
                    }
                    switch (align) {
                    case 'before': options.main = 'start'; break;
                    case 'after': options.main = 'end'; break;
                    case 'start': options.main = 'align-start'; break;
                    case 'end': options.main = 'align-end'; break;
                    case 'center': options.main = 'center'; break;
                    default: if (dir) options.main = 'center';
                    }

                    let {x, y} = computePosition(el.fp_target, el, options);
                    changes.push({el, x, y});
                }
                next_stack.push(...(el.fp_children || []));
                delete el.fp_force;
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





if (window.CSS?.registerProperty) {
    window.CSS.registerProperty({
        name: "--multiselectable",
        syntax: "*",
        inherits: false,
        initialValue: "false",
    });
    window.CSS.registerProperty({
        name: "--track-tabindex",
        syntax: "*",
        inherits: true,
        initialValue: "false",
    });
    window.CSS.registerProperty({
        name: "--allow-deselect",
        syntax: "*",
        inherits: true,
        initialValue: "true",
    });
    window.CSS.registerProperty({
        name: "--toggle-controls",
        syntax: "*",
        inherits: false,
    });


    for (const name of ['--unset-children', '--set-ancestor', '--has-setsize']) {
        window.CSS.registerProperty({
            name,
            syntax: "*",
            inherits: false,
            initialValue: "false",
        });
    }
    for (const name of ['--collapse-on-esc', '--collapse-on-blur',
                        '--collapse-on-click-outside']) {
        window.CSS.registerProperty({
            name,
            syntax: "*",
            inherits: false,
        });
    }
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
//     }, { passive: true, capture: true });
// }
let scrollBarWidth;
function getScrollBarWidth() {
    if (!scrollBarWidth) {
        let el = document.createElement("div");
        el.style.cssText = "overflow:scroll; visibility:hidden; position:absolute;";
        document.body.appendChild(el);
        scrollBarWidth = el.offsetWidth - el.clientWidth;
        el.remove();
    }
    return scrollBarWidth
}
function menu_header_x_scroll_lock_behavior(e) {
    if (e.target?.getAttribute && e.target.getAttribute('data-menu') !== undefined) {
        let header = e.target.previousElementSibling;
        if (header && header.getAttribute('data-menu-header-wrap') !== undefined) {
            header.style.paddingRight = `${getScrollBarWidth()}px`;
            let menuHeader = header.querySelector('[data-menu-header]');
            if (menuHeader) {
                menuHeader.scrollLeft = e.target.scrollLeft;
            }
        }
    }
}

class MenuSelectController {
    newOpens = new Set();

    get_datamenu_options(target) {
        if (target.hasAttribute('data-menu')) {
            let menu = target.dataset.menu;
            // let options = menu ? [...target.querySelectorAll(menu)] :
            //                      [...target.children];
            let options = menu ? [...target.querySelectorAll(menu)] :
                                 [...target.querySelectorAll('[aria-setsize]')];
            options = options.filter(opt => {
                return opt.closest('[data-menu]') === target;
            });
            return options;
        } else {
            return [];
        }
    }

    hasSetsize(d, style) {
        style ??= getComputedStyle(d);
        return d.hasAttribute('aria-setsize') ||
               style.getPropertyValue('--has-setsize') === 'true';
    }

    scrollTo(datamenu, d) {
        // TODO: 可能暫時不會實作
    }

    do_unset(target) {
        this.unset(target);
        let style = getComputedStyle(target);
        if (style.getPropertyValue('--unset-children') === 'true') {
            const options = this.get_datamenu_options(target);
            options.map(opt => this.do_unset(opt));
        }
    }
    do_set(target) {
        let style = getComputedStyle(target);
        if (style.getPropertyValue('--set-ancestor') === 'true') {
            // Expand Ancestor
            // TODO: 必須要是 selectable的 data-menu
            let datamenu = target.parentElement?.closest?.('[data-menu]');
            datamenu && this.do_set(datamenu);
        }
        this.set(target);
    }
    do_reset(target) {
        this.set(target);
    }


    detect(d) {
        let style = getComputedStyle(d);
        if (style.getPropertyValue('--selection') === 'aria-expanded') {
            return d.getAttribute('aria-expanded') !== 'true';
        } else {
            return d.getAttribute('aria-selected') !== 'true';
        }
    };

    set(d) {
        let style = getComputedStyle(d);
        if (style.getPropertyValue('--selection') === undefined) {
            return;
        }
        if (style.getPropertyValue('--track-tabindex') === 'true') {
            d.setAttribute('tabindex', '0');
        }
        if (style.getPropertyValue('--selection') !== 'aria-expanded') {
            d.setAttribute('aria-selected', 'true');
        }
        if (d.hasAttribute('aria-expanded')) {
            d.setAttribute('aria-expanded', 'true');
        } else {
            let datamenu = d.parentElement?.closest?.('[data-menu]');
            let controlBy = datamenu?.controlBy;
            for (const dst of [datamenu, controlBy]) {
                if (dst) {
                    const event = new Event("choose");
                    event.choose = d;
                    dst.dispatchEvent(event);
                }
            }
            if (controlBy && this.hasSetsize(d, style) &&
                controlBy.getAttribute('data-dropdown', undefined) !== undefined) {
                this.do_unset(controlBy);
            }
            if (datamenu) {
                this.scrollTo(datamenu, d);
            }
        }
        this.toggle_control(d);
    }
    unset(d) {
        let style = getComputedStyle(d);
        if (style.getPropertyValue('--track-tabindex') === 'true') {
            d.setAttribute('tabindex', '-1');
        }
        if (style.getPropertyValue('--selection') !== 'aria-expanded') {
            d.removeAttribute('aria-selected');
        }
        d.hasAttribute('aria-expanded') && d.setAttribute('aria-expanded', 'false');
        this.toggle_control(d)
    }
    isMultiselectable(target) {
        let style = getComputedStyle(target);
        return target.getAttribute('aria-multiselectable') === 'true' ||
               style.getPropertyValue('--multiselectable') === 'true';
    }

    isDisable(target) {
        return target.getAttribute('aria-disabled') === 'true' ||
               target.hasAttribute('disabled');
    }

    toggle_target(target, e) {
        let style = getComputedStyle(target);
        if (this.isDisable(target)) {
            return;
        } else if (this.detect(target)) {
            if (this.hasSetsize(target, style)) {
                const multiselectShift = e?.shiftKey || e?.altKey;
                const multiselectable = this.isMultiselectable(target);
                // const parent = target.closest('[data-menu]');
                const parent = target.parentElement.closest('[data-menu]');
                let options = parent ? this.get_datamenu_options(parent) : [];
                if (multiselectShift) {
                    options = [];
                } else if (multiselectable) {
                    options = options.filter(opt => !this.isMultiselectable(opt));
                }
                options.map(opt => this.do_unset(opt));
            }
            this.do_set(target);
        } else if (style.getPropertyValue('--allow-deselect') === 'false') {
            this.do_reset(target);
        } else {
            this.do_unset(target);
        }
    }
    set_control_hidden(controled) {
        controled.setAttribute('aria-hidden', 'true');
        controled.setAttribute('hidden', '');
        this.newOpens.has(controled) && this.newOpens.delete(controled);
        controled.previouslyFocused?.focus?.()
    }
    unset_control_hidden(controled, target) {
        controled.setAttribute('aria-hidden', 'false');
        controled.removeAttribute('hidden');
        this.newOpens.add(controled);
        if (controled.hasAttribute('data-fixedpos')) {
            // 只有彈出的東西才需要再關閉後轉移焦點
            controled.previouslyFocused = document.activeElement;
        }
        controled.controlBy = target;
        let f;
        f = controled.querySelector('[autofocus]');
        f ??= controled.querySelector('[aria-selected="true"]');
        f = f?.checkVisibility?.() ? f : null;
        f ??= controled.querySelector('[tabindex="0"]');
        f ??= controled.querySelector('[tabindex]');
        f && f.focus();
    }
    toggle_control(target, selected) {
        let root = target.getRootNode();
        let style = getComputedStyle(target);
        let toggle = style.getPropertyValue('--toggle-controls');
        let controled;
        if (toggle === 'href') {
            controled = root.querySelector(target.href);
        } else if (toggle === '+') {
            controled = target.nextElementSibling;
        } else if (toggle) {
            controled = target.querySelector(toggle);
        } else if (target.hasAttribute('aria-controls')) {
            controled = root.getElementById(target.getAttribute('aria-controls'));
        }
        if (controled) {
            // selected ??= target.getAttribute('aria-selected');
            selected ??= target.getAttribute('aria-expanded');
            if (controled.getAttribute('aria-modal') === 'true') {
                if (selected === 'true') {
                    controled.controlBy = target;
                    showDialog(controled);
                } else {
                    hideDialog(controled);
                }
            } else {
                if (selected === 'true') {
                    this.unset_control_hidden(controled, target);
                } else {
                    this.set_control_hidden(controled);
                }
            }
        }
    }
}


function selection_behavior(e) {
    // console.log(e.type, e.target);
    if (e.type === 'focusout' && e.target === window) {
        return;
    }
    let root = e.target.getRootNode();
    let style = getComputedStyle(e.target);
    const msc = new MenuSelectController();
    e.msController = msc;


    let keyPressed;
    if (!e.isComposing) {
        // 不是在輸入法中
        switch (e.code) {
        case 'Space': keyPressed = 'Space'; break;
        case 'Enter': keyPressed = 'Enter'; break;
        case 'Escape': keyPressed = 'Escape'; break;
        case 'Tab': keyPressed = 'Tab'; break;
        case 'ArrowUp':
        case 'ArrowLeft': keyPressed = 'ArrowLeft'; break;
        case 'ArrowDown':
        case 'ArrowRight': keyPressed = 'ArrowRight'; break;
        case 'Home': keyPressed = 'Home'; break;
        case 'End': keyPressed = 'End'; break;
        }
    }

    function deact(expand) {
        if (expand.controlBy) {
            msc.do_unset(expand.controlBy);
        } else {
            msc.set_control_hidden(expand);
        }
    }

    let selectControl = style.getPropertyValue('--selection');
    let target;
    switch(selectControl) {
    case 'true':
    case '1':
        target = e.target.closest('[tabindex]') ?? e.target;
        break;
    case 'aria-expanded':
        target = e.target.closest('[tabindex]');
        break;
    default:
        target = selectControl ? e.target.closest(selectControl) : null;
    }

    if (target) {
        // const datamenu = e.target.closest('[data-menu]');
        const datamenu = e.target.parentElement.closest('[data-menu]');
        let options = datamenu ? msc.get_datamenu_options(datamenu) : [];
        options = options.filter(el => !msc.isDisable(el));
        let index = options.indexOf(target);
        // console.log(e.type, e.target, target, datamenu, options, index);
        if (keyPressed === 'Space') {
            if (target.tagName !== 'BUTTON') {
                target.focus();
                msc.toggle_target(target, e);
                // target.contentEditable = true;
                // target.contentEditable = false;
                // e.preventDefault();
            }
        } else if (e.button === 0) {
            msc.toggle_target(target, e);
        } else if (e.type === 'focusout') {
            // let focused = document.activeElement;
            let focused = e.relatedTarget;
            if (focused === null) {
                // 只是失去焦點不要關閉
            } else if (datamenu && datamenu.hasAttribute('aria-hidden')) {
                let inside = datamenu.contains(focused);
                let insideControl = datamenu.controlBy?.contains?.(focused);
                if (!inside && !insideControl) {
                    let datamenuStyle = getComputedStyle(datamenu);
                    if (datamenuStyle.getPropertyValue('--collapse-on-blur') === 'true') {
                        deact(datamenu);
                    }
                }
            }
        } else if (index !== -1) {
            // 根據 https://www.w3.org/WAI/ARIA/apg/patterns/listbox/#keyboardinteraction
            if      (keyPressed === 'ArrowLeft')    index -= 1;
            else if (keyPressed === 'ArrowRight')   index += 1;
            else if (keyPressed === 'Home')         index = 0;
            else if (keyPressed === 'End')          index = options.length - 1;
            else                                    index = -99;
            if (index >= 0 && index < options.length) {
                options[index].focus();
                e.preventDefault();
            } else if (keyPressed === 'ArrowLeft' || keyPressed === 'ArrowRight') {
                e.preventDefault();
            }
        }
    }


    if (keyPressed === 'Space' || keyPressed === 'Enter' || e.button === 0) {

        // 按下按鈕而關閉
        // if (e.target.ariaLabel === 'Close') {
        //     msc.toggle_control(e.target);
        // }

        // 按到元素之外而關閉
        // [aria-expanded="true"]
        let expands = [...root.querySelectorAll('[aria-hidden="false"]')];
        for (const expand of expands) {
            // if (!isChildOfParent(e.target, expand) && !msc.newOpens.has(expand)) {
            if (!expand.contains(e.target) && !msc.newOpens.has(expand)) {
                let style = getComputedStyle(expand);
                if (style.getPropertyValue('--collapse-on-click-outside')) {
                    deact(expand);
                    // if (expand.controlBy) {
                    //     msc.do_unset(expand.controlBy);
                    // } else {
                    //     msc.set_control_hidden(expand);
                    // }
                }
            }
        }

        // We use `.closest(..)` and not `.matches(..)` here so that clicking
        // an element nested within a dialog opener does cause the dialog to open
        // let btn;
        // btn = e.target.closest(`[data-a11y-dialog-show]`);
        // if (btn && btn.dataset?.a11yDialogShow !== undefined) {
        //     let modal = root.getElementById(btn.dataset?.a11yDialogShow ||
        //                                     btn.getAttribute('aria-controls'));
        //     if (modal) {
        //         showDialog(modal, event);
        //         keyPressed && e.preventDefault();
        //     }
        // }
        // btn = e.target.closest(`[data-a11y-dialog-hide]`);
        // if (btn) {
        //     let modal;
        //     if (btn.dataset?.a11yDialogHide) {
        //         modal = root.getElementById(btn.dataset?.a11yDialogHide);
        //     } else {
        //         modal = e.target.closest('[aria-modal="true"]');
        //     }
        //     if (modal) {
        //         hideDialog(modal, event);
        //         keyPressed && e.preventDefault();
        //     }
        // }

        btn = e.target.closest(`[data-popup-hide]`);
        if (btn && !msc.isDisable(btn)) {
            let expand = btn;
            // 兄弟鄰接關係
            while(expand = expand?.parentElement) {
                if (expand === document.body) expand = null;
                if (expand.controlBy) break;
            };
            expand && deact(expand);
        }

    } else if (keyPressed === 'Escape') {
        // ESC鍵

        if (e.target.getAttribute('aria-expanded') === 'true') {
            // 由於ESC鍵對於.auto-popup異常
            // 這個時候focus聚焦在彈出按鈕，因此直接把按鈕關閉即可
            msc.do_unset(e.target);
        } else {

            const expands = [];
            let candidates = root.activeElement === document.body ?
                [...root.activeElement.querySelectorAll('[aria-hidden="false"]')] :
                [root.activeElement.closest('[aria-hidden="false"]')];

            // 更後面的流程再處理 [aria-modal="true"]
            candidates = candidates.filter(el => el && el.getAttribute('aria-modal') !== 'true');
            for (const expand of candidates) {
                if (expand) {
                    let style = getComputedStyle(expand);
                    if (style.getPropertyValue('--collapse-on-esc')) {
                        expands.push(expand);
                    }
                }
            }
            // 對聚焦元件下，所有展開並且設定有--collapse-on-esc的元素中
            // 選取最後一個最內層的元素，把它關閉。
            let closeSomething = false;
            for (const expand of expands.reverse()) {
                deact(expand);
                closeSomething = true;
                break;
            }

            if (!closeSomething) {
                let layers = get_modal_layers();
                modal = layers.length ? layers.at(-1) : null;
                if (modal) {
                    deact(modal);
                }
            }
        }
    }


    // let modal;
    // if (document.activeElement === window) {

    // } else if (document.activeElement === document.body) {
    //     let layers = get_modal_layers();
    //     modal = layers.length ? layers.at(-1) : null;
    // } else {
    //     modal = document.activeElement?.closest('[aria-modal="true"]');
    // }
    // // const modal = document.activeElement?.closest('[aria-modal="true"]');
    // if (modal && !modal.open && keyPressed) {
    //     let hasOpenPopover = false
    //     try {
    //       hasOpenPopover = !!modal.querySelector(
    //         '[popover]:not([popover="manual"]):popover-open'
    //       )
    //     } catch {
    //       // Run that DOM query in a try/catch because not all browsers support the
    //       // `:popover-open` selector, which would cause the whole expression to
    //       // fail
    //       // See: https://caniuse.com/mdn-css_selectors_popover-open
    //       // See: https://github.com/KittyGiraudel/a11y-dialog/pull/578#discussion_r1343215149
    //     }

    //     // If the dialog is shown and the ESC key is pressed, prevent any further
    //     // effects from the ESC key and hide the dialog, unless:
    //     // - its role is `alertdialog`, which means it should be modal
    //     // - or it contains an open popover, in which case ESC should close it
    //     if (
    //       keyPressed === 'Escape' &&
    //       modal.getAttribute('role') !== 'alertdialog' &&
    //       !hasOpenPopover
    //     ) {
    //       event.preventDefault();
    //       hideDialog(modal, event);
    //     }
    // }

    process_fixedpos(document);
}


// 大部分dialog相關的程式碼都參考了以下這個小型獨立套件
// https://a11y-dialog.netlify.app/advanced/focus-considerations

function get_modal_layers() {
    let models = [...document.querySelectorAll(
        '[aria-modal="true"]:not([aria-hidden="true"])')]
    models.sort((a, b) => (parseInt(a.dataset.modalIndex ?? '0')) -
                          (parseInt(b.dataset.modalIndex ?? '0')));
    return models;
}

function unlockDialog(el) {
    let p = el;
    while (p !== document.body) {
        p.inert = false;
        p = p.parentElement;
    }
}

function showDialog(el) {
    // If the dialog is already open, abort
    const shown = !el.matches('[aria-hidden="true"]');
    if (shown) return;

    let layers = get_modal_layers();
    let lastModal = layers.length ? layers.at(-1) : null;
    let lastIndex = lastModal ? (parseInt(lastModal.dataset?.modalIndex ?? '0')) + 1 : 0;


    for (let top of document.body.children) {
        top.inert = true;
    }
    unlockDialog(el);

    // Keep a reference to the currently focused element to be able to restore
    // it later
    // el.removeAttribute('aria-hidden')
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    el.setAttribute('data-modal-index', `${lastIndex}`);
    el.previouslyFocused = document.activeElement;

    // moveFocusToDialog
    const focused = (el.querySelector('[autofocus]') || el);
    focused.focus();
}



function hideDialog(el) {
    const shown = !el.matches('[aria-hidden="true"]');
    if (!shown) return;

    el.setAttribute('aria-hidden', 'true');
    el.removeAttribute('data-modal-index');
    el.previouslyFocused?.focus?.()

    let layers = get_modal_layers();
    let lastModal = layers.length ? layers.at(-1) : null;
    if (lastModal) {
        unlockDialog(lastModal);
        // moveFocusToDialog
        const focused = (lastModal.querySelector('[autofocus]') || lastModal);
        focused.focus()
    } else {
        for (let top of document.body.children) {
            top.inert = false;
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



