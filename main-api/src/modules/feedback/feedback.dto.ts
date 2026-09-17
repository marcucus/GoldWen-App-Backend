import { IsIn, IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min, Max, IsObject } from 'class-validator';
export class CreateFeedbackDto {
  @IsIn(['bug', 'feature', 'general']) type: string;
  @IsString() @IsNotEmpty() @MaxLength(100) subject: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) message: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
