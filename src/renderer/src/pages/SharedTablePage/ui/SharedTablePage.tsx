import { JSX } from 'react'
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle'
import { SharedTable } from '@/shared/ui/SharedTable/SharedTable'

export function SharedTablePage(): JSX.Element {
  return (
    <section className="space-y-6">
      <PageTitle
        title="Общая таблица"
        subtitle="Объединённые данные из модулей Spotread и Реконструкции"
      />
      <SharedTable />
    </section>
  )
}
