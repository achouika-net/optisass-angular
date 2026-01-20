/**
 * Base de données optique - Seed Data
 *
 * Ce fichier contient les données réelles des marques, modèles, fabricants et laboratoires
 * de l'industrie optique. Ces données sont destinées à alimenter la BDD via le backend
 * et sont utilisées temporairement dans les mocks frontend.
 *
 * Sources:
 * - EssilorLuxottica: https://www.essilorluxottica.com/en/2024-highlights/brands/
 * - Safilo Group: https://www.safilogroup.com/en/product/brands
 * - Marcolin: https://www.marcolin.com/
 * - Hoya Vision: https://www.hoyavision.com/
 * - Carl Zeiss: https://www.zeiss.com/vision-care/
 *
 * @version 1.0.0
 * @date 2026-01-20
 */

import { ProductType } from '../models';

// ============================================================================
// TYPES
// ============================================================================

export interface ISeedBrand {
  readonly code: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly manufacturerCodes: readonly string[];
  readonly parentCompany: string | null;
  readonly country: string | null;
  readonly website: string | null;
  readonly productLines: readonly ProductType[];
  readonly order: number;
}

export interface ISeedModel {
  readonly code: string;
  readonly label: string;
  readonly brandCode: string;
  readonly aliases: readonly string[];
  readonly manufacturerCode: string | null;
  readonly category: 'optical' | 'sun' | 'sport' | 'safety' | null;
  readonly order: number;
}

export interface ISeedManufacturer {
  readonly code: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly country: string | null;
  readonly website: string | null;
  readonly productLines: readonly string[];
  readonly order: number;
}

export interface ISeedLaboratory {
  readonly code: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly country: string | null;
  readonly website: string | null;
  readonly brands: readonly string[];
  readonly order: number;
}

// ============================================================================
// GROUPES / HOLDINGS
// ============================================================================

export const OPTICAL_GROUPS = {
  ESSILORLUXOTTICA: 'EssilorLuxottica',
  SAFILO: 'Safilo Group',
  MARCOLIN: 'Marcolin Group',
  DERIGO: 'De Rigo Vision',
  KERING: 'Kering Eyewear',
  LVMH: 'LVMH',
  MARCHON: 'Marchon Eyewear',
  SILHOUETTE: 'Silhouette International',
} as const;

// ============================================================================
// MARQUES MONTURES (FRAMES)
// ============================================================================

export const SEED_BRANDS: readonly ISeedBrand[] = [
  // -------------------------------------------------------------------------
  // EssilorLuxottica - Marques propres
  // -------------------------------------------------------------------------
  {
    code: 'RAY',
    label: 'Ray-Ban',
    aliases: ['RAYBAN', 'RB', 'R-B', 'RAY BAN', 'RAY-BAN'],
    manufacturerCodes: ['RB', 'RX', 'RJ'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'Italie',
    website: 'https://www.ray-ban.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 1,
  },
  {
    code: 'OAK',
    label: 'Oakley',
    aliases: ['OAKLEY', 'OO', 'O'],
    manufacturerCodes: ['OO', 'OX', 'OY'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'États-Unis',
    website: 'https://www.oakley.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 2,
  },
  {
    code: 'PER',
    label: 'Persol',
    aliases: ['PERSOL', 'PO'],
    manufacturerCodes: ['PO'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'Italie',
    website: 'https://www.persol.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 3,
  },
  {
    code: 'VOG',
    label: 'Vogue Eyewear',
    aliases: ['VOGUE', 'VO', 'VOGUE EYEWEAR'],
    manufacturerCodes: ['VO'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'Italie',
    website: 'https://www.vogue-eyewear.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 4,
  },
  {
    code: 'ARN',
    label: 'Arnette',
    aliases: ['ARNETTE', 'AN'],
    manufacturerCodes: ['AN'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'États-Unis',
    website: 'https://www.arnette.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 5,
  },
  {
    code: 'OLI',
    label: 'Oliver Peoples',
    aliases: ['OLIVER PEOPLES', 'OV', 'OP'],
    manufacturerCodes: ['OV'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'États-Unis',
    website: 'https://www.oliverpeoples.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 6,
  },

  // -------------------------------------------------------------------------
  // EssilorLuxottica - Licences
  // -------------------------------------------------------------------------
  {
    code: 'PRA',
    label: 'Prada',
    aliases: ['PRADA', 'PR', 'PRADA LINEA ROSSA', 'PS'],
    manufacturerCodes: ['PR', 'PS'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'Italie',
    website: 'https://www.prada.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 10,
  },
  {
    code: 'CHA',
    label: 'Chanel',
    aliases: ['CHANEL', 'CH'],
    manufacturerCodes: ['CH'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'France',
    website: 'https://www.chanel.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 11,
  },
  {
    code: 'DG',
    label: 'Dolce & Gabbana',
    aliases: ['DOLCE GABBANA', 'D&G', 'DG', 'DOLCE & GABBANA', 'DOLCE AND GABBANA'],
    manufacturerCodes: ['DG'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'Italie',
    website: 'https://www.dolcegabbana.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 12,
  },
  {
    code: 'VER',
    label: 'Versace',
    aliases: ['VERSACE', 'VE'],
    manufacturerCodes: ['VE'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'Italie',
    website: 'https://www.versace.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 13,
  },
  {
    code: 'MIU',
    label: 'Miu Miu',
    aliases: ['MIU MIU', 'MU', 'MIUMIU'],
    manufacturerCodes: ['MU'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'Italie',
    website: 'https://www.miumiu.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 14,
  },
  {
    code: 'GIO',
    label: 'Giorgio Armani',
    aliases: ['GIORGIO ARMANI', 'AR', 'GA', 'ARMANI'],
    manufacturerCodes: ['AR'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'Italie',
    website: 'https://www.armani.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 15,
  },
  {
    code: 'EMO',
    label: 'Emporio Armani',
    aliases: ['EMPORIO ARMANI', 'EA', 'EMPORIO'],
    manufacturerCodes: ['EA'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'Italie',
    website: 'https://www.armani.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 16,
  },
  {
    code: 'BUR',
    label: 'Burberry',
    aliases: ['BURBERRY', 'BE', 'B'],
    manufacturerCodes: ['BE'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'Royaume-Uni',
    website: 'https://www.burberry.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 17,
  },
  {
    code: 'COA',
    label: 'Coach',
    aliases: ['COACH', 'HC'],
    manufacturerCodes: ['HC'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'États-Unis',
    website: 'https://www.coach.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 18,
  },
  {
    code: 'MIC',
    label: 'Michael Kors',
    aliases: ['MICHAEL KORS', 'MK', 'KORS'],
    manufacturerCodes: ['MK'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'États-Unis',
    website: 'https://www.michaelkors.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 19,
  },
  {
    code: 'TIF',
    label: 'Tiffany & Co',
    aliases: ['TIFFANY', 'TF', 'TIFFANY & CO', 'TIFFANY AND CO'],
    manufacturerCodes: ['TF'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'États-Unis',
    website: 'https://www.tiffany.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 20,
  },
  {
    code: 'RLU',
    label: 'Ralph Lauren',
    aliases: ['RALPH LAUREN', 'RL', 'POLO RALPH LAUREN', 'PH'],
    manufacturerCodes: ['RL', 'PH'],
    parentCompany: OPTICAL_GROUPS.ESSILORLUXOTTICA,
    country: 'États-Unis',
    website: 'https://www.ralphlauren.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 21,
  },

  // -------------------------------------------------------------------------
  // Safilo Group - Marques propres
  // -------------------------------------------------------------------------
  {
    code: 'CAR',
    label: 'Carrera',
    aliases: ['CARRERA', 'CA'],
    manufacturerCodes: ['CA'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'Italie',
    website: 'https://www.carreraworld.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 30,
  },
  {
    code: 'POL',
    label: 'Polaroid',
    aliases: ['POLAROID', 'PLD'],
    manufacturerCodes: ['PLD'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'États-Unis',
    website: 'https://www.polaroid.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 31,
  },
  {
    code: 'SMI',
    label: 'Smith',
    aliases: ['SMITH', 'SMITH OPTICS'],
    manufacturerCodes: ['SM'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'États-Unis',
    website: 'https://www.smithoptics.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 32,
  },

  // -------------------------------------------------------------------------
  // Safilo Group - Licences
  // -------------------------------------------------------------------------
  {
    code: 'DIO',
    label: 'Dior',
    aliases: ['DIOR', 'CD', 'CHRISTIAN DIOR'],
    manufacturerCodes: ['CD'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'France',
    website: 'https://www.dior.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 35,
  },
  {
    code: 'FEN',
    label: 'Fendi',
    aliases: ['FENDI', 'FF'],
    manufacturerCodes: ['FF'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'Italie',
    website: 'https://www.fendi.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 36,
  },
  {
    code: 'GIV',
    label: 'Givenchy',
    aliases: ['GIVENCHY', 'GV'],
    manufacturerCodes: ['GV'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'France',
    website: 'https://www.givenchy.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 37,
  },
  {
    code: 'HUG',
    label: 'Hugo Boss',
    aliases: ['HUGO BOSS', 'BOSS', 'HB', 'HUGO'],
    manufacturerCodes: ['BOSS', 'HG'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'Allemagne',
    website: 'https://www.hugoboss.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 38,
  },
  {
    code: 'MJA',
    label: 'Marc Jacobs',
    aliases: ['MARC JACOBS', 'MJ', 'MARC'],
    manufacturerCodes: ['MJ'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'États-Unis',
    website: 'https://www.marcjacobs.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 39,
  },
  {
    code: 'TOM',
    label: 'Tommy Hilfiger',
    aliases: ['TOMMY HILFIGER', 'TH', 'TOMMY'],
    manufacturerCodes: ['TH'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'États-Unis',
    website: 'https://www.tommy.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 40,
  },
  {
    code: 'KSP',
    label: 'Kate Spade',
    aliases: ['KATE SPADE', 'KS', 'KATE SPADE NEW YORK'],
    manufacturerCodes: ['KS'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'États-Unis',
    website: 'https://www.katespade.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 41,
  },
  {
    code: 'LEV',
    label: "Levi's",
    aliases: ['LEVIS', 'LV', "LEVI'S"],
    manufacturerCodes: ['LV'],
    parentCompany: OPTICAL_GROUPS.SAFILO,
    country: 'États-Unis',
    website: 'https://www.levi.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 42,
  },

  // -------------------------------------------------------------------------
  // Marcolin Group
  // -------------------------------------------------------------------------
  {
    code: 'TFO',
    label: 'Tom Ford',
    aliases: ['TOM FORD', 'TF', 'TOMFORD'],
    manufacturerCodes: ['FT'],
    parentCompany: OPTICAL_GROUPS.MARCOLIN,
    country: 'États-Unis',
    website: 'https://www.tomford.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 50,
  },
  {
    code: 'GUE',
    label: 'Guess',
    aliases: ['GUESS', 'GU'],
    manufacturerCodes: ['GU'],
    parentCompany: OPTICAL_GROUPS.MARCOLIN,
    country: 'États-Unis',
    website: 'https://www.guess.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 51,
  },
  {
    code: 'MON',
    label: 'Moncler',
    aliases: ['MONCLER', 'ML'],
    manufacturerCodes: ['ML'],
    parentCompany: OPTICAL_GROUPS.MARCOLIN,
    country: 'France',
    website: 'https://www.moncler.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 52,
  },
  {
    code: 'ICB',
    label: 'ic! berlin',
    aliases: ['IC BERLIN', 'IC! BERLIN', 'ICB'],
    manufacturerCodes: ['IC'],
    parentCompany: OPTICAL_GROUPS.MARCOLIN,
    country: 'Allemagne',
    website: 'https://www.ic-berlin.de',
    productLines: ['optical_frame', 'sun_frame'],
    order: 53,
  },
  {
    code: 'ADI',
    label: 'Adidas',
    aliases: ['ADIDAS', 'AD', 'ADIDAS SPORT'],
    manufacturerCodes: ['AD'],
    parentCompany: OPTICAL_GROUPS.MARCOLIN,
    country: 'Allemagne',
    website: 'https://www.adidas.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 54,
  },

  // -------------------------------------------------------------------------
  // Kering Eyewear
  // -------------------------------------------------------------------------
  {
    code: 'GUC',
    label: 'Gucci',
    aliases: ['GUCCI', 'GG'],
    manufacturerCodes: ['GG'],
    parentCompany: OPTICAL_GROUPS.KERING,
    country: 'Italie',
    website: 'https://www.gucci.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 60,
  },
  {
    code: 'SLA',
    label: 'Saint Laurent',
    aliases: ['SAINT LAURENT', 'SL', 'YSL', 'YVES SAINT LAURENT'],
    manufacturerCodes: ['SL'],
    parentCompany: OPTICAL_GROUPS.KERING,
    country: 'France',
    website: 'https://www.ysl.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 61,
  },
  {
    code: 'BOT',
    label: 'Bottega Veneta',
    aliases: ['BOTTEGA VENETA', 'BV', 'BOTTEGA'],
    manufacturerCodes: ['BV'],
    parentCompany: OPTICAL_GROUPS.KERING,
    country: 'Italie',
    website: 'https://www.bottegaveneta.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 62,
  },
  {
    code: 'BAL',
    label: 'Balenciaga',
    aliases: ['BALENCIAGA', 'BB'],
    manufacturerCodes: ['BB'],
    parentCompany: OPTICAL_GROUPS.KERING,
    country: 'France',
    website: 'https://www.balenciaga.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 63,
  },
  {
    code: 'MCQ',
    label: 'Alexander McQueen',
    aliases: ['ALEXANDER MCQUEEN', 'AM', 'MCQUEEN'],
    manufacturerCodes: ['AM'],
    parentCompany: OPTICAL_GROUPS.KERING,
    country: 'Royaume-Uni',
    website: 'https://www.alexandermcqueen.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 64,
  },
  {
    code: 'PUM',
    label: 'Puma',
    aliases: ['PUMA', 'PU'],
    manufacturerCodes: ['PU'],
    parentCompany: OPTICAL_GROUPS.KERING,
    country: 'Allemagne',
    website: 'https://www.puma.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 65,
  },

  // -------------------------------------------------------------------------
  // De Rigo Vision
  // -------------------------------------------------------------------------
  {
    code: 'PLI',
    label: 'Police',
    aliases: ['POLICE', 'PL'],
    manufacturerCodes: ['PL'],
    parentCompany: OPTICAL_GROUPS.DERIGO,
    country: 'Italie',
    website: 'https://www.police.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 70,
  },
  {
    code: 'CHO',
    label: 'Chopard',
    aliases: ['CHOPARD', 'SCH', 'VCH'],
    manufacturerCodes: ['SCH', 'VCH'],
    parentCompany: OPTICAL_GROUPS.DERIGO,
    country: 'Suisse',
    website: 'https://www.chopard.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 71,
  },
  {
    code: 'FIL',
    label: 'Fila',
    aliases: ['FILA', 'SF', 'VF'],
    manufacturerCodes: ['SF', 'VF'],
    parentCompany: OPTICAL_GROUPS.DERIGO,
    country: 'Italie',
    website: 'https://www.fila.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 72,
  },

  // -------------------------------------------------------------------------
  // Silhouette International
  // -------------------------------------------------------------------------
  {
    code: 'SIL',
    label: 'Silhouette',
    aliases: ['SILHOUETTE'],
    manufacturerCodes: ['SI'],
    parentCompany: OPTICAL_GROUPS.SILHOUETTE,
    country: 'Autriche',
    website: 'https://www.silhouette.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 80,
  },

  // -------------------------------------------------------------------------
  // Indépendants / Autres
  // -------------------------------------------------------------------------
  {
    code: 'LAC',
    label: 'Lacoste',
    aliases: ['LACOSTE', 'L'],
    manufacturerCodes: ['L'],
    parentCompany: OPTICAL_GROUPS.MARCHON,
    country: 'France',
    website: 'https://www.lacoste.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 90,
  },
  {
    code: 'CAL',
    label: 'Calvin Klein',
    aliases: ['CALVIN KLEIN', 'CK', 'CKJ'],
    manufacturerCodes: ['CK', 'CKJ'],
    parentCompany: OPTICAL_GROUPS.MARCHON,
    country: 'États-Unis',
    website: 'https://www.calvinklein.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 91,
  },
  {
    code: 'NIK',
    label: 'Nike Vision',
    aliases: ['NIKE', 'NIKE VISION', 'NK'],
    manufacturerCodes: ['NK'],
    parentCompany: OPTICAL_GROUPS.MARCHON,
    country: 'États-Unis',
    website: 'https://www.nike.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 92,
  },
  {
    code: 'DRA',
    label: 'Dragon Alliance',
    aliases: ['DRAGON', 'DR', 'DRAGON ALLIANCE'],
    manufacturerCodes: ['DR'],
    parentCompany: OPTICAL_GROUPS.MARCHON,
    country: 'États-Unis',
    website: 'https://www.dragonalliance.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 93,
  },
  {
    code: 'CAT',
    label: 'Caterpillar',
    aliases: ['CATERPILLAR', 'CAT'],
    manufacturerCodes: ['CAT'],
    parentCompany: null,
    country: 'États-Unis',
    website: 'https://www.cat.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 94,
  },
  {
    code: 'SWA',
    label: 'Swarovski',
    aliases: ['SWAROVSKI', 'SW', 'SK'],
    manufacturerCodes: ['SK'],
    parentCompany: null,
    country: 'Autriche',
    website: 'https://www.swarovski.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 95,
  },

  // -------------------------------------------------------------------------
  // Marques optiques économiques (très présentes au Maroc)
  // -------------------------------------------------------------------------
  {
    code: 'CHE',
    label: 'Carolina Herrera',
    aliases: ['CAROLINA HERRERA', 'CH', 'CH-HER', 'HERRERA'],
    manufacturerCodes: ['HER'],
    parentCompany: null,
    country: 'Venezuela',
    website: 'https://www.carolinaherrera.com',
    productLines: ['optical_frame', 'sun_frame'],
    order: 100,
  },
  {
    code: 'CET',
    label: 'Cerruti',
    aliases: ['CERRUTI', 'CERRUTI 1881', 'CE'],
    manufacturerCodes: ['CE'],
    parentCompany: null,
    country: 'Italie',
    website: null,
    productLines: ['optical_frame', 'sun_frame'],
    order: 101,
  },
  {
    code: 'NAO',
    label: 'Nano Vista',
    aliases: ['NANO', 'NANO VISTA', 'NAO'],
    manufacturerCodes: ['NAO'],
    parentCompany: null,
    country: 'Espagne',
    website: 'https://www.nframesgroup.com',
    productLines: ['optical_frame'],
    order: 102,
  },
];

// ============================================================================
// MODÈLES PAR MARQUE
// ============================================================================

export const SEED_MODELS: readonly ISeedModel[] = [
  // -------------------------------------------------------------------------
  // Ray-Ban
  // -------------------------------------------------------------------------
  {
    code: 'WAY',
    label: 'Wayfarer',
    brandCode: 'RAY',
    aliases: ['WAYFARER', 'RB2140', '2140'],
    manufacturerCode: 'RB2140',
    category: 'sun',
    order: 1,
  },
  {
    code: 'WAN',
    label: 'New Wayfarer',
    brandCode: 'RAY',
    aliases: ['NEW WAYFARER', 'RB2132', '2132'],
    manufacturerCode: 'RB2132',
    category: 'sun',
    order: 2,
  },
  {
    code: 'AVI',
    label: 'Aviator',
    brandCode: 'RAY',
    aliases: ['AVIATOR', 'RB3025', '3025'],
    manufacturerCode: 'RB3025',
    category: 'sun',
    order: 3,
  },
  {
    code: 'AVL',
    label: 'Aviator Large',
    brandCode: 'RAY',
    aliases: ['AVIATOR LARGE', 'RB3026', '3026'],
    manufacturerCode: 'RB3026',
    category: 'sun',
    order: 4,
  },
  {
    code: 'CLU',
    label: 'Clubmaster',
    brandCode: 'RAY',
    aliases: ['CLUBMASTER', 'RB3016', '3016'],
    manufacturerCode: 'RB3016',
    category: 'sun',
    order: 5,
  },
  {
    code: 'CLO',
    label: 'Clubmaster Oval',
    brandCode: 'RAY',
    aliases: ['CLUBMASTER OVAL', 'RB3946', '3946'],
    manufacturerCode: 'RB3946',
    category: 'sun',
    order: 6,
  },
  {
    code: 'ERI',
    label: 'Erika',
    brandCode: 'RAY',
    aliases: ['ERIKA', 'RB4171', '4171'],
    manufacturerCode: 'RB4171',
    category: 'sun',
    order: 7,
  },
  {
    code: 'JUS',
    label: 'Justin',
    brandCode: 'RAY',
    aliases: ['JUSTIN', 'RB4165', '4165'],
    manufacturerCode: 'RB4165',
    category: 'sun',
    order: 8,
  },
  {
    code: 'RND',
    label: 'Round Metal',
    brandCode: 'RAY',
    aliases: ['ROUND METAL', 'RB3447', '3447'],
    manufacturerCode: 'RB3447',
    category: 'sun',
    order: 9,
  },
  {
    code: 'HEX',
    label: 'Hexagonal',
    brandCode: 'RAY',
    aliases: ['HEXAGONAL', 'RB3548N', '3548'],
    manufacturerCode: 'RB3548N',
    category: 'sun',
    order: 10,
  },
  {
    code: 'SHO',
    label: 'Shooter',
    brandCode: 'RAY',
    aliases: ['SHOOTER', 'RB3138', '3138'],
    manufacturerCode: 'RB3138',
    category: 'sun',
    order: 11,
  },
  {
    code: 'CAT',
    label: 'Cats 5000',
    brandCode: 'RAY',
    aliases: ['CATS 5000', 'RB4125', '4125', 'CATS'],
    manufacturerCode: 'RB4125',
    category: 'sun',
    order: 12,
  },
  {
    code: 'FWA',
    label: 'Folding Wayfarer',
    brandCode: 'RAY',
    aliases: ['FOLDING WAYFARER', 'RB4105', '4105'],
    manufacturerCode: 'RB4105',
    category: 'sun',
    order: 13,
  },
  {
    code: 'MWA',
    label: 'Mega Wayfarer',
    brandCode: 'RAY',
    aliases: ['MEGA WAYFARER', 'RB0840S'],
    manufacturerCode: 'RB0840S',
    category: 'sun',
    order: 14,
  },
  {
    code: 'STA',
    label: 'State Street',
    brandCode: 'RAY',
    aliases: ['STATE STREET', 'RB2186', '2186'],
    manufacturerCode: 'RB2186',
    category: 'sun',
    order: 15,
  },
  // Ray-Ban Optical
  {
    code: 'RX5',
    label: 'RX5154',
    brandCode: 'RAY',
    aliases: ['RX5154', '5154'],
    manufacturerCode: 'RX5154',
    category: 'optical',
    order: 50,
  },
  {
    code: 'RX7',
    label: 'RX7047',
    brandCode: 'RAY',
    aliases: ['RX7047', '7047'],
    manufacturerCode: 'RX7047',
    category: 'optical',
    order: 51,
  },
  {
    code: 'RX8',
    label: 'RX8416',
    brandCode: 'RAY',
    aliases: ['RX8416', '8416'],
    manufacturerCode: 'RX8416',
    category: 'optical',
    order: 52,
  },

  // -------------------------------------------------------------------------
  // Oakley
  // -------------------------------------------------------------------------
  {
    code: 'HOL',
    label: 'Holbrook',
    brandCode: 'OAK',
    aliases: ['HOLBROOK', 'OO9102', '9102'],
    manufacturerCode: 'OO9102',
    category: 'sun',
    order: 1,
  },
  {
    code: 'HXL',
    label: 'Holbrook XL',
    brandCode: 'OAK',
    aliases: ['HOLBROOK XL', 'OO9417', '9417'],
    manufacturerCode: 'OO9417',
    category: 'sun',
    order: 2,
  },
  {
    code: 'FRO',
    label: 'Frogskins',
    brandCode: 'OAK',
    aliases: ['FROGSKINS', 'OO9013', '9013'],
    manufacturerCode: 'OO9013',
    category: 'sun',
    order: 3,
  },
  {
    code: 'FRL',
    label: 'Frogskins Lite',
    brandCode: 'OAK',
    aliases: ['FROGSKINS LITE', 'OO9374', '9374'],
    manufacturerCode: 'OO9374',
    category: 'sun',
    order: 4,
  },
  {
    code: 'SUT',
    label: 'Sutro',
    brandCode: 'OAK',
    aliases: ['SUTRO', 'OO9406', '9406'],
    manufacturerCode: 'OO9406',
    category: 'sun',
    order: 5,
  },
  {
    code: 'SUL',
    label: 'Sutro Lite',
    brandCode: 'OAK',
    aliases: ['SUTRO LITE', 'OO9463', '9463'],
    manufacturerCode: 'OO9463',
    category: 'sun',
    order: 6,
  },
  {
    code: 'RAD',
    label: 'Radar EV',
    brandCode: 'OAK',
    aliases: ['RADAR EV', 'OO9208', '9208', 'RADAR'],
    manufacturerCode: 'OO9208',
    category: 'sport',
    order: 7,
  },
  {
    code: 'JAW',
    label: 'Jawbreaker',
    brandCode: 'OAK',
    aliases: ['JAWBREAKER', 'OO9290', '9290'],
    manufacturerCode: 'OO9290',
    category: 'sport',
    order: 8,
  },
  {
    code: 'FLA',
    label: 'Flak 2.0',
    brandCode: 'OAK',
    aliases: ['FLAK 2.0', 'OO9188', '9188', 'FLAK'],
    manufacturerCode: 'OO9188',
    category: 'sport',
    order: 9,
  },
  {
    code: 'GAS',
    label: 'Gascan',
    brandCode: 'OAK',
    aliases: ['GASCAN', 'OO9014', '9014'],
    manufacturerCode: 'OO9014',
    category: 'sun',
    order: 10,
  },
  {
    code: 'FUC',
    label: 'Fuel Cell',
    brandCode: 'OAK',
    aliases: ['FUEL CELL', 'OO9096', '9096'],
    manufacturerCode: 'OO9096',
    category: 'sun',
    order: 11,
  },
  // Oakley Optical
  {
    code: 'OX8',
    label: 'OX8046',
    brandCode: 'OAK',
    aliases: ['OX8046', '8046', 'AIRDROP'],
    manufacturerCode: 'OX8046',
    category: 'optical',
    order: 50,
  },
  {
    code: 'OX5',
    label: 'OX5038',
    brandCode: 'OAK',
    aliases: ['OX5038', '5038', 'METAL PLATE'],
    manufacturerCode: 'OX5038',
    category: 'optical',
    order: 51,
  },

  // -------------------------------------------------------------------------
  // Gucci
  // -------------------------------------------------------------------------
  {
    code: 'G01',
    label: 'GG0036S',
    brandCode: 'GUC',
    aliases: ['GG0036S', '0036'],
    manufacturerCode: 'GG0036S',
    category: 'sun',
    order: 1,
  },
  {
    code: 'G02',
    label: 'GG0061S',
    brandCode: 'GUC',
    aliases: ['GG0061S', '0061'],
    manufacturerCode: 'GG0061S',
    category: 'sun',
    order: 2,
  },
  {
    code: 'G03',
    label: 'GG0062S',
    brandCode: 'GUC',
    aliases: ['GG0062S', '0062'],
    manufacturerCode: 'GG0062S',
    category: 'sun',
    order: 3,
  },
  {
    code: 'G04',
    label: 'GG1136S',
    brandCode: 'GUC',
    aliases: ['GG1136S', '1136'],
    manufacturerCode: 'GG1136S',
    category: 'sun',
    order: 4,
  },

  // -------------------------------------------------------------------------
  // Prada
  // -------------------------------------------------------------------------
  {
    code: 'P01',
    label: 'PR 01OS',
    brandCode: 'PRA',
    aliases: ['PR01OS', '01OS', 'PR 01OS'],
    manufacturerCode: 'PR01OS',
    category: 'sun',
    order: 1,
  },
  {
    code: 'P02',
    label: 'PR 16MV',
    brandCode: 'PRA',
    aliases: ['PR16MV', '16MV', 'PR 16MV'],
    manufacturerCode: 'PR16MV',
    category: 'optical',
    order: 2,
  },
  {
    code: 'P03',
    label: 'PR 17WS',
    brandCode: 'PRA',
    aliases: ['PR17WS', '17WS', 'PR 17WS'],
    manufacturerCode: 'PR17WS',
    category: 'sun',
    order: 3,
  },

  // -------------------------------------------------------------------------
  // Carrera
  // -------------------------------------------------------------------------
  {
    code: 'C01',
    label: 'Carrera 1001',
    brandCode: 'CAR',
    aliases: ['CARRERA 1001', '1001'],
    manufacturerCode: 'CARRERA1001',
    category: 'sun',
    order: 1,
  },
  {
    code: 'C02',
    label: 'Carrera 1003',
    brandCode: 'CAR',
    aliases: ['CARRERA 1003', '1003'],
    manufacturerCode: 'CARRERA1003',
    category: 'sun',
    order: 2,
  },
  {
    code: 'CHA',
    label: 'Champion',
    brandCode: 'CAR',
    aliases: ['CHAMPION', 'CARRERA CHAMPION'],
    manufacturerCode: 'CHAMPION',
    category: 'sun',
    order: 3,
  },
  {
    code: 'SPE',
    label: 'Speedway',
    brandCode: 'CAR',
    aliases: ['SPEEDWAY', 'CARRERA SPEEDWAY'],
    manufacturerCode: 'SPEEDWAY',
    category: 'sport',
    order: 4,
  },

  // -------------------------------------------------------------------------
  // Persol
  // -------------------------------------------------------------------------
  {
    code: 'PE1',
    label: 'PO0649',
    brandCode: 'PER',
    aliases: ['PO0649', '0649', '649'],
    manufacturerCode: 'PO0649',
    category: 'sun',
    order: 1,
  },
  {
    code: 'PE2',
    label: 'PO0714',
    brandCode: 'PER',
    aliases: ['PO0714', '0714', '714', 'STEVE MCQUEEN'],
    manufacturerCode: 'PO0714',
    category: 'sun',
    order: 2,
  },
  {
    code: 'PE3',
    label: 'PO3019S',
    brandCode: 'PER',
    aliases: ['PO3019S', '3019'],
    manufacturerCode: 'PO3019S',
    category: 'sun',
    order: 3,
  },

  // -------------------------------------------------------------------------
  // Tom Ford
  // -------------------------------------------------------------------------
  {
    code: 'TF1',
    label: 'FT0237',
    brandCode: 'TFO',
    aliases: ['FT0237', '0237', 'SNOWDON'],
    manufacturerCode: 'FT0237',
    category: 'sun',
    order: 1,
  },
  {
    code: 'TF2',
    label: 'FT0058',
    brandCode: 'TFO',
    aliases: ['FT0058', '0058', 'CARY'],
    manufacturerCode: 'FT0058',
    category: 'sun',
    order: 2,
  },
  {
    code: 'TF3',
    label: 'FT5178',
    brandCode: 'TFO',
    aliases: ['FT5178', '5178'],
    manufacturerCode: 'FT5178',
    category: 'optical',
    order: 3,
  },
];

// ============================================================================
// FABRICANTS DE VERRES (LENS MANUFACTURERS)
// ============================================================================

export const SEED_MANUFACTURERS: readonly ISeedManufacturer[] = [
  {
    code: 'ESS',
    label: 'Essilor',
    aliases: ['ESSILOR', 'ESSILOR LUXOTTICA', 'VARILUX', 'CRIZAL'],
    country: 'France',
    website: 'https://www.essilor.com',
    productLines: ['Varilux', 'Crizal', 'Transitions', 'Eyezen', 'Xperio'],
    order: 1,
  },
  {
    code: 'ZEI',
    label: 'Carl Zeiss',
    aliases: ['ZEISS', 'CARL ZEISS', 'ZEISS VISION'],
    country: 'Allemagne',
    website: 'https://www.zeiss.com/vision-care',
    productLines: ['SmartLife', 'Progressive Individual', 'DriveSafe', 'Digital', 'EnergizeMe'],
    order: 2,
  },
  {
    code: 'HOY',
    label: 'Hoya',
    aliases: ['HOYA', 'HOYA VISION', 'HOYA LENS'],
    country: 'Japon',
    website: 'https://www.hoyavision.com',
    productLines: ['Hoyalux', 'Nulux', 'Sensity', 'BlueControl', 'Hi-Vision'],
    order: 3,
  },
  {
    code: 'ROD',
    label: 'Rodenstock',
    aliases: ['RODENSTOCK'],
    country: 'Allemagne',
    website: 'https://www.rodenstock.com',
    productLines: ['Impression', 'Multigressiv', 'Cosmolit', 'Colormatic'],
    order: 4,
  },
  {
    code: 'NIK',
    label: 'Nikon',
    aliases: ['NIKON', 'NIKON LENSWEAR'],
    country: 'Japon',
    website: 'https://www.nikonlenswear.com',
    productLines: ['Presio', 'SeeMax', 'Neo', 'Lite'],
    order: 5,
  },
  {
    code: 'SEI',
    label: 'Seiko',
    aliases: ['SEIKO', 'SEIKO OPTICAL'],
    country: 'Japon',
    website: 'https://www.seiko-optical.com',
    productLines: ['Seiko Brilliance', 'Seiko Superior', 'Smart Zoom'],
    order: 6,
  },
  {
    code: 'SHA',
    label: 'Shamir',
    aliases: ['SHAMIR', 'SHAMIR OPTICAL'],
    country: 'Israël',
    website: 'https://www.shamir.com',
    productLines: ['Autograph', 'Genesis', 'Spectrum', 'Relax'],
    order: 7,
  },
  {
    code: 'BBG',
    label: 'BBGR',
    aliases: ['BBGR', 'BB GR'],
    country: 'France',
    website: 'https://www.bbgr.com',
    productLines: ['Neva', 'Varimax', 'Intuitiv'],
    order: 8,
  },
  {
    code: 'IOT',
    label: 'IOT',
    aliases: ['IOT', 'INDIZEN OPTICAL'],
    country: 'Espagne',
    website: 'https://www.iot.es',
    productLines: ['Camber', 'Digital Ray-Path', 'Free-Form'],
    order: 9,
  },
];

// ============================================================================
// LABORATOIRES LENTILLES DE CONTACT
// ============================================================================

export const SEED_LABORATORIES: readonly ISeedLaboratory[] = [
  {
    code: 'JNJ',
    label: 'Johnson & Johnson Vision',
    aliases: ['JOHNSON JOHNSON', 'J&J', 'JJ VISION', 'ACUVUE'],
    country: 'États-Unis',
    website: 'https://www.jnjvisioncare.com',
    brands: ['Acuvue Oasys', 'Acuvue Moist', 'Acuvue Vita', 'Acuvue Abiliti'],
    order: 1,
  },
  {
    code: 'ALC',
    label: 'Alcon',
    aliases: ['ALCON', 'CIBA VISION'],
    country: 'Suisse',
    website: 'https://www.alcon.com',
    brands: ['Air Optix', 'Dailies Total 1', 'Dailies AquaComfort Plus', 'Precision1'],
    order: 2,
  },
  {
    code: 'BAL',
    label: 'Bausch & Lomb',
    aliases: ['BAUSCH LOMB', 'B&L', 'BAUSCH AND LOMB', 'BAUSCH+LOMB'],
    country: 'États-Unis',
    website: 'https://www.bausch.com',
    brands: ['Ultra', 'Biotrue ONEday', 'PureVision', 'SofLens'],
    order: 3,
  },
  {
    code: 'COO',
    label: 'CooperVision',
    aliases: ['COOPERVISION', 'COOPER VISION', 'COOPER'],
    country: 'États-Unis',
    website: 'https://www.coopervision.com',
    brands: ['Biofinity', 'clariti', 'MyDay', 'Proclear', 'MiSight'],
    order: 4,
  },
  {
    code: 'MEN',
    label: 'Menicon',
    aliases: ['MENICON'],
    country: 'Japon',
    website: 'https://www.menicon.com',
    brands: ['Menicon Z', 'Menicon PremiO', 'Magic'],
    order: 5,
  },
  {
    code: 'MAR',
    label: 'Mark Ennovy',
    aliases: ['MARK ENNOVY', 'MARKENNOVY', 'ENNOVY'],
    country: 'Espagne',
    website: 'https://www.markennovy.com',
    brands: ['Saphir', 'Gentle', 'Cloud'],
    order: 6,
  },
  {
    code: 'SWI',
    label: 'SwissLens',
    aliases: ['SWISSLENS', 'SWISS LENS'],
    country: 'Suisse',
    website: 'https://www.swisslens.ch',
    brands: ['Relax', 'Orbis', 'Natural'],
    order: 7,
  },
  {
    code: 'LAB',
    label: 'LCS (Laboratoire de Contactologie Spécialisée)',
    aliases: ['LCS', 'LABORATOIRE CONTACTOLOGIE'],
    country: 'France',
    website: null,
    brands: ['Custom lenses'],
    order: 8,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Génère un ID unique basé sur le type et le code.
 */
export function generateSeedId(
  type: 'brand' | 'model' | 'manufacturer' | 'laboratory',
  code: string,
): string {
  return `${type}-${code.toLowerCase()}`;
}

/**
 * Nombre total d'éléments dans la seed.
 */
export const SEED_COUNTS = {
  brands: SEED_BRANDS.length,
  models: SEED_MODELS.length,
  manufacturers: SEED_MANUFACTURERS.length,
  laboratories: SEED_LABORATORIES.length,
} as const;
