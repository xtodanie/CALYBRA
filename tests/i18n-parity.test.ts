import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';

type DictionaryNode = Record<string, unknown>;

function collectLeafPaths(node: DictionaryNode, prefix = ''): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(node)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...collectLeafPaths(value as DictionaryNode, currentPath));
    } else {
      paths.push(currentPath);
    }
  }

  return paths;
}

describe('i18n dictionary parity', () => {
  it('en and es expose identical translation leaf keys', () => {
    const enPaths = new Set(collectLeafPaths(en as unknown as DictionaryNode));
    const esPaths = new Set(collectLeafPaths(es as unknown as DictionaryNode));

    const missingInEs = [...enPaths].filter((path) => !esPaths.has(path));
    const missingInEn = [...esPaths].filter((path) => !enPaths.has(path));

    expect(missingInEs).toEqual([]);
    expect(missingInEn).toEqual([]);
  });
});
