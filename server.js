const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const port = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== 'production';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/ai-grader';

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    // Pastikan req.url selalu memiliki prefix basePath jika proxy cPanel/LiteSpeed memotongnya
    if (
      basePath &&
      req.url &&
      !(
        req.url === basePath ||
        req.url.startsWith(`${basePath}/`) ||
        req.url.startsWith(`${basePath}?`)
      )
    ) {
      req.url = req.url === '/' ? basePath : `${basePath}${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
    }

    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> WMVAA AI Grader Pro v2.0.6 ready (basePath: ${basePath || '/'}, port/socket: ${port})`);
  });
});
