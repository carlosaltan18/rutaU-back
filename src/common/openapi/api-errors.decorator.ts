import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiProperty,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

class ApiFieldErrorDto {
  @ApiProperty({ example: 'travelDate' })
  field: string;

  @ApiProperty({ example: 'La fecha no es válida.' })
  message: string;
}

class ApiErrorDto {
  @ApiProperty({ example: 'NO_SEATS_AVAILABLE' })
  code: string;

  @ApiProperty({ example: 'No quedan plazas para esa fecha.' })
  message: string;

  @ApiProperty({ type: [ApiFieldErrorDto] })
  fieldErrors: ApiFieldErrorDto[];

  @ApiProperty({ format: 'uuid' })
  requestId: string;
}

export class ApiErrorEnvelopeDto {
  @ApiProperty({ type: ApiErrorDto })
  error: ApiErrorDto;
}

export function ApiStandardErrors() {
  return applyDecorators(
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR',
      type: ApiErrorEnvelopeDto,
    }),
    ApiUnauthorizedResponse({
      description: 'UNAUTHENTICATED',
      type: ApiErrorEnvelopeDto,
    }),
    ApiForbiddenResponse({
      description: 'FORBIDDEN',
      type: ApiErrorEnvelopeDto,
    }),
    ApiNotFoundResponse({
      description: 'Recurso inexistente o no visible',
      type: ApiErrorEnvelopeDto,
    }),
    ApiConflictResponse({
      description:
        'REQUEST_ALREADY_EXISTS, REQUEST_NOT_PENDING, NO_LONGER_COMPATIBLE, NO_SEATS_AVAILABLE o conflicto de versión',
      type: ApiErrorEnvelopeDto,
    }),
    ApiUnprocessableEntityResponse({
      description: 'TRAVEL_DATE_DAY_MISMATCH o PRICE_REFERENCE_UNAVAILABLE',
      type: ApiErrorEnvelopeDto,
    }),
    ApiTooManyRequestsResponse({
      description: 'RATE_LIMITED',
      type: ApiErrorEnvelopeDto,
    }),
    ApiInternalServerErrorResponse({
      description: 'INTERNAL_ERROR sin detalles internos',
      type: ApiErrorEnvelopeDto,
    }),
  );
}
