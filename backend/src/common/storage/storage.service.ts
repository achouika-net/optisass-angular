import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Client;
  private bucket: string;
  private publicEndpoint: string;

  constructor() {
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = parseInt(process.env.MINIO_PORT || '9002', 10);
    const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
    const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
    this.bucket = process.env.MINIO_BUCKET || 'optisaas';
    this.publicEndpoint =
      process.env.MINIO_PUBLIC_URL || `http://${endPoint}:${port}`;

    this.client = new Client({
      endPoint,
      port,
      useSSL: false,
      accessKey,
      secretKey,
    });
  }

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      // Set public read policy so files are accessible without signing
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };
      await this.client.setBucketPolicy(
        this.bucket,
        JSON.stringify(policy),
      );
    }
    console.log(`✅ MinIO storage ready — bucket: ${this.bucket}`);
  }

  /**
   * Upload a buffer to MinIO and return the relative path.
   * The returned path starts with /uploads/ for backward compatibility
   * with the ServeStatic pattern used in the frontend.
   */
  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    fileName: string,
    contentType?: string,
  ): Promise<string> {
    const objectName = `${folder}/${fileName}`;
    await this.client.putObject(
      this.bucket,
      objectName,
      buffer,
      buffer.length,
      contentType ? { 'Content-Type': contentType } : undefined,
    );
    return `/uploads/${objectName}`;
  }

  /**
   * Upload a base64 encoded file (optionally with data URI prefix).
   * Returns the relative path /uploads/{folder}/{fileName}.
   */
  async uploadBase64(
    base64Data: string,
    folder: string,
    fileName: string,
  ): Promise<string> {
    const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    let contentType = 'application/octet-stream';
    let raw = base64Data;
    if (matches && matches.length === 3) {
      contentType = matches[1];
      raw = matches[2];
    } else {
      raw = base64Data.replace(/^data:.*?;base64,/, '');
    }
    const buffer = Buffer.from(raw, 'base64');
    return this.uploadBuffer(buffer, folder, fileName, contentType);
  }

  /**
   * Get the full public URL for a stored file path.
   * If the path is already absolute, return it as-is.
   */
  getPublicUrl(filePath: string): string {
    if (filePath.startsWith('http')) return filePath;
    // Strip leading /uploads/ to get the object name
    const objectName = filePath.replace(/^\/uploads\//, '');
    return `${this.publicEndpoint}/${this.bucket}/${objectName}`;
  }

  async deleteFile(filePath: string): Promise<void> {
    const objectName = filePath.replace(/^\/uploads\//, '');
    await this.client.removeObject(this.bucket, objectName);
  }
}
