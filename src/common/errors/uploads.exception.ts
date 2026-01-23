import { BadRequestException, ConflictException } from '@nestjs/common';

export class UploadTokenInvalidException extends BadRequestException {
  constructor() {
    super({ code: 'UPLOAD_TOKEN_INVALID' });
  }
}

export class UploadNotFoundException extends BadRequestException {
  constructor() {
    super({ code: 'UPLOAD_NOT_FOUND' });
  }
}

export class UploadConflictException extends ConflictException {
  constructor(message = 'UPLOAD_CONFLICT') {
    super({ code: message });
  }
}
