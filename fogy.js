
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
            let s = document.querySelector(`script[src='${path}']`);
            if (!s) {
                s = document.createElement("script");
                s.src = path;
                s.isLoaded = false;
            }
            if (s.isLoaded === false) {
                s.addEventListener('error', err => reject(s.isLoaded = err));
                s.addEventListener('load', err => resolve(s.isLoaded = s));
                if (s.getRootNode() === s) {
                    const t = document.getElementsByTagName('script')[0];
                    (t?.parentElement || document.head).insertBefore(s, t);
                }
            } else if (s.isLoaded === undefined) {
                // the native tag on html page
                // must loaded but don't known it's error or not
                resolve(s);
            } else {
                (s.isLoaded === s ? resolve : reject)(s.isLoaded);
            }
        }
        afterReady ? ready(f) : f();
    });
}

function addStyle(css) {
  let s = document.createElement("style");
  s.type = "text/css";
  // s.styleSheet.cssText = css;
  s.appendChild(document.createTextNode(css));
  if (s.getRootNode() === s) {
      document.head.appendChild(s);
  }
}

function loadStyle(path) {
  let s = document.querySelector(`link[href='${path}']`) ||
          document.createElement("link");
  s.rel = "stylesheet";
  if (!path.startsWith('file:')) {
    s.crossOrigin = "anonymous";
  }
  s.href ||= path;
  if (s.getRootNode() === s) {
      document.head.appendChild(s);
  }
}

function importModule(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const tempGlobal = "__tempModuleLoadingVariable" + Math.random().toString(32).substring(2);
    script.type = "module";
    script.textContent = `import * as m from "${url}"; window.${tempGlobal} = m;`;

    script.onload = () => {
      resolve(window[tempGlobal]);
      delete window[tempGlobal];
      script.remove();
    };
    script.onerror = () => {
      reject(new Error("Failed to load module script with URL " + url));
      delete window[tempGlobal];
      script.remove();
    };
    document.documentElement.appendChild(script);
  });
}



async function loadFogy() {
  const scripts = document.querySelectorAll(`script[src]`);
  // let script_root;
  for (const s of scripts) {
    if (s.src.endsWith('/fogy.js')) {
      window.fogyTag = s;
      window.fogyBasepath = s.src.slice(0, -('/fogy.js'.length));
      break
    }
  }

  if (window.fogyBasepath) {
    const loaders = [];
    loaders.push(
      loadScript(`${window.fogyBasepath}/lib/engine.js`),
      loadScript(`${window.fogyBasepath}/lib/lifecycle.js`),
    );
    if (!window.fogyTag.dataset.noBehavior) {
      loaders.push(
        loadScript(`${window.fogyBasepath}/lib/behavior.js`),
      );
    }
    if (!window.fogyTag.dataset.noAnimate) {
      loaders.push(
        loadScript(`${window.fogyBasepath}/lib/animate.js`),
      );
    }
    if (!window.fogyTag.dataset.noMarkdown) {
      loaders.push(
        loadScript('https://cdn.jsdelivr.net/npm/marked@5.0.4/marked.min.js'),
        loadScript('https://cdn.jsdelivr.net/npm/marked-highlight/lib/index.umd.js'),
        loadStyle('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.0/build/styles/default.min.css'),
        loadScript('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.0/build/highlight.min.js'),
        loadScript(`${window.fogyBasepath}/lib/direct-compile.js`),
      );
    }
    if (!window.fogyTag.dataset.noPageHead) {
      loaders.push(
         loadScript(`${window.fogyBasepath}/lib/headcompile.js`),
      );
    }
    if (!window.fogyTag.dataset.noStyle) {
      // loaders.push(
      //   loadStyle(`${window.fogyBasepath}/css/2024/core.css`),
      // );
      loaders.push(addStyle(`
        @layer reset, basic, reset-after-basic, basic-form, attaches,
           btn, behavior, card, table, variety, other, elevation, custom, control;`));
      loaders.push(loadStyle(`${window.fogyBasepath}/css/2024/reset.css`));
      loaders.push(loadStyle(`${window.fogyBasepath}/css/2024/attaches.css`));
      loaders.push(loadStyle(`${window.fogyBasepath}/css/2024/other.css`));
      loaders.push(loadStyle(`${window.fogyBasepath}/css/2024/btn.css`));
      loaders.push(loadStyle(`${window.fogyBasepath}/css/2024/card.css`));
      loaders.push(loadStyle(`${window.fogyBasepath}/css/2024/sheet.css`));

    }
    loaders.push(loadScript('DOM'));
    await Promise.all(loaders);

    // await Promise.all([
    //   // loadScript('https://cdn.jsdelivr.net/npm/terser/dist/bundle.min.js'),
    //   loadScript('https://cdn.jsdelivr.net/npm/marked@5.0.4/marked.min.js'),
    //   // loadStyle('https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.css'),
    //   // loadStyle('https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.5.0/prism-darcula.min.css'),
    //   loadStyle('https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-gruvbox-light.min.css'),
    //   loadScript('https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js'),
    //   loadScript('https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js'),
    //   loadScript(`${window.fogyBasepath}/lib/engine.js`),
    //   loadScript(`${window.fogyBasepath}/lib/lifecycle.js`),
    //   loadScript(`${window.fogyBasepath}/lib/animate.js`),
    //   // loadScript(`${window.fogyBasepath}/lib/compiler.js`),
    //   // loadScript(`${window.fogyBasepath}/jamlab/headcompile.js`),
    //   loadScript(`${window.fogyBasepath}/lib/headcompile.js`),
    //   loadScript(`${window.fogyBasepath}/lib/direct-compile.js`),
    //   // loadStyle(`${window.fogyBasepath}/css/article.css`),
    //   loadScript('DOM'),
    // ]);
  }
}

if (!window.fogyLoading) {
  window.fogyLoading = loadFogy();
  window.fogyReady = function fogyReady(func) {
    window.fogyLoading.then(func);
  }
  if (!document.documentElement.dataset.build) {
    document.documentElement.style.display = 'none';
    window.fogyLoading.then(() => {
      delete document.documentElement.style.display;
    });
  }
}


