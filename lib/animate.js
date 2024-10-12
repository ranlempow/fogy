
// 參考資料
// [animejs][https://animejs.com/documentation/]
// [GSAP][https://gsap.com/cheatsheet/]



// defined in behavior.js
//
// const isRectVisible = (r1) => !(
//     r1.left == 0 && r1.top == 0 && r1.width == 0 && r1.height == 0);


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

class Flip {
    query;
    state1;
    state2;

    getOneState(element) {
        const exist = element.style.display !== 'none';
        let opacity = element.style.opacity;
        opacity = opacity === undefined || opacity === '' ? 1 : opacity;
        return {
            rect: getRect(element),
            opacity,
            exist,
        }
    }
    snapshot(targets) {
        if (typeof targets === 'string') {
            targets = [...document.querySelectorAll(targets)];
        } else if (!Array.isArray(targets)) {
            targets = [targets];
        }
        const state = Object.fromEntries(targets.map((e, i) =>
            [e.dataset.flipKey ?? `${i}`, this.getOneState(e)]));
        return {targets, state};
    }

    getStage2() {
        const {targets, state} = this.snapshot(this.query);
        this.state2 = state;

        const elemMap = Object.fromEntries(targets.map((e, i) =>
            [e.dataset.flipKey ?? `${i}`, e]));

        let keys = new Set([...Object.keys(this.state1),
                            ...Object.keys(this.state2)]);

        let pairs = [];
        for (const k of keys) {
            let firstRect, lastRect, isEnter = false, isLeave = false, element,
                firstOpacity = 1, lastOpacity = 1;

            if (!this.state1[k]) {
                firstRect = lastRect = this.state2[k].rect;
                firstOpacity = lastOpacity = this.state2[k].opacity;
                if (!this.state2[k].exist) {
                    continue;
                }
                isEnter = true;
            } else if (!this.state2[k]) {
                continue;
            } else {
                firstRect = this.state1[k].rect;
                lastRect = this.state2[k].rect;
                firstOpacity = this.state1[k].opacity;
                lastOpacity = this.state2[k].opacity;
                if (!this.state1[k].exist && !this.state2[k].exist) {
                    continue
                }
                !this.state1[k].exist && (isEnter = true);
                !this.state2[k].exist && (isLeave = true);
            }
            element = elemMap[k];
            pairs.push({firstRect, lastRect,
                        firstOpacity, lastOpacity,
                        isEnter, isLeave, element});
        }
        return pairs;
    }
}

Flip.getState = function (targets, options) {
    const fp = new Flip();
    fp.query = targets;
    const {state} = fp.snapshot(fp.query);
    fp.state1 = state;
    return fp;
    // fp.state1 = Object.fromEntries(targets.map((e, i) =>
    //     [element.dataset.flipKey ?? `${i}`, getRect(element)]));
    // fp.query = targets;
    
    // options.props
    // for (const element of targets) {
    //     let key = element.dataset.flipKey ??;
    //     let rect = getRect(element);
    // }
}

// window.addEventListener('animationend', (e) => {
//     if (e.target.dataset.flipState &&
//         e.target.dataset.flipState.startsWith('move')) {
//         if (e.target.dataset.flipState === 'move-leave') {
//             e.target.style.display = 'none'
//             e.target.style.position = null;
//         }
//         for (const attr of [...e.target.style]) {
//             attr.startsWith('--flip-') && e.target.style.setProperty(attr, null);
//         }
//         e.target.removeAttribute('data-flip-state');
//     }
// });

Flip.set = function(timeline, vars, position, pair) {

    let {firstRect: r0, lastRect: r1,
         firstOpacity: op0, lastOpacity: op1,
         isEnter, isLeave, element} = pair;
    let dx = r1.left - r0.left;
    let dy = r1.top - r0.top;
    let widthRatio = r1.width / r0.width;
    let heightRatio =  r1.height / r0.height;
    let opacity = op0;
    // const [isEnter, isLeave] = [!isRectVisible(r0) && isRectVisible(r1),
    //                             isRectVisible(r0) && !isRectVisible(r1)];

    if (isLeave) {
        // TODO: ?
        // element.style.display = null;
        // element.style.position = 'absolute';
        element.style.opacity = 0;
        [dx, dy, widthRatio, heightRatio, opacity] = [0, 0, 1, 1, 1];
    } else if (isEnter) {
        [dx, dy, widthRatio, heightRatio, opacity] = [0, 0, 1, 1, 0];
    }
    // element.style.setProperty('--flip-s1-opacity', isLeave ? 0 : 1);
    // setStages(element, [{stage: {dx, dy, widthRatio, heightRatio, opacity},
    //                      duration: 3000}]);
    timeline.from(element,
                 {dx, dy, widthRatio, heightRatio, opacity, ...vars},
                 position);

    element.dataset.flipState = isLeave ? 'move-leave' : 'move';
}





const DEFAULT_OPTIONS = {
    easing: 'linear', duration: 0, delay: 0, endDelay: 0,
    total: null, at: null, onFinish: null}

class Tween {
    timeline;
    targets = [];
    prevAttrs;
    attrs;
    // attrs = {dx:0, dy:0, widthRatio:1, heightRatio:1, opacity:1};
    timing = {startTime: 0, duration: 0, delay: 0, endDelay: 0};
    easing = 'linear';
    onFinish = null;

    get total() { return this.timing.delay +
                         this.timing.duration +
                         this.timing.endDelay; }
    get startTime() { return this.timing.startTime; }
    get endTime() { return this.startTime + this.total; }

    to(vars) {
        return this.timeline.fromTo(this.targets, this.attrs, vars, this.endTime);
    }

    _toAnimationArgs() {
        const makekeyframe = (attrs, offset) => {
            let {dx, dy, widthRatio=1, heightRatio=1, opacity, ...otherAttrs} = attrs;
            let iw_percent = `${1/widthRatio * 100}%`;
            let ih_percent = `${1/heightRatio * 100}%`;
            return {
                ...(dx || dy ? {transform: `translate(${dx ? -dx : 0}px, ${dy ? -dy : 0}px)`} : {}),
                ...(opacity !== undefined ? {opacity: opacity} : {}),
                ...(iw_percent !== '100%' || ih_percent !== '100%' ?
                    {clipPath: `polygon(0% 0%, ${iw_percent} 0, ${iw_percent} ${ih_percent}, 0 ${ih_percent})`} : {}),
                ...otherAttrs,
                offset,
            }
        }
        let keyframes = [
            ...(this.prevAttrs ? [makekeyframe(this.prevAttrs, 0)] : []),
            ...(this.attrs ? [makekeyframe(this.attrs, 1)] : []),
        ]
        return {targets: this.targets,
                keyframes,
                options: {...this.timing,
                          easing: this.easing,
                          onFinish: this.onFinish,
                          composite: 'accumulate', fill: 'both'}};
    }
}


class AnimationGroup {
    animations = [];
    cancel() {
        this.animations.forEach(a => a.cancel());
    }
    finish() {
        this.animations.forEach(a => a.finish());
    }
    play(currentTime) {
        currentTime ??= document.timeline.currentTime;
        this.animations.forEach(a => {
            a.play();
            a.startTime = currentTime + (a._startTime ?? 0);
        });
    }
    discard() {
        this.finish();
        for (const animation of this.animations) {
            animation.removeEventListener("finish", this.onFinish);
        }
        this.cancel();
        this.animations.length = 0;
    }
    onFinish() {
        let allFinished = true;
        for (const animation of this.animations) {
            allFinished &&= animation.playState === 'finished';
        }
        if (allFinished) {
            this.cancel();
            this.animations.length = 0;
        }
    }
    setStage(timeline) {
        this.discard();
        for (const tween of timeline.cuts) {
            let {targets, keyframes, options} = tween._toAnimationArgs();
            for (const target of targets) {
                let effect = new KeyframeEffect(target, keyframes, options);
                let animation = new Animation(effect)
                animation._startTime = options.startTime;
                animation.addEventListener("finish", () => this.onFinish());
                if (options.onFinish) {
                    animation.addEventListener("finish", options.onFinish);
                }
                if (options.onCancel) {
                    animation.addEventListener("cancel", options.onCancel);
                }
                this.animations.push(animation);
            }
        }
    }
}

const evalvar = (v) => typeof v === 'function' ? v() : v;

class Timeline {
    // target by string key first, bind element later


    // cuts = [{
    //     targets: [],
    //     attrs: {dx:0, dy:0, widthRatio:1, heightRatio:1, opacity:1},
    //     options: {...DEFAULT_OPTIONS},
    // }];
    cuts = [];
    labels = {};
    flipKey = {};
    targetMap = {};

    constructor(defaultOptions = {}) {
        this.defaultOptions = {
            ...DEFAULT_OPTIONS,
            ...defaultOptions,
        }
    }

    parsePosition(tween, position) {
        // "+=1" - 1 second past the end of the timeline (creates a gap)
        // "-=1" - 1 second before the end of the timeline (overlaps)
        // "myLabel+=2" - 2 seconds past the label "myLabel"
        // "<+=3" - 3 seconds past the start of the previous animation
        // "<3" - same as "<+=3" (see above) ("+=" is implied when following "<" or ">")
        // ">-0.5" - 0.5 seconds before the end of the previous animation. It's like saying "the end of the previous animation plus -0.5"
        // "-=25%" - overlap with the end of the timeline by 25% of the inserting animation's total duration
        // "+=50%" - beyond the end of the timeline by 50% of the inserting animation's total duration, creating a gap
        // "<25%" - 25% into the previous animation (from its start). Same as ">-75%" which is negative 75% from the end of the previous animation.
        // "<+=25%" - 25% of the inserting animation's total duration past the start of the previous animation. Different than "<25%" whose percentage is based on the previous animation's total duration whereas anything immediately following "+=" or "-=" is based on the inserting animation's total duration.
        if (typeof position === 'number') {
            return position;
        }
        let m = /([<>]|\w+)?([+\-]=?)?([\d\.]+)?(%)?/.exec(position);
        let [_, ref, add, secend, percent] = m;
        secend ??= 0;
        secend = parseFloat(secend);
        secend *= add && add.startsWith('-') ? -1 : 1;
        if (percent) {
            if (!ref && !add) {
                throw new Error('percent position must combine with ">", "<" or "+=", "-=" ');
            }
            percent = secend / 100;
            if (add.endsWith('=')) {
                if (!tween) {
                    throw new Error('label position cannot be "+=", "-="');
                }
                secend = percent * (tween.tailTime ?? tween.total);
            } else {
                secend = percent * this.lastTween.total;
            }
        }
        if (!ref) {
            return this.tailTime + secend;
        } else if (ref === '<') {
            return this.lastTween.startTime + secend;
        } else if (ref === '>') {
            return this.lastTween.endTime + secend;
        } else {
            if (this.labels[ref] === undefined) {
                throw new Error(`label "${ref} not found"`);
            }
            return this.labels[ref] + secend;
        }
    }

    // label(label, position = "+=0") {
    //     this.labels[label] = parsePosition(null, position);
    // }

    add(timeline, position = "+=0") {
        if (typeof timeline === 'string') {
            // return this.label(timeline, position);
            this.labels[timeline] = parsePosition(null, position);
        } else if (timeline instanceof Timeline) {
            let offset = parsePosition(timeline, position);
            for (const tween of timeline.cuts) {
                const newTween = new Tween();
                // TODO: tween.prevTween
                newTween.targets = [...tween.targets];
                tween.prevAttrs && (newTween.prevAttrs = {...tween.prevAttrs});
                tween.attrs && (newTween.attrs = {...tween.attrs});
                newTween.easing = newTween.easing;
                newTween.onFinish = newTween.onFinish;
                newTween.timing = {...tween.timing};
                newTween.timing.startTime += t;
                this.cuts.push(newTween);
            }
            for (const [label, t] of Object.entries(timeline.labels)) {
                this.labels[label] = offset + t;
            }
        } else {
            throw new Error('arg1 should be label or timeline');
        }
    }

    _tween(targets, prevAttrs, attrs, options, position = "+=0") {
        let {easing = 'linear', duration = 0, delay = 0, endDelay = 0,
             total = null, at = null, onFinish = null} = options;
        duration = evalvar(duration) ?? 0;
        delay = evalvar(delay) ?? 0;
        endDelay = evalvar(endDelay) ?? 0;
        total = evalvar(total) ?? 0;
        at = evalvar(at);
        if (total) {
            duration = total - delay - endDelay;
        }
        const timing = {
            duration, delay, endDelay
        }
        timing.startTime = this.parsePosition(timing, at ?? position);
        const tween = new Tween();
        tween.timeline = this;
        tween.targets = targets;
        tween.prevAttrs = prevAttrs;
        tween.attrs = attrs;
        tween.timing = timing;
        tween.easing = easing;
        tween.onFinish = onFinish;
        this.cuts.push(tween);
        return tween;
    }

    _get_options_from_vars(target, vars) {
        let targets = Array.isArray(target) ? target : [target];
        let {easing = 'linear', duration = 0, delay = 0, endDelay = 0,
             total = null, at = null, onFinish = null, ...attrs} = {
                ...this.defaultOptions, ...vars
            };
        let options = {easing, duration, delay, endDelay,
                       total, at, onFinish};
        return {targets, attrs, options};
    }
    to(target, vars, position = "+=0") {
        const {targets, attrs, options} = this._get_options_from_vars(target, vars);
        return this._tween(targets, null, attrs, options, position);
    }
    from(target, vars, position = "+=0") {
        const {targets, attrs, options} = this._get_options_from_vars(target, vars);
        if (target instanceof Flip) {
            // animate from the previous state to the current one
            const pairs = target.getStage2()
            let pos = this.parsePosition(null, position);
            for (let pair of pairs) {
                Flip.set(this, vars, pos, pair);
            }
        } else {
            return this._tween(targets, attrs, null, options, position);
        }
    }
    fromTo(target, vars1, vars2, position = "+=0") {
        const {targets, attrs: attrs1, options: options1} =
            this._get_options_from_vars(target, vars1);
        const {attrs: attrs2, options: options2} =
            this._get_options_from_vars(target, vars2);

        return this._tween(targets, attrs1, attrs2, {...options2}, position);
    }

    get lastTween() {
        return this.cuts.length && this.cuts[-1] || undefined;
    }
    get tailTime() {
        return Math.max(0, ...this.cuts.map(tween => tween.endTime));
    }

    group() {
        const group = new AnimationGroup();
        group.setStages(this);
        return group;
    }
}




// function setStages2(timeline, defaultOptions) {
//     defaultOptions = {...DEFAULT_OPTIONS, ...(defaultOptions ?? {})};

//     let lastStart = 0, lastEnd = 0, head = 0;
//     for (const {targets, attrs, options} of timeline) {
//         let {easing, duration, delay, endDelay,
//              total, at, onFinish} = {...defaultOptions, ...(options ?? {})};

//         let keyframes = [];
//         if (attrs) {
//             let {dx, dy, widthRatio, heightRatio, opacity} = attrs;
//             let iw_percent = `${1/widthRatio * 100}%`;
//             let ih_percent = `${1/heightRatio * 100}%`;

//             keyframes = [{
//                 transform: `translate(${-dx}px, ${-dy}px)`,
//                 opacity,
//                 clipPath: `polygon(0% 0%, ${iw_percent} 0, ${iw_percent} ${ih_percent}, 0 ${ih_percent})`
//             }]
//         }

//         ({startTime, duration, delay, endDelay, total, at} = evaldur(
//                 lastStart, lastEnd, head, duration, delay, endDelay, total, at));

//         lastStart = startTime;
//         lastEnd = startTime + total;
//         head = Math.max(head, lastEnd);
//         yield {targets, keyframes,
//                options: {startTime, delay, duration, endDelay, onFinish,
//                          composite: 'accumulate', fill: 'both'}};
//     }
// }





// function setup(group, list) {
//     for (const {targets, keyframes, options} of list) {
//         for (const target of targets) {
//             let effect = new KeyframeEffect(target, keyframes, options);
//             let animation = new Animation(effect)
//             animation._startTime = options.startTime;
//             group.animations.push(animation);
//             // let onFinish = options.onFinish;
//             // if (options.leave) onFinish = e => {
//             //     target.style.display = 'none'
//             //     target.style.position = null;
//             //     options.onFinish && options.onFinish(e);
//             // };
//             // onFinish && animation.addEventListener('finish', onFinish);
//         }
//     }
// }



