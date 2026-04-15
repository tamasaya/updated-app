import { PageTitle } from '@/shared/ui/PageTitle/PageTitle'
import { ReconstructionWorkspace } from '@/widgets/reconstruction-workspace'
import { JSX } from 'react'

export function ReconstructionPage(): JSX.Element {
  return (
    <section className="space-y-6">
      <PageTitle
        title="Спектральная реконструкция"
        subtitle="Запуск модели и просмотр спектральных каналов"
      />

      <ReconstructionWorkspace />
    </section>
  )
}
