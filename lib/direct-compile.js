

function mountLive(hValueCode, ...args) {
  let hValue;
  if (typeof hValueCode === 'function') {
    // hValue = hValueCode();
    hValueCode = `(${hValueCode.toString()})()`;
    hValue = eval(hValueCode);
  } else {
    hValue = eval(hValueCode);
  }
  let slot = mount(hValue, ...args);
  // if (!slot.key.startsWith('_')) {
  //   let s = document.createElement("script");
  //   s.innerHTML = `ready(() => hydrate(${hValueCode}, '${slot.key}'));`;
  //   document.body.append(s);
  // }
}

function customHeadingId() {
  return {
    renderer: {
      heading(text, level, raw, slugger) {
        const headingIdRegex = /(?: +|^)\{#([a-z][\w-]*)\}(?: +|$)/i;
        const hasId = text.match(headingIdRegex);
        if (!hasId) {
          // fallback to original heading renderer
          return false;
        }
        return `<h${level} id="${hasId[1]}">${text.replace(headingIdRegex, '')}</h${level}>\n`;
      },
      paragraph(text) {
        if (!text) {
          // forbid empty paragraph
          return '';
        } else if (text.match(/^<(template|slot)/)) {
          // support template/slot tag
          return text;
        }
        return false;
      },
    }
  };
}

function replaceSlotToTemplate(slot) {
  const s = slot;
  function interpolation(string) {
    return string.replace(/\$\{(\w+)\}/g,
                          (_, a) => s.getAttribute(a, ''));
  }
  let templateId = s.getAttribute('slot-from-template');
  let template = document.getElementById(templateId);
  if (template) {
    let clone = template.content.cloneNode(true);
    let first = clone.children[0];
    if (first) {
      s.id && (first.id = s.id);
      // s.classList && first.classList.add(...s.classList);
      // if (s.getAttribute('style')) {
      //   first.setAttribute('style',
      //                      (first.getAttribute('style') ?? '') +
      //                      s.getAttribute('style'));
      // }
    }
    [...clone.children].map(el => {
      s.classList && el.classList.add(...s.classList);
      if (s.getAttribute('style')) {
        el.setAttribute('style',
                           (el.getAttribute('style') ?? '') +
                           s.getAttribute('style'));
      }
    });
    let descendents = clone.querySelectorAll('*');
    for (const elem of descendents) {
      for (let i = 0; i < elem.attributes.length; i++) {
          let attrib = elem.attributes[i];
          if (attrib.value.startsWith('$')) {
            attrib.value = interpolation(attrib.value);
          }
      }
      for (const child of elem.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          child.nodeValue = interpolation(child.nodeValue);
        }
      }
    }
    s.replaceWith(clone);
  }
}

if (!document.documentElement.dataset.build) {

  window.profile = {};

  fogyReady(() => {
    function compileBody() {
      window.marked.use({
        gfm: true,
        mangle: false,
        headerIds: false,
        headerPrefix: false,
      })
      window.marked.use(customHeadingId());
      // TODO: 這個需要刪除嗎?
      // let content = document.body.innerHTML.replace(/&gt;/g, '>');
      let content = document.body.innerHTML;
      const docHtml = marked.parse(content);
      return docHtml;
    }

    window.markdoc = compileBody();

    function html_renderer({frame}) {
      frame.profile ||= window.profile;
      frame.markdoc ||= h('template', window.markdoc);

      // hValue interpolation at markdown
      for (const p of frame.markdoc.querySelectorAll('p')) {
        if (p.innerHTML.match(/^\$\{.*?\}$/)) {
          let hValueCode = p.innerHTML.slice(2, -1);
          mountLive(hValueCode, {replace: p});
          // let hvalue = eval(code);
          // mount(hvalue, {replace: p});
        }
      }
      //TODO: 使用bottom up mount解決relive問題

      for (const s of frame.markdoc.querySelectorAll('[slot-from-code]')) {
        let hValueCode = s.getAttribute('slot-from-code');
        mountLive(hValueCode, {replace: s});
      }

      for (const s of frame.markdoc.querySelectorAll('[slot-from-template]')) {
        replaceSlotToTemplate(s);
        // function interpolation(string) {
        //   return string.replace(/\$\{(\w+)\}/g,
        //                         (_, a) => s.getAttribute(a, ''));
        // }
        // let templateId = s.getAttribute('slot-from-template');
        // let template = document.getElementById(templateId);
        // if (template) {
        //   let clone = template.content.cloneNode(true);
        //   let first = clone.children[0];
        //   if (first) {
        //     s.id && (first.id = s.id);
        //     s.classList && first.classList.add(...s.classList);
        //     if (s.getAttribute('style')) {
        //       first.setAttribute('style',
        //                          (first.getAttribute('style') ?? '') +
        //                          s.getAttribute('style'));
        //     }
        //   }
        //   let descendents = clone.querySelectorAll('*');
        //   for (const elem of descendents) {
        //     for (let i = 0; i < elem.attributes.length; i++) {
        //         let attrib = elem.attributes[i];
        //         if (attrib.value.startsWith('$')) {
        //           attrib.value = interpolation(attrib.value);
        //         }
        //     }
        //     for (const child of elem.childNodes) {
        //       if (child.nodeType === Node.TEXT_NODE) {
        //         child.nodeValue = interpolation(child.nodeValue);
        //       }
        //     }
        //   }
        //   s.replaceWith(clone);
        // }
      }

      document.documentElement.dataset.build = true;
      document.documentElement.style.display = '';
    }

    async function* make_title({frame}) {
      let a;
      (a = frame.markdoc.querySelectorAll('h1'))?.length ||
      (a = frame.markdoc.querySelectorAll('h2'))?.length ||
      (a = frame.markdoc.querySelectorAll('h3'))?.length;
      if (a[0]) {
        yield h('title', a[0].innerText);
      }
    }

    function head_renderer({frame}) {
      // make_icons
      // make_style
      // make_viewporte
      // make_manifest
      // make_favicon
      // make_title
      // make_fontface
      if (window.pageHead) {
        return h(PageHead)('PageHead',
                           props => ({...window.pageHead,
                                      externals: [make_title]}));
      }
      // return [h(make_title)];
      // return h('title', 'xxx');
    }

    function body_renderer({frame}) {
      // Prism.highlightAllUnder(frame.markdoc);
      for (const child of frame.markdoc.children) {
        hljs.highlightElement(child);
      }
      return window.bodyRender ? h(window.bodyRender)({mount: mountLive}) :
                                 frame.markdoc;
    }

    ready(() => {
      const htmlSlot = mount(h(html_renderer), {contentOf: document.documentElement});
      mount(h(head_renderer), {tailOf: document.head});
      mount(h(body_renderer), {contentOf: document.body});
      render(htmlSlot);
      // update(htmlSlot);
    });
  });

}
