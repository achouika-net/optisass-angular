import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Client;
  private bucket: string;
  private publicEndpoint: string;
  private minioReady = false;
  private localUploadDir = '/app/uploads';

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
    
    // Ensure local fallback directory exists
    if (!fs.existsSync(this.localUploadDir)) {
      try {
        fs.mkdirSync(this.localUploadDir, { recursive: true });
      } catch (e) {}
    }
  }

  async onModuleInit() {
    try {
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
      this.minioReady = true;
      console.log(`✅ MinIO storage ready — bucket: ${this.bucket}`);
    } catch (error) {
      this.minioReady = false;
      console.warn('⚠️ MinIO storage NOT ready (connection refused). Falling back to local filesystem in /app/uploads.');
    }
  }

  /**
   * Upload a buffer to MinIO (or fallback) and return the relative path.
   */
  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    fileName: string,
    contentType?: string,
  ): Promise<string> {
    const objectName = `${folder}/${fileName}`;
    
    if (this.minioReady) {
      await this.client.putObject(
        this.bucket,
        objectName,
        buffer,
        buffer.length,
        contentType ? { 'Content-Type': contentType } : undefined,
      );
    } else {
      // Local fallback
      const targetDir = path.join(this.localUploadDir, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(path.join(this.localUploadDir, objectName), buffer);
    }
    return `/uploads/${objectName}`;
  }

  /**
   * Upload a base64 encoded file
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
   */
  getPublicUrl(filePath: string): string {
    if (filePath.startsWith('http')) return filePath;
    const objectName = filePath.replace(/^\/uploads\//, '');
    
    if (this.minioReady) {
      return `${this.publicEndpoint}/${this.bucket}/${objectName}`;
    } else {
      return `http://localhost:3000/uploads/${objectName}`;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const objectName = filePath.replace(/^\/uploads\//, '');
    if (this.minioReady) {
      try {
        await this.client.removeObject(this.bucket, objectName);
      } catch (e) {}
    } else {
      const targetPath = path.join(this.localUploadDir, objectName);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    }
  }
}
