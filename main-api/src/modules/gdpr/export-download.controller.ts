import { Controller, Get, Param, Query, Res, ParseUUIDPipe } from '@nestjs/common';
import type { Response } from 'express';
import { DataExportService } from './data-export.service';
@Controller('exports')
export class ExportDownloadController {
  constructor(private readonly exports: DataExportService) {}
  @Get(':requestId/download')
  async download(@Param('requestId', ParseUUIDPipe) requestId: string, @Query('expires') expires: string,
    @Query('signature') signature: string, @Res() response: Response) {
    const file = await this.exports.download(requestId, expires, signature);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Content-Disposition', 'attachment; filename="goldwen-data.json"');
    response.send(file);
  }
}
