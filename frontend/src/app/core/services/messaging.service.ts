import { Injectable } from '@angular/core';

export type MessageType = 'DELIVERY_READY' | 'DELIVERY_DELAY' | 'CONTROL_REMINDER' | 'PROMOTION' | 'GENERAL';

@Injectable({
    providedIn: 'root'
})
export class MessagingService {

    constructor() { }

    getTemplate(type: MessageType, data: { name: string, date?: string, custom?: string }): string {
        switch (type) {
            case 'DELIVERY_READY':
                return `Bonjour ${data.name}, vos lunettes sont prêtes ! Vous pouvez passer les récupérer en magasin quand vous le souhaitez. À très bientôt !`;
            case 'DELIVERY_DELAY':
                return `Bonjour ${data.name}, suite à un imprévu, votre commande aura un léger retard. Nous faisons le maximum pour vous livrer au plus vite. Merci de votre compréhension.`;
            case 'CONTROL_REMINDER':
                return `Bonjour ${data.name}, un petit rappel pour votre contrôle de vue. N'hésitez pas à passer nous voir ou prendre rendez-vous !`;
            case 'PROMOTION':
                return `Bonjour ${data.name}, profitez de nos offres exceptionnelles du moment sur une large sélection de montures ! À bientôt en magasin.`;
            case 'GENERAL':
            default:
                return data.custom || '';
        }
    }

    generateWhatsAppLink(phone: string, text: string): string {
        // Moroccan context: standard numbers like 06... or 07... 
        // We need international format WITHOUT + or spaces: 2126...
        let cleanPhone = phone.replace(/[^0-9]/g, '');

        if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
            cleanPhone = '212' + cleanPhone.substring(1);
        } else if (cleanPhone.length === 9) {
            cleanPhone = '212' + cleanPhone;
        }

        const encodedText = encodeURIComponent(text);
        // Using api.whatsapp.com/send is often more compatible for pre-filling than wa.me on some platforms
        return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    }

    generateSmsLink(phone: string, text: string): string {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const encodedText = encodeURIComponent(text);
        // 'sms:' protocol format varies slightly by OS but generally accepts body
        // Android/iOS typical support: sms:123456?body=Hello
        return `sms:${cleanPhone}?body=${encodedText}`;
    }

    openWhatsApp(phone: string, type: MessageType, data: { name: string, date?: string, custom?: string }): void {
        const text = this.getTemplate(type, data);
        const link = this.generateWhatsAppLink(phone, text);
        window.open(link, '_blank');
    }

    openSms(phone: string, type: MessageType, data: { name: string, date?: string, custom?: string }): void {
        const text = this.getTemplate(type, data);
        // For SMS, we typically just set window.location or open a target
        // window.open might be blocked or act weirdly for protocols, but let's try _self or just href
        window.location.href = this.generateSmsLink(phone, text);
    }
}
