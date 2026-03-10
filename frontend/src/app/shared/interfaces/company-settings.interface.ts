export interface BankAccount {
    bankName: string;
    rib: string;
    iban?: string;
    swift?: string;
}

export interface CompanySettings {
    id?: string;
    name: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    email?: string;
    ice?: string;
    identifiantFiscal?: string;
    rc?: string;
    patente?: string;
    cnss?: string;
    inpeCode?: string;
    bankAccounts?: BankAccount[];
    headerText?: string;
    footerText?: string;
    updatedAt?: string;
}
