import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
    private logger = new Logger('RATE_LIMIT');
    private requests = new Map<string, RateLimitEntry>();

    // Configuration
    private readonly LIMIT = 100; // 100 requests
    private readonly WINDOW = 60 * 1000; // per 60 seconds
    private readonly STRICT_LIMIT = 10; // 10 requests per 10s for auth endpoints
    private readonly STRICT_WINDOW = 10 * 1000;

    use(request: Request, response: Response, next: NextFunction) {
        const ipAddress = request.ip || 'UNKNOWN';
        const isAuthEndpoint = request.originalUrl.includes('login') ||
            request.originalUrl.includes('refresh_token');

        const key = `${ipAddress}:${isAuthEndpoint ? 'auth' : 'general'}`;
        const now = Date.now();
        const limit = isAuthEndpoint ? this.STRICT_LIMIT : this.LIMIT;
        const window = isAuthEndpoint ? this.STRICT_WINDOW : this.WINDOW;

        let entry = this.requests.get(key);

        // Reset if window expired
        if (!entry || now > entry.resetTime) {
            entry = {
                count: 0,
                resetTime: now + window,
            };
        }

        // Increment counter
        entry.count++;
        this.requests.set(key, entry);

        // Set rate limit headers
        const remaining = Math.max(0, limit - entry.count);
        const resetTime = Math.ceil((entry.resetTime - now) / 1000);

        response.setHeader('X-RateLimit-Limit', limit);
        response.setHeader('X-RateLimit-Remaining', remaining);
        response.setHeader('X-RateLimit-Reset', resetTime);

        // Check if limit exceeded
        if (entry.count > limit) {
            this.logger.warn(`Rate limit exceeded for IP: ${ipAddress}`);
            throw new HttpException(
                `Too many requests. Try again in ${resetTime} seconds.`,
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        // Cleanup old entries periodically
        if (Math.random() < 0.01) {
            this.cleanupOldEntries(now);
        }

        next();
    }

    private cleanupOldEntries(now: number) {
        for (const [key, entry] of this.requests.entries()) {
            if (now > entry.resetTime + 60000) {
                // Remove entries older than 1 minute
                this.requests.delete(key);
            }
        }
    }
}
