'use client'

import { useParams } from 'next/navigation'
import OnboardingScreen from '@/components/screens/OnboardingScreen'
import { useOnboarding } from '@/hooks/useOnboarding'

export default function OnboardingPage(): React.ReactElement {
  const params = useParams()
  const clientId = (params?.clientId as string) || '2141d077-0d82-4fda-83df-558377f105ff'

  const { data, status, error } = useOnboarding(clientId)

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0C0C0F]">
        <p className="text-zinc-400">Carregando...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0C0C0F]">
        <p className="text-red-400">Erro: {error}</p>
      </div>
    )
  }

  return <OnboardingScreen clientId={clientId} initialData={data} />
}