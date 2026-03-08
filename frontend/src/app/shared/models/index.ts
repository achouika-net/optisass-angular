// Core types used across the app
export type IProduct = any;
export type Product = any;
export interface ISupplier {
    [key: string]: any;
    name?: any;
    address?: any;
    phone?: any;
    email?: any;
    ice?: any;
    taxId?: any;
    tradeRegister?: any;
    siret?: any;
    rib?: any;
    active?: any;
    bank?: any;
    bankAccountNumber?: any;
    businessLicense?: any;
}
export type IStockEntry = any;
export type IWarehouse = any;
export type IFrame = any;
export type ISupplierProductCode = any;
export type IStockEntryProductFormRow = any;
export type IProductForm = any;
export type IProductFormGroup = any;
export type IProductPhoto = any;
export type IClientSearchRequest = any;
export type IClientSearchResponse = any;
export type ISupplierSearchRequest = any;
export type ISupplierSearchResponse = any;
export interface IAddress {
    [key: string]: any;
    street?: any;
    streetLine2?: any;
    postcode?: any;
    city?: any;
    country?: any;
    lat?: any;
    lon?: any;
}
export type IStatisticCardData = any;
export type IStatisticCardDataExtras = any;
export type FrameSubType = any;
export type Channel = any;
export type ChannelTemplate = any;
export type WebSocketResponse = any;
export type MessageHandler = any;
export type ResourceAuthorizations = any;
export type IManufacturer = any;
export type PricingMode = any;
export type ProductType = any;
export type IModel = any;
export type IResource = any;
export type IOcrConfig = any;
export type ResourceMap = any;
export type IProductSearch = any;
export type PaginatedApiResponse<T> = any;
export type WebSocketMessage = any;
export type IColor = any;
export type ILaboratory = any;
export type ResourceType = any;
export type ISubFamily = any;
export type IBrand = any;
export type IFamily = any;
export type IRole = any;
export type IWsError = any;
export type ProductStatus = any;
export type IClient = any;
export type ProductUpdateRequest = any;
export type ProductCreateRequest = any;
export type ILinks = any;
export type IMeta = any;
export type IAccessory = any;
export type IContactLens = any;
export type ILens = any;
export type RemainingTime = any;
export type MenuItem = any;
export type IProductMatchResult = any;
export type IProductSuggestion = any;
export type MatchConfidence = any;
export type MatchMethod = any;
export type TypeClient = any;
export type IParsedProductInfo = any;
export type IValidationResult = any;
export type IInvoiceClient = any;
export type ConfirmData = any;
export type IValidationError = any;
export type IOcrBlock = any;
export type ICenter = any;
export type ISupplierInvoice = any;
export type IInvoiceSupplier = any;
export type IInvoiceTotals = any;
export type IInvoiceLine = any;
export interface IParseResult<T = any> {
    data: T;
    confidence: number;
    [key: string]: any;
}
export interface IDataExtractor<T = any> { [key: string]: any; }
export type IOcrResult = any;
export type OcrDocumentType = any;
export type IOcrEngine = any;
export type IOcrOptions = any;
export enum OcrErrorCode {
    PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
    TIMEOUT = 'TIMEOUT',
    INVALID_IMAGE = 'INVALID_IMAGE',
    IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
}
export type IJwtTokens = any;
export type IResetPasswordConfirmRequest = any;
export class IOcrPipeline<T = any> { [key: string]: any; }
export type OcrProviderType = any;
export type ParserStrategyType = any;
export type IPipelineConfig = any;
export type IPipelineFactory = any;
export type IPipelineDocumentConfig = any;
export type IOcrLine = any;
export type IOcrWord = any;
export const FR_LOCALE: any = {};
export const EN_LOCALE: any = {};
export const detectLowConfidenceWarnings: any = (result: any): any[] => [];
export type ICurrentUser = any;
export type ICurrentUserState = any;
export type ILoginRequest = any;
export type ILoginResponse = any;
export type IUserOptions = any;
export type ITenant = any;
export type IDeviceCapabilities = any;
export type States = any;
export type JwtTokensState = any;
export type WsErrorState = any;
export type PasswordRetryTimer = any;
export class CalledRessources { [key: string]: any; }
export type ICalledRessources = any;
export class ClientSearch { [key: string]: any; }
export const isValidUser: any = (user: any): boolean => !!user;
export const INITIAL_JWT_TOKENS: any = {};
export const INITIAL_CURRENT_USER: any = {};
export const INITIAL_WS_ERROR: any = {};
// Non-I-prefixed aliases for compatibility
export class CurrentUser { [key: string]: any; }
export type CurrentUserState = any;
export class JwtTokens { [key: string]: any; }
export type IClientSearch = any;
export const filterMenuByAuthorizations: any = (menu: any[], authorizations: any): any[] => menu;
export const createWsErrorWithMessage: any = (msg: string): any => ({ message: msg });
export const resetTypeSpecificFields: any = (current: any) => current;
export type ISupplierProductCodeForm = any;
export const toProductCreateRequest: any = (data: any) => data;
export const toProductUpdateRequest: any = (id: any, data: any) => data;

export const PermissionType: any = {
    EXPORT: 'EXPORT',
    WRITE: 'WRITE',
    READ: 'READ',
    DELETE: 'DELETE',
    UPDATE: 'UPDATE'
};

// OCR Stubs as classes/values because they are used with 'new' or as metadata
export class IOcrLocale {
    [key: string]: any;
    noiseKeywords?: any;
    paymentTerms?: any[];
}
export class IdentifierExtractor {
    [key: string]: any;
    extractInvoiceNumber(text: string, locale: any): any { return { value: null }; }
    extractAllMoroccan(text: string): any { return {}; }
}
export class DateExtractor {
    [key: string]: any;
    extract(text: string, locale: any, type: string): any { return { value: null }; }
}
export class AmountExtractor {
    [key: string]: any;
    extractAllLabeled(text: string, locale: any): any { return { totalHT: {}, totalTTC: {}, vat: {}, discount: {} }; }
    calculateVAT(ht: number, ttc: number): number { return 0; }
}
export class ContactExtractor {
    [key: string]: any;
    extractAllDetailed(text: string, locale: any): any { return {}; }
}
export class LineItemExtractor {
    [key: string]: any;
    constructor(noiseKeywords?: any) { }
    extractLines(text: string, threshold: number): any[] { return []; }
    validateAgainstTotal(lines: any[], totalHT: number): any { return { isValid: true }; }
}
export class CustomerExtractor {
    [key: string]: any;
    extractCustomer(text: string, locale: any, vendorName: string): any { return { confidence: 0 }; }
}
export class LooseContactExtractor {
    [key: string]: any;
    extractFullSupplier(text: string, locale: any): any { return { _confidence: 0 }; }
}
export class EntityZoneDetector {
    [key: string]: any;
    detectEntityBlocks(text: string): any { return {}; }
    extractVendorFromFooter(text: string): any { return {}; }
}
export class WsErrorClass {
    constructor(public error?: any) { }
}
export class Links { }
export class Meta {
    constructor(public length?: number) { }
}
export class ProductSearch { [key: string]: any; }
export class ActionsButton { [key: string]: any; }

export const createEmptySupplier: any = (): any => ({});
export const createEmptyAddress: any = (): any => ({});
export const detectCurrency: any = (text: string, def?: string): any => def;
export const toNestedProductSearch: any = undefined;
export const scoreToConfidence: any = undefined;
export const calculateSimilarity: any = undefined;
export const normalizeBarcode: any = undefined;
export const normalizeBrandName: any = undefined;
export const normalizeModelName: any = undefined;
export const parseDesignation: any = (text: string): any => ({ confidence: 0 });
export const createNoMatchResult: any = undefined;
export const DEFAULT_STOCK_SETTINGS: any = undefined;
export const parseSafiloDesignation: any = (text: string): any => ({ confidence: 0 });
export const USER_ROLES: any = {};
export const categoryToFrameSubType: any = (cat: any): any => null;
export const categoryToProductType: any = (cat: any): any => null;
export const getDefaultProductForm: any = (): any => ({});
export const toProductForm: any = (p: any): any => ({});
export type ChannelSubType = any;

export const TypesClient: any = {
    ALL: 'ALL'
};
