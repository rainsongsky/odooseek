import type { Plugin } from 'vite'
import { buildThemeBootScript } from '../src/themes/theme-boot-script.ts'

/** Inject blocking theme boot script into index.html `<head>`. */
export function injectThemeBoot(): Plugin {
  return {
    name: 'inject-theme-boot',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const script = buildThemeBootScript()
        return html.replace('<head>', `<head>\n    <script>${script}</script>`)
      },
    },
  }
}
