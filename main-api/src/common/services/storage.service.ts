import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl: string;
  private readonly isS3Configured: boolean;
  private readonly localUploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('storage.bucket') || '';
    this.cdnUrl = this.configService.get<string>('storage.cdnUrl') || '';
    const accessKeyId = this.configService.get<string>('storage.accessKeyId') || '';
    const secretAccessKey = this.configService.get<string>('storage.secretAccessKey') || '';

    this.isS3Configured = !!(this.bucket && accessKeyId && secretAccessKey);

    this.s3Client = new S3Client({
      region: this.configService.get<string>('storage.region') || 'eu-west-3',
      credentials: { accessKeyId, secretAccessKey },
    });

    this.localUploadDir = path.join(process.cwd(), 'uploads');

    if (!this.isS3Configured) {
      this.logger.warn('S3 not configured — using local disk storage (dev only)');
      fs.mkdirSync(this.localUploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    if (!this.isS3Configured) {
      return this.uploadLocal(file, folder);
    }
    return this.uploadS3(file, folder);
  }

  private async uploadS3(file: Express.Multer.File, folder: string): Promise<string> {
    const key = `${folder}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: Readable.from(file.buffer),
        ContentType: file.mimetype,
      },
    });

    await upload.done();
    this.logger.log(`Fichier uploadé sur S3: ${key}`);
    return this.cdnUrl ? `${this.cdnUrl}/${key}` : `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  private uploadLocal(file: Express.Multer.File, folder: string): string {
    const dir = path.join(this.localUploadDir, folder);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, file.buffer);

    const port = this.configService.get<number>('app.port') || 3000;
    const appUrl = this.configService.get<string>('app.url') || `http://localhost:${port}`;
    const url = `${appUrl}/uploads/${folder}/${filename}`;
    this.logger.log(`Fichier sauvegardé localement: ${url}`);
    return url;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!this.isS3Configured) {
      this.deleteLocal(fileUrl);
      return;
    }

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

  private deleteLocal(fileUrl: string): void {
    try {
      const url = new URL(fileUrl);
      const uploadsRoot = path.resolve(process.cwd(), 'uploads');
      // SECURITY (Phase 0.9): url.pathname is attacker-influenced (it comes
      // from a stored file URL that, depending on how it got there, may not
      // be one we generated ourselves). path.join() does NOT stop ".."
      // segments from escaping uploadsRoot — resolve the final path and
      // verify it is still inside uploadsRoot before touching the
      // filesystem, otherwise a crafted URL like
      // ".../uploads/../../../../etc/passwd" could delete arbitrary files.
      const resolved = path.resolve(
        path.join(uploadsRoot, url.pathname.replace(/^\/uploads\//, '')),
      );

      if (
        resolved !== uploadsRoot &&
        !resolved.startsWith(uploadsRoot + path.sep)
      ) {
        this.logger.warn(
          `Refus de suppression hors du dossier uploads: ${fileUrl}`,
        );
        return;
      }

      if (fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
        this.logger.log(`Fichier local supprimé: ${resolved}`);
      }
    } catch {
      // ignore
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
