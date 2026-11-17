export class DomainError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'DOMAIN_ERROR', statusCode = 422) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class TableCapacityExceededError extends DomainError {
  public readonly tableNumber: number;
  public readonly requestedSeats: number;
  public readonly availableSeats: number;

  constructor(tableNumber: number, requestedSeats: number, availableSeats: number) {
    super(
      `La Mesa ${tableNumber} no tiene cupo suficiente: solicita ${requestedSeats} asiento(s) y solo quedan ${availableSeats} disponibles`,
      'TABLE_CAPACITY_EXCEEDED',
      422
    );
    this.tableNumber = tableNumber;
    this.requestedSeats = requestedSeats;
    this.availableSeats = availableSeats;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'No autorizado o sesión expirada') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Acceso denegado para el rol actual') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}
