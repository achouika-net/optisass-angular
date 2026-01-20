import { Injectable } from '@angular/core';
import { IWarehouse } from '../../features/settings/warehouse/models/warehouse.model';
import {
  IBrand,
  IColor,
  IFamily,
  ILaboratory,
  IManufacturer,
  IModel,
  IResource,
  ResourceMap,
  ResourceType,
  ISubFamily,
  ISupplier,
} from '@app/models';
import { Observable, of } from 'rxjs';
import {
  getMockResourcesByType,
  MOCK_BRANDS,
  MOCK_COLORS,
  MOCK_FAMILIES,
  MOCK_LABORATORIES,
  MOCK_MANUFACTURERS,
  MOCK_MODELS,
  MOCK_RESOURCES,
  MOCK_SUB_FAMILIES,
  MOCK_SUPPLIERS,
  MOCK_WAREHOUSES,
} from './resource.service.mock';

// TODO: Inject HttpClient and use API URLs when backend is ready

@Injectable({ providedIn: 'root' })
export class ResourceService {
  // ============================================
  // Resources simples (type Resource)
  // ============================================

  /**
   * Retrieves resources by type.
   * @param {ResourceType} type - The resource type to retrieve
   * @returns {Observable<IResource[]>} Observable of resources array
   */
  getByType(type: ResourceType): Observable<IResource[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<IResource[]>(RESOURCES_API_URL, { params: { type } });
    return of(getMockResourcesByType(type));
  }

  /**
   * Loads all simple resources at once.
   * @returns {Observable<ResourceMap>} Observable of all resources mapped by type
   */
  loadAllSimpleResources(): Observable<ResourceMap> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<ResourceMap>(`${RESOURCES_API_URL}/all`);
    return of(MOCK_RESOURCES);
  }

  // ============================================
  // Brands & Models
  // ============================================

  /**
   * Retrieves all brands.
   * @returns {Observable<IBrand[]>} Observable of brands array
   */
  getBrands(): Observable<IBrand[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<IBrand[]>(BRANDS_API_URL);
    return of(MOCK_BRANDS);
  }

  /**
   * Retrieves all models.
   * @returns {Observable<IModel[]>} Observable of models array
   */
  getModels(): Observable<IModel[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<IModel[]>(MODELS_API_URL);
    return of(MOCK_MODELS);
  }

  /**
   * Retrieves models for a specific brand.
   * @param {string} brandId - The brand ID to filter models
   * @returns {Observable<IModel[]>} Observable of models array filtered by brand
   */
  getModelsByBrand(brandId: string): Observable<IModel[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<IModel[]>(`${BRANDS_API_URL}/${brandId}/models`);
    return of(MOCK_MODELS.filter((m) => m.brandId === brandId));
  }

  // ============================================
  // Manufacturers
  // ============================================

  /**
   * Retrieves all manufacturers.
   * @returns {Observable<IManufacturer[]>} Observable of manufacturers array
   */
  getManufacturers(): Observable<IManufacturer[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<IManufacturer[]>(MANUFACTURERS_API_URL);
    return of(MOCK_MANUFACTURERS);
  }

  // ============================================
  // Laboratories
  // ============================================

  /**
   * Retrieves all laboratories.
   * @returns {Observable<ILaboratory[]>} Observable of laboratories array
   */
  getLaboratories(): Observable<ILaboratory[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<ILaboratory[]>(LABORATORIES_API_URL);
    return of(MOCK_LABORATORIES);
  }

  // ============================================
  // Families & SubFamilies
  // ============================================

  /**
   * Retrieves all families.
   * @returns {Observable<IFamily[]>} Observable of families array
   */
  getFamilies(): Observable<IFamily[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<IFamily[]>(FAMILIES_API_URL);
    return of(MOCK_FAMILIES);
  }

  /**
   * Retrieves all sub-families.
   * @returns {Observable<ISubFamily[]>} Observable of sub-families array
   */
  getSubFamilies(): Observable<ISubFamily[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<ISubFamily[]>(`${FAMILIES_API_URL}/sub-families`);
    return of(MOCK_SUB_FAMILIES);
  }

  /**
   * Retrieves sub-families for a specific family.
   * @param {string} familyId - The family ID to filter sub-families
   * @returns {Observable<ISubFamily[]>} Observable of sub-families array filtered by family
   */
  getSubFamiliesByFamily(familyId: string): Observable<ISubFamily[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<ISubFamily[]>(`${FAMILIES_API_URL}/${familyId}/sub-families`);
    return of(MOCK_SUB_FAMILIES.filter((sf) => sf.familyId === familyId));
  }

  // ============================================
  // Colors
  // ============================================

  /**
   * Retrieves all colors.
   * @returns {Observable<IColor[]>} Observable of colors array
   */
  getColors(): Observable<IColor[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<IColor[]>(COLORS_API_URL);
    return of(MOCK_COLORS);
  }

  // ============================================
  // Suppliers
  // ============================================

  /**
   * Retrieves all suppliers.
   * @returns {Observable<ISupplier[]>} Observable of suppliers array
   */
  getSuppliers(): Observable<ISupplier[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<ISupplier[]>(SUPPLIERS_API_URL);
    return of(MOCK_SUPPLIERS);
  }

  // ============================================
  // Warehouses
  // ============================================

  /**
   * Retrieves all warehouses.
   * @returns {Observable<IWarehouse[]>} Observable of warehouses array
   */
  getWarehouses(): Observable<IWarehouse[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<IWarehouse[]>(WAREHOUSES_API_URL);
    return of(MOCK_WAREHOUSES);
  }
}
