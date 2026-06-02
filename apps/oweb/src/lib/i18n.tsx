import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { IntlProvider } from 'use-intl'
import { useAuth } from './auth'
import deMessages from './locales/de.json'
import enMessages from './locales/en.json'
import esMessages from './locales/es.json'
import frMessages from './locales/fr.json'
import zhMessages from './locales/zh.json'

const DEFAULT_LOCALE = 'en'

const FALLBACK: Record<string, Record<string, unknown>> = {
  en: enMessages,
  zh: zhMessages,
  fr: frMessages,
  de: deMessages,
  es: esMessages,
}

const LOCALE_MAP: Record<string, string> = {
  zh: 'zh',
  zh_CN: 'zh',
  zh_TW: 'zh',
  en: 'en',
  en_US: 'en',
  fr: 'fr',
  fr_FR: 'fr',
  fr_BE: 'fr',
  fr_CA: 'fr',
  de: 'de',
  de_DE: 'de',
  de_CH: 'de',
  es: 'es',
  es_ES: 'es',
  es_MX: 'es',
  es_AR: 'es',
}

let _cache: { locale: string; data: Record<string, unknown> } | null = null

function toLocale(lang: string | null | undefined): string {
  if (!lang) return DEFAULT_LOCALE
  return LOCALE_MAP[lang] ?? LOCALE_MAP[lang.split('_')[0] ?? ''] ?? DEFAULT_LOCALE
}

function fallbackMessages(locale: string): Record<string, unknown> {
  return FALLBACK[locale] ?? FALLBACK[DEFAULT_LOCALE] ?? {}
}

/** Odoo `/web/webclient/translations` bundle — not use-intl nested messages. */
function isOdooTranslationBundle(data: Record<string, unknown>): boolean {
  return typeof data.modules === 'object' && data.modules !== null && 'lang' in data
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(patch)) {
    const pv = patch[key]
    const bv = out[key]
    if (
      pv !== null &&
      typeof pv === 'object' &&
      !Array.isArray(pv) &&
      bv !== null &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      out[key] = deepMerge(bv as Record<string, unknown>, pv as Record<string, unknown>)
    } else {
      out[key] = pv
    }
  }
  return out
}

async function fetchTranslations(locale: string): Promise<Record<string, unknown>> {
  const fallback = fallbackMessages(locale)
  if (_cache?.locale === locale) return _cache.data
  try {
    const res = await fetch(`/api/translations?lang=${locale}&mods=web,base`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed')
    const data = (await res.json()) as Record<string, unknown>
    // Keep app strings (login, nav, …); Odoo bundle uses { modules: { web: { messages: [] } } }.
    const merged = isOdooTranslationBundle(data) ? fallback : deepMerge(fallback, data)
    _cache = { locale, data: merged }
    return merged
  } catch {
    return fallback
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const locale = session.db ? toLocale(session.user_context?.lang) : DEFAULT_LOCALE
  const [msgs, setMsgs] = useState<Record<string, unknown>>(() => fallbackMessages(locale))

  useEffect(() => {
    if (!session.db) return
    fetchTranslations(locale).then(setMsgs)
  }, [locale, session.db])

  return (
    <IntlProvider key={locale} locale={locale} messages={msgs}>
      {children}
    </IntlProvider>
  )
}
