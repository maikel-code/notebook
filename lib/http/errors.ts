export const HTTP_STATUS = {
  unauthorized: 401,
  notFound: 404,
  conflict: 409,
  unprocessableContent: 422,
  badGateway: 502,
} as const

export class HttpError extends Error {
  constructor(
    readonly status: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS],
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = "HttpError"
  }
}

export function unauthorizedError(): HttpError {
  return new HttpError(HTTP_STATUS.unauthorized, "Anmeldung erforderlich.", "UNAUTHORIZED")
}

export function notFoundError(): HttpError {
  return new HttpError(HTTP_STATUS.notFound, "Eintrag nicht gefunden.", "NOT_FOUND")
}

export function conflictError(message: string): HttpError {
  return new HttpError(HTTP_STATUS.conflict, message, "CONFLICT")
}

export function validationError(message: string): HttpError {
  return new HttpError(HTTP_STATUS.unprocessableContent, message, "INVALID_INPUT")
}

export function providerError(): HttpError {
  return new HttpError(
    HTTP_STATUS.badGateway,
    "Der externe Dienst ist gerade nicht erreichbar.",
    "PROVIDER_UNAVAILABLE",
  )
}
