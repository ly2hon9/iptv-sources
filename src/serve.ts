import fs from 'fs';
import path from 'path';

import Koa from 'koa';
import { default as Static } from 'koa-static';
import Router from 'koa-router';
import MarkdownIt from 'markdown-it';

import { canIUseIPTVChecker, canIUseM3uFile } from './checker';

const app = new Koa();
const router = new Router();
const md = new MarkdownIt({ html: true });

const markdownBody = (md_p: string, back_p: string) => {
  const target = [md_p, back_p].find((p) => fs.existsSync(p));
  if (!target) return undefined;

  const markdown = fs.readFileSync(target).toString();

  return `
    <html lang="en">
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.css" integrity="sha512-LX/J+iRwkfRqaipVsfmi2B1S7xrqXNHdTb6o4tWe2Ex+//EN3ifknyLIbX5f+kC31zEKHon5l9HDEwTQR1H8cg==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <style>
        html, body {
            margin: 0;
            padding: 0;
        }
        .markdown-body {
            box-sizing: border-box;
            max-width: none;
            padding: 32px clamp(16px, 4vw, 64px);
        }

        .markdown-body table {
            display: table;
            width: 100%;
        }

        @media (max-width: 768px) {
            .markdown-body {
                padding: 20px 16px;
                overflow-x: auto;
            }

            .markdown-body table {
                width: max-content;
                min-width: 100%;
            }
        }

        tr, td {
            color: var(--color-fg-default);
        }
    </style>
    </head>
    <body>
        <div class="markdown-body">${md.render(markdown)}</div>
    </body>
    </html>
    `;
};

router.get('/', (ctx) => {
  const readme_p = path.resolve('m3u', 'README.md');
  const back_readme_p = path.resolve('back', 'README.md');

  const body = markdownBody(readme_p, back_readme_p);
  if (!body) {
    ctx.status = 404;
    ctx.body = 'README.md not found, please run the build first.';
    return;
  }
  ctx.body = body;
});

// channel 可以带目录，如 `iptv/multicast/beijing/unicom.list`
router.get('/list/:channel(.+\\.list)', (ctx) => {
  const list = ctx.params.channel;
  const list_dir = path.resolve('m3u', 'list');
  const back_list_dir = path.resolve('back', 'list');
  const list_readme_p = path.resolve(list_dir, `${list}.md`);
  const back_list_readme_p = path.resolve(back_list_dir, `${list}.md`);

  // 防止通过 `..` 读取 list 目录以外的文件
  if (!list_readme_p.startsWith(list_dir + path.sep)) {
    ctx.status = 404;
    return;
  }

  const body = markdownBody(list_readme_p, back_list_readme_p);
  if (!body) {
    ctx.status = 404;
    return;
  }
  ctx.body = body;
});

router.get('/check/:channel', async (ctx) => {
  const chan = ctx.params.channel;

  if (!canIUseM3uFile(`${chan}.m3u`)) {
    ctx.status = 404;
    return;
  }

  if (!(await canIUseIPTVChecker())) {
    ctx.status = 403;
    return;
  }

  ctx.body = fs.readFileSync(path.resolve('public', 'check.html')).toString();
});

router.get('/api/check', async (ctx) => {
  if (!(await canIUseIPTVChecker())) {
    ctx.status = 403;
    return;
  }

  const { url, timeout } = ctx.query;
  if (!url) {
    ctx.status = 403;
    return;
  }

  try {
    const t = parseInt(timeout as string, 10);
    const res = await fetch(
      `${
        process.env.IPTV_CHECKER_URL
      }/check/url-is-available?url=${url}&timeout=${isNaN(t) ? -1 : t}`
    );

    ctx.status = res.status;
    ctx.body = await res.text();
  } catch {
    ctx.status = 500;
    return;
  }
});

app.use(router.routes());
app.use(Static('./m3u'));

const port = Number(process.env.PORT) || 8080;

app.listen(port, () => {
  console.log(`Serving at http://127.0.0.1:${port}`);
  console.log(`If the network supports ipv6, visit http://[::1]:${port}`);
});
