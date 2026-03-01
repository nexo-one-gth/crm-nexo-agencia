import { getLeadById, getLeadActivities } from '@/app/actions/lead-actions'
import { LeadDetailView } from '@/components/leads/LeadDetailView'
import { notFound } from 'next/navigation'

export default async function LeadPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const lead = await getLeadById(id)

    if (!lead) {
        notFound()
    }

    const activities = await getLeadActivities(id)

    return (
        <LeadDetailView lead={lead} activities={activities} />
    )
}
