# Cognito Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "password_min_length" {
  description = "Minimum password length"
  type        = number
  default     = 12
}

variable "mfa_enabled" {
  description = "Enable MFA for user pool"
  type        = bool
  default     = true
}

variable "enable_passkeys" {
  description = "Enable passkeys (FIDO2) for user pool"
  type        = bool
  default     = true
}

variable "required_attributes" {
  description = "Required attributes for user registration"
  type        = list(string)
  default     = ["email", "preferred_username"]
}
