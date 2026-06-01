import postcss from 'postcss'
import prefixSelector from 'postcss-prefix-selector'
import type { Plugin } from 'vite'

const RBC_CSS = 'react-big-calendar/lib/css/react-big-calendar.css'
const RBC_DND_CSS = 'react-big-calendar/lib/addons/dragAndDrop/styles.css'

function isRbcStylesheet(id: string): boolean {
  return id.includes(RBC_CSS) || id.includes(RBC_DND_CSS)
}

/** Prefix RBC default selectors with `.odooseek-calendar` to avoid global style leaks. */
export function scopeRbcCss(): Plugin {
  return {
    name: 'scope-rbc-css',
    enforce: 'pre',
    async transform(code, id) {
      if (!isRbcStylesheet(id)) return
      const result = await postcss([
        prefixSelector({
          prefix: '.odooseek-calendar',
          skipGlobalSelectors: true,
        }),
      ]).process(code, { from: id })
      return { code: result.css, map: null }
    },
  }
}
