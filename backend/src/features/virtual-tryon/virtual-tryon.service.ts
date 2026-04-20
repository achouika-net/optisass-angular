import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { CreateVirtualTryonDto, VirtualTryonResultDto } from './dto/create-virtual-tryon.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class VirtualTryonService {
    private readonly logger = new Logger(VirtualTryonService.name);
    private readonly storageDir = path.join(process.cwd(), 'public/tryon-results');

    constructor(private readonly prisma: PrismaService) {
        this.ensureStorageDir();
    }

    private async ensureStorageDir() {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
        } catch (error) {
            this.logger.warn(`Failed to create storage directory: ${error.message}`);
        }
    }

    /**
     * Create virtual try-on session
     * Processes camera image with face detection and applies 3D model overlay
     */
    async createTryon(
        dto: CreateVirtualTryonDto,
        centreId?: string,
    ): Promise<VirtualTryonResultDto> {
        try {
            // Validate product exists
            const product = await this.prisma.produit.findUnique({
                where: { id: dto.productId },
            });

            if (!product) {
                throw new NotFoundException(`Product ${dto.productId} not found`);
            }

            // Validate centre_id for multi-tenancy
            const effectiveCentreId = centreId || dto.centreId;
            if (!effectiveCentreId) {
                throw new BadRequestException('centreId is required');
            }

            // Store camera image (Base64 → File)
            const imageFileName = await this.saveCameraImage(dto.cameraImage, effectiveCentreId);

            // Process face detection data (from frontend TensorFlow.js)
            const faceFrame = this.processFaceDetection(dto.faceDetectionData);

            // Generate try-on result (simulated 3D rendering)
            const resultImageUrl = await this.generateTryonResult(
                imageFileName,
                dto.model3DUrl,
                faceFrame,
            );

            // Calculate confidence score (0-100)
            const confidenceScore = this.calculateConfidence(faceFrame);

            // Store in database
            const tryon = await this.prisma.virtualTryon.create({
                data: {
                    productId: dto.productId,
                    clientId: dto.clientId,
                    centreId: effectiveCentreId,
                    cameraImageUrl: `/public/tryon-results/${imageFileName}`,
                    resultImageUrl: resultImageUrl,
                    confidenceScore: confidenceScore,
                    faceFrame: faceFrame,
                    productType: dto.productType || 'GLASSES',
                    notes: dto.notes,
                    tryonDuration: 0, // Updated by frontend
                },
            });

            return this.mapToDto(tryon);
        } catch (error) {
            this.logger.error(`Tryon creation failed: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get try-on history for client
     */
    async getClientHistory(clientId: string, centreId: string, limit = 10) {
        return this.prisma.virtualTryon.findMany({
            where: {
                clientId,
                centreId,
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                product: {
                    select: {
                        id: true,
                        nom: true,
                        prix: true,
                        image: true,
                    },
                },
            },
        });
    }

    /**
     * Get analytics for try-ons (centre dashboard)
     */
    async getAnalytics(centreId: string, startDate?: Date, endDate?: Date) {
        const where = { centreId };
        if (startDate && endDate) {
            Object.assign(where, {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            });
        }

        const totalTryons = await this.prisma.virtualTryon.count({ where });
        const avgConfidence = await this.prisma.virtualTryon.aggregate({
            where,
            _avg: { confidenceScore: true },
        });

        const byProductType = await this.prisma.virtualTryon.groupBy({
            by: ['productType'],
            where,
            _count: true,
            orderBy: { _count: { id: 'desc' } },
        });

        return {
            totalTryons,
            averageConfidence: avgConfidence._avg.confidenceScore || 0,
            byProductType,
            period: { startDate, endDate },
        };
    }

    /**
     * Save camera image from Base64
     */
    private async saveCameraImage(base64Data: string, centreId: string): Promise<string> {
        try {
            if (!base64Data) {
                throw new BadRequestException('Camera image is required');
            }

            const fileName = `${centreId}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
            const filePath = path.join(this.storageDir, fileName);

            // Extract base64 content (remove data URI header)
            const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
            const buffer = Buffer.from(base64Content, 'base64');

            await fs.writeFile(filePath, buffer);
            return fileName;
        } catch (error) {
            this.logger.error(`Failed to save camera image: ${error.message}`);
            throw new BadRequestException('Failed to process camera image');
        }
    }

    /**
     * Process face detection landmarks
     */
    private processFaceDetection(faceData: any): any {
        if (!faceData || !faceData.landmarks) {
            return null;
        }

        return {
            faceBox: faceData.faceBox || null,
            landmarks: faceData.landmarks,
            expressions: faceData.expressions || {},
            age: faceData.age || null,
            gender: faceData.gender || null,
            timestamp: new Date(),
        };
    }

    /**
     * Calculate confidence score based on face detection quality
     */
    private calculateConfidence(faceFrame: any): number {
        if (!faceFrame) return 0;

        let score = 100;

        // Penalize if landmarks are incomplete
        const expectedLandmarks = 68;
        const actualLandmarks = faceFrame.landmarks?.length || 0;
        if (actualLandmarks < expectedLandmarks) {
            score -= (expectedLandmarks - actualLandmarks) * 0.5;
        }

        // Penalize if expressions are uncertain
        const maxExpression = Math.max(...Object.values(faceFrame.expressions || {}));
        if (maxExpression < 0.5) {
            score -= 15;
        }

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Generate try-on result image (simulated 3D rendering)
     * In production: Use WebGL renderer or 3D service
     */
    private async generateTryonResult(
        imageFileName: string,
        model3DUrl: string,
        faceFrame: any,
    ): Promise<string> {
        try {
            // Simulated: In production, call WebGL/Three.js service or Babylon.js
            const resultFileName = `result-${Date.now()}.jpg`;
            const resultPath = path.join(this.storageDir, resultFileName);

            // For now, copy original image (placeholder)
            const sourcePath = path.join(this.storageDir, imageFileName);
            await fs.copyFile(sourcePath, resultPath);

            return `/public/tryon-results/${resultFileName}`;
        } catch (error) {
            this.logger.error(`Failed to generate try-on result: ${error.message}`);
            throw new BadRequestException('Failed to generate try-on result');
        }
    }

    /**
     * Delete try-on session
     */
    async deleteTryon(id: string, centreId: string) {
        const tryon = await this.prisma.virtualTryon.findUnique({
            where: { id },
        });

        if (!tryon) {
            throw new NotFoundException('Try-on not found');
        }

        if (tryon.centreId !== centreId) {
            throw new BadRequestException('Cannot delete try-on from another centre');
        }

        // Clean up image files
        if (tryon.cameraImageUrl) {
            await this.deleteImageFile(tryon.cameraImageUrl);
        }
        if (tryon.resultImageUrl) {
            await this.deleteImageFile(tryon.resultImageUrl);
        }

        await this.prisma.virtualTryon.delete({ where: { id } });
    }

    private async deleteImageFile(fileUrl: string) {
        try {
            const fileName = fileUrl.split('/').pop();
            const filePath = path.join(this.storageDir, fileName);
            await fs.unlink(filePath);
        } catch (error) {
            this.logger.warn(`Failed to delete image file: ${error.message}`);
        }
    }

    private mapToDto(tryon: any): VirtualTryonResultDto {
        return {
            id: tryon.id,
            productId: tryon.productId,
            clientId: tryon.clientId,
            centreId: tryon.centreId,
            resultImageUrl: tryon.resultImageUrl,
            confidenceScore: tryon.confidenceScore,
            faceFrame: tryon.faceFrame,
            tryonDuration: tryon.tryonDuration || 0,
            createdAt: tryon.createdAt,
            updatedAt: tryon.updatedAt,
        };
    }
}
