import { PageTitle } from '@/shared/ui/PageTitle/PageTitle'
import { FC } from 'react'

export const MeasureModule: FC = () => {
  return (
    <section>
      <PageTitle
        title="Spotread"
        subtitle="Измерение одной точки через X-Rite i1 Pro и ArgyllCMS"
      />

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm leading-6 text-zinc-600">
          Здесь будет запуск spotread, подключение прибора, получение спектральных данных и вывод
          результата.
        </p>
      </div>
    </section>
  )
}
