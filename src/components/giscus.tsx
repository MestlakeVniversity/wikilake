import React from 'react'
import { useThemeConfig, useColorMode } from '@docusaurus/theme-common'
import Giscus, { GiscusProps } from '@giscus/react'
import { useLocation } from '@docusaurus/router';

const defaultConfig: Partial<GiscusProps> = {
  id: 'comments',
  mapping: 'pathname',
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'top',
  loading: 'lazy',
  strict: '1',
  lang: 'zh-CN',
}

export default function Comment(): React.JSX.Element {
  const themeConfig = useThemeConfig()
  const { pathname } = useLocation()
  const colorMode = useColorMode().colorMode

  const giscus = {
    ...defaultConfig,
    ...(themeConfig as typeof themeConfig & { giscus?: Partial<GiscusProps> }).giscus,
  }

  if (!giscus.repo || !giscus.repoId || !giscus.categoryId) {
    throw new Error(
      'You must provide `repo`, `repoId`, and `categoryId` to `themeConfig.giscus`.',
    )
  }

  giscus.theme = colorMode === 'dark' ? 'transparent_dark' : 'light'

  return (
    <Giscus {...(giscus as GiscusProps)} key={pathname} />
  )
}
