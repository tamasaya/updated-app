import { PageTitle } from '@/shared/ui/PageTitle/PageTitle'
import { FC } from 'react'

export const ReconstructionModule: FC = () => {
  return (
    <section>
      <PageTitle
        title="Спектральная реконструкция"
        subtitle="Запуск модели и просмотр результата реконструкции"
      />

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm leading-6 text-zinc-600">
          Здесь будет загрузка изображения, запуск модели, предпросмотр и сохранение результата.
        </p>
      </div>
    </section>
  )
}
