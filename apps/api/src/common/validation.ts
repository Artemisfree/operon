import { BadRequestException } from '@nestjs/common';
import { ZodError, ZodType } from 'zod';

export function parseBody<T>(schema: ZodType<T>, payload: unknown): T {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    throw error;
  }
}
