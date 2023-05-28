
const isRectVisible = (r1) => !(
    r1.left == 0 && r1.top == 0 && r1.width == 0 && r1.height == 0);

// TODO?: get relative position of 'render layer'
function getRect(element) {
    const { top, left, width, height } = element.getBoundingClientRect();
    let ancestor = element.parentElement.closest('[data-flip-key]');
    const {top:a_top, left:a_left} = ancestor ? ancestor.getBoundingClientRect() :
                                              { top: 0, left: 0 };
    return {
        top: top - a_top,
        left: left - a_left,
        width, height,
    };
}


// function reset_animation() {
//   var el = document.getElementById('animated');
//   el.style.animation = 'none';
//   el.offsetHeight; /* trigger reflow */
//   el.style.animation = null;
// }

// frame流程，用「一個frame，一次render」就把動畫給搞定。
// 0. 觸發behavior，這有可能造成slot.update()而觸發render流程。
//    在這個一個階段盡量讀取需要的layout資訊存放到slot中，這樣可以減少render時reflow次數
// 1. 剛開始render的時候，還在比較高層級的地方，決定要進行動畫，並且把上次動畫停止(reflow-A)。
//    use reflow to apply the change
// 2. 首次製作快照(reflow-A)。
// 3. render動畫移動結束的狀態，利用exchange計算進出，妥善設置data-filp-key。這之間也可以快照中間影格。
// 4. render快結束時，執行fixedpos等等全局計算(reflow-B+)。安插在 after document.body
// 5. 進行最後一次快照(reflow-B)，並且安排動畫setStages。
// X. 動畫結束後，根據需要以slot.update()觸發下一次render流程。


document.querySelector('[data-flip-key="X"]').style.display = 'none';

let map = {};
[...document.querySelectorAll(`[data-flip-key]`)].forEach(element => {
    map[element.getAttribute('data-flip-key')] = {
        firstRect: getRect(element),
        element,
    };
});


document.querySelector('[data-flip-key="A"]').style.display = 'none';
document.querySelector('[data-flip-key="X"]').style.display = null;
document.querySelector('[data-flip-key="C"]').innerHTML = 'C';
let ul0 = document.querySelector('[data-flip-key="L1"]')
ul0.parentElement.append(ul0);
document.body.append(document.querySelector('[data-flip-key="C1"]'));


[...document.querySelectorAll(`[data-flip-key]`)].forEach(element => {
    let key = element.getAttribute('data-flip-key');
    let data = map[key];
    if (!data) {
        // Enter
        data = map[key] = {
            element,
            firstRect: getRect(element),
            lastRect: getRect(element),
            firstVisible: false,
            // lastVisible: isVisible(element),
        }
    } else if (data.element === element) {
        data.lastRect = getRect(element);
        // data.lastVisible = isVisible(element);
    } else {

    }
})

console.log(map);
Object.keys(map).forEach(set);


const evalvar = (v) => typeof v === 'function' ? v() : v;

const evaldur = (lastStart, lastEnd, head,
                 duration, delay, endDelay, total, at) => {
    duration = evalvar(duration);
    delay = evalvar(delay);
    endDelay = evalvar(endDelay);
    total = evalvar(total);
    at = evalvar(at);

    if (total)  duration = total - delay - endDelay;
    else        total = duration + delay + endDelay;

    let startTime = at || 0;
    if (typeof at === 'string') {
        let [_, refer, value, ratio] = at.match(/([<>]?)([+\-]?[\d\.]+)(%?)/);
        let startTime = refer === '<' ? lastStart :
                        refer === '>' ? lastEnd : head;
        if (ratio) {
            value = parseFloat(value) / 100;
            value *= refer === '<' ? (lastEnd - lastStart) :
                     refer === '>' ? (lastEnd - lastStart) : head;
        }
        startTime += value;
    }
    return {startTime, duration, delay, endDelay, total, at}
}

// const evalkeyframe = ({...attrs}) => {
//     let maxkeyframe = 0;
//     for (const [attr, array] of Object.entries(attrs)) {
//         attrs[attr] = Array.isArray(array) ? array : [array];
//         maxkeyframe = Math.max(maxkeyframe, attrs[attr].length);
//     }
//     for (const [attr, array] of Object.entries(attrs)) {
//         attrs[attr] = ensure_length(attrs[attr], maxkeyframe);
//     }
// }

const default_options = {
    easing: 'linear', duration: 0, delay: 0, endDelay: 0,
    total: null, at: null, onFinish: null}
function setStages2(timeline, defaultOptions) {
    defaultOptions = {...default_options, defaultOptions};

    let lastStart = 0, lastEnd = 0, head = 0;
    for (const [targets, attrs, options] of timeline) {
        let {easing, duration, delay, endDelay,
             total, at, onFinish} = {...defaultOptions, options};

        let keyframes = [];
        if (attrs) {
            let {dx, dy, widthRatio, heightRatio, opacity} = attrs;
            let iw_percent = `${1/widthRatio * 100}%`;
            let ih_percent = `${1/heightRatio * 100}%`;

            keyframes = [{
                transform: `translate(${-dx}px, ${-dy}px)`,
                opacity,
                clipPath: `polygon(0% 0%, ${iw_percent} 0, ${iw_percent} ${ih_percent}, 0 ${ih_percent})`
            }]
        }

        ({startTime, duration, delay, endDelay, total, at} = evaldur(
                lastStart, lastEnd, head, duration, delay, endDelay, total, at));

        lastStart = startTime;
        lastEnd = startTime + total;
        head = Math.max(head, lastEnd);
        yield [targets, keyframes,
               {startTime, delay, duration, endDelay, onFinish,
                composite: 'accumulate', fill: 'both'}];
    }
}

function setup(list, timeline) {
    let group = {};
    group.animations ||= []
    for (const [targets, keyframes, options] of list) {
        let animation;
        for (const target of targets) {
            let effect = new KeyframeEffect(target, keyframes, options)
            animation = new Animation(effect)
            animation._startTime = options.startTime;
            group.animations.push(animation);

            let onFinish = options.onFinish;
            if(options.leave) onFinish = e => {
                target.style.display = 'none'
                target.style.position = null;
                options.onFinish && options.onFinish(e);
            };
            onFinish && animation.addEventListener('finish', onFinish);
        }
    }
    const currentTime = Document.timeline.currentTime;
    for (const animation of group.animations) {
        animation.play();
        animation.startTime = currentTime + animation._startTime;
    }
    return () => group.animations.forEach(a => a.cancel());
}


function set(key) {
    let { firstRect: r0, lastRect: r1, element } = map[key];

    let dx = r1.left - r0.left;
    let dy = r1.top - r0.top;
    let widthRatio = r1.width / r0.width;
    let heightRatio =  r1.height / r0.height;
    let opacity = 1;
    const [isEnter, isLeave] = [!isRectVisible(r0) && isRectVisible(r1),
                                isRectVisible(r0) && !isRectVisible(r1)];

    if (isLeave) {
        element.style.display = null;
        element.style.position = 'absolute';
        [dx, dy, widthRatio, heightRatio] = [0, 0, 1, 1];
    } else if (isEnter) {
        [dx, dy, widthRatio, heightRatio, opacity] = [0, 0, 1, 1, 0];
    }
    // element.style.setProperty('--flip-s1-opacity', isLeave ? 0 : 1);

    setStages(element, [{stage: {dx, dy, widthRatio, heightRatio, opacity},
                         duration: 3000}])

    element.dataset.flipState = isLeave ? 'move-leave' : 'move';
}













function setStages(element, timeline) {
    let wait = 0;
    let stages = [];
    for (const [n, {stage, duration, delay=0}] of timeline.entries()) {
        let {dx, dy, widthRatio, heightRatio, opacity} = stage;
        element.style.setProperty(`--flip-s${n}-inverse-xy`, `translate(${-dx}px, ${-dy}px)`);
        element.style.setProperty(`--flip-s${n}-iw-ratio`, `${1/widthRatio}`);
        element.style.setProperty(`--flip-s${n}-ih-ratio`, `${1/heightRatio}`);
        element.style.setProperty(`--flip-s${n}-opacity`, opacity);
        wait += delay;
        element.style.setProperty(`--flip-s${n+1}-delay`, `${wait}ms`);
        element.style.setProperty(`--flip-s${n+1}-duration`, `${duration}ms`);
        wait += duration;
        stages.push(`stage${n+1}`);
    }
    element.style.setProperty('--flip-stages', stages.join(','));
}

function animate_style() {
    const attrs = (n) => `
        transform: var(--flip-s${n}-inverse-xy, none);
        opacity: var(--flip-s${n}-opacity, 1);
        clip-path: polygon(0% 0%, calc(var(--flip-s${n}-iw-ratio, 1) * 100%) 0, calc(var(--flip-s${n}-iw-ratio, 1) * 100%) calc(var(--flip-s${n}-ih-ratio, 1) * 100%), 0 calc(var(--flip-s${n}-ih-ratio, 1) * 100%));
    `
    const range = [1,2,3,4];
    return range.map(n =>`
    @keyframes stage${n} {
        from { ${attrs(n-1)} }
        to { ${attrs(n)} }
    }`).join('') + `
    [data-flip-state] {
        will-change: transform;
    }
    [data-flip-state^="move"] {
        animation-name: var(--flip-stages);
        animation-delay: ${range.map(n => `var(--flip-s${n}-delay, 0s)`).join(',')};
        animation-duration: ${range.map(n => `var(--flip-s${n}-duration, 0s)`).join(',')};
        animation-timing-function: ease-in-out;
    }
    `;
}
let style = document.createElement('style');
style.innerHTML = animate_style()
// style.appendChild(document.createTextNode(animate_style()));
document.body.prepend(style);

window.addEventListener('animationend', (e) => {
    if (e.target.dataset.flipState &&
        e.target.dataset.flipState.startsWith('move')) {
        if (e.target.dataset.flipState === 'move-leave') {
            e.target.style.display = 'none'
            e.target.style.position = null;
        }
        for (const attr of [...e.target.style]) {
            attr.startsWith('--flip-') && e.target.style.setProperty(attr, null);
        }
        e.target.removeAttribute('data-flip-state');
    }
});


