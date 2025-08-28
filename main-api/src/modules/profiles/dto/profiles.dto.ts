import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUUID,
  IsUrl,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  age?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  job?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  school?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;
}

export class PersonalityAnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textAnswer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  numericAnswer?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  booleanAnswer?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  multipleChoiceAnswer?: string[];
}

export class SubmitPersonalityAnswersDto {
  @ApiProperty({ type: [PersonalityAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonalityAnswerDto)
  @ArrayMinSize(1)
  answers: PersonalityAnswerDto[];
}

export class PhotoDto {
  @ApiProperty()
  @IsUrl()
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}

export class UploadPhotosDto {
  @ApiProperty({ type: [PhotoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  @ArrayMinSize(1)
  photos: PhotoDto[];
}

export class PromptAnswerDto {
  @ApiProperty()
  @IsUUID()
  promptId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  answer: string;
}

export class SubmitPromptAnswersDto {
  @ApiProperty({ type: [PromptAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptAnswerDto)
  @ArrayMinSize(3)
  answers: PromptAnswerDto[];
}
