// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://sagereseller.com',
  trailingSlash: 'always',
  output: 'static',
  build: {
    format: 'directory',
    // CSP forbids inline scripts, so keep every script and stylesheet external.
    inlineStylesheets: 'never',
  },
  integrations: [mdx()],
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
