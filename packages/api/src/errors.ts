export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request') {
    super(400, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}
