<!DOCTYPE html>

<html lang="en-us">
<head>
<meta charset="utf-8">
<style>
body {
    /*margin: 0px;*/
}
#container2 {
    overflow: scroll;
    height: 400px;
    width: 400px;
}

#container {
    position: relative;
    overflow: scroll;
    height: 600px;
    width: 600px;
}

#button {
    position: relative;
    left: 600px;
    top: 600px;
}
#button2 {
    position: relative;
    left: 1000px;
    top: 1000px;
}
#tooltip {
    position: absolute;
    background: #222;
    color: white;
    font-weight: bold;
    padding: 20px;
    border-radius: 4px;
    font-size: 90%;
    pointer-events: none;
}


</style>


</head>
<body>
    <div id="container2">
    <div id="container">
        <button id="button" aria-describedby="tooltip">
            My button
        </button>
        <button id="button2">
            My button2
        </button>
        <div id="tooltip" role="tooltip">My tooltip</div>
    </div>
    </div>


<script type="text/javascript">

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
    let left =   Math.max(r1.left, r2.left);
    let top =    Math.max(r1.top, r2.top);
    let right =  Math.min(r1.right, r2.right);
    let bottom = Math.min(r1.bottom, r2.bottom);
    return {
        left, top, right, bottom,
        width: right - left,
        height: bottom - top,
    }
};

const isRectVisible = (r1) => !(
    r1.left == 0 && r1.top == 0 && r1.width == 0 && r1.height == 0);

const isRectHasVolumn = (r1) => !(r1.width == 0 && r1.height == 0);


function* getAncestors(element, condition, attribute) {
    let ancestor;
    while(ancestor = (ancestor || target)[attribute || 'parentElement']) {
        (!condition || condition(ancestor)) && yield ancestor;
    }
}

function getViewport(target) {
    let ancestors = getAncestors(target).filter(a => {
        const {overflow, overflowX, overflowY} = window.getComputedStyle(ancestor);
        return ancestor.tagName === 'BODY' ||
               /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
    });
    let viewport = ancestors.map(el => el.getBoundingClientRect()).reduce(
        mergeRect, {left:-NaN, right: NaN, top: -NaN, bottom:NaN},
    );
    return { closestAncestor: ancestors[ancestors.length-1], viewport };
}

function isInViewport(target) {
    let r1 = target.getBoundingClientRect();
    return isRectVisible(r1) &&
           isRectHasVolumn(mergeRect(r1, getViewport(target).viewport));
}


function computePosition(target, describedby, options) {
    let closest_ancestor = getViewport(target);
    let viewport = closest_ancestor.viewport;
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
                if (isRectHasVolumn(mergeRect({left:x, top:y, width, height}, viewport))) {
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
          [closest_ancestor.scrollLeft - closest_ancestor.getBoundingClientRect().left,
           closest_ancestor.scrollTop - closest_ancestor.getBoundingClientRect().top];
    }
    let result = {
        x: x + relativeOffsetX,
        y: y + relativeOffsetY,
    };
    return result;
}


// TODO? 順便利用IntersectionObserver做出ScrollSpy的效果

let root_observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        entry.target.isIntersecting = entry.isIntersecting;
    });
    process_fixedpos();
})
root_observer.elements = new WeakSet();

function ensure_ob(el) {
    if (!root_observer.elements.has(el)) {
        root_observer.observe(el);
        root_observer.elements.add(el);
        return false;
    }
    return el.isIntersecting !== undefined;
}

function process_fixedpos() {
    document.body.fp_target = document.body;
    // 選取兩端元素
    let s = new Set();
    for (const fp_source of e.querySelectorAll('[data-fixedpos]')) {
        let fp_target = !fp_source.dataset.fixedpos ? fp_source.previousElementSibling :
                         fp_source.dataset.fixedpos === 'parent' ? fp_source.parentElement :
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

    // 分成有加入IntersectionObserver與還沒加入IntersectionObserver的模式
    const isInViewportFast = el =>
        (ensure_ob(el) && el.isIntersecting) ||
                // fast path
                // 利用IntersectionObserver的結果，快速剔除不在螢幕中的元素
        isInViewport(el);   // slow path
                            // 必須要自己與所有父元素都沒有設定display:none，才能滿足可視性探測

    function delete_one(el) {
        (el.fp_children || []).forEach(delete_one);
        delete el.fp_target;
        delete el.fp_children;
    }

    // TODO: 改用廣度優先演算法，並且批次設定el.style，以顯著減少reflow次數
    (function process_one(el) {
        if (!isInViewportFast(el)) {
            // 必須沒有被捲動到任何viewport之外，才能滿足範圍探測，否則剪枝
            return delete_one(el);
            // 4.如果父端被剔除，子端也會被剔除。被剔除的子端標記data-fixedpos-target-offscreen=true

            // TODO: 無法顯示時，自動關閉 --collapse-on-target-disappear
            // 目標離開視野 (這個計算可能會有點複雜?) 必須要監測scroll resize
            // TODO: 目標關閉時 `display: none` (因此可以循環進行)

        }
        if (el.dataset.fixedpos) {
            let style = getComputedStyle(el);
            let options = {
                axis: style.getPropertyValue('--fixedpos-axis'),
                main: style.getPropertyValue('--fixedpos-main'),
                cross: style.getPropertyValue('--fixedpos-cross'),
                closeup: style.getPropertyValue('--fixedpos-closeup'),
                offset: style.getPropertyValue('--fixedpos-offset'),
            }
            // let {x, y} = computePosition(el, el.fp_target, options);
            let {x, y} = computePosition(el.fp_target, el, options);
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
        }
        (el.fp_children || []).forEach(process_one);
        delete el.fp_target;
        delete el.fp_children;
    })(document.body);
}





// const button = document.querySelector('#button');
// const tooltip = document.querySelector('#tooltip');

// function f() {
//     let {x, y} = computePosition(button, tooltip);
//     Object.assign(tooltip.style, {
//         left: `${x}px`,
//         top: `${y}px`,
//     });
// }

//interface Options {
//   ancestorScroll?: boolean;
//   ancestorResize?: boolean;
//   elementResize?: boolean;
//   animationFrame?: boolean;
// }



define(function() {
    function fixedpos_case1_renderer() {
        return `
        <div id="container2">
        <div id="container">
            <button id="button" aria-describedby="tooltip">
                My button
            </button>
            <button id="button2">
                My button2
            </button>
            <div id="tooltip" role="tooltip">My tooltip</div>
        </div>
        </div>
        `;
    }
    fixedpos_case1_renderer.name = 'fixedpos1';
    define_case(fixedpos_case1_renderer);

    function fixedpos_behavior(e) {
        // for (const el of e.querySelectorAll('[data-fixedpos]')) {
        //     let style = getComputedStyle(el);
        //     let q = style.getPropertyValue('--fixedpos-target');
        //     let target = el.querySelector(q);
        //     let options = {
        //         axis: style.getPropertyValue('--fixedpos-axis'),
        //         main: style.getPropertyValue('--fixedpos-main'),
        //         cross: style.getPropertyValue('--fixedpos-cross'),
        //         closeup: style.getPropertyValue('--fixedpos-closeup'),
        //         offset: style.getPropertyValue('--fixedpos-offset'),
        //     }
        //     let {x, y} = computePosition(target, el, options);
        //     Object.assign(el.style, {
        //         left: `${x}px`,
        //         top: `${y}px`,
        //     });
        // }
        process_fixedpos();
    }
    fixedpos_behavior.name = 'fixedpos';
    // fixedpos_behavior.listen_on = ['scroll', 'resize', 'mousemove', 'click'];
    fixedpos_behavior.listen_on = ['scroll', 'resize'];
    define_layer(`
        @layer tooltip {
            [role="tooltip"] {
                position: fixed;
                pointer-events: none;
                --fixedpos: "describedby";
            }
        }`);


    define_behavior(fixedpos_behavior);
    // (window.behaviors ||= []).push(fixedpos_behavior);

    function selection_behavior(e) {
        let root = e.target.getRootNode();
        let style = getComputedStyle(e.target);

        function isChildOfParent(target, parent) {
            while(target && (target = target.parentNode)) {
                if(target === parent) return true;
            }
            return false;
        }
        // node.closest

        function toggle_target(target, detect, set, unset) {
            // TODO: close_children
            let style = getComputedStyle(target);
            let selection;
            if (selection = style.getPropertyValue('--selection')) {
                if (detect(target)) {
                    if (style.getPropertyValue('--multiselect') !== 'true') {
                        let others = target.parentNode.querySelectorAll(selection);
                        for (const other of others) {
                            if (other != e.target) unset(other);
                        }
                    }
                    set(target);
                    return true;
                } else if (style.getPropertyValue('--allow-deselect', 'true')) {
                    unset(target);
                    if (style.getPropertyValue('--unset-children') == 'true') {
                        // target.querySelectorAll('[aria-hidden="false"]')
                        // TODO:
                    }
                }
                return false;
            }
        }

        let selected = toggle_target(e.target,
                            d => d.getAttribute('aria-selected') !== 'true',
                            d => d.setAttribute('aria-selected', 'true'),
                            d => d.removeAttribute('aria-selected'));

        if (selected !== false) {
            let toggle = style.getPropertyValue('--toggle');
            let control;
            if (toggle === 'href') {
                control = root.querySelector(e.target.href);
            } else if (toggle) {
                control = e.querySelector(toggle);
            } else if (e.target.hasAttribute('aria-controls')) {
                control = root.getElementById(e.target.getAttribute('aria-controls'));
            }
            if (control) {
                toggle_target(control,
                          d => d.getAttribute('aria-hidden') !== 'true',
                          d => d.setAttribute('aria-hidden', 'true'),
                          d => d.setAttribute('aria-hidden', 'false'));
            }
        }

        // TODO: select-all, unselect-all


        // 按下按鈕而關閉
        if (e.target.ariaLabel == 'Close') {
            function find_parent_until(target) {
                while (target = target.parentNode) {
                    let style = getComputedStyle(target);
                    if (style.getPropertyValue('--collapse-by-close-label')) {
                        return target;
                    }
                }
            }
            let parent = find_parent_until(e.target);
            toggle_target(parent);
        }

        // 按到元素之外而關閉
        // [aria-expanded="true"]
        for (const expand of root.querySelectorAll('[aria-hidden="false"]')) {
            if (!isChildOfParent(e.target, expend)) {
                let style = getComputedStyle(expend);
                if (style.getPropertyValue('--collapse-on-click-outside')) {
                    toggle_target(expend);
                }
            }
        }

        // ESC鍵，而且不是在輸入法中
        if(e.keyCode === 27 && !e.isComposing) {
            const expends = [];
            for (const expend of root.activeElement.querySelectorAll('[aria-hidden="false"]')) {
                let style = getComputedStyle(expend);
                if (style.getPropertyValue('--collapse-on-esc')) {
                    expends.push(expend);
                }
            }
            // 對聚焦元件下，所有展開並且設定有--collapse-on-esc的元素中
            // 選取最後一個最內層的元素，把它關閉。
            for (const expend of expends.reverse()) {
                if (expends.all(exp => !isChildOfParent(exp, expend))) {
                    toggle_target(expend);
                    break;
                }
            }
        }

    }

    selection_behavior.name = 'selection';
    selection_behavior.capture = true;
    selection_behavior.listen_on = ['click'];
    (window.behaviors ||= []).push(selection_behavior);

    // TODO: 偵測向上捲動，向下捲動

})


</script>
</body>
</html>