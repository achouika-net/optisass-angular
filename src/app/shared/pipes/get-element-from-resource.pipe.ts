import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'getElementFromResource' })
export class GetElementFromResourcePipe implements PipeTransform {
  /**
   * Récupère un élément d'une ressource par valeur de clé.
   * @param resource Tableau de ressources
   * @param value Valeur à rechercher
   * @param key Clé de recherche (par défaut 'id')
   * @returns L'élément trouvé ou undefined
   */
  transform<T, K extends keyof T>(
    resource: T[],
    value: T[K] | null,
    key: K = 'id' as K,
  ): T | undefined {
    if (value === null || value === undefined) return undefined;
    if (!resource?.length) return undefined;
    return resource.find((row: T) => String(row[key]) === String(value));
  }
}
