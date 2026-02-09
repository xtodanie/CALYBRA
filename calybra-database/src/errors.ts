/**
 * @fileoverview Centralized error classes for the application backend.
 */

/**
 * Thrown when incoming data fails schema validation.
 * Contains structured details about the validation failure.
 */
export class ValidationError extends Error {
  public issues: any[];

  constructor(message: string, issues: any[] = []) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/**
 * Thrown when an operation is forbidden due to business logic or permissions,
 * distinct from authentication failures.
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
