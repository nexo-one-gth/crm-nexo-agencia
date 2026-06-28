'use client'

import { Home, BarChart3, Settings, Plus, Building2, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog'

const NAV_ITEMS = [
    { href: '/', label: 'Inicio', icon: Home },
    { href: '/funnel', label: 'Embudo', icon: BarChart3 },
    { href: '/prepagas', label: 'Prepagas', icon: Building2 },
    { href: '/settings', label: 'Ajustes', icon: Settings },
]

export const BottomNav = () => {
    const pathname = usePathname()
    const router = useRouter()
    const [isCreateOpen, setIsCreateOpen] = useState(false)

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
                <div className="backdrop-blur-xl bg-white/10 dark:bg-black/40 border-t border-white/15 dark:border-white/10 px-2 pt-2 pb-1">
                    <div className="flex items-center justify-around">
                        {/* Inicio */}
                        <Link
                            href="/"
                            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 min-w-[56px] ${
                                pathname === '/'
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-500 dark:text-slate-400 active:scale-95'
                            }`}
                        >
                            <Home className={`w-5 h-5 ${pathname === '/' ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]' : ''}`} />
                            <span className={`text-[10px] font-bold ${pathname === '/' ? '' : 'opacity-70'}`}>Inicio</span>
                            {pathname === '/' && <div className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />}
                        </Link>

                        {/* Embudo */}
                        <Link
                            href="/funnel"
                            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[48px] ${
                                pathname === '/funnel'
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-500 dark:text-slate-400 active:scale-95'
                            }`}
                        >
                            <BarChart3 className={`w-5 h-5 ${pathname === '/funnel' ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]' : ''}`} />
                            <span className={`text-[10px] font-bold ${pathname === '/funnel' ? '' : 'opacity-70'}`}>Embudo</span>
                            {pathname === '/funnel' && <div className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />}
                        </Link>

                        {/* Botón central: Nuevo Prospecto */}
                        <button
                            onClick={() => setIsCreateOpen(true)}
                            className="flex flex-col items-center gap-0.5 -mt-4 px-3 py-1.5 rounded-2xl transition-all duration-200 active:scale-95"
                            aria-label="Nuevo prospecto"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-shadow">
                                <Plus className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 opacity-80">Nuevo</span>
                        </button>

                        {/* Prepagas */}
                        <Link
                            href="/prepagas"
                            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[48px] ${
                                pathname.startsWith('/prepagas')
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-500 dark:text-slate-400 active:scale-95'
                            }`}
                        >
                            <Building2 className={`w-5 h-5 ${pathname.startsWith('/prepagas') ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]' : ''}`} />
                            <span className={`text-[10px] font-bold ${pathname.startsWith('/prepagas') ? '' : 'opacity-70'}`}>Prepagas</span>
                            {pathname.startsWith('/prepagas') && <div className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />}
                        </Link>

                        {/* Recursos */}
                        <Link
                            href="/recursos"
                            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-[40px] ${
                                pathname.startsWith('/recursos')
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-500 dark:text-slate-400 active:scale-95'
                            }`}
                        >
                            <FolderOpen className={`w-5 h-5 ${pathname.startsWith('/recursos') ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]' : ''}`} />
                            <span className={`text-[10px] font-bold ${pathname.startsWith('/recursos') ? '' : 'opacity-70'}`}>Recursos</span>
                            {pathname.startsWith('/recursos') && <div className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />}
                        </Link>

                        {/* Ajustes */}
                        <Link
                            href="/settings"
                            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-[40px] ${
                                pathname === '/settings'
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-500 dark:text-slate-400 active:scale-95'
                            }`}
                        >
                            <Settings className={`w-5 h-5 ${pathname === '/settings' ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]' : ''}`} />
                            <span className={`text-[10px] font-bold ${pathname === '/settings' ? '' : 'opacity-70'}`}>Ajustes</span>
                            {pathname === '/settings' && <div className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />}
                        </Link>
                    </div>
                </div>
            </nav>

            <CreateLeadDialog
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={() => router.refresh()}
            />
        </>
    )
}
