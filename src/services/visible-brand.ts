export const VISIBLE_APP_NAME = '神仙云'

export const replaceVisibleBrand = (text: string) =>
  text
    .replaceAll('Clash Verge Rev', VISIBLE_APP_NAME)
    .replaceAll('Clash-Verge', VISIBLE_APP_NAME)
    .replaceAll('Clash Verge', VISIBLE_APP_NAME)
    .replaceAll('Verge', VISIBLE_APP_NAME)
