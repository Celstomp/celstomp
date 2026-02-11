import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

function copyLegacyAssets() {
  return {
    name: 'copy-legacy-assets',
    apply: 'build',
    closeBundle() {
      const rootDir = resolve(__dirname, 'celstomp');
      const outDir = resolve(rootDir, 'dist');

      const copyDir = (src, dest) => {
        cpSync(resolve(rootDir, src), resolve(outDir, dest), {
          recursive: true,
          force: true,
        });
      };

      const copyFile = (src, dest) => {
        cpSync(resolve(rootDir, src), resolve(outDir, dest), {
          force: true,
        });
      };

      // These are loaded dynamically at runtime by celstomp/js/html-loader.js.
      copyDir('js', 'js');
      copyDir('parts', 'parts');

      // Keep existing relative asset paths working in the built output.
      copyDir('css', 'css');
      copyDir('icons', 'icons');

      // Runtime-fetched / not directly referenced by index.html
      copyFile('service-worker.js', 'service-worker.js');

      // Misc static assets
      copyFile('manifest.webmanifest', 'manifest.webmanifest');
      copyFile('robots.txt', 'robots.txt');
      copyFile('sitemap.xml', 'sitemap.xml');

      // Legacy app scripts living at the celstomp/ root
      copyFile('celstomp-app.js', 'celstomp-app.js');
      copyFile('celstomp-autosave.js', 'celstomp-autosave.js');
      copyFile('celstomp-imgseq.js', 'celstomp-imgseq.js');
    },
  };
}

export default defineConfig({
  root: 'celstomp',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [copyLegacyAssets()],
});
