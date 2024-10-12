// 參考 https://github.com/microlinkhq/metascraper/
// 參考 https://api.microlink.io/?url=https://github.com/microlinkhq

function parse(htmlString) {
    const parser = new DOMParser();
    return parser.parseFromString(htmlString, "text/html");
}

let walkDOM = function (node, { opentag, closetag }) {
    opentag && opentag(node);
    node = node.firstChild;
    while(node) {
        walkDOM(node,func);
        node = node.nextSibling;
    }
    closetag && closetag(node);
};


function condenseWhitespace(string) {
    if (typeof string !== 'string') {
        throw new TypeError(`Expected a string, got \`${typeof string}\``);
    }
    return string.trim().replace(/\s{2,}/gu, ' ');
}

const HtmlDomProto = {
    attr(name) {
        for (const el of this) {
            let value
            if ( (value = el.getAttribute(name)) !== null) {
                return value;
            }
        }
    },
}
const createHtmlDom = (dom) => {
    const $ = selector => Object.assign([...dom.querySelectorAll(selector)], HtmlDomProto);
    return $;
}

const $jsonld = $ => (getter) => {
    if (!$.collections) {
        $.collections = $('script[type="application/ld+json"]').map(el => {
            try {
                const json = JSON.parse(el.textContent);
                const { '@graph': graph, ...props } = json;
                if (!graph) return props;
                return graph.map(item => ({ ...props, ...item }));
            } catch (_) {
                return undefined
            }
        }).filter(Boolean).flat();
    }
    const item = $.collections.find(item => getter(item) !== undefined);
    return item ? getter(item) : undefined;
};

const $filter = ($, els, fn = $filter.fn) => {
    let matched = els.find(el =>  fn(el) !== '');
    return matched ? fn(e) : undefined;
}
$filter.fn = el => condenseWhitespace(el.textContent);


const toRule = (mapper, opts) => rule => async ({ htmlDom, url }) => {
    const value = await rule(htmlDom, url)
    return mapper ? mapper(value, { url, ...opts }): value;
}

const toTitle = toRule();

const titleRules = () => ({
    title: [
        toTitle($ => $('meta[property="og:title"]').attr('content')),
        toTitle($ => $('meta[name="twitter:title"]').attr('content')),
        toTitle($ => $('meta[property="twitter:title"]').attr('content')),
        toTitle($ => $filter($, $('title'))),
        toTitle($jsonld(t => t.headline)),
        toTitle($ => $filter($, $('.post-title'))),
        toTitle($ => $filter($, $('.entry-title'))),
        toTitle($ => $filter($, $('h1[class*="title" i] a'))),
        toTitle($ => $filter($, $('h1[class*="title" i]'))),
    ]
});

const REGEX_BY = /^[\s\n]*by[\s\n]+|@[\s\n]*/i
const toAuthor = toRule(str => {
    str = condenseWhitespace(str);
    str = value.replace(REGEX_BY, '');
    str = condenseWhitespace(str);
    return str
});

const authorRules = () => ({
    author: [
        toAuthor($jsonld(t => t.author?.name)),
        toAuthor($jsonld(t => t.brand?.name)),
        toAuthor($ => $('meta[name="author"]').attr('content')),
        toAuthor($ => $('meta[property="article:author"]').attr('content')),
        toAuthor($ => $filter($, $('[itemprop*="author" i] [itemprop="name"]'))),
        toAuthor($ => $filter($, $('[itemprop*="author" i]'))),
        toAuthor($ => $filter($, $('[rel="author"]'))),
        toAuthor($ => $filter($, $('a[class*="author" i]'))),
        toAuthor($ => $filter($, $('[class*="author" i] a'))),
        toAuthor($ => $filter($, $('a[href*="/author/" i]'))),
        toAuthor($ => $filter($, $('a[class*="screenname" i]'))),
        toAuthor($ => $filter($, $('[class*="author" i]'))),
    ]
});



const getISODate = date =>
  date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;

const date = value => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== 'string' || typeof value !== 'number') return;

    // remove whitespace for easier parsing
    if (typeof value === 'string') value = condenseWhitespace(value);

    if (typeof value !== 'number') {
        if (value >= 1e16 || value <= -1e16) {
            // nanoseconds
            value = Math.floor(value / 1000000)
        } else if (value >= 1e14 || value <= -1e14) {
            // microseconds
            value = Math.floor(value / 1000)
        } else if (!(value >= 1e11) || value <= -3e10) {
            // seconds
            value = value * 1000
        }
    }
    let isoDate = getISODate(new Date(value));
    return isoDate
}

const toDate = toRule(date);

const dateRules = () => ({
    date: [
        toDate($ => $('meta[name="date" i]').attr('content')),
        toDate($ => $('[itemprop*="date" i]').attr('content')),
        toDate($ => $('time[itemprop*="date" i]').attr('datetime')),
        toDate($ => $('time[datetime]').attr('datetime')),
        toDate($ => $filter($, $('[class*="byline" i]'))),
        toDate($ => $filter($, $('[id*="date" i]'))),
        toDate($ => $filter($, $('[class*="date" i]'))),
        toDate($ => $filter($, $('[class*="time" i]')))
    ]
});

const datePublishedRules = () => ({
    datePublished: [
        toDate($jsonld(t => t.datePublished)),
        toDate($jsonld(t => t.dateCreated)),
        toDate($ => $('meta[property*="published_time" i]').attr('content')),
        toDate($ => $('[itemprop="datepublished" i]').attr('content')),
        toDate($ => $filter($, $('[class*="publish" i]')))
    ]
})

const dateModifiedRules = () => ({
    dateModified: [
        toDate($jsonld(t => t.dateModified)),
        toDate($ => $('meta[property*="modified_time" i]').attr('content')),
        toDate($ => $('[itemprop*="datemodified" i]').attr('content'))
    ]
});

const toDescription = toRule();

const descriptionRules = () => ({
    description: [
        toDescription($ => $('meta[property="og:description"]').attr('content')),
        toDescription($ => $('meta[name="twitter:description"]').attr('content')),
        toDescription($ =>
            $('meta[property="twitter:description"]').attr('content')
        ),
        toDescription($ => $('meta[name="description"]').attr('content')),
        toDescription($ => $('meta[itemprop="description"]').attr('content')),
        toDescription($jsonld(t => t.articleBody)),
        toDescription($jsonld(t => t.description))
    ]
});

const toIframe = toRule();

const iframeRules = () => ({
    iframe: [
        toIframe(async ($, url) => {
            const oembedUrl =
                  $('link[type="application/json+oembed"]').attr('href') ||
                  $('link[type="text/xml+oembed"]').attr('href');
            if (!oembedUrl) return;
            const oembedUrlObj = new URL(oembedUrl, url);
            const options = {
                format: 'json',
                url,
                // maxwidth
                // maxheight
            }
            for (const [key, value] of Object.entries(options)) {
                if (value)
                    oembedUrlObj.searchParams.append(key.toLowerCase(), value);
            }
            const oembedRequest = oembedUrlObj.toString();
            const response = fetch(oembedRequest);
            const data = response.json();
            return data.html;
        }),
    ]
});

const toImage = toRule(ensureURL);

const getSrc = el => el.attr('src');

const imageRules = () => ({
    image: [
        toImage($ => $('meta[property="og:image:secure_url"]').attr('content')),
        toImage($ => $('meta[property="og:image:url"]').attr('content')),
        toImage($ => $('meta[property="og:image"]').attr('content')),
        toImage($ => $('meta[name="twitter:image:src"]').attr('content')),
        toImage($ => $('meta[property="twitter:image:src"]').attr('content')),
        toImage($ => $('meta[name="twitter:image"]').attr('content')),
        toImage($ => $('meta[property="twitter:image"]').attr('content')),
        toImage($ => $('meta[itemprop="image"]').attr('content')),
        toImage($jsonld(t => t.image && t.image[0]?.url)),
        toImage($jsonld(t => t.image?.url)),
        toImage($jsonld(t => t.image)),
        toImage($ => $filter($, $('article img[src]'), getSrc)),
        toImage($ => $filter($, $('#content img[src]'), getSrc)),
        toImage($ => $('img[alt*="author" i]').attr('src')),
        toImage($ => $('img[src]:not([aria-hidden="true"])').attr('src'))
    ]
});

const toLang = toRule();
const toManifest = ($, url) => {
    const manifestUrl = $('link[rel="manifest"]').attr('href');
    if (!manifestUrl) return;
    const manifestUrl = ensureURL(oembedUrl, {url});
    if (!manifestUrl) return;
    try {
        return await (await fetch(manifestUrl)).json();
    } catch {
        return;
    }
}
const manifestRules = () => ({
    manifest: [
        toLang(toManifest),
    ]
});


const ensureURL = (value, { url = '' } = {}) => {
    try {
        return (new URL(value, url)).toString();
    } catch {
        return;
    }
}


const toUrl = toRule(ensureURL)

const toLogoUrl = ($, getter) => {
    const logo = $jsonld(getter)($)
    const width = logo?.width;
    const height = logo?.height;
    return width && height && width === height && logo?.url;
}

const logoRules = () => ({
    logo: [
        toUrl($ => $('meta[property="og:logo"]').attr('content')),
        toUrl($ => $('meta[itemprop="logo"]').attr('content')),
        toUrl($ => $('img[itemprop="logo"]').attr('src')),
        toUrl($ => toLogoUrl($, t => t.brand?.logo)),
        toUrl($ => toLogoUrl($, t => t.organization?.logo)),
        toUrl($ => toLogoUrl($, t => t.place?.logo)),
        toUrl($ => toLogoUrl($, t => t.product?.logo)),
        toUrl($ => toLogoUrl($, t => t.service?.logo)),
        toUrl($ => toLogoUrl($, t => t.publisher?.logo)),
        toUrl($ => toLogoUrl($, t => t.logo?.url)),
        toUrl($ => toLogoUrl($, t => t.logo)),
    ]
})


const langRules = () => ({
    lang: [
        toLang($ => $('meta[property="og:locale"]').attr('content')),
        toLang($ => $('meta[itemprop="inLanguage"]').attr('content')),
        toLang($ => $('html').attr('lang'))
    ]
});

const urlRules = () => ({
    url: [
        toUrl($ => $('meta[property="og:url"]').attr('content')),
        toUrl($ => $('meta[name="twitter:url"]').attr('content')),
        toUrl($ => $('meta[property="twitter:url"]').attr('content')),
        toUrl($ => $('link[rel="canonical"]').attr('href')),
        toUrl($ => $('link[rel="alternate"][hreflang="x-default"]').attr('href')),
        ({ url }) => url,
    ]
})

const isReachable = async url => {
    try {
        const response = await fetch(url, {method: 'HEAD'});
        return response.ok;
    } catch {
        return false
    }
}

const THUMBAILS_RESOLUTIONS = [
    'maxresdefault.jpg',
    'sddefault.jpg',
    'hqdefault.jpg',
    'mqdefault.jpg',
    'default.jpg'
]

const getThumbnailUrl = (id) => {
    const urls = THUMBAILS_RESOLUTIONS.map(
        res => `https://img.youtube.com/vi/${id}/${res}`
    )
    for (const url of urls) {
        if (await isReachable(url)) return url;
    }
}

const getVideoId = (url) => {
    const shortcode = /(?:youtube://|youtu\.be/|y2u\.be/)([^?/&#\s]+)/;
    const shortsUrl = /(?:/shorts/)([^?/&#\s]+)/;
    const parameterv = /(?:v=|vi=)([^?/&#\s]+)/;
    const inlinev = /(?:/v/|/vi/|/watch/)([^?/&#\s]+)/;
    const eformat = /(?:/e/|/embed/)([^?/&#\s]+)/;
    for (const re of [shortcode, shortsUrl, parameterv, inlinev, eformat]) {
        let m = url.match(re);
        if (m && m[1]) return m[1];
    }
}

const youtubeRules = () => ({
    author: [
        toAuthor($ => $filter($, $('[class*="user-info" i]'))),
        toAuthor($ => $('[itemprop="author"] [itemprop="name"]').attr('content'))
    ],
    publisher: [() => 'YouTube'],
    image: [
        async ({ url }) => {
            const id = getVideoId(url)
            return id && await getThumbnailUrl(id)
        }
    ],
    embedUrl: [
        async ({ url }) => {
            const id = getVideoId(url)
            return `https://www.youtube-nocookie.com/embed/${id}`;
        },
    ],
    embedRWD: [
        async ({ url }) => {
            const id = getVideoId(url);
            return
        `<style>
        .embed-container {
            position: relative;
            padding-bottom: 56.25%;
            height: 0;
            overflow: hidden;
            max-width: 100%;
        }
        .embed-container iframe, .embed-container object, .embed-container embed {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        </style>
        <div class='embed-container'>
            <iframe width='560' height='315' src='https://www.youtube-nocookie.com/embed/${id}?rel=0' frameborder='0' allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture' allowfullscreen>
            </iframe>
        </div>`;
        },
    ],
    test({ url }) => getVideoId(url) !== undefined,
})

const toPublisher = toRule(value =>
        typeof value === 'string' ? condenseWhitespace(value) : undefined)

const publisherRules = () => ({
    publisher: [
        toPublisher($jsonld(t => t.publisher?.name)),
        toPublisher($ => $('meta[property="og:site_name"]').attr('content')),
        toPublisher($ => $('meta[name*="application-name" i]').attr('content')),
        toPublisher($ => $('meta[name*="app-title" i]').attr('content')),
        toPublisher($ => $('meta[property*="app_name" i]').attr('content')),
        toPublisher($ => $('meta[name="publisher" i]').attr('content')),
        toPublisher($ => $('meta[name="twitter:app:name:iphone"]').attr('content')),
        toPublisher($ =>
          $('meta[property="twitter:app:name:iphone"]').attr('content')
        ),
        toPublisher($ => $('meta[name="twitter:app:name:ipad"]').attr('content')),
        toPublisher($ =>
          $('meta[property="twitter:app:name:ipad"]').attr('content')
        ),
        toPublisher($ =>
          $('meta[name="twitter:app:name:googleplay"]').attr('content')
        ),
        toPublisher($ =>
          $('meta[property="twitter:app:name:googleplay"]').attr('content')
        ),
        toPublisher($ => $filter($, $('#logo'))),
        toPublisher($ => $filter($, $('.logo'))),
        toPublisher($ => $filter($, $('a[class*="brand" i]'))),
        toPublisher($ => $filter($, $('[class*="brand" i]'))),
        toPublisher($ => $('[class*="logo" i] a img[alt]').attr('alt')),
        toPublisher($ => $('[class*="logo" i] img[alt]').attr('alt')),
    ]
});


const getLogo = async url => {
    const faviconUrl = ensureURL('/favicon.ico', { url });
    if (!faviconUrl) return
    if (isReachable(faviconUrl)) return faviconUrl;
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain_url=${url}&sz=128`;
    if (isReachable(googleFaviconUrl)) return googleFaviconUrl;
}

const faviconRules = () => ({
    logo: [
        // toUrl($ => {
        //     const sizes = getSizes($, sizeSelectors)
        //     const size = pickFn(sizes, pickBiggerSize)
        //     return get(size, 'url')
        // }),
        toUrl($ => $('link[rel*="icon" i]').attr('href')),
        async ({ url }) => await getLogo(url),
        async ({ url }) => {
            const urlObj = new URL(url)
            urlObj.hostname = urlObj.hostname.split('.').slice(-2).join('.');
            return await getLogo(urlObj.toString());
        }
    ]
});

const keywordsRules = () => ({
    keywords: [
        toLang($ => $('meta[name="keywords" i]'.attr('content'))),
    ]
})

async function scrape({url, html, plugins}) {
    if (url) {
        const response = fetch(url);
        html = await response.text();
    }
    if (!html) return;
    const rulesets = {}
    for (const pluginMaker of plugins) {
        const plugin = pluginMaker();
        if (!plugin.test || plugin.test({url})) {
            delete plugin.test;
            for (const [attr, rules] of Object.entries(plugin)) {
                if (rulesets[attr]) {
                    rulesets[attr].push(...rules);
                } else {
                    rulesets[attr] = [...rules];
                }
            }
        }
    }
    const dom = parse(html)
    const $ = createHtmlDom(dom);
    const jobs = Object.entries(plugin).map(([attr, rules]) => ([attr, async () => {
        for (const rule of rules) {
            const value = await rule($, url);
            if (value !== undefined) return value;
        }
    }]);
    const result = {}
    for (const [attr, job] of jobs) {
        const value = await job;
        result[attr] = value;
    }
    return result;
}

