import type { ComponentType } from 'react'

export type ToyMeta = {
  slug: string
  title: string
  description: string
  load: () => Promise<{ default: ComponentType }>
}
