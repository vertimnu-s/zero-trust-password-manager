/**
 * Password validation to match Cognito password policy
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character/symbol
 */

export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export const validatePassword = (password: string): PasswordValidation => {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push("At least 12 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("At least one uppercase letter (A-Z)");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("At least one lowercase letter (a-z)");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("At least one number (0-9)");
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push("At least one special character (e.g., !@#$%^&*)");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
