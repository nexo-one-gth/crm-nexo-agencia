'use client'

import { Home, BarChart3, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
    { href: '/', label: 'Inicio', icon: Home },
    { href: '/funnel', label: 'Embudo', icon: BarChart3 },
    { href: '/settings', label: 'Ajustes', icon: Settings },
]

export const BottomNav = () => {
    const pathname = usePathname()

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-bottom">
            <div className="backdrop-blur-xl bg-white/10 dark:bg-black/40 border-t border-white/15 dark:border-white/10 px-2 pt-2 pb-1">
                <div className="flex items-center justify-around">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 min-w-[64px] ${isActive
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-slate-500 dark:text-slate-400 active:scale-95'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]' : ''}`} />
                                <span className={`text-[10px] font-bold ${isActive ? '' : 'opacity-70'}`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />
                                )}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}
