import { Sort } from '@angular/material/sort';
import { PaginatedApiResponse } from '@app/models';
import { delay, Observable, of, throwError } from 'rxjs';
import { IWarehouse, IWarehouseSearch } from '../models';

// Mock warehouses data
const MOCK_WAREHOUSES: IWarehouse[] = [
  {
    id: 1,
    name: 'Entrepôt Central',
    capacity: 5000,
    address: '12 Rue de Paris, 75001 Paris',
    type: 'PRINCIPALE',
    active: true,
  },
  {
    id: 2,
    name: 'Entrepôt Nord',
    capacity: 2500,
    address: '45 Avenue du Nord, 59000 Lille',
    type: 'SECONDAIRE',
    active: true,
  },
  {
    id: 3,
    name: 'Entrepôt Sud',
    capacity: 3000,
    address: '8 Boulevard du Sud, 13001 Marseille',
    type: 'SECONDAIRE',
    active: false,
  },
  {
    id: 4,
    name: 'Entrepôt Est',
    capacity: 1800,
    address: '23 Rue de Lyon, 69001 Lyon',
    type: 'SECONDAIRE',
    active: true,
  },
  {
    id: 5,
    name: 'Entrepôt Ouest',
    capacity: 4200,
    address: '56 Avenue de Bordeaux, 33000 Bordeaux',
    type: 'PRINCIPALE',
    active: true,
  },
];

// Mock state
let warehouses = [...MOCK_WAREHOUSES];
let nextId = 6;

/**
 * Reset mock data to initial state (useful for testing)
 */
export function resetMockData(): void {
  warehouses = [...MOCK_WAREHOUSES];
  nextId = 6;
}

/**
 * Mock search warehouses with filtering, sorting and pagination
 */
export function mockSearchWarehouses(
  searchForm: IWarehouseSearch,
  page: number,
  pageSize: number,
  sort: Sort | null = null
): Observable<PaginatedApiResponse<IWarehouse>> {
  let filtered = [...warehouses];

  // Filter by name
  if (searchForm.name) {
    const searchName = searchForm.name.toLowerCase();
    filtered = filtered.filter((w) => w.name.toLowerCase().includes(searchName));
  }

  // Filter by type
  if (searchForm.type) {
    filtered = filtered.filter((w) => w.type === searchForm.type);
  }

  // Sort
  if (sort?.active && sort?.direction) {
    filtered.sort((a, b) => {
      const aValue = a[sort.active as keyof IWarehouse];
      const bValue = b[sort.active as keyof IWarehouse];
      const direction = sort.direction === 'asc' ? 1 : -1;

      if (aValue === null) return 1;
      if (bValue === null) return -1;
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
  }

  // Paginate
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const paginatedData = filtered.slice(start, start + pageSize);

  const response: PaginatedApiResponse<IWarehouse> = {
    data: paginatedData,
    links: {
      first: '',
      last: '',
      prev: '',
      next: '',
    },
    meta: {
      current_page: page,
      from: start + 1,
      last_page: Math.ceil(total / pageSize),
      path: '',
      per_page: pageSize,
      to: Math.min(start + pageSize, total),
      total,
    },
  };

  return of(response).pipe(delay(300));
}

/**
 * Mock get warehouse by ID
 */
export function mockGetWarehouse(id: number): Observable<IWarehouse> {
  const warehouse = warehouses.find((w) => w.id === id);
  if (!warehouse) {
    return throwError(() => new Error('Warehouse not found'));
  }
  return of(warehouse).pipe(delay(200));
}

/**
 * Mock add warehouse
 */
export function mockAddWarehouse(warehouse: Omit<IWarehouse, 'id'>): Observable<IWarehouse> {
  const newWarehouse: IWarehouse = {
    ...warehouse,
    id: nextId++,
  };
  warehouses.push(newWarehouse);
  return of(newWarehouse).pipe(delay(300));
}

/**
 * Mock update warehouse
 */
export function mockUpdateWarehouse(id: number, warehouse: Partial<IWarehouse>): Observable<IWarehouse> {
  const index = warehouses.findIndex((w) => w.id === id);
  if (index === -1) {
    return throwError(() => new Error('Warehouse not found'));
  }
  warehouses[index] = { ...warehouses[index], ...warehouse };
  return of(warehouses[index]).pipe(delay(300));
}

/**
 * Mock delete warehouse
 */
export function mockDeleteWarehouse(id: number): Observable<void> {
  const index = warehouses.findIndex((w) => w.id === id);
  if (index === -1) {
    return throwError(() => new Error('Warehouse not found'));
  }
  warehouses.splice(index, 1);
  return of(void 0).pipe(delay(300));
}
