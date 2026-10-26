export class HttpError extends Error {
  constructor(status, code, message, issues) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export const unavailable = () => new HttpError(503, 'CMS_UNAVAILABLE', 'Turinio valdymas laikinai nepasiekiamas. Pabandykite vėliau.');
