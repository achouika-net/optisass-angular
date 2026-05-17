import { Injectable, BadRequestException, Logger } from '@nestjs/common';

@Injectable()
export class InputSanitizationService {
  private logger = new Logger('INPUT_SANITIZATION');

  /**
   * Sanitize string input to prevent XSS attacks
   */
  sanitizeString(input: string): string {
    if (!input) return '';

    // Remove potential XSS vectors
    const sanitized = input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();

    return sanitized;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format (Moroccan format)
   */
  validatePhone(phone: string): boolean {
    // Accept Moroccan phone numbers: +212XXXXXXXXX or 06XXXXXXXX or 07XXXXXXXX
    const phoneRegex = /^(\+212|0)[0-9]{9}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
  }

  /**
   * Validate UUID format
   */
  validateUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate monetary amount
   */
  validateAmount(amount: any): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0 && isFinite(num);
  }

  /**
   * Sanitize object recursively
   */
  sanitizeObject(obj: Record<string, any>): Record<string, any> {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized: Record<string, any> = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  /**
   * Validate and sanitize DTO
   */
  validateAndSanitize<T extends Record<string, any>>(
    data: T,
    rules: Record<string, any>,
  ): T {
    const sanitized = this.sanitizeObject(data);

    for (const [field, rule] of Object.entries(rules)) {
      const value = sanitized[field];

      if (rule.required && !value) {
        throw new BadRequestException(`Field '${field}' is required`);
      }

      if (value) {
        switch (rule.type) {
          case 'email':
            if (!this.validateEmail(value)) {
              throw new BadRequestException(
                `Field '${field}' must be a valid email`,
              );
            }
            break;
          case 'phone':
            if (!this.validatePhone(value)) {
              throw new BadRequestException(
                `Field '${field}' must be a valid phone number`,
              );
            }
            break;
          case 'uuid':
            if (!this.validateUUID(value)) {
              throw new BadRequestException(
                `Field '${field}' must be a valid UUID`,
              );
            }
            break;
          case 'amount':
            if (!this.validateAmount(value)) {
              throw new BadRequestException(
                `Field '${field}' must be a positive number`,
              );
            }
            break;
          case 'string':
            if (rule.minLength && value.length < rule.minLength) {
              throw new BadRequestException(
                `Field '${field}' must be at least ${rule.minLength} characters`,
              );
            }
            if (rule.maxLength && value.length > rule.maxLength) {
              throw new BadRequestException(
                `Field '${field}' must be at most ${rule.maxLength} characters`,
              );
            }
            break;
        }
      }
    }

    return sanitized as T;
  }
}
