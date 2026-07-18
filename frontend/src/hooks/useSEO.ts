import { useEffect } from 'react'
import { useTranslation } from '../context/AIContext'

export function useSEO(titleKey: string, descriptionKey: string) {
  const { t } = useTranslation()

  useEffect(() => {
    // Dynamic document title
    const translatedTitle = t(titleKey)
    document.title = `${translatedTitle} — FanFlow AI`

    // Dynamic canonical URL matching active route
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    const cleanPath = window.location.pathname === '/' ? '' : window.location.pathname
    canonical.setAttribute('href', `https://fanflow.ai${cleanPath}`)

    // Dynamic meta description matching current language and page
    const translatedDesc = t(descriptionKey)
    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.setAttribute('name', 'description')
      document.head.appendChild(metaDesc)
    }
    metaDesc.setAttribute('content', translatedDesc)
  }, [titleKey, descriptionKey, t])
}
