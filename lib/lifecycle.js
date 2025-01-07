// 三大state管理
//
// 1. page state
// 2. net state (net-ping protocal)
// 3. TODO: login state (oidc-token)
//
// 其他功能:
// mediaQuery
// loadScript
// TODO: getEnv 瀏覽器相關資訊
// TODO: web-push，注意，收到web-push時不一定有任何頁籤開啟。


//
// 參考 https://developer.chrome.com/articles/page-lifecycle-api/
//     https://wd.imgix.net/image/eqprBhZUGfb8WYnumQ9ljAxRrA72/wgyY9jyBaPTlVZIrJfoD.svg
//
// 1. 與渲染有關的函式庫使用defer，這會預先下載，等到DOMContentLoaded前一刻才執行，
//    同時保證，stylesheets已經載入。
// 2. 與渲染無關的小型函式庫使用async，這會預先下載，但不會與DOMContentLoaded交互干擾。
// 3. 與渲染無關的大型函式庫使用(例如GA)，使用動態載入，在DOMContentLoaded之後，
//    呼叫loadScript()，這會插入script標籤，這個額外插入的script會自動使用async，平行下載後執行。
//
// ready時，可以偵測document.wasDiscarded來判斷之前是否非正常關閉。
// 使用navigator.sendBeacon(url, data)來送出死前同步訊號。

const getState = () => document.visibilityState === 'hidden' ? 'hidden' :
                       document.hasFocus() ? 'active' : 'passive';

// Stores the initial state using the `getState()` function (defined above).
window.state = getState();
window.stateCallbacks ??= [];

// Accepts a next state and, if there's been a state change, logs the
// change to the console. It also updates the `state` value defined above.
const onStateChange = (nextState) => {
  const prevState = window.state;
  if (nextState !== prevState) {
    for (const cb of window.stateCallbacks ?? []) {
        cb(nextState, prevState);
    }
    // console.log(`State change: ${prevState} >>> ${nextState}`);
    window.state = nextState;
  }
};



// These lifecycle events can all use the same listener to observe state
// changes (they call the `getState()` function to determine the next state).
['pageshow', 'focus', 'blur', 'visibilitychange', 'resume'].forEach((type) => {
  window.addEventListener(type, () => onStateChange(getState(), {capture: true}));
});

// The next two listeners, on the other hand, can determine the next
// state from the event itself.
window.addEventListener('freeze', () => {
  // In the freeze event, the next state is always frozen.
  onStateChange('frozen');
}, {capture: true});

window.addEventListener('pagehide', (event) => {
  // If the event's persisted property is `true` the page is about
  // to enter the back/forward cache, which is also in the frozen state.
  // If the event's persisted property is not `true` the page is
  // about to be unloaded.
  onStateChange(event.persisted ? 'frozen' : 'terminated');
}, {capture: true});



function statechange(func) {
    if (!window.stateCallbacks.includes(func)) {
        window.stateCallbacks.push(func);
    }
}
window.statechange = statechange;

function ready(func, func2) {
    let target;
    if (typeof func === 'string') {
        [target, func] = [func, func2];
    }
    func ??= () => undefined;

    if (target === 'state') {
        statechange(func);
    } else if (target === 'network') {
        networkchange(func);
    } else if (target && target.endsWith('.js')) {
        return loadScript(target);
    } else if (target && target.endsWith('.css')) {
        return loadStyle(target);
    } else {
        return new Promise((resolve, reject) => {
            if (document.readyState === 'loading') {
                window.addEventListener('DOMContentLoaded',
                                        e => resolve(func(e)), {capture: true});
            } else {
                resolve(func());
            }
        });
    }
}
window.ready = ready;

function loadScript(path, afterReady = false) {
    // this method is deferred and async.
    // use `import(path) -> Promise` for load module dynamically.
    // `Promise.all(loadScript(p1), import(p2))` 可以需求多個腳本

    return new Promise((resolve, reject) => {
        const f = () => {
            if (path === 'DOM' || path === 'ready') {
                resolve(document);
                return;
            }
            let s = document.querySelector(`script[src='${path}']`) ||
                    document.createElement("script");

            if (s.isLoaded === undefined) {
                s.addEventListener('error', err => reject(s.isLoaded = err));
                s.addEventListener('load', err => resolve(s.isLoaded = s));
                s.src ||= path;
                if (s.getRootNode() !== document) {
                    const t = document.getElementsByTagName('script')[0];
                    (t?.parentElement || document.head).insertBefore(s, t);
                }
            } else {
                (s.isLoaded === s ? resolve : reject)(s.isLoaded);
            }
        }
        afterReady ? ready(f) : f();
    });
}

function loadStyle(path) {
  let s = document.querySelector(`link[href='${path}']`) ||
          document.createElement("link");
  s.href ||= path;
  if (!s.getRootNode()) {
      document.head.appendChild(s);
  }
}


// function loadScript(path) {
//     // this method is deferred and async.
//     // use `import(path) -> Promise` for load module dynamically.
//     // `Promise.all(loadScript(p1), import(p2))` 可以需求多個腳本
//     const promise = new Promise((resolve, reject) => {
//         ready(() => {
//             if (path === 'DOM') {
//                 resolve(document);
//                 return;
//             }
//             let s = document.querySelector(`script[src='${path}']`) ||
//                     document.createElement("script");
//             s.src ||= path;
//             if (s.isLoaded === undefined) {
//                 s.addEventListener('error', err => reject(s.isLoaded = err));
//                 s.addEventListener('load', err => resolve(s.isLoaded = s));
//                 if (!s.getRootNode()) {
//                     document.head.insertBefore(s);
//                 }
//             } else {
//                 (s.isLoaded === s ? resolve : reject)(s.isLoaded);
//             }

//             // if (!s) {
//             //     s = document.createElement("script");
//             //     s.src = path;
//             // }
//             // else {
//             //     s.addEventListener('error', (err) => {
//             //         s.isLoaded = err;
//             //         reject(err);
//             //     })
//             //     s.addEventListener('load', (err) => {
//             //         s.isLoaded = true;
//             //         resolve(s);
//             //     })
//             //     if (!s.isAddedToDOM) {
//             //         s.isAddedToDOM = true;
//             //         const t = document.getElementsByTagName('script')[0];
//             //         t.parentElement.insertBefore(s, t);
//             //     }
//             // }
//         });
//     });
//     return promise;
// }


// if ("serviceWorker" in navigator) {
//     navigator.serviceWorker.getRegistrations().then(async arr => {
//         if(arr.length > 0) return;
//         let scope = window.location.pathname;
//         while(1) {
//             scope = scope.split('/').slice(0, -1).join('/');
//             const sw = `${scope}/.service-worker.js`
//             try {
//                 const registration = await navigator.serviceWorker.register(sw, {
//                     scope,
//                 });
//                 break;
//             } catch (error) {
//                 // console.error(`Registration failed with ${error}`);
//             }
//             if (scope === '') break;
//         }
//     }, skipError => null);
// }


// if ("connection" in navigator) {
//     let slowConnection = ['slow-2g', '2g'];
//     let speedConnection = ['3g', '4g'];
//     navigator.connection.addEventListener("change", (e) =>{
//         let connection = navigator.connection,
//             effectiveType = connection.effectiveType,
//             isSlowConnection = slowConnection.indexOf(effectiveType) !== -1;
//         if(isSlowConnection) {
//             console.log("reduce video quality")
//         } else {
//             console.log("maintain or increase the video quality")
//         }
//     })
// }


window.netState = {};
window.netStateCallbacks = [];

async function onNetworkChange(event) {
    let isOnline = navigator.onLine;
    let network_test = await fetch('https://accounts.google.com/.well-known/openid-configuration');
    let network_ok = network_test.status === 200;
    let netping;
    if (window.netpingUrl) {
        // do net-ping protocol
        let netping_test = await fetch(window.netpingUrl);
        if (netping_test.status === 200) {
            netping = await netping_test.json();
        }
    }
    const prevState = {...window.netState};

    window.netState.online = isOnline;
    window.netState.network = network_ok;
    window.netState.netping = netping;

    for (const cb of window.netStateCallbacks || []) {
        cb(window.netState, prevState);
    }
}

function onConnectionChange(event) {
    const prevState = {...window.netState};

    window.netState.effectiveType = navigator.connection?.effectiveType;
    window.netState.connectionType = navigator.connection?.type;
    window.netState.rtt = navigator.connection?.rtt;

    for (const cb of window.netStateCallbacks || []) {
        cb(window.netState, prevState);
    }
}

window.addEventListener("online", onNetworkChange);
window.addEventListener("offline", onNetworkChange);
if ("connection" in navigator) {
    navigator.connection.addEventListener("change", onConnectionChange);
}

function networkchange(func) {
    if (!window.netStateCallbacks.includes(func)) {
        window.netStateCallbacks.push(func);
    }
}





if(!window.mediaQueryHooks) {
    const hooks = window.mediaQueryHooks = {};
    hooks.s = window.matchMedia("(width <= 600px)");
    hooks.s.klass = 'page-size-s'
    hooks.m = window.matchMedia("(600px < width < 840px)");
    hooks.m.klass = 'page-size-m'
    hooks.l = window.matchMedia("(width >= 840px)");
    hooks.l.klass = 'page-size-l'

    hooks.s.func = (e) => document.documentElement.classList[e.matches ? 'add' : 'remove']('size-s')
    hooks.m.func = (e) => document.documentElement.classList[e.matches ? 'add' : 'remove']('size-m')
    hooks.l.func = (e) => document.documentElement.classList[e.matches ? 'add' : 'remove']('size-l')
    for (const mq of [hooks.s, hooks.m, hooks.l]) {
        const func = (e) => document.documentElement.classList[
                                        e.matches ? 'add' : 'remove'](mq.klass);
        mq.addEventListener("change", func);
        func(mq);
    }
}


function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

const agent_callbacks = [];

function ensure_agent_iframe(callback) {
    const agent_url = localStorage.getItem('agent_url');
    if (!agent_url) {
        throw new Error('agent_url undefined');
    }
    if (!agent_callbacks.includes(callback)) {
        agent_callbacks.push(callback);
    }
    let agent_iframe = document.getElementById("token_agent_iframe");
    if (!agent_iframe) {
        agent_iframe = document.createElement("iframe");
        agent_iframe.id = 'token_agent_iframe';
        agent_iframe.setAttribute("src", agent_url);
        agent_iframe.style.display = 'none';
        document.body.appendChild(agent_iframe);

        async function receiveMessage(event) {
            if (event.data?.access_token !== undefined) {
                const {access_token, id_token = null, token_endpoint} = event.data;
                localStorage.setItem('access_token', access_token);
                localStorage.setItem('id_token', id_token);
                localStorage.setItem('last_token_endpoint', token_endpoint);
                if (id_token) {
                    localStorage.setItem('id_token_payload', parseJwt(id_token));
                }
                for (const callback of agent_callbacks) {
                    callback();
                }
                // if (access_token && config.userinfo_api) {
                //     fetch(config.userinfo_api, {
                //         headers: Object.assign({}, config.userinfo_api_headers || {}, {
                //             'authorization': `Bearer ${access_token}`
                //         }),
                //     }).then( response => response.json() )
                //       .then(body => {
                //         console.log(body);
                //         document.getElementById("picture").src = body[config.userinfo_property];
                //     })
                // }
            }
        }
        window.addEventListener("message", receiveMessage, false);
    }
    return agent_iframe;
}

function send_get_token(code, pkce_code_verifier) {
    const agent_iframe = ensure_agent_iframe();
    const agent_url = localStorage.getItem('agent_url');
    const data = { code, pkce_code_verifier };
    if (!code) data.getcode = true;

    agent_iframe.contentWindow.postMessage(data, agent_url);
}

function send_refresh_token() {
    const agent_iframe = ensure_agent_iframe();
    const agent_url = localStorage.getItem('agent_url');
    const data = { refresh: true };
    agent_iframe.contentWindow.postMessage(data, agent_url);
}

