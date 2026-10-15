(function () {
  const SITE_NAME = 'IPTV Sources';
  /** 行数超过该值的表格显示搜索框 */
  const LONG_TABLE_ROWS = 15;
  const FILE_EXT_RE = /\.(m3u|txt|xml|json|gz)$/i;

  const ICONS = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
    auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  };

  const content = document.getElementById('content');
  const panel = document.getElementById('panel');
  const tocRail = document.getElementById('toc-rail');
  const toc = document.getElementById('toc');

  // ---------- 工具函数 ----------

  const pad = (n) => String(n).padStart(2, '0');

  function dateFormat(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function dateTimeFormat(date) {
    return `${dateFormat(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function el(tag, props = {}, html = '') {
    const node = document.createElement(tag);
    Object.assign(node, props);
    if (html) node.innerHTML = html;
    return node;
  }

  function slugify(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  let toastTimer;
  function toast(message) {
    const node = document.getElementById('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 1800);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 非安全上下文下 clipboard API 不可用，退回到 execCommand
      const area = el('textarea', { value: text });
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  }

  function copyButton(text) {
    const btn = el('button', { type: 'button', className: 'copy-btn', title: '复制链接' }, ICONS.copy);
    btn.setAttribute('aria-label', '复制链接');
    btn.dataset.copy = text;
    return btn;
  }

  // ---------- 路由 ----------

  /** 页面路径对应的 Markdown 文件，不是站内页面时返回空 */
  function markdownUrlOf(pathname) {
    if (!pathname || pathname === '/' || pathname === '/index.html') return '/README.md';
    if (pathname.startsWith('/list/')) {
      const channelPath = pathname.slice('/list/'.length).replace(/^\/+|\/+$/g, '');
      if (channelPath) return '/list/' + channelPath + '.md';
    }
    return '';
  }

  const isPagePath = (pathname) => pathname === '/' || /^\/list\/.+\.list$/.test(pathname);

  // ---------- 渲染增强 ----------

  function replacePlaceholders(root) {
    root.querySelectorAll('code').forEach((code) => {
      code.textContent = code.textContent
        .replaceAll('{site_url}', window.location.origin)
        .replaceAll('{today}', dateFormat(new Date()));
    });
  }

  function addHeadingAnchors(root) {
    const used = new Set();
    root.querySelectorAll('h1, h2, h3').forEach((h) => {
      let id = slugify(h.textContent) || 'section';
      let unique = id;
      for (let i = 1; used.has(unique); i++) unique = `${id}-${i}`;
      used.add(unique);
      h.id = unique;
      if (h.tagName !== 'H1') {
        const anchor = el('a', { className: 'anchor', href: '#' + unique, textContent: '#' });
        anchor.setAttribute('aria-hidden', 'true');
        h.appendChild(anchor);
      }
    });
  }

  /** 把 "Updated at **...**" 段落挪到标题下方的信息条里 */
  function buildPageMeta(root) {
    const h1 = root.querySelector('h1');
    const meta = el('div', { className: 'page-meta' });

    root.querySelectorAll('p').forEach((p) => {
      if (!/^\s*Updated at/i.test(p.textContent)) return;
      const raw = p.querySelector('strong')?.textContent || p.textContent.replace(/^\s*Updated at/i, '');
      const date = new Date(raw.trim());
      const label = isNaN(date) ? raw.trim() : dateTimeFormat(date);
      meta.appendChild(el('span', { className: 'chip', title: raw.trim() }, `${ICONS.clock}更新于 ${label}`));
      p.remove();
    });

    // 频道列表页：统计频道数
    const channelTable = [...root.querySelectorAll('table')].find((t) =>
      /channel name/i.test(t.tHead?.textContent || '')
    );
    if (channelTable) {
      const rows = channelTable.tBodies[0]?.rows.length || 0;
      meta.prepend(el('span', { className: 'chip' }, `${ICONS.tv}${rows} 个频道`));
    }

    if (meta.children.length && h1) h1.after(meta);
  }

  function buildBreadcrumb(root, pathname) {
    if (pathname === '/') return;
    const h1 = root.querySelector('h1');
    const crumb = el('nav', { className: 'breadcrumb' });
    crumb.setAttribute('aria-label', '面包屑');
    const parts = [['/', '首页']];
    if (pathname.startsWith('/list/iptv/')) parts.push(['/list/iptv.list', '运营商 IPTV']);
    parts.forEach(([href, text]) => {
      crumb.append(el('a', { href, textContent: text }), el('span', { className: 'sep', textContent: '/' }));
    });
    crumb.append(el('span', { textContent: h1 ? h1.textContent.trim() : pathname }));
    root.prepend(crumb);
  }

  function enhanceLinks(root) {
    root.querySelectorAll('a[href]').forEach((a) => {
      // 表格里的短链接（如「📋列表」「🏠代理」）不在字中间断开
      if (a.closest('td') && [...a.textContent.trim()].length <= 8) a.classList.add('nowrap');
      const url = new URL(a.getAttribute('href'), window.location.origin);
      if (url.origin !== window.location.origin) {
        a.target = '_blank';
        a.rel = 'noopener';
        if (a.closest('td') && a.textContent.trim() === a.getAttribute('href')) a.classList.add('stream-link');
        return;
      }
      const match = url.pathname.match(FILE_EXT_RE);
      if (!match) return;

      a.classList.add('file-link');
      const ext = match[1].toLowerCase();
      const text = a.textContent.trim();
      // 链接文本就是文件名时，用扩展名标签代替后缀，并提供复制按钮
      if (text.toLowerCase().endsWith('.' + ext)) {
        a.textContent = '';
        a.append(
          el('span', { className: 'ext', textContent: ext }),
          document.createTextNode(text.slice(0, -ext.length - 1))
        );
        a.title = url.href;
        // 包一层避免链接和复制按钮被拆到两行
        const item = el('span', { className: 'file-item' });
        a.replaceWith(item);
        item.append(a, copyButton(url.href));
      }
    });

    // 内联代码里的完整 URL 可直接复制
    root.querySelectorAll('code').forEach((code) => {
      // 跳过 `http://<网关>:port/...` 这类示意格式
      if (code.closest('pre') || !/^https?:\/\/[^\s<>]+$/.test(code.textContent.trim())) return;
      if (code.textContent.includes('...')) return;
      const wrap = el('span', { className: 'copyable' });
      code.replaceWith(wrap);
      wrap.append(code, copyButton(code.textContent.trim()));
    });
  }

  const STATUS_BADGES = [
    [/^✅$/, 'badge-ok', '正常'],
    [/^(⚠️)?\s*(update failed|更新失败)$/i, 'badge-bad', '更新失败'],
    [/^独立构建$/, 'badge-muted', '独立构建'],
    [/^🌐\s*暂无$/, 'badge-muted', '暂无'],
  ];

  function enhanceTable(table) {
    const headers = [...(table.tHead?.rows[0]?.cells || [])].map((th) => th.textContent.trim().toLowerCase());
    const body = table.tBodies[0];
    const rows = body ? [...body.rows] : [];

    const colClass = headers.map((h) => {
      if (h === 'no.') return 'col-num';
      if (h === 'count') return 'col-count';
      if (h === 'from') return 'col-from';
      return '';
    });
    colClass.forEach((cls, i) => cls && table.tHead.rows[0].cells[i].classList.add(cls));

    // `<br>` 两侧的空格在 pre-wrap 下会变成多余的缩进
    table.querySelectorAll('td br').forEach((br) => {
      [br.previousSibling, br.nextSibling].forEach((node) => {
        if (node && node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node.remove();
      });
    });

    rows.forEach((row) => {
      [...row.cells].forEach((td, i) => {
        if (colClass[i]) td.classList.add(colClass[i]);
        const text = td.textContent.trim();
        const status = STATUS_BADGES.find(([re]) => re.test(text));
        if (status) td.innerHTML = `<span class="badge ${status[1]}">${status[2]}</span>`;
      });
    });

    const block = el('div', { className: 'table-block' });
    const wrap = el('div', { className: 'table-wrap' });
    table.replaceWith(block);
    wrap.appendChild(table);

    if (rows.length > LONG_TABLE_ROWS) {
      const toolbar = el('div', { className: 'table-toolbar' });
      const search = el('label', { className: 'search' }, ICONS.search);
      const input = el('input', { type: 'search', placeholder: '搜索频道、来源或地址…' });
      input.setAttribute('aria-label', '筛选表格');
      const count = el('span', { className: 'table-count' });
      const empty = el('div', { className: 'table-empty', textContent: '没有匹配的结果', hidden: true });
      const texts = rows.map((row) => row.textContent.toLowerCase());

      const update = () => {
        const q = input.value.trim().toLowerCase();
        let shown = 0;
        rows.forEach((row, i) => {
          const hit = !q || texts[i].includes(q);
          row.classList.toggle('is-hidden', !hit);
          if (hit) shown++;
        });
        count.textContent = q ? `匹配 ${shown} / ${rows.length} 条` : `共 ${rows.length} 条`;
        empty.hidden = shown > 0;
      };
      input.addEventListener('input', update);
      update();

      search.appendChild(input);
      toolbar.append(search, count);
      wrap.appendChild(empty);
      block.appendChild(toolbar);
    }
    block.appendChild(wrap);
  }

  let tocSpy = null;
  function buildToc(root) {
    tocSpy = null;
    const headings = [...root.querySelectorAll('h2, h3')];
    const h2Count = headings.filter((h) => h.tagName === 'H2').length;
    toc.innerHTML = '';
    if (h2Count < 3) {
      tocRail.hidden = true;
      panel.classList.remove('has-toc');
      return;
    }

    const headingText = (h) =>
      [...h.childNodes]
        .filter((n) => !(n.classList && n.classList.contains('anchor')))
        .map((n) => n.textContent)
        .join('')
        .trim();
    const buildList = (onLink) => {
      const list = el('ol');
      headings.forEach((h) => {
        const a = el('a', { href: '#' + h.id, textContent: headingText(h) });
        onLink?.(h, a);
        const li = el('li', { className: h.tagName === 'H3' ? 'sub' : '' });
        li.appendChild(a);
        list.appendChild(li);
      });
      return list;
    };

    const links = new Map();
    toc.append(
      el('p', { className: 'toc-title', textContent: '目录' }),
      buildList((h, a) => links.set(h, a))
    );

    // 窄屏下侧栏目录隐藏，在正文顶部放一个可折叠的目录
    const inline = el('details', { className: 'toc-inline' });
    inline.append(el('summary', { textContent: '本页目录' }), buildList());
    inline.addEventListener('click', (e) => {
      if (e.target.closest('a')) inline.open = false;
    });
    (root.querySelector('.page-meta') || root.querySelector('h1'))?.after(inline);
    tocRail.hidden = false;
    panel.classList.add('has-toc');

    // 高亮当前阅读位置所在的章节：最后一个越过页头的标题
    let ticking = false;
    tocSpy = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const current = headings.filter((h) => h.getBoundingClientRect().top < 120).pop() || headings[0];
        links.forEach((a, h) => a.classList.toggle('active', h === current));
      });
    };
    tocSpy();
  }

  /** 顶部导航只区分两个版块：运营商 IPTV 及其子页面，其余（首页和各源列表）都归首页 */
  function updateNav(pathname) {
    const section = /^\/list\/iptv(\.list$|\/)/.test(pathname) ? 'iptv' : 'home';
    document.querySelectorAll('.nav a[data-match]').forEach((a) => {
      a.classList.toggle('active', a.dataset.match === section);
    });
  }

  function scrollToHash(hash, smooth) {
    if (!hash) return false;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return false;
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    return true;
  }

  // ---------- 页面加载 ----------

  function renderState({ code, title, text }) {
    tocRail.hidden = true;
    panel.classList.remove('has-toc');
    content.innerHTML = `
      <div class="state">
        <p class="state-code">${code}</p>
        <h1>${title}</h1>
        <p>${text}</p>
        <div class="state-actions">
          <a class="btn" href="/">返回首页</a>
          ${code === '!' ? '<button class="btn btn-ghost" type="button" data-retry>重试</button>' : ''}
        </div>
      </div>`;
    document.title = `${title} · ${SITE_NAME}`;
  }

  let loadedPath = null;
  let requestId = 0;

  async function loadPage() {
    const { pathname, hash } = window.location;
    updateNav(pathname);
    const markdownUrl = markdownUrlOf(pathname);
    const id = ++requestId;
    loadedPath = pathname;

    if (!markdownUrl) {
      renderState({ code: 404, title: '页面不存在', text: '你访问的页面不存在，可能已被移除或地址有误。' });
      return;
    }

    let markdown;
    try {
      const response = await fetch(markdownUrl);
      if (id !== requestId) return;
      if (!response.ok) {
        renderState({ code: 404, title: '页面不存在', text: '没有找到对应的列表，可能该源已下线或尚未生成。' });
        return;
      }
      markdown = await response.text();
    } catch (error) {
      console.error('Error loading the markdown file:', error);
      if (id === requestId) {
        renderState({ code: '!', title: '加载失败', text: '网络异常，请检查网络后重试。' });
      }
      return;
    }
    if (id !== requestId) return;

    const root = el('div', {}, marked.parse(markdown));
    replacePlaceholders(root);
    addHeadingAnchors(root);
    buildPageMeta(root);
    root.querySelectorAll('table').forEach(enhanceTable);
    enhanceLinks(root);
    buildBreadcrumb(root, pathname);

    content.replaceChildren(...root.childNodes);
    content.classList.remove('is-entering');
    void content.offsetWidth;
    content.classList.add('is-entering');
    document.body.classList.toggle('page-home', pathname === '/');

    const h1 = content.querySelector('h1');
    const heading = h1 ? h1.textContent.replace(/#$/, '').trim() : '';
    document.title = pathname === '/' || !heading ? SITE_NAME : `${heading} · ${SITE_NAME}`;

    buildToc(content);
    if (!scrollToHash(hash, false)) window.scrollTo(0, 0);
  }

  function navigate(url) {
    const sameDoc = url.pathname === loadedPath;
    if (url.href !== window.location.href) history.pushState(null, '', url.href);
    if (sameDoc) {
      if (!scrollToHash(url.hash, true)) window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      loadPage();
    }
  }

  // ---------- 事件 ----------

  document.addEventListener('click', async (event) => {
    const copyBtn = event.target.closest('.copy-btn');
    if (copyBtn) {
      event.preventDefault();
      const ok = await copyText(copyBtn.dataset.copy);
      toast(ok ? '已复制到剪贴板' : '复制失败，请手动复制');
      if (ok) {
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = ICONS.check;
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = ICONS.copy;
        }, 1500);
      }
      return;
    }

    if (event.target.closest('[data-retry]')) {
      loadPage();
      return;
    }

    const a = event.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const url = new URL(a.href);
    if (url.origin !== window.location.origin || !isPagePath(url.pathname)) return;
    event.preventDefault();
    navigate(url);
  });

  window.addEventListener('popstate', () => {
    // 仅 hash 变化时不重新加载
    if (window.location.pathname === loadedPath) {
      scrollToHash(window.location.hash, true);
      return;
    }
    loadPage();
  });

  // 主题：跟随系统 → 浅色 → 深色
  const themeBtn = document.getElementById('theme-toggle');
  const THEME_LABELS = { auto: '跟随系统', light: '浅色', dark: '深色' };
  function applyTheme(theme) {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    themeBtn.innerHTML = ICONS[theme === 'auto' ? 'auto' : theme === 'light' ? 'sun' : 'moon'];
    themeBtn.title = `主题：${THEME_LABELS[theme]}`;
  }
  let theme = document.documentElement.dataset.theme || 'auto';
  applyTheme(theme);
  themeBtn.addEventListener('click', () => {
    theme = { auto: 'light', light: 'dark', dark: 'auto' }[theme];
    applyTheme(theme);
    toast(`主题：${THEME_LABELS[theme]}`);
    try {
      if (theme === 'auto') localStorage.removeItem('theme');
      else localStorage.setItem('theme', theme);
    } catch {
      // 隐私模式等场景下存储不可用，忽略即可
    }
  });

  const toTop = document.getElementById('to-top');
  window.addEventListener(
    'scroll',
    () => {
      toTop.classList.toggle('show', window.scrollY > 600);
      tocSpy?.();
    },
    { passive: true }
  );
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  loadPage();
})();
