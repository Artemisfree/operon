import { Decimal } from '@prisma/client/runtime/library';

export function serializeValue(value: unknown): unknown {
  if (value instanceof Decimal) {
    return value.toNumber();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        serializeValue(nestedValue),
      ]),
    );
  }

  return value;
}
