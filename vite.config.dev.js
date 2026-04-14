import { defineConfig } from 'vite';
import externalGlobals from 'rollup-plugin-external-globals';
import { createReadStream, existsSync } from 'fs';
import { join, extname } from 'path';

const fontMime = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/truetype',
  '.eot': 'application/vnd.ms-fontobject',
};

const config = defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },

  plugins: [
    externalGlobals({
      jquery: '$',
    }),
    {
      // Serve /examples/font/* directly from src/font/ so that icon fonts
      // load when browsing example pages (URLs are relative to /examples/).
      name: 'serve-example-fonts',
      configureServer(server) {
        server.middlewares.use('/examples/font', (req, res, next) => {
          const file = join(process.cwd(), 'src/font', req.url.replace(/^\//, '').split('?')[0]);
          const mime = fontMime[extname(file)];
          if (!mime || !existsSync(file)) { next(); return; }
          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          createReadStream(file).pipe(res);
        });
      },
    },
  ],

  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern',
      },
    },
  },

  build: {

    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        entryFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`,
        chunkFileNames: `[name].js`,
        external: ['jquery'],
      },

    },
  },
});

export default config;