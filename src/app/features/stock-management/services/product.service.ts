import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
    Product,
    BaseProduct,
    Frame,
    Lens,
    ContactLens,
    Accessory,
    ProductType,
    ProductStatus,
    ProductFilters,
    StockStats
} from '../../../shared/interfaces/product.interface';

@Injectable({
    providedIn: 'root'
})
export class ProductService {

    private mockProducts: Product[] = [];

    constructor() {
        this.initializeMockData();
    }

    /**
     * CRUD Operations
     */

    create(product: Partial<Product>): Observable<Product> {
        console.log('Creating product:', product);

        const id = Math.random().toString(36).substr(2, 9);
        const dateCreation = new Date();
        const dateModification = new Date();

        // Calculate selling price automatically
        const prixVenteHT = this.calculateSellingPrice(
            product.prixAchatHT || 0,
            product.coefficient || 1
        );

        const prixVenteTTC = this.calculatePriceTTC(
            prixVenteHT,
            product.tauxTVA || 0.20
        );

        const newProduct = {
            ...product,
            id,
            dateCreation,
            dateModification,
            prixVenteHT,
            prixVenteTTC,
            statut: product.statut || ProductStatus.DISPONIBLE
        } as Product;

        this.mockProducts.push(newProduct);
        console.log('Product created successfully:', newProduct);
        console.log('Total products:', this.mockProducts.length);

        return of(newProduct);
    }

    findAll(filters?: ProductFilters): Observable<Product[]> {
        let products = [...this.mockProducts];

        if (filters) {
            if (filters.typeArticle) {
                products = products.filter(p => p.typeArticle === filters.typeArticle);
            }
            if (filters.marque) {
                products = products.filter(p =>
                    p.marque?.toLowerCase().includes(filters.marque!.toLowerCase())
                );
            }
            if (filters.famille) {
                products = products.filter(p => p.famille === filters.famille);
            }
            if (filters.statut) {
                products = products.filter(p => p.statut === filters.statut);
            }
            if (filters.stockMin !== undefined) {
                products = products.filter(p => p.quantiteActuelle >= filters.stockMin!);
            }
            if (filters.stockMax !== undefined) {
                products = products.filter(p => p.quantiteActuelle <= filters.stockMax!);
            }
            if (filters.prixMin !== undefined) {
                products = products.filter(p => p.prixVenteHT >= filters.prixMin!);
            }
            if (filters.prixMax !== undefined) {
                products = products.filter(p => p.prixVenteHT <= filters.prixMax!);
            }
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                products = products.filter(p =>
                    p.designation.toLowerCase().includes(searchLower) ||
                    p.codeInterne.toLowerCase().includes(searchLower) ||
                    p.codeBarres.toLowerCase().includes(searchLower) ||
                    p.marque?.toLowerCase().includes(searchLower) ||
                    p.modele?.toLowerCase().includes(searchLower)
                );
            }
        }

        return of(products);
    }

    findOne(id: string): Observable<Product | undefined> {
        const product = this.mockProducts.find(p => p.id === id);
        return of(product);
    }

    update(id: string, productData: Partial<Product>): Observable<Product> {
        console.log('Updating product:', id, productData);
        const index = this.mockProducts.findIndex(p => p.id === id);

        if (index !== -1) {
            // Recalculate prices if purchase price or coefficient changed
            let prixVenteHT = this.mockProducts[index].prixVenteHT;
            let prixVenteTTC = this.mockProducts[index].prixVenteTTC;

            if (productData.prixAchatHT !== undefined || productData.coefficient !== undefined) {
                const prixAchat = productData.prixAchatHT ?? this.mockProducts[index].prixAchatHT;
                const coeff = productData.coefficient ?? this.mockProducts[index].coefficient;
                prixVenteHT = this.calculateSellingPrice(prixAchat, coeff);
                prixVenteTTC = this.calculatePriceTTC(
                    prixVenteHT,
                    productData.tauxTVA ?? this.mockProducts[index].tauxTVA
                );
            }

            const updatedProduct = {
                ...this.mockProducts[index],
                ...productData,
                id: id,
                prixVenteHT,
                prixVenteTTC,
                dateModification: new Date()
            } as Product;

            this.mockProducts[index] = updatedProduct;
            console.log('Product updated successfully:', updatedProduct);
            return of(updatedProduct);
        }

        throw new Error(`Product with id ${id} not found`);
    }

    delete(id: string): Observable<boolean> {
        const index = this.mockProducts.findIndex(p => p.id === id);
        if (index !== -1) {
            this.mockProducts.splice(index, 1);
            console.log('Product deleted successfully');
            return of(true);
        }
        return of(false);
    }

    /**
     * Price Calculations
     */

    calculateSellingPrice(purchasePrice: number, coefficient: number): number {
        return Math.round(purchasePrice * coefficient * 100) / 100;
    }

    calculatePriceTTC(priceHT: number, tvaRate: number = 0.20): number {
        return Math.round(priceHT * (1 + tvaRate) * 100) / 100;
    }

    calculateWeightedAveragePrice(
        currentStock: number,
        currentPrice: number,
        newQuantity: number,
        newPrice: number
    ): number {
        if (currentStock + newQuantity === 0) {
            return 0;
        }
        const totalValue = (currentStock * currentPrice) + (newQuantity * newPrice);
        const totalQuantity = currentStock + newQuantity;
        return Math.round((totalValue / totalQuantity) * 100) / 100;
    }

    /**
     * Search Operations
     */

    searchByBarcode(barcode: string): Observable<Product | undefined> {
        const product = this.mockProducts.find(p => p.codeBarres === barcode);
        return of(product);
    }

    searchByReference(reference: string): Observable<Product[]> {
        const products = this.mockProducts.filter(p =>
            p.referenceFournisseur?.toLowerCase().includes(reference.toLowerCase())
        );
        return of(products);
    }

    searchByBrand(brand: string): Observable<Product[]> {
        const products = this.mockProducts.filter(p =>
            p.marque?.toLowerCase().includes(brand.toLowerCase())
        );
        return of(products);
    }

    /**
     * Statistics
     */

    getStockValue(): Observable<number> {
        const totalValue = this.mockProducts.reduce((sum, product) => {
            return sum + (product.quantiteActuelle * product.prixAchatHT);
        }, 0);
        return of(Math.round(totalValue * 100) / 100);
    }

    getLowStockProducts(): Observable<Product[]> {
        const lowStock = this.mockProducts.filter(p =>
            p.quantiteActuelle <= p.seuilAlerte && p.statut !== ProductStatus.OBSOLETE
        );
        return of(lowStock);
    }

    getTopSellingProducts(limit: number = 10): Observable<Product[]> {
        // TODO: Implement based on sales history
        // For now, return products sorted by stock movement
        return of(this.mockProducts.slice(0, limit));
    }

    getStockStats(): Observable<StockStats> {
        const stats: StockStats = {
            totalProduits: this.mockProducts.length,
            valeurStockTotal: 0,
            produitsStockBas: 0,
            produitsRupture: 0,
            byType: {
                montures: 0,
                verres: 0,
                lentilles: 0,
                accessoires: 0
            }
        };

        this.mockProducts.forEach(product => {
            // Total value
            stats.valeurStockTotal += product.quantiteActuelle * product.prixAchatHT;

            // Low stock
            if (product.quantiteActuelle <= product.seuilAlerte) {
                stats.produitsStockBas++;
            }

            // Out of stock
            if (product.quantiteActuelle === 0) {
                stats.produitsRupture++;
            }

            // By type
            switch (product.typeArticle) {
                case ProductType.MONTURE:
                    stats.byType.montures++;
                    break;
                case ProductType.VERRE:
                    stats.byType.verres++;
                    break;
                case ProductType.LENTILLE:
                    stats.byType.lentilles++;
                    break;
                case ProductType.ACCESSOIRE:
                    stats.byType.accessoires++;
                    break;
            }
        });

        stats.valeurStockTotal = Math.round(stats.valeurStockTotal * 100) / 100;

        return of(stats);
    }

    /**
     * Initialize mock data for testing
     */
    private initializeMockData(): void {
        // Sample frame
        const sampleFrame: Frame = {
            id: '1',
            codeInterne: 'MON001',
            codeBarres: '2001234567890',
            designation: 'Ray-Ban Aviator RB3025',
            marque: 'Ray-Ban',
            modele: 'RB3025',
            couleur: 'Or',
            typeArticle: ProductType.MONTURE,
            famille: 'Solaire',
            quantiteActuelle: 5,
            seuilAlerte: 2,
            prixAchatHT: 80,
            coefficient: 2.5,
            prixVenteHT: 200,
            prixVenteTTC: 240,
            tauxTVA: 0.20,
            dateCreation: new Date(),
            dateModification: new Date(),
            statut: ProductStatus.DISPONIBLE,
            utilisateurCreation: 'admin',
            categorie: 'solaire' as any,
            genre: 'mixte' as any,
            forme: 'aviateur' as any,
            matiere: 'metal' as any,
            couleurMonture: 'Or',
            calibre: 58,
            pont: 14,
            branche: 135,
            typeMonture: 'cerclee' as any
        };

        this.mockProducts.push(sampleFrame);
    }
}
