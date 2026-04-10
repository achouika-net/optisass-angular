
// ... existing imports ...
import { BehaviorSubject } from 'rxjs'; // Ensure BehaviorSubject is imported! I will add it to the top of the file separately if needed or assume it's there.
// Actually, I should check imports. common/http or rxjs?
// It is usually in 'rxjs'.

// ... inside class ...

loadLinkedFacture(): void {
    if(!this.clientId || !this.ficheId) return;

    this.factureService.findAll({ clientId: this.clientId }).subscribe(factures => {
        const found = factures.find(f => f.ficheId === this.ficheId);
        if (found) {
            this.linkedFactureSubject.next(found);
        } else {
            this.linkedFactureSubject.next(null);
        }
    });
}

onInvoiceSaved(facture: any): void { // Start of onInvoiceSaved
    console.log('✅ Invoice saved/updated in Monture Form:', facture);

    // Update the subject to reflect the new state (e.g. Valid status, New Number)
    this.linkedFactureSubject.next(facture);

    // Also ensure inputs are synced if they weren't
    this.cdr.markForCheck();
}
