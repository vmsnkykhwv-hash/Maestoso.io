// Mini-Ersatz für das Supabase-Gateway: supabase-js ruft <url>/rest/v1/* auf,
// PostgREST lauscht ohne dieses Präfix.
import http from 'node:http'

http
  .createServer((req, res) => {
    if (!req.url.startsWith('/rest/v1')) {
      res.writeHead(404)
      return res.end('{}')
    }
    const ziel = http.request(
      { host: '127.0.0.1', port: 3001, path: req.url.slice('/rest/v1'.length) || '/', method: req.method, headers: { ...req.headers, host: '127.0.0.1:3001' } },
      (r) => {
        res.writeHead(r.statusCode, r.headers)
        r.pipe(res)
      }
    )
    ziel.on('error', () => {
      res.writeHead(502)
      res.end('{}')
    })
    req.pipe(ziel)
  })
  .listen(54321)
