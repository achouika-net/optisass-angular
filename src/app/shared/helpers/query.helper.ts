/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpParams } from '@angular/common/http';
import { Sort } from '@angular/material/sort';

/**
 * Recursively traverses an object and removes properties with null, undefined, empty string,
 * -1, empty arrays, or File objects, returning a cleaned object.
 *
 * @param {object} obj - The input object to clean.
 * @returns {object} - A new object with non-null and non-empty values.
 */
export const removeEmptyValues = (obj: object): object => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    // Check if the value should be omitted
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      value === -1 ||
      (Array.isArray(value) && !value.length) ||
      (typeof value === 'object' && value instanceof File)
    ) {
      return acc; // Skip this value and continue to the next iteration
    }

    // Recursively handle nested objects
    if (typeof value === 'object' && !Array.isArray(value)) {
      const cleanedValue = removeEmptyValues(value);
      if (Object.keys(cleanedValue).length) {
        acc[key] = cleanedValue;
      }
    } else {
      // Add non-null, non-empty values to the cleaned object
      acc[key] = value;
    }

    return acc;
  }, {} as any);
};

/**
 * Updates an `HttpParams` object with pagination parameters.
 *
 * @param {HttpParams} params - The existing `HttpParams` object.
 * @param {number} page - The page number to set in the parameters.
 * @param {number} per_page - The number of items per page to set in the parameters.
 * @returns {HttpParams} - A new `HttpParams` object with the updated pagination parameters.
 */
function getPageParams(
  params: HttpParams,
  page: number,
  per_page: number
): HttpParams {
  if (page || per_page) {
    params = params.set('page', page).set('per_page', per_page);
  }
  return params;
}

/**
 * Updates an `HttpParams` object with sorting parameters.
 *
 * @param {HttpParams} params - The existing `HttpParams` object.
 * @param {Sort} sort - The sorting information to set in the parameters.
 * @returns {HttpParams} - A new `HttpParams` object with the updated sorting parameters.
 */
function getSortParams(params: HttpParams, sort: Sort): HttpParams {
  if (sort?.direction) {
    params = params.set('sort', sort.active).set('order', sort.direction);
  }
  return params;
}

/**
 * Converts an input object into HTTP query parameters.
 *
 * @param {object} data - The input data object.
 * @returns {HttpParams} - An instance of HttpParams containing the generated query parameters.
 */
function getQueryParams(data: object): HttpParams {
  // Check if the input data is falsy and return an empty HttpParams object if so.
  if (!data) return new HttpParams();

  // Use Object.entries to get an array of key-value pairs from the input data.
  return Object.entries(removeEmptyValues(data)).reduce(
    // Use the reduce function to accumulate query parameters in an HttpParams instance.
    (queryParams: HttpParams, [key, value]: [string, any]) => {
      // Check if the value is an array with at least one item.
      if (Array.isArray(value) && value.length) {
        // If it's an array, iterate through its items and append each one as a separate parameter.
        value.forEach(
          (item) => (queryParams = queryParams.append(`${key}[]`, item))
        );
      } else {
        // If it's not an array, set it as a single parameter.
        queryParams = queryParams.set(key, value);
      }
      return queryParams; // Return the updated HttpParams instance.
    },
    new HttpParams() // Initialize the accumulator with an empty HttpParams instance.
  );
}

/**
 * Generates HTTP query parameters for a resource, including filtering, pagination, and sorting.
 *
 * @param {object} data - The data object for filtering.
 * @param {number} [page] - The page number for pagination (optional).
 * @param {number} [page_size] - The number of items per page for pagination (optional).
 * @param {Sort} [sort] - The sorting criteria (optional).
 * @returns {HttpParams} - An instance of HttpParams containing the generated query parameters.
 */
export const getQuery = (
  data: object,
  page?: number,
  page_size?: number,
  sort?: Sort
): HttpParams => {
  let params: HttpParams = getQueryParams(data);
  params = getPageParams(params, page, page_size);
  params = getSortParams(params, sort);
  return params;
};
