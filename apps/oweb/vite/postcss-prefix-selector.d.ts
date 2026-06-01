declare module 'postcss-prefix-selector' {
  import type { PluginCreator } from 'postcss'

  interface PrefixSelectorOptions {
    prefix: string
    skipGlobalSelectors?: boolean
    transform?: (
      prefix: string,
      selector: string,
      prefixedSelector: string,
    ) => string
  }

  const prefixSelector: PluginCreator<PrefixSelectorOptions>
  export default prefixSelector
}
