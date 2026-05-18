import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('storage.bucket') || '';
    this.cdnUrl = this.configService.get<string>('storage.cdnUrl') || '';

    this.s3Client = new S3Client({
      region: this.configService.get<string>('storage.region') || 'eu-west-3',
      credentials: {
        accessKeyId: this.configService.get<string>('storage.accessKeyId') || '',
        secretAccessKey: this.configService.get<string>('storage.secretAccessKey') || '',
      },
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const key = `${folder}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: Readable.from(file.buffer),
        ContentType: file.mimetype,
        // Objets privés par défaut — URL signées pour l'accès public via CDN
      },
    });

    await upload.done();

    this.logger.log(`Fichier uploadé sur S3: ${key}`);

    return this.cdnUrl ? `${this.cdnUrl}/${key}` : `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    const key = this.extractKeyFromUrl(fileUrl);
    if (!key) return;

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.log(`Fichier supprimé de S3: ${key}`);
    } catch (error) {
      this.logger.error(`Erreur suppression S3 ${key}:`, error);
    }
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      if (this.cdnUrl && url.startsWith(this.cdnUrl)) {
        return url.replace(`${this.cdnUrl}/`, '');
      }
      const urlObj = new URL(url);
      return urlObj.pathname.replace(/^\//, '');
    } catch {
      return null;
    }
  }
}
