/**
 * Error classes for FHEVM SDK
 * Centralized error handling for better debugging
 */

/**
 * Base error class for FHEVM SDK
 */
export class FhevmError extends Error {
  public readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FhevmError";
    this.code = code;
  }
}

/**
 * Error thrown when operation is cancelled
 */
export class FhevmAbortError extends FhevmError {
  constructor(message: string = "Operation was cancelled") {
    super("ABORT", message);
    this.name = "FhevmAbortError";
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class FhevmConfigError extends FhevmError {
  constructor(message: string) {
    super("CONFIG_ERROR", message);
    this.name = "FhevmConfigError";
  }
}

/**
 * Error thrown when instance creation fails
 */
export class FhevmInstanceError extends FhevmError {
  constructor(message: string, cause?: unknown) {
    super("INSTANCE_ERROR", message, cause ? { cause } : undefined);
    this.name = "FhevmInstanceError";
  }
}

/**
 * Error thrown when encryption fails
 */
export class FhevmEncryptionError extends FhevmError {
  constructor(message: string, cause?: unknown) {
    super("ENCRYPTION_ERROR", message, cause ? { cause } : undefined);
    this.name = "FhevmEncryptionError";
  }
}

/**
 * Error thrown when decryption fails
 */
export class FhevmDecryptionError extends FhevmError {
  constructor(message: string, cause?: unknown) {
    super("DECRYPTION_ERROR", message, cause ? { cause } : undefined);
    this.name = "FhevmDecryptionError";
  }
}

/**
 * Error thrown when signature creation fails
 */
export class FhevmSignatureError extends FhevmError {
  constructor(message: string, cause?: unknown) {
    super("SIGNATURE_ERROR", message, cause ? { cause } : undefined);
    this.name = "FhevmSignatureError";
  }
}

/**
 * Error thrown when network connection fails
 */
export class FhevmNetworkError extends FhevmError {
  constructor(message: string, cause?: unknown) {
    super("NETWORK_ERROR", message, cause ? { cause } : undefined);
    this.name = "FhevmNetworkError";
  }
}

