import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminAdvisorView } from '@/components/admin/AdminAdvisorView'

export default async function AdminPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const userRole = profile?.role?.toLowerCase() ?? ''
    const isAdmin = userRole === 'admin' || userRole === 'admin_principal'

    if (!isAdmin) redirect('/')

    const isAdminPrincipal = userRole === 'admin_principal'

    return (
        <div className="max-w-6xl mx-auto py-8">
            <AdminAdvisorView isAdminPrincipal={isAdminPrincipal} currentUserId={user.id} />
        </div>
    )
}
