// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  experimental: {
    appManifest: false
  },

  modules: [
    '@pinia/nuxt',
    '@nuxt/ui'
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss()
    ]
  },

  app: {
    head: {
      title: 'Stock AI Portal - LS증권 연동 실시간 주식 포털',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'LS증권 Open API & Anthropic Claude AI 연동 퀀트 스크리너 및 주식 투자 포털' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Stock AI Portal - LS증권 연동 실시간 주식 포털' },
        { property: 'og:description', content: 'LS증권 Open API & Anthropic Claude AI 연동 퀀트 스크리너 및 주식 투자 포털' },
        { property: 'og:image', content: '/icon.png' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Stock AI Portal - LS증권 연동 실시간 주식 포털' },
        { name: 'twitter:description', content: 'LS증권 Open API & Anthropic Claude AI 연동 퀀트 스크리너 및 주식 투자 포털' },
        { name: 'twitter:image', content: '/icon.png' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/icon.png' },
        { rel: 'shortcut icon', type: 'image/png', href: '/icon.png' },
        { rel: 'apple-touch-icon', href: '/icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap' },
        { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' }
      ]
    }
  }
});