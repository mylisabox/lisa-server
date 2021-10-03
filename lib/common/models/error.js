
class ServiceError {
  constructor(status, errorCode, message, error) {
    this.name = 'ServiceError';
    this.status = status;
    this.errorCode = errorCode;
    this.message = message;
    this.error = error;
  }
}

class ForbiddenError extends ServiceError {
  constructor(message, error) {
    super(403, '403', message || 'Forbidden', error);
  }
}

class UnauthorizedError extends ServiceError {
  constructor(message, error) {
    super(401, '401', message || 'Unauthorized', error);
  }
}

class PayloadError extends ServiceError {
  constructor(message, error) {
    super(400, '400', message || 'Payload incorrect', error);
  }
}

class NotFoundError extends ServiceError {
  constructor(message, error) {
    super(404, '404', message || 'Resource not found', error);
  }
}

export {ServiceError, UnauthorizedError, ForbiddenError, PayloadError, NotFoundError};
