import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductType {
    MONTURE = 'monture',
    VERRE = 'verre',
    LENTILLE = 'lentille',
    ACCESSOIRE = 'accessoire'
}

export class CreateProductDto {
    // Common Fields
    @IsEnum(ProductType)
    @IsNotEmpty()
    typeArticle: ProductType;

    @IsString()
    @IsNotEmpty()
    codeInterne: string;

    @IsString()
    @IsOptional()
    codeBarres?: string;

    @IsString()
    @IsOptional()
    referenceFournisseur?: string;

    @IsString()
    @IsNotEmpty()
    designation: string;

    @IsString()
    @IsOptional()
    marque?: string;

    @IsString()
    @IsOptional()
    modele?: string;

    @IsString()
    @IsOptional()
    couleur?: string;

    @IsString()
    @IsOptional()
    famille?: string;

    @IsString()
    @IsOptional()
    sousFamille?: string;

    @IsString()
    @IsOptional()
    fournisseurPrincipal?: string;

    // Stock & Pricing
    @IsNumber()
    @Type(() => Number)
    @Min(0)
    quantiteActuelle: number;

    @IsNumber()
    @Type(() => Number)
    @Min(0)
    seuilAlerte: number;

    @IsNumber()
    @Type(() => Number)
    @Min(0)
    prixAchatHT: number;

    @IsNumber()
    @Type(() => Number)
    @Min(1)
    coefficient: number;

    @IsNumber()
    @Type(() => Number)
    @Min(0)
    prixVenteHT: number;

    @IsNumber()
    @Type(() => Number)
    @Min(0)
    prixVenteTTC: number;

    @IsNumber()
    @Type(() => Number)
    @Min(0)
    tauxTVA: number;

    @IsString()
    @IsOptional()
    statut?: string;

    @IsString()
    @IsOptional()
    utilisateurCreation?: string;

    @IsString()
    @IsOptional()
    photo?: string;

    @IsString()
    @IsNotEmpty()
    entrepotId: string;

    // Specific Data (JSON)
    // We will store all type-specific fields in a single JSON object 'specificData'
    // or mapped individually if we decide to flatten them. 
    // Based on Prisma schema: specificData Json?
    // But standard DTO usually validates these.
    // For simplicity helping reuse, we can capture extra fields as specificData or flattened.
    // Prisma schema has specificData Json?

    // Let's allow passing them as a dictionary/object to be stored in specificData
    @IsOptional()
    specificData?: any;

    // We can also explicitly map them if we want strict validation, 
    // but since we are reusing a dynamic form, mapping to specificData is flexible.
    // However, the frontend sends them flat.
    // We will handle the mapping in the Service or Controller to pack them into `specificData`.

    // Frame Specific
    @IsOptional() categorie?: string;
    @IsOptional() genre?: string;
    @IsOptional() forme?: string;
    @IsOptional() matiere?: string;
    @IsOptional() couleurMonture?: string;
    @IsOptional() couleurBranches?: string;
    @IsOptional() calibre?: number;
    @IsOptional() pont?: number;
    @IsOptional() branche?: number;
    @IsOptional() typeCharniere?: string;
    @IsOptional() typeMonture?: string;

    // Lens Specific
    @IsOptional() typeVerre?: string;
    @IsOptional() materiau?: string; // Conflicts with Frame 'matiere'? Frontend uses 'matiere' for frame and 'materiau' for lens? Checked form: 'matiere' for frame, 'materiau' for lens. Good.
    @IsOptional() indiceRefraction?: number;
    @IsOptional() teinte?: string;
    @IsOptional() puissanceSph?: number;
    @IsOptional() puissanceCyl?: number;
    @IsOptional() axe?: number;
    @IsOptional() addition?: number;
    @IsOptional() diametre?: number;

    // Contact Lens Specific
    @IsOptional() typeLentille?: string;
    @IsOptional() usage?: string;
    @IsOptional() rayonCourbure?: number;

    // Accessory Specific
    @IsOptional() categorieAccessoire?: string;
    // Frame Specific Additional Fields
    @IsOptional() @IsString() photoFace?: string;
    @IsOptional() @IsString() photoProfil?: string;

    // Lens Specific Additional Fields
    // (typeVerre, materiau, indiceRefraction, teinte, puissanceSph, puissanceCyl, axe, addition, diametre already exist)
    @IsOptional() @IsArray() filtres?: string[];
    @IsOptional() @IsArray() traitements?: string[];
    @IsOptional() @IsNumber() base?: number;
    @IsOptional() @IsNumber() courbure?: number;
    @IsOptional() @IsString() fabricant?: string;
    @IsOptional() @IsString() familleOptique?: string;

    // Contact Lens Specific Additional Fields
    // (typeLentille, usage, rayonCourbure already exist)
    @IsOptional() @IsString() modeleCommercial?: string;
    @IsOptional() @IsString() laboratoire?: string;
    @IsOptional() @IsNumber() nombreParBoite?: number;
    @IsOptional() @IsNumber() prixParBoite?: number;
    @IsOptional() @IsNumber() prixParUnite?: number;
    @IsOptional() @IsString() numeroLot?: string;
    @IsOptional() @IsString() datePeremption?: string; // or Date if transformed
    @IsOptional() @IsNumber() quantiteBoites?: number;
    @IsOptional() @IsNumber() quantiteUnites?: number;

    // Accessory Specific Additional Fields
    @IsOptional() @IsString() sousCategorie?: string;
}
