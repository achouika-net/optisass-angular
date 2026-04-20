import { IsString, IsNumber, IsArray, IsOptional, IsUUID, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVirtualTryonDto {
    @IsUUID()
    productId: string;

    @IsString()
    @IsOptional()
    productName?: string;

    @IsNumber()
    @IsOptional()
    productPrice?: number;

    @IsString()
    @IsOptional()
    model3DUrl?: string;

    @IsArray()
    @IsOptional()
    textureUrls?: string[];

    @IsString()
    @IsOptional()
    cameraImage?: string; // Base64 encoded image

    @IsArray()
    @IsOptional()
    faceDetectionData?: any[]; // TensorFlow.js face detection output

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @IsEnum(['GLASSES', 'SUNGLASSES', 'CONTACT_LENS', 'FRAME', 'LENS'])
    @IsOptional()
    productType?: string;

    @IsString()
    @IsOptional()
    centreId?: string;

    @IsString()
    @IsOptional()
    clientId?: string;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class VirtualTryonResultDto {
    id: string;
    productId: string;
    clientId: string;
    centreId: string;
    resultImageUrl: string;
    confidenceScore: number;
    faceFrame: any;
    tryonDuration: number;
    createdAt: Date;
    updatedAt: Date;
}
