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

async function loadFogy() {
  const scripts = document.querySelectorAll(`script[src]`);
  // let script_root;
  for (const s of scripts) {
    if (s.src.endsWith('/fogy.js')) {
      window.fogyTag = s;
      window.fogyBasepath = s.src.slice(0, -('/fogy.js'.length));
      window.fogyAssetBasepath = window.fogyBasepath
      break
    } else if (/\/fogy$|\/fogy@[^\/]+$/.test(s.src)) {
      window.fogyTag = s;
      window.fogyBasepath = s.src
      let last2 = window.fogyBasepath.split('/').slice(-2).join('/');
      window.fogyAssetBasepath =
        `https://cdn.jsdelivr.net/npm/${last2}`;
      break
    }
  }

  if (window.fogyBasepath) {
    const loaders = [];
    loaders.push(
      import(`${window.fogyBasepath}/lib/engine.js`),
      import(`${window.fogyBasepath}/lib/lifecycle.js`),
    );
    if (!window.fogyTag.dataset.noBehavior) {
      loaders.push(
        import(`${window.fogyBasepath}/lib/behavior.js`),
      );
    }
    if (!window.fogyTag.dataset.noAnimate) {
      loaders.push(
        import(`${window.fogyBasepath}/lib/animate.js`),
      );
    }
    if (!window.fogyTag.dataset.noMarkdown) {
      loaders.push(
        // loadScript('https://cdn.jsdelivr.net/npm/marked@5.0.4/marked.min.js'),
        import('https://cdn.jsdelivr.net/npm/marked@5.0.4/lib/marked.esm.js').then(({marked}) => (window.marked = marked)),
        import('https://cdn.jsdelivr.net/npm/marked-highlight/lib/index.umd.js'),
        loadStyle('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.0/build/styles/default.min.css'),
        import('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.0/build/es/highlight.min.js').then(hljs => (window.hljs = hljs.default)),
        import(`${window.fogyBasepath}/lib/direct-compile.js`),
      );
    }
    if (!window.fogyTag.dataset.noPageHead) {
      loaders.push(
         import(`${window.fogyBasepath}/lib/headcompile.js`),
      );
    }
    if (!window.fogyTag.dataset.noStyle) {
      // loaders.push(
      //   import(`${window.fogyBasepath}/css/2024/core.css`),
      // );
      loaders.push(addStyle(`
        @layer reset, basic, reset-after-basic, basic-form, attaches,
           btn, behavior, card, table, variety, other, elevation, custom, control;`));
      loaders.push(loadStyle(`${window.fogyAssetBasepath}/css/2024/reset.css`));
      loaders.push(loadStyle(`${window.fogyAssetBasepath}/css/2024/attaches.css`));
      loaders.push(loadStyle(`${window.fogyAssetBasepath}/css/2024/other.css`));
      loaders.push(loadStyle(`${window.fogyAssetBasepath}/css/2024/btn.css`));
      loaders.push(loadStyle(`${window.fogyAssetBasepath}/css/2024/card.css`));
      loaders.push(loadStyle(`${window.fogyAssetBasepath}/css/2024/sheet.css`));
    }
    // TODO:
    // loaders.push(loadScript('DOM'));
    await Promise.all(loaders);

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
