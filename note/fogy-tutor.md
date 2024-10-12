
## MV的要點

Model **非V**
Controller **MV**
View **純V**


自己無法處理的事件，轉給更高層的View處理。
各個擊破，將狀態向下傳遞。

讓View給我一個hValue
直接render是由下至上組合hValue，透過mount則改成由上至下求值。

變更事件向上傳遞，模型資料向下傳遞。

View
Slot 有自己的內部狀態，狀態依附在slot上，感知節點歷史。
Entry
    局部的最高層，完全獨立狀態，是一個物件。適合攔截行動。
    Entry不會被上層影響，除非自己update

this.from


ＭＶ同步: 即時同步/推估同步


// TODO: actions與event系統更多的綁定
// (X)withoutRedraw default?
// (O)entry = action/event handler/updater
// (O)error capture default?
// (O)norenderchildren?
// (X)alwaysRedrawSlots? function format?

(O) event `() => {}`  // autoredraw
(O) event `function() {}`  // no autoredraw

pure renderer  `() => {}`               // no prototype, check props change
pure async renderer `async () => {}`    // no prototype, check props change
transform renderer (this == from 時，一定要回傳空值) `function() {}`
async generate renderer `async function *() {}` // check props change
instance renderer (使用到this與class) `class { render() {} }` // is a entry, errorCatcher


## render流程詳解

```js
function () {
    let returned_hValue = h`...`;
    mount(returned_hValue, this);   // 1. eval and swap all content
    render(this);                   // 2. render all subslots
    render(returned_hValue, this);  // do 1 and 2
    h(this.element, ...)            // set attribute or style after render
    // leave frame
}

function() {
    mount(renderer, {after: this.slots.YYY})    // insert slot after YYY
    mount(renderer(props), this.slots.ZZZ);     // set new props to ZZZ
    render(this.slots.XXX);         // render XXX subslot first
    h(this.element, [other_hValue]) // set hvalue directly
    mount(undefined, this);         // eval already placed content and no swap
    render(this);                   // render all subslots but XXX
    // leave frame
}

update(slot)                        // mark the active slot/parentEntry must update
update(element)                     // mark the nearest slot/parentEntry must update
update(document)                    // mark the toplevel must update

update.auto = false;
render(document)                    // render everything, very expensive but simple


function A() {
    window.req = 1;
}
A.prototype.afterUnmount = () => delete window.req;


mount.defaultToplevel ||= document.firstChild;
renderer.defaultMount = { headOf: xxx };



// 以下幾個a()等價
const a = ({data1, data2}) => h`${h(b)(data1)}${h(b)(data2)}`;

function a({data1, data2}) {
    return h`${h(b)(data1)}${h(b)(data2)}`;
}

function a({data1, data2}) {
    render(h(b)(data1), this.slots.b1 || {tailOf: this});
    render(h(b)(data2), this.slots.b2 || {tailOf: this});
}

function a({data1, data2}) {
    mount(null, this);
    mount(h(b)(data1), {tailOf: this});
    mount(h(b)(data2), {tailOf: this});
    render(this.slots.b1);
    render(this.slots.b2);
}



function full({from}) {
    if (!from) {
        // init
        this.afterUnmount(() => {
            // deinit
        })
    }
    // mount child
    // render child
}

async function* full2() {
    // init
    try {
        // mount child
        // render child       
        yield
    } finally {
        // deinit
    }
}


function change_view_or_data({view, data}) {
    mount(h(view)('_1', data), this.slots._1 || {tailOf: this});
}

// 打行李箱內的畫拿出來掛吧
// 掛與畫
// 打草稿與完稿

function c() {
    mount(h(view)('_1', data1), {tailOf: this});
    mount(h(view)('_2', data1), {tailOf: this});

    // 更換 render，執行umount，執行update
    mount(h(anotherView), this.slots._1);

    // 更換 getter，不執行umount，執行update
    mount(h(view)(anotherData), this.slots._1);
    
    // 移動 slot，不執行umount，不執行update，外部重新sort
    mount(this.slots._1, {tailOf: this});
    mount(this.slots._1, {after: this.slots._2});
    mount(this.slots._1, this.slots._2);

    // 移動 node
    mount(this.elements[0], {after: this.elements[2]});
    
    // 設定hValue 到普通的node
    mount(fragment, {after: this.elements[2]});
    
    // 設定hValue，執行update，內部重新sort
    mount(null, this.slots._1);
    mount(null, {contentOf: this.slots._1});
    mount(fragemnt, this.slots._1);

    // 對內容求值，執行update，內部重新sort
    mount(undefined, this.slots._1);

}
```


## 對於frame有著更明確的定義

首次呼叫render後會進入frame之中
在frame之中「走訪」是被定義的
frame結束後執行累積的AfterUnmount

這些只有rootFrame擁有
renderQueue
renderEntries
monitorAfterUnmount

這些只有redrawFrame擁有
slotStack = []
redrawRoot = null

這些每個frame都有
objectCache



## 重新思考redraw/render = frame，如何更高效能實現

frame 之中呼叫
update()
mount()
unmount()
render()
會有不同影響


1. 有人呼叫parent.update()
2. slot.pure && hash(slot, props) 或 slot.hash && !slot.hash(props)

兩個條件都滿足後才會呼叫renderer



```js
h(window.querySelector('body'), [view(props)]);
```


fogy 是直覺了當的，稍微熟悉之後一眼就能看出程式的問題出在哪。
而不是弄出難以閱讀的程式碼後，冀望編譯器能夠辨識出深陷其中的瑕疵。

fogy的效能不比React差，而且更容易優化。
fogy的GC友善度更高，長時間運行的強固性更好。

fogy是極簡的，不希望開發者的腦袋死記更多呼叫，也不希望消耗更多記憶體還有載入時間。
fogy簡單到只需要瀏覽器就能夠練習，把整個程式庫貼上開發命令列之後，就能以互動形式在瀏覽器中練習fogy。
Learn Nothing is best

對於fogy使用ES6最新功能，其實是一個誤會，fogy的概念早在ES6之前就已經成形。



適合放在props的物件
    Promise/defered
    renderer
    Node
    hValue
    query function


render 可以是個function/async function/asycn generator
render 可以回傳hvalue/undefined/Promise?

slot.xxx        最好只存放常數性質的變數
slot.state.xxx  存放隨著render一直改變的變數，設定之後會自動update
slot.local.xxx  會自動udpate的變數
slot.global.xxx 全部slot共享的變數
slot.frame.xxx  全部slot在frame中共享的變數，設置後不能改變？

props傳遞的重要性
狀態保留在何處? view的狀態是可棄置的。
到底是model狀態還是view狀態
不提供額外複雜度，除非你真的需要這些功能。
使用瀏覽器內建機制，能夠與其他函示庫接軌。
透過工廠方法，靜態組合一群renderer。


renderstack? 跳級傳遞的方式? 更方便傳遞props的方式? 比getter更直覺的方式?
用frame來跨層傳遞全域物件


htmlValue Node/Slot
htmlValue style
htmlValue listener
function renderer
htmlValue renderer()
htmlValue h(renderer)                   // bound
htmlValue h(h(renderer))
htmlValue h(renderer)(props)
htmlValue h(renderer)(key, props)
htmlValue h(renderer)(props)(props)     // rebind
htmlValue h(renderer)(props => props)
htmlValue h(element, ...children);
htmlString h([...htmlValues])
htmlString h'';


mountValue h(renderer)(...)
mountValue h(mountValue)
mountValue mountValue(...)

NodeValue Node|NodeList
(HIDE)NodeValue h('template', ...renderValue)
(use fragment)NodeValue h('text', ...string)
(rename to '>')NodeValue h('fragment', ...children)
NodeValue h(NodeValue, ...children)
NodeValue h(Fragment, ...children)
NodeValue h(spec, ...children)
NodeValue h('>', ...children)
children  string|h|attributes|NodeValue|[...renderValue|mountValue]

// TODO: quote, 這應該不需要做
hValue string
hValue h([...renderValue|mountValue])
hValue h.html(...renderValue|mountValue)
hValue h'${renderValue|mountValue|listener|style}'
renderValue NodeValue|hValue
renderValue renderer(...)


// renderer : function | htmlValue

slot mount(slot[, options])  // (remount?)
slot mount(renderer[, options])
slot mount(renderer, target[, options])
slot mount(hValue, target);

slot umount(slot)
slot umount(renderer)

(X)Node render()       要求先渲染子節點
(X)Node render(null)   要求跳過渲染子節點
(X)Node render(this)   要求先渲染自己，不包含子結點

Node render(null)               (TODO)要求跳過渲染子節點
Node render(null, slot)         要求跳過渲染特定節點
Node render(this)               要求先渲染子節點
Node render(hValue, this)       要求先渲染自己，再渲染子結點
Node render(slot)               要求先渲染特定節點

Node render();
Node render(slot[[, data], options])
Node render(target);
Node render(renderer[, data])
Node render(renderer, target[, data])
Node render(hValue[, data]);
Node render(hValue, target[, data]);








mount('element-id', renderer);
mount(e, render);
mount(['contentOf', e], renderer);
mount({headOf: document}, renderer);
mount(slot, transform);

render(slot);
render(slot, data, options)
render(renderer, data, options)
render(target, renderer, data, options)

render({contentOf: '#abc'}, renderer)


slot.update(slot)
nearestEntry(node).update()

slot.unmount()
    unmount(slot, options);
    unmount(slot, transfrom);
slot.slots
slot.nodes
slot.state
slot.selectAll()
slot.swap()

this.slot 用在Class instance中

彈性的選用物件導向，是fogy的特色。
instance renderer用class還算適合，pure renderer不用Function就稍嫌多餘。
fogy不使用任何繼承體系，你可以將繼承用在自己的架構上。

h.require('script.js');
h.require('script.mjs');
h.require('script text');

h.use('script.js');
h.use('script.mjs');
h.use('script text');


## 202406

因此現有的架構很容易遇到幾個問題：

- 為了復用一些現有的元件（頁面），我們需要將常用的檔案（元件）拆開來，現有的 JavaScript 並沒有辦法很容易做到這件事。
- 為了確保彼此的相依性（例如載入 bootstrap modal 時，我們要確保 jQuery 載入），以往的做法是直接把所有相依性全部塞到網頁 `<script>` 中。
- 在修改某幾筆資料時，希望所有用到這個資料的元件或頁面都可以自動更新。
- 怎麼有效地管理各種狀態

管理狀態一直是開發上的難題之一，尤其是在前端那麼多狀態共存的情況下，怎麼優雅地管理狀態就是一大問題，到底管理狀態難在哪裡？

今天會從前端狀態管理遇到的問題跟 redux 試圖解決的問題談狀態管理。

- 狀態容易被意外地改變，導致不好預測
- 狀態可能被多個元件共享，如果想要在不同元件間共享狀態就要層層傳遞 prop
- 在元件內撰寫改變狀態的邏輯，很容易讓元件變得臃腫肥大
- 如果要做非同步的行為，像是 call API、讀取 File 等等，再搭配改變狀態的邏輯，全部寫在元件當中會相當不容易管理。
- 在狀態改變時，我們希望通知所有監聽此狀態的元件或邏輯


fogy採用節制的單向資料流。

原則上，父給予子屬性，資料從父元件往子元件移動。


雙向資料流並不限定資料源，可以從 model 而來，也可以從 input 而來。


- Input
- Textarea
- Radiobutton
- Checkbox
- Select/Option

這類元素都有一個共通性，就是都是屬於「通用性質」的元素，原則上他內部怎麼運作的對用的人也不需要了解，沒有依賴其他的程式可以適用在每一個地方的。

和這類元素同樣性質的Component我估且把他稱之為「通用組件」，可以是我們自製的表單元素、或者是一樣小型的組件。

這類型的「通用組件」如果還是使用「單向資料流」，就顯得有點脫褲子放屁、太過麻煩了。


一些難以察覺的頁面狀態

- 捲動位置
- 文字選取
- hover狀態
- 輸入法狀態
- 拖曳的目的
- 滑鼠位置
- 動畫剩餘秒數
- 鍵盤按下狀態
- 聚焦的元件

其他不適合放到model中的狀態

- TAB切換
- 選單中選取的項目
- 文字編輯器的狀態
- 輸入到一半的文字
- 步驟記錄（用於可以復原的動作）
- 彈出的tooltip
- 彈出的modal, offscreen

爭議性狀態

- 縮放比例
- 網路連線狀態
- 所在頁面(網址歷史)
- 分頁列表的所在分頁


如果這些都要同步到model之中則，model將太過複雜肥大。

於是，很遺憾的，怎麼樣都無法避免，會有兩組狀態儲存在不同的地方。這樣的雙重真相，對於狀態管理傷害很大。

即使是在單向資料流之中，我們也必須承認，文件節點值得擁有他專屬的內部狀態。

這些文件節點內部狀態，不屬於model，也不會即時同步給model。

打開一個後門讓model可以與文件節點直接溝通，看似是一個不負責任的想法。

對於這些有內部狀態的元件，將以slot作為溝通的介面。元件內部狀態不另外存放在js變數，而是直接存在文件節點之中。需要得知內部狀態時，用slot.query查詢

slot.query.xxx 可以查詢元件內部狀態
(X)slot.method() 可以改變元件內部狀態
(O)改變內部狀態還是以傳遞props為主

如此回到了物件導向的老步調。

slot.state 是儲存在slot之中的組件內部狀態
slot.query 是隱含在文件節點的內部狀態(這是三者裡唯一的公開API)
slot.nodes 文件節點本身也是一種狀態

以上這些就是組件可以自我管理的狀態，這些狀態在不同的render之間可以保持。
不但組件本身可以調用，回呼到上層事件，也能夠讓上層調用。
由於正常slot的宣染是由上至下，因此，
上層render時如果呼叫下層的slot.query，得到的是上個frame的狀態。
如果是事件回呼中呼叫slot.query，得到的是frame之外的最新狀態。




## 範例


```js
let main = () => h`<div>Hello World!</div>`;

render(document.body, main);
```


```js

let main = ({global}) => {
    global.n ||= 0;
    return h`<span>you are click ${global.n} times.</span>
             <button onclick=${e => global.n += 1}>click me!</button>`;
}
mount(document.body, main);

```


```js

function main() {
    let onclick = e => {
        n += 1;
        // this.update();
    }
    return h`<span>you are click ${n} times.</span>
             <button :onclick=${onclick}>click me!</button>`;
}
var n = 0;
mount(document.body, main);

```


```js

let banner = ({times}) => h`you are click ${times} times.`;

function main({times}) {
    let onclick = e => {
        data.times += 1;
        // this.update(); // equal to `app.update()`
    }
    return h`<span>${banner({times})}</span>
             <button onclick=${onclick}>click me!</button>`;
}

var data = { times: 0 };
var app = mount(document.body, h(main)(data));

```


```js
let banner = ({times}) => h`you are click ${times} times.`;

function main() {
    if (this.init) return;
    let onclick = e => {
        data.times += 1;
        // this.update();
    }
    return h`<span>${h(banner)}</span>
             <button onclick=${onclick}>click me!</button>`;
}

var data = { times: 0 };
var app = mount(document.body, h(main)(data));
```



```js

let banner = ({times}) => h`you are click ${times} times.`;

function main({times}) {
    if (!this.init) {
        this.span = h('span');
        let onclick = e => {
            data.times += 1;
            // this.update();
        }
        return h`${this.span}
                 <button onclick=${onclick}>click me!</button>`;
    }
    render(this.span, banner, {times});
}

var data = { times: 0 };
var app = mount(document.body, h(main)(data));
```







```js

function Animate(props) {
    let target = h(props.target);
    if (!from)
        return target;
}

function ButtonText(props) {

}

function Button(props) {
    let { Animate } = this.global;
    return h`<button>${ Animate({target: ButtonText}) }</button>`    
}

function Main(props, from) {
    if(!from) {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const nullAnimate = (props) => props.target;
        const handleChange = () => 
            this.global.Animate = mq.matches ? Animate : nullAnimate;
        handleChange();
        mq.addEventListener('change', handleChange);
        this.afterremove = () =>
            mq.removeEventListener('change', handleChange);

        return `you may want this. ${Button}`
    }
}



h.mount(document.body, main);
```









```js
function my_renderer4(props, from) {
    if (from && from.hash === props.a) return;
    if (this.slots) {
        this.hash = props.a;
    }
    const transform_renderer = { renderer: listOf,
                    getter: props => ({ items: props.objs,
                                        renderer: obj => obj_renderer,
                                        key: obj => obj.a }) }
    return `<div>
                ${ place(pure_renderer(props)) }
                ${ place(props.comp1) }
                ${ place(transform_renderer) }
            </div>`;
}
```


```js
function movieArtical({url = null}) {
    if (!url) {
        return `<div>empty</div>`
    } else if (this.url !== url) {
        this.url = url;
        fetch(url || 'http://example.com/movies.json')
            .then(response => response.json())
            .then(json => {
                this.movie = json;
                update(this);
            });
        return `<div>loading</div>`
    } else if (this.movie) {
        return `<div>${this.movie.name}</div>`
    }
}
```


```js
function movieMenu({movies}) {
    const list = movies.map({name, url} => `<li><a href="${url}">${name}</a></li>`);
    return `<ul>${list.join('')}</ul>
            <div>${place(movieArtical)}</div>`
}
moviesMenu.prototype.events = {
    click: function(e) { 
        if (e.target.href) {
            document.dispatchEvent(new Event('movieClick'));
            // update(e.targetSlot);
            fetch(e.target.href)
                .then(response => response.json())
                .then(json => {
                    document.dispatchEvent(new CustomEvent('movieLoad',
                        { detail: { movie: json } });
                    // update(e.targetSlot, {url, ...myJson})
                });
        }
    },
}

function main() {
    if (!this.movieLists) {
        this.movieLists = {};
        mount('movieView', {renderer: movieView, getter: this.movieLists});
    }
    for (const e of window.actions) {
        switch(e.type) {
            case 'movieClick':
                this.movieLists[e.detail.sourceType].current = 'loading';
                update(this.slots.movieView);
                break
            case 'movieLoad':
                this.movieLists[e.detail.sourceType].current = e.detail.movie;
                update(this.slots.movieView);
                break
        }
    }
}

mount(document, main);
mount(document, main2);

```








```js

const blob = new Blob(Array.prototype.map.call(
        document.querySelectorAll("script[type='text\/js-worker']"),
        (script) => script.textContent, 
        { type: 'text/javascript' }
      );

let worker = new Worker("worker.js", { type: "module" });
let worker = new Worker(window.URL.createObjectURL(blob));

worker.onmessage = (event) => {
    this.dispatchEvent(event);
};

```


```js
const event = new Event('build')
const event = new CustomEvent('build', { detail: elem.dataset.time });
EventTarget.dispatchEvent(event)

```



不知道呼叫的是html renderer還是pure renderer時，這麼做

```js
function child_unkonwn(props) {
    return h('fragemnt', [child1(props), child2(props)])
}
// TODO: 限定回傳規則
```

這保證回傳的是合格的node而讓`child_unkonwn`也是pure renderer。



```js
document.querySelector('#main').append(render(pure_renderer, props))

or 

render(mount(document.querySelector('#main'), pure_renderer, {position: 'tailOf'}), props)

or

mount(document.querySelector('#main'),
      {renderer: pure_renderer, getter: props},
      {position: 'tailOf'}).update();

or

actions 流程控制

async renderer 也是一種自帶狀態的 renderer

```




```js

function Class1(state) {
    this.state = state;
    this.key = state.id;
    this.onclick = function(e) {
        this.slot.update();
    }
    this.renderer = function() {
        return h`abc=${this.state.a}${func2(this.state.b)}`;
    }
}

let instance = new Class1(a);
mount(mp, instance);


```



```js

export const TodoModel = class {
    constructor(localStorageKey) {
        this.localStorageKey = localStorageKey;
        this._readStorage();
    }
    _readStorage () {
        this.todos = JSON.parse(window.localStorage.getItem(this.localStorageKey) || '[]');
    }
    _save () {
        window.localStorage.setItem(this.localStorageKey, JSON.stringify(this.todos));
    }
    add (title) {
        this.todos.push({title, completed: false, id: "id_" + Date.now()});
        this._save();
    }
    remove (id) {
        this.todos = this.todos.filter(t => t.id !== id);
        this._save();
    }
    complete (id, completed) {
        this.todos = this.todos.map(t => t.id === id ? { ...t, completed } : t);
        this._save();
    }
    relabel (id, title) {
        this.todos = this.todos.map(t => t.id === id ? { ...t, title} : t);
        this._save();
    }
}

function TodoItem({id, title, completed, editing}) {
    return h`
<li data-id="${id}"
    class="${completed ? 'completed' : ''}
    ${editing ? 'editing' : ''}">
    <div class="view">
        <input class="toggle" type="checkbox" ${completed ? 'checked' : ''}>
        <label>${title}</label>
        <button class="destroy"></button>
    </div>
    <input class="edit" value="${title}">
</li>`;
}

function TodoList({todos, filter}, from) {
    if (!from) this.local.editing = null;
    return h(todos.filter({
        'all': () => true,
        'active': t => !t.completed,
        'completed': t => t.completed,
    }[filter]).map({id, ...other} =>
        ({id, ...other, editing: this.local.editing === id})).map(TodoItem));
}


TodoList.events = {
    'click      [data-id] .toggle': e => dispatchToEntry(e.target, 'TodoItem:toggle',
            { completed: e.target.hasAttribute('checked') }),
    'click      [data-id] .destroy': e => dispatchToEntry(e.target, 'TodoItem:destroy'),
    'dblclick   [data-id] label'(e) {
        let todoList = nearestSlot(e.target);
        todoList.local.editing = element.closest('li').dataset.id;
    },
    'keyup      [data-id] .edit'(e) {
        let todoList = nearestSlot(e.target);
        if (e.key === 'Enter' && e.target.value) {
            todoList.local.editing = null;
            dispatchToEntry(e.target, 'TodoItem:relabel', { title: e.target.value });
        } else if (e.key === 'Escape') {
            todoList.local.editing = null;
        }
    },
    'blur       [data-id] .edit'(e) {
        let todoList = nearestSlot(e.target);
        todoList.local.editing = null;
        dispatchToEntry(e.target, 'TodoItem:relabel', { title: e.target.value });
    },
}

function dispatchToEntry(element, type, data) {
    const entry = nearestEntry(element);
    const detail = {...data};
    if (type.startsWith('TodoItem:')) {
        detail.id = element.closest('li').dataset.id;
    }
    entry.dispatchEvent(new CustomEvent(type, {detail}));
    entry.update();
}



function TodoMain({todos}) {
    let completedItems = todos.filter(t => t.completed);
    return h`<section class="main">
        ${ completedItems.length === 0 ?
           `<input id="toggle-all" class="toggle-all" type="checkbox" ${
                completedItems.length === todos.length ? 'checked' : ''
            } />
            <label for="toggle-all">Mark all as complete</label>` : '' }
        <ul class="todo-list">${TodoList}</ul>
    </section>`
}

TodoMain.events = {
    'click input.toggle-all'(e) {
        dispatchToEntry(e.target, 'TodoApp:toggle', {
            all: e.target.hasAttribute('checked'),
        });
    }
}


function TodoFooter({todos, filter}) {
    let completedItems = todos.filter(t => t.completed);
    return h`<footer class="footer" >
        <!-- This should be \`0 items left\` by default -->
        <span class="todo-count">
            <strong>${completedItems.length}</strong> items left
        </span>
        <!-- Remove this if you don't implement routing -->
        <ul class="filters">
            <li><a class="${filter === 'all' ? 'selected' : ''}" href="#/">All</a></li>
            <li><a class="${filter === 'active' ? 'selected' : ''}"href="#/active">Active</a></li>
            <li><a class="${filter === 'completed' ? 'selected' : ''}"href="#/completed">Completed</a></li>
        </ul>
        <!-- Hidden if no completed items are left ↓ -->
        ${ completedItems.length === 0 ?
           '<button class="clear-completed">Clear completed</button>' : ''  }
    </footer>`
}

TodoFooter.events = {
    'click button.clear-completed'(e) {
        dispatchToEntry(e.target, 'TodoApp:destroy', { completed: true });
    }
}


function TodoView({todos, editText}, from) {
    // TODO: mount wrap
    if (!from)
        this.todoview = h('section.todoapp', [
        `<header class="header">
            <h1>todos</h1>
            <input
                placeholder="What needs to be done?"
                autofocus
                class="new-todo"
            />
        </header>`]);

    if (todos.length) {
        this.slots.TodoMain || mount({tailOf: this.todoview}, TodoMain);
        this.slots.TodoFooter || mount({tailOf: this.todoview}, TodoFooter);
    } else {
        this.slots.TodoMain && this.slots.TodoMain.unmount();
        this.slots.TodoFooter && this.slots.TodoFooter.unmount();
    }
    return h([this.todoview]);
}

TodoView.events = {
    'keyup input.new-todo'(e) {
        if (e.key === 'Enter' && e.target.value) {
            dispatchToEntry(e.target, 'TodoApp:add', {
                title: e.target.value,
            });
            e.target.value = '';
        }
    },
}



class TodoApp {
    constructor() {
        this.state = {
            todoModel: new TodoModel('todo-fogy-2022'),
            filter: 'all',
        }
        (this.actions = []).push('TodoApp:route');
    }

    'onhashchange window'() {
        this.dispatchEvent(new CustomEvent('TodoApp:route'));
        this.update();
    }
    // handle todos edited in another window
    'onstorage window'() {
        this.todoModel._readStorage();
        this.update()
    }

    static events = Object.fromEntries([
        'TodoApp:route',
        'TodoApp:add',
        'TodoApp:destroy',
        'TodoApp:toggle',
        'TodoItem:destroy',
        'TodoItem:toggle',
        'TodoItem:relabel',
    ].map(type => [type, e => e]));

    render(props, from) {
        for (const e of [...this.actions, ...window.actions]) {
            switch(e.type) {
                case 'TodoApp:route':
                    this.state.filter = document.location.hash ?
                        document.location.hash.replace(/^#\//, '') : 'all';
                    break
                case 'TodoApp:add': 
                    this.state.todoModel.add(e.detail.title);
                    break;
                case 'TodoItem:relabel':
                    this.state.todoModel.relabel(e.detail.id, e.detail.title);
                    break
                case 'TodoApp:destroy':
                case 'TodoItem:destroy':
                    if (e.detail.completed) {
                        this.state.todoModel
                            .filter(t => t.completed)
                            .map(t => this.state.todoModel.remove(t.id))
                    } else {
                        this.state.todoModel.remove(e.detail.id)
                    }
                    break
                case 'TodoApp:toggle':
                case 'TodoItem:toggle':
                    if (e.detail.all !== undefined) {
                        this.state.todoModel
                            .map(t => this.state.todoModel.complete(t.id, e.detail.all));
                    } else {
                        this.state.todoModel.complete(e.detail.id, e.detail.completed);
                    }
                    break;
            }
        }
        this.actions = [];
        if (!from) {
            const mainRenderer = h(TodoView)(() => ({
                todos: this.state.todoModel.todos,
                filter: this.state.filter,
            }));
            return h([mainRenderer]);
        }
    }
}


let app = TodoApp()
mount(document.querySelector('.todoapp'), app);


```



```js
function anim(props, from) {    
    if (!from)
        this.e = h('div');
    let dt = this.frame.time - this.lasttime;
    [this.x, this.x_v] = spring(this.x, this.x_v, props.x, dt);
    this.lasttime = this.frame.time;
    let {e, x} = this;
    
    h(e, { style: { x }});
    if (x !== props.x) {
        this.update(true);
    }
    if (!from)
        return e;
}
```

```js
function anim(props, from) {    
    if (!from)
        this.e = h('div');
    let done = animate(this, 'x', props);
    if (!done)
        this.update(true);
    h(this.e, { style: { x: this.x }});
    if (!from)
        return this.e;
}
```


```js

function fade(props, from) {
    this.currentItems = exchange(props.wantItems, this.currentItems);
    return h([this.currentItems]);
}
```


```js
function flip(props) {
    let state = flipping.read();
    this.afterrupdate = () => {
        state.flip();
    }
}
h.mount({contentOf:document.body}, h(flip)(props => window.transforms));


```



```js
await sleep()
await timeline();
actions = await window.actions.XXX;
data = await fetch()
module = await requireAsync();
event = await signal(e, 'onerror')
content = await props.defered


(X)let composer = mount({tailOf: document.documentElement}, timeline());
(X)let animation = mount({headOf: composer}, timeline([], {id: 'xyz', freeze: '.box'}));

async function* () {
    yield h`<input></input>`;
    this.elements[0].text = "I'm OK!";
}
```

// TODO: 串連Promise做成的訊號機制


ATM轉帳動畫，以及MV互動，作為案例。
計時器。
下載進度條。


```js
function isRequired(argument) {
    throw new Error(`The argument${argument ? ' ' + argument : ''} is required`)
}
function includesG(string = isRequired('string')) {
  return string.includes('G')
}
```

滑鼠滑過方格時，同類型的方格會一起高亮顯示，該類型的選單按鈕也會高亮。
這透過「共享狀態/供需狀態」會更方便。但正常來說，共享越少越好。

時序難以確定
狀態失去同步
原子被打破
可見性？今天，我去超商買走最後一瓶飲料，其他顧客要買時，就會發現飲料沒了。


兩個狀態同步
    最好不要把狀態放在兩個以上不同地方
    並不是直接修改狀態
    而是把「修改」變成動作事件

事件狀態同步
    原子事件 & 單一組件內同步
    單幀同步/使用proxy分享
    單幀同步/使用事件捕捉
    跨幀同步/使用Defered
    獨立?的跨幀同步/AsyncGen


程式設計師是驚喜創造師，也是渾然天成的大家來找碴出題者。
會什麼程式設計師容易與同僚爭吵，因為他們天天在考驗彼此的眼力與智力。
搬石頭砸自己的腳。


咖啡店/分店/新店員/全域變數
全域變數是邪惡的，那是因為它容易被誤用。
讓全域變數有別名是非常愚蠢的。這包含太長時間引用他。通緝小明與小華。
js的window顯式的指名全域變數，是好的語言設計。但不要太繁瑣的使用。
全域變數應該包裹包裝分門別類，而且顯式宣告，表達其用途。
把任何東西放進全域變數前，要徵詢同事的同意。
用區域變數遮蓋全域變數。建立變化的副本。


空間資料原子/包含去除重複程式碼/Deja vu
時間順序原子

用同步來達成原子是不得以的做法。天生原子是最棒的。因為同步化往往難以正確實作。

效能與資料安全/並行執行，往往會違反原子性。

資料比演算法更好理解/動作資料化/自訂語言

竹林裡叫小孩吃飯/什麼是人類/數學歸納法/亞當是0還是1/樹/圖/json/html
編譯器/style/選擇器

整體性?/獨立性?
模組化原則：可替換性

抽象介面/手機充電線/防呆卡榫?

黑天鵝/建立抽象就是求同存異/建立在統計與機率上更好

通用是一種約束/封閉相對自由
依賴/最小可見性原則/不能信賴的內部易變函數/保留實作彈性自由
根據被引用的模式，依照最小可見分割模組
設計就是預知未來/過於一廂情願是最大的阻礙/看不清就用試誤法



風格/不同的邏輯也能完成同一件事情
這有可能是技術問題/政治問題/藝術問題

有疑惑才占卜/測試老公/測試的必要性/顯而易見不需要測試/定義也不需要測試/可測試性/有時，未定義是最好的定義

汽車引擎沒機油無法發動/保護資料維持同步/提早失敗/錯誤可見性，不讓錯誤蔓延/錯誤可恢復性
用「棄置，重啟」來恢復錯誤

走訪/程式一行一行執行，如同看一般文章/帶錢出門搭車買菜回家給媽媽/函數/功能/進入點/與程式碼等價/介面
函式是一個傳送門
邊走訪邊改變自身狀態
國中數學程度就能模擬電腦執行程式/除錯的過程也是這樣/透過駐解除錯/二分搜尋法/有相關性時無法使用

陣列/值/變數/命名空間標籤唯一性/參照/map/reduce/字典妙用/回呼函數
副作用/純函數
私有變數/prototype/new

小美、小明，王聰明要買票搭火車，請問要買幾張票。
小寶吃飯了嗎

同名箱子/實存空間/物件承載著概念/具有辨識上的唯一性

同時從正反進行思考，加上東西與刪減東西都能幫助除錯/與其畫重點，不如把不重要的專有名詞塗黑
女朋友為什麼生氣，我是做了什麼嗎，我什麼都沒做啊
分而治之法/金字塔/橫木過門/先乘除後加減

JAM，JavaScript, API & Markup

JavaScript → Style → Layout → Paint → Composite

assert/語意不變量?/限制關鍵的地方，而放鬆其他地方
只要在必要的時候才捕捉並且處理異常

成對操作/不要你丟我接/自己開的檔案，由自己關閉/例外情形是「最後一個人關門」

耦合程度調整/堅實則頑固，零碎則無具體/封閉的區域收緊，對廣大的未來放寬
現實空間前後依賴/現實時間前後依賴/依賴是一種神聖的關聯性/蝴蝶效應打破這個關係
從馬桶內部構造理解單向依賴
描述切面的叫做「狀態」，關係的連續性構成「持存」
這種想法是邏輯的基礎，卻不是人類天生的思考方式，而互為因果的「協同性」，互相確定實存，更不能出現在程式中。
像寫小說一樣安排９個個性截然不同的人類聚集在酒吧中，看他們互相交互作用/因此正確歸因很困難，有時候甚至不可能。


