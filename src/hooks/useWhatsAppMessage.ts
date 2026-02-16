import { useState, useCallback } from 'react'

export const useWhatsAppMessage = () => {
    const generateLink = useCallback((phone: string, firstName: string) => {
        // Sanitize phone
        const cleanPhone = phone.replace(/\D/g, '')
        const formattedPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`

        // Default message template
        const message = `Hola ${firstName}, te contacto de Nexo ...`
        const encodedMessage = encodeURIComponent(message)

        return `https://wa.me/${formattedPhone}?text=${encodedMessage}`
    }, [])

    return { generateLink }
}
