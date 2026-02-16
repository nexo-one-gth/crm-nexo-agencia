'use client'

import { LogOut } from 'lucide-react'
import { signOutAction } from '@/app/actions/auth-actions'

export const SignOutButton = () => {
    return (
        <button
            onClick={() => signOutAction()}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-slate-400"
            title="Cerrar Sesión"
        >
            <LogOut className="w-5 h-5" />
        </button>
    )
}
