'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RootPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState<boolean>(true)

  // 🛡️ VERIFICAÇÃO AUTOMÁTICA DE SESSÃO ATIVA (GATILHO DE NEGÓCIO)
  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/instagram')
      } else {
        setCheckingSession(false)
      }
    }
    checkUser()
  }, [router])

  // 🔐 DISPARO DO FLUXO DE LOGIN COMPATÍVEL COM O AUTH.USERS
  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
    } else if (data.session) {
      // Login bem-sucedido! Encaminha o usuário para o dashboard pintado
      router.push('/instagram')
    }
  }

  if (checkingSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200 font-sans">
        <p className="text-sm tracking-wide animate-pulse">Autenticando sessão Orbit...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 font-sans">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">ORBIT <span className="text-blue-500">S</span></h1>
          <p className="mt-2 text-sm text-slate-400">Entre com suas credenciais de analista</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              E-mail corporativo
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="seu.nome@orbitdashboard.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Senha de acesso
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {errorMessage && (
            <div className="rounded-lg bg-red-950/30 border border-red-900/50 p-3 text-xs text-red-400">
              ⚠️ {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Validando credenciais...' : 'Acessar Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
