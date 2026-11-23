import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

// 正式运行（vite preview）时，底图 JSON（约 2.8MB）和公司数据压缩后再发给浏览器，约减到 1/4，首屏更快。
// 文件改动后（例如重新执行了 npm run data 并打包）会重新压缩。
function gzipJson(): Plugin {
  const cache = new Map<string, { mtime: number; body: Buffer }>()
  return {
    name: 'gzip-json',
    configurePreviewServer(server) {
      const dist = server.config.build.outDir
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!/^\/(geo|mock)\/[\w-]+\.json$/.test(url) || !/\bgzip\b/.test(String(req.headers['accept-encoding']))) return next()
        const file = join(server.config.root, dist, url)
        let hit = cache.get(url)
        try {
          const mtime = statSync(file).mtimeMs
          if (hit?.mtime !== mtime) cache.set(url, (hit = { mtime, body: gzipSync(readFileSync(file)) }))
        } catch { return next() }
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Encoding', 'gzip')
        // 底图不会变，可以缓存；公司数据每次都要拿最新的
        res.setHeader('Cache-Control', url.startsWith('/geo/') ? 'public, max-age=3600' : 'no-cache')
        res.end(hit.body)
      })
    },
  }
}

// 监听 0.0.0.0，局域网内用 http://<服务器IP>:5188 访问
export default defineConfig({
  plugins: [react(), gzipJson()],
  server: {
    host: '0.0.0.0',
    port: 5188,
    strictPort: true,
  },
  preview: { host: '0.0.0.0', port: 5188, strictPort: true },
})
