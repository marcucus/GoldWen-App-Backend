import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
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
    const accessKeyId =
      this.configService.get<string>('storage.accessKeyId') || '';
    const secretAccessKey =
      this.configService.get<string>('storage.secretAccessKey') || '';

    this.isS3Configured =
      this.configService.get<string>('storage.provider') === 's3';
    if (this.isS3Configured && !this.bucket)
      throw new Error('S3_BUCKET is required for S3 storage');

    this.s3Client = new S3Client({
      region: this.configService.get<string>('storage.region') || 'eu-west-3',
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });

    this.localUploadDir = path.resolve(
      process.cwd(),
      this.configService.get<string>('fileUpload.uploadDir') || 'uploads',
    );

    if (!this.isS3Configured) {
      this.logger.warn(
        'S3 not configured — using local disk storage (dev only)',
      );
      fs.mkdirSync(this.localUploadDir, { recursive: true });
    }
  }

  private privateExportPath(key: string): string {
    if (!/^exports\/[a-f0-9-]+\.json$/.test(key))
      throw new Error('Invalid export key');
    return path.join(process.cwd(), '.private-exports', path.basename(key));
  }

  async uploadPrivateExport(key: string, content: Buffer): Promise<void> {
    const filename = this.privateExportPath(key);
    if (this.isS3Configured) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: content,
          ContentType: 'application/json',
        }),
      );
    } else {
      fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
      fs.writeFileSync(filename, content, { mode: 0o600 });
    }
  }

  async readPrivateExport(key: string): Promise<Buffer> {
    const filename = this.privateExportPath(key);
    if (!this.isS3Configured) return fs.promises.readFile(filename);
    const response = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) throw new Error('Export file not found');
    return Buffer.from(await response.Body.transformToByteArray());
  }

  /**
   * Politique de rétention : un export de données GDPR n'est plus
   * accessible au téléchargement après 7 jours (voir DataExportRequest
   * .expiresAt) ; ce fichier doit alors être effacé du stockage pour ne
   * pas conserver de copie "orpheline" indéfiniment.
   */
  async deletePrivateExport(key: string): Promise<void> {
    const filename = this.privateExportPath(key);
    if (this.isS3Configured) {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return;
    }
    await fs.promises.rm(filename, { force: true });
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    if (!this.isS3Configured) {
      return this.uploadLocal(file, folder);
    }
    return this.uploadS3(file, folder);
  }

  private async uploadS3(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
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
    return this.cdnUrl
      ? `${this.cdnUrl}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  private uploadLocal(file: Express.Multer.File, folder: string): string {
    const dir = path.join(this.localUploadDir, folder);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, file.buffer);

    const port = this.configService.get<number>('app.port') || 3000;
    const appUrl =
      this.configService.get<string>('app.url') || `http://localhost:${port}`;
    const url = `${appUrl}/uploads/${folder}/${filename}`;
    this.logger.log(`Fichier sauvegardé localement: ${url}`);
    return url;
  }

  async deleteFile(fileUrl: string, strict = false): Promise<void> {
    if (!this.isS3Configured) {
      this.deleteLocal(fileUrl, strict);
      return;
    }

    const key = this.extractKeyFromUrl(fileUrl);
    if (!key) {
      if (strict) throw new Error('Invalid file URL');
      return;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.log(`Fichier supprimé de S3: ${key}`);
    } catch (error: unknown) {
      this.logger.error(`Erreur suppression S3 ${key}:`, error);
      if (strict) throw error;
    }
  }

  private deleteLocal(fileUrl: string, strict = false): void {
    try {
      const url = new URL(fileUrl);
      const uploadsRoot = this.localUploadDir;
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
        if (strict) throw new Error('File path outside uploads');
        return;
      }

      if (fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
        this.logger.log(`Fichier local supprimé: ${resolved}`);
      }
    } catch (error) {
      if (strict) throw error;
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
