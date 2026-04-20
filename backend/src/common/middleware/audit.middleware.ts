import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface AuditEntry {
    userId: string;
    action: string;
    resource: string;
    method: string;
    statusCode: number;
    timestamp: Date;
    ipAddress: string;
    changes?: Record<string, any>;
}

@Injectable()
export class AuditMiddleware implements NestMiddleware {
    private logger = new Logger('AUDIT');

    constructor(private prisma: PrismaService) { }

    async use(request: Request, response: Response, next: NextFunction) {
        const startTime = Date.now();
        const { method, originalUrl, body, headers } = request;
        const ipAddress = request.ip || 'UNKNOWN';

        // Extract user ID from JWT if available
        const authHeader = headers.authorization;
        let userId = 'ANONYMOUS';

        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = require('jsonwebtoken').verify(
                    token,
                    process.env.JWT_SECRET || 'your-very-secret-key',
                ) as any;
                userId = decoded.sub;
            } catch (e) {
                // Invalid token, userId remains ANONYMOUS
            }
        }

        // Capture response
        const originalSend = response.send;
        let responseBody: any;

        response.send = function (data: any) {
            responseBody = data;
            return originalSend.call(this, data);
        };

        // Log audit entry after response is sent
        response.on('finish', async () => {
            const duration = Date.now() - startTime;
            const { statusCode } = response;

            // Skip audit for non-critical operations
            if (this.shouldAudit(method, originalUrl)) {
                const auditEntry: AuditEntry = {
                    userId,
                    action: this.getAction(method, originalUrl),
                    resource: this.getResource(originalUrl),
                    method,
                    statusCode,
                    timestamp: new Date(),
                    ipAddress,
                    changes: body && (method === 'POST' || method === 'PUT' || method === 'PATCH')
                        ? this.sanitizeBody(body)
                        : undefined,
                };

                // Log to console
                this.logger.log(
                    `${method} ${originalUrl} | User: ${userId} | Status: ${statusCode} | Duration: ${duration}ms | IP: ${ipAddress}`,
                );

                // Log to database (async, non-blocking)
                // Note: Requires AuditLog table in Prisma schema
                // TODO: Uncomment after schema update
                /*
                try {
                    await this.prisma.auditLog.create({
                        data: {
                            userId: userId !== 'ANONYMOUS' ? userId : null,
                            action: auditEntry.action,
                            resource: auditEntry.resource,
                            method: auditEntry.method,
                            statusCode: auditEntry.statusCode,
                            ipAddress: auditEntry.ipAddress,
                            changes: auditEntry.changes ? JSON.stringify(auditEntry.changes) : null,
                            createdAt: auditEntry.timestamp,
                        },
                    });
                } catch (error) {
                    this.logger.error('Failed to save audit log:', error);
                }
                */
            }
        });

        next();
    }

    private shouldAudit(method: string, url: string): boolean {
        // Don't audit health checks or file downloads
        if (url.includes('health') || url.includes('download') || url.includes('pdf')) {
            return false;
        }
        // Audit all state-changing operations
        return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    }

    private getAction(method: string, url: string): string {
        const resource = url.split('/').filter(Boolean)[0];
        if (method === 'POST') return `CREATE_${resource.toUpperCase()}`;
        if (method === 'PUT' || method === 'PATCH') return `UPDATE_${resource.toUpperCase()}`;
        if (method === 'DELETE') return `DELETE_${resource.toUpperCase()}`;
        return `${method}_${resource.toUpperCase()}`;
    }

    private getResource(url: string): string {
        return url.split('/').filter(Boolean).slice(0, 2).join('/');
    }

    private sanitizeBody(body: Record<string, any>): Record<string, any> {
        const sanitized = { ...body };

        // Remove sensitive fields from logs
        const sensitiveFields = [
            'password',
            'token',
            'refresh_token',
            'secret',
            'apiKey',
            'creditCard',
            'cvv',
            'bankAccount',
        ];

        sensitiveFields.forEach((field) => {
            if (sanitized[field]) {
                sanitized[field] = '***REDACTED***';
            }
        });

        return sanitized;
    }
}
