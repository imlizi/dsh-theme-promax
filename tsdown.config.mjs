import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Module specifiers the shell shares into the frozen browser module table.
 * Mirrors packages/client/web/src/platform.ts — these must stay external so the
 * bundle resolves them through the injected require instead of bundling a
 * second copy of React or of the slot registry.
 */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

const isPlatform = specifier => PLATFORM_MODULES.includes(specifier)

/**
 * Import `*.css` as a default-exported string. The skin owns its stylesheet
 * lifecycle (one `<style>` tag per plugin, removed with the fiber), so the CSS
 * must not go through any CSS-module or injection pipeline.
 */
const cssAsText = {
  name: 'dsh-skin-css-text',
  resolveId(source, importer) {
    if (!source.endsWith('.css')) return null
    const base = importer === undefined ? process.cwd() : dirname(importer)
    return `${resolve(base, source)}?skin-text`
  },
  load(id) {
    if (!id.endsWith('.css?skin-text')) return null
    const file = id.slice(0, -'?skin-text'.length)
    return `export default ${JSON.stringify(readFileSync(file, 'utf8'))}`
  },
}

/** Host-side entry: the loader must be able to import a Node half. */
const nodeFace = {
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  dts: false,
  clean: true,
  fixedExtension: false,
}

/** Browser entry: a closure factory the boot graph can materialize. */
const clientFace = {
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false,
  fixedExtension: false,
  outExtensions: () => ({ js: '.js' }),
  plugins: [cssAsText],
  deps: {
    neverBundle: specifier => isPlatform(specifier),
    alwaysBundle: specifier => !isPlatform(specifier),
  },
  outputOptions: {
    banner: 'window.__ModuleLoader__.load({ id: "dsh-theme-promax", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports;\n} });',
  },
}

export default [nodeFace, clientFace]
