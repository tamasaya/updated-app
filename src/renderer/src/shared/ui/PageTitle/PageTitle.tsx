import { FC } from 'react'

type PageTitleProps = {
  title: string
  subtitle?: string
}

export const PageTitle: FC<PageTitleProps> = ({ title, subtitle }) => {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-zinc-500">{subtitle}</p> : null}
    </div>
  )
}
