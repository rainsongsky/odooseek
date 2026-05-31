import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { IntlProvider } from 'use-intl'
import { useAuth } from './auth'
import enMessages from './locales/en.json'
import zhMessages from './locales/zh.json'
import frMessages from './locales/fr.json'
import deMessages from './locales/de.json'
import esMessages from './locales/es.json'

const DEFAULT_LOCALE = 'en'

const FALLBACK: Record<string, Record<string, unknown>> = {
  en: enMessages,
  zh: zhMessages,
  fr: frMessages,
  de: deMessages,
  es: esMessages,
}

const LOCALE_MAP: Record<string, string> = {
  zh: 'zh', zh_CN: 'zh', zh_TW: 'zh',
  en: 'en', en_US: 'en',
  fr: 'fr', fr_FR: 'fr', fr_BE: 'fr', fr_CA: 'fr',
  de: 'de', de_DE: 'de', de_CH: 'de',
  es: 'es', es_ES: 'es', es_MX: 'es', es_AR: 'es',
}

let _cache: { locale: string; data: Record<string, unknown> } | null = null

function toLocale(lang: string | null | undefined): string {
  if (!lang) return DEFAULT_LOCALE
  return LOCALE_MAP[lang] ?? LOCALE_MAP[lang.split('_')[0] ?? ''] ?? DEFAULT_LOCALE
}

async function fetchTranslations(locale: string): Promise<Record<string, unknown>> {
  if (_cache?.locale === locale) return _cache.data
  try {
    const res = await fetch(`/api/translations?lang=${locale}&mods=web,base`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed')
    const data = (await res.json()) as Record<string, unknown>
    _cache = { locale, data }
    return data
  } catch {
    return FALLBACK[locale] ?? FALLBACK[DEFAULT_LOCALE] ?? {}
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const locale = session.db ? toLocale(session.user_context?.lang) : DEFAULT_LOCALE
  const [msgs, setMsgs] = useState<Record<string, unknown>>(
    () => FALLBACK[locale] ?? FALLBACK[DEFAULT_LOCALE] ?? {},
  )

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
