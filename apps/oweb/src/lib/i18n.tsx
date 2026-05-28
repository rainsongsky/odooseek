import type { ReactNode } from 'react'
import { IntlProvider } from 'use-intl'
import { useAuth } from './auth'
import enMessages from './locales/en.json'
import zhMessages from './locales/zh.json'

const MESSAGES: Record<string, Record<string, unknown>> = {
  en: enMessages,
  zh: zhMessages,
}

const LOCALE_MAP: Record<string, string> = {
  zh: 'zh',
  zh_CN: 'zh',
  zh_TW: 'zh',
  en: 'en',
  en_US: 'en',
  fr: 'fr',
  de: 'de',
  es: 'es',
}

function odooLangToLocale(lang: string | null | undefined): string {
  if (!lang) return 'en'
  return LOCALE_MAP[lang] ?? LOCALE_MAP[lang.split('_')[0] ?? ''] ?? 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const locale = session.db ? odooLangToLocale('zh_CN') : 'en'

  return (
    <IntlProvider key={locale} locale={locale} messages={MESSAGES[locale] ?? {}}>
      {children}
    </IntlProvider>
  )
}
