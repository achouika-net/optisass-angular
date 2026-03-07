import { Injectable } from '@angular/core';
import { Sort } from '@angular/material/sort';
import { removeEmptyValues } from '@app/helpers';
import {
  IProductSearch,
  PaginatedApiResponse,
  Product,
  ProductCreateRequest,
  ProductUpdateRequest,
  toNestedProductSearch,
} from '@app/models';
import { Observable } from 'rxjs';
import {
  mockSearchProducts,
  mockGetProduct,
  mockCreateProduct,
  mockUpdateProduct,
  mockDeleteProduct,
  mockSearchProductByDesignation,
} from './product.service.mock';

@Injectable({ providedIn: 'root' })
export class ProductService {
  /**
   * Searches products with pagination and filters via POST.
   * @param searchForm The search criteria
   * @param page The page number (1-based)
   * @param pageSize The number of items per page
   * @param sort The sort configuration
   * @returns Observable of paginated products
   */
  search(
    searchForm: IProductSearch,
    page: number,
    pageSize: number,
    sort: Sort,
  ): Observable<PaginatedApiResponse<Product>> {
    const nestedSearch = toNestedProductSearch(searchForm);
    const body = {
      ...removeEmptyValues(nestedSearch),
      page,
      pageSize,
      ...(sort?.direction && { sort: sort.active, order: sort.direction }),
    };
    // TODO: Replace mock with HTTP call when backend is ready
    return mockSearchProducts(body);
  }

  /**
   * Retrieves a product by ID.
   * @param id The product ID
   * @returns Observable of the product
   */
  getById(id: string): Observable<Product> {
    // TODO: Replace mock with HTTP call when backend is ready
    return mockGetProduct(id);
  }

  /**
   * Creates a new product.
   * @param request The product creation request
   * @returns Observable of the created product
   */
  create(request: ProductCreateRequest): Observable<Product> {
    // TODO: Replace mock with HTTP call when backend is ready
    return mockCreateProduct(request);
  }

  /**
   * Updates an existing product.
   * @param id The product ID
   * @param request The product update request
   * @returns Observable of the updated product
   */
  update(id: string, request: ProductUpdateRequest): Observable<Product> {
    // TODO: Replace mock with HTTP call when backend is ready
    return mockUpdateProduct(id, request);
  }

  /**
   * Deletes a product.
   * @param id The product ID
   * @returns Observable that completes when deleted
   */
  delete(id: string): Observable<void> {
    // TODO: Replace mock with HTTP call when backend is ready
    return mockDeleteProduct(id);
  }

  /**
   * Searches for a product by exact designation match.
   * @param designation The product designation to search
   * @returns Observable of the matched product or null
   */
  searchByDesignation(designation: string): Observable<Product | null> {
    // TODO: Replace mock with HTTP call when backend is ready
    return mockSearchProductByDesignation(designation);
  }
}
