import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')

// jsdom doesn't expose DOMParser globally — polyfill it
if (!globalThis.DOMParser) {
  // @ts-expect-error DOMParser from jsdom window
  globalThis.DOMParser = dom.window.DOMParser
}
