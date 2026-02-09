import { Injectable } from '@angular/core';
import { createEmptyAddress, createEmptySupplier, ISupplier } from '@app/models';
import {
  IOcrSupplierData,
  ISupplierFieldDiff,
  SupplierDiffField,
  SupplierIdentifierField,
} from '../models';

/**
 * Service for matching OCR-extracted supplier data against existing suppliers.
 * Handles supplier identification by unique identifiers and computes field differences.
 */
@Injectable({ providedIn: 'root' })
export class SupplierMatchingService {
  /**
   * Finds a supplier by unique identifiers (ICE, Tax ID, Trade Register).
   * Normalizes values by removing spaces and case for comparison.
   * @param ocrSupplier OCR-extracted supplier data
   * @param suppliersList List of existing suppliers to search
   * @returns Match result with supplier and matched field, or null if no match
   */
  findByIdentifiers(
    ocrSupplier: IOcrSupplierData,
    suppliersList: readonly ISupplier[],
  ): { supplier: ISupplier; matchedBy: SupplierIdentifierField } | null {
    const identifiers: { field: SupplierIdentifierField; ocrValue: string | null }[] = [
      { field: 'ice', ocrValue: ocrSupplier.ice },
      { field: 'taxId', ocrValue: ocrSupplier.fiscalId },
      { field: 'tradeRegister', ocrValue: ocrSupplier.tradeRegister },
    ];

    for (const { field, ocrValue } of identifiers) {
      if (!ocrValue) continue;

      const normalizedValue = ocrValue.replace(/\s/g, '').toLowerCase();
      const match = suppliersList.find((s) => {
        const supplierValue = s[field];
        if (!supplierValue) return false;
        return supplierValue.replace(/\s/g, '').toLowerCase() === normalizedValue;
      });

      if (match) {
        return { supplier: match, matchedBy: field };
      }
    }

    return null;
  }

  /**
   * Computes differences between OCR-extracted data and existing supplier.
   * Compares all relevant fields and returns an array of differences.
   * @param ocrSupplier OCR-extracted supplier data
   * @param existingSupplier Existing supplier from database
   * @returns Array of field differences with current and OCR values
   */
  computeDiffs(ocrSupplier: IOcrSupplierData, existingSupplier: ISupplier): ISupplierFieldDiff[] {
    const diffs: ISupplierFieldDiff[] = [];

    if (ocrSupplier.name && ocrSupplier.name !== existingSupplier.name) {
      diffs.push({
        field: 'name',
        labelKey: 'stock.entry.supplierInfo.name',
        currentValue: existingSupplier.name,
        ocrValue: ocrSupplier.name,
      });
    }

    if (ocrSupplier.address && ocrSupplier.address !== existingSupplier.address?.street) {
      diffs.push({
        field: 'address',
        labelKey: 'stock.entry.supplierInfo.address',
        currentValue: existingSupplier.address?.street ?? null,
        ocrValue: ocrSupplier.address,
      });
    }

    if (ocrSupplier.phone && ocrSupplier.phone !== existingSupplier.phone) {
      diffs.push({
        field: 'phone',
        labelKey: 'stock.entry.supplierInfo.phone',
        currentValue: existingSupplier.phone,
        ocrValue: ocrSupplier.phone,
      });
    }

    if (ocrSupplier.email && ocrSupplier.email !== existingSupplier.email) {
      diffs.push({
        field: 'email',
        labelKey: 'stock.entry.supplierInfo.email',
        currentValue: existingSupplier.email,
        ocrValue: ocrSupplier.email,
      });
    }

    if (ocrSupplier.ice && ocrSupplier.ice !== existingSupplier.ice) {
      diffs.push({
        field: 'ice',
        labelKey: 'stock.entry.supplierInfo.ice',
        currentValue: existingSupplier.ice,
        ocrValue: ocrSupplier.ice,
      });
    }

    if (ocrSupplier.fiscalId && ocrSupplier.fiscalId !== existingSupplier.taxId) {
      diffs.push({
        field: 'taxId',
        labelKey: 'stock.entry.supplierInfo.taxId',
        currentValue: existingSupplier.taxId,
        ocrValue: ocrSupplier.fiscalId,
      });
    }

    if (ocrSupplier.tradeRegister && ocrSupplier.tradeRegister !== existingSupplier.tradeRegister) {
      diffs.push({
        field: 'tradeRegister',
        labelKey: 'stock.entry.supplierInfo.tradeRegister',
        currentValue: existingSupplier.tradeRegister,
        ocrValue: ocrSupplier.tradeRegister,
      });
    }

    if (ocrSupplier.patente && ocrSupplier.patente !== existingSupplier.businessLicense) {
      diffs.push({
        field: 'businessLicense',
        labelKey: 'stock.entry.supplierInfo.businessLicense',
        currentValue: existingSupplier.businessLicense,
        ocrValue: ocrSupplier.patente,
      });
    }

    if (ocrSupplier.bank && ocrSupplier.bank !== existingSupplier.bank) {
      diffs.push({
        field: 'bank',
        labelKey: 'stock.entry.supplierInfo.bank',
        currentValue: existingSupplier.bank,
        ocrValue: ocrSupplier.bank,
      });
    }

    if (ocrSupplier.rib && ocrSupplier.rib !== existingSupplier.bankAccountNumber) {
      diffs.push({
        field: 'bankAccountNumber',
        labelKey: 'stock.entry.supplierInfo.bankAccountNumber',
        currentValue: existingSupplier.bankAccountNumber,
        ocrValue: ocrSupplier.rib,
      });
    }

    return diffs;
  }

  /**
   * Creates a new supplier entity from OCR-extracted data.
   * Maps OCR field names to supplier model field names.
   * @param ocrSupplier OCR-extracted supplier data
   * @returns New supplier instance with OCR data populated
   */
  createFromOcr(ocrSupplier: IOcrSupplierData): ISupplier {
    const newSupplier = createEmptySupplier();
    const details = ocrSupplier.addressDetails;

    return {
      ...newSupplier,
      name: ocrSupplier.name ?? '',
      address: {
        ...createEmptyAddress(),
        street: details?.street ?? ocrSupplier.address,
        city: details?.city ?? null,
        postcode: details?.postalCode ?? null,
        country: details?.country ?? 'Maroc',
      },
      phone: ocrSupplier.phone,
      email: ocrSupplier.email,
      ice: ocrSupplier.ice,
      taxId: ocrSupplier.fiscalId,
      tradeRegister: ocrSupplier.tradeRegister,
      businessLicense: ocrSupplier.patente,
      bank: ocrSupplier.bank,
      bankAccountNumber: ocrSupplier.rib,
    };
  }

  /**
   * Merges accepted OCR fields into an existing supplier.
   * Only updates fields that were accepted by the user in the diff dialog.
   * @param existingSupplier Existing supplier from database
   * @param ocrSupplier OCR-extracted supplier data
   * @param acceptedFields Array of field names that user accepted
   * @returns New supplier instance with merged data
   */
  mergeWithOcr(
    existingSupplier: ISupplier,
    ocrSupplier: IOcrSupplierData,
    acceptedFields: readonly SupplierDiffField[],
  ): ISupplier {
    const merged = { ...existingSupplier, address: { ...existingSupplier.address } };
    const details = ocrSupplier.addressDetails;

    for (const field of acceptedFields) {
      switch (field) {
        case 'name':
          if (ocrSupplier.name) merged.name = ocrSupplier.name;
          break;
        case 'address':
          if (details?.street || ocrSupplier.address) {
            merged.address.street = details?.street ?? ocrSupplier.address;
          }
          if (details?.city) merged.address.city = details.city;
          if (details?.postalCode) merged.address.postcode = details.postalCode;
          if (details?.country) merged.address.country = details.country;
          break;
        case 'phone':
          if (ocrSupplier.phone) merged.phone = ocrSupplier.phone;
          break;
        case 'email':
          if (ocrSupplier.email) merged.email = ocrSupplier.email;
          break;
        case 'ice':
          if (ocrSupplier.ice) merged.ice = ocrSupplier.ice;
          break;
        case 'taxId':
          if (ocrSupplier.fiscalId) merged.taxId = ocrSupplier.fiscalId;
          break;
        case 'tradeRegister':
          if (ocrSupplier.tradeRegister) merged.tradeRegister = ocrSupplier.tradeRegister;
          break;
        case 'businessLicense':
          if (ocrSupplier.patente) merged.businessLicense = ocrSupplier.patente;
          break;
        case 'bank':
          if (ocrSupplier.bank) merged.bank = ocrSupplier.bank;
          break;
        case 'bankAccountNumber':
          if (ocrSupplier.rib) merged.bankAccountNumber = ocrSupplier.rib;
          break;
      }
    }

    return merged;
  }
}
