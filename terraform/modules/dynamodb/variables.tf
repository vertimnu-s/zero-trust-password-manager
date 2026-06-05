variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "billing_mode" {
  description = "Billing mode for DynamoDB (PAY_PER_REQUEST or PROVISIONED)"
  type        = string
  default     = "PAY_PER_REQUEST"
  
  validation {
    condition     = contains(["PAY_PER_REQUEST", "PROVISIONED"], var.billing_mode)
    error_message = "Billing mode must be either PAY_PER_REQUEST or PROVISIONED."
  }
}

variable "point_in_time_recovery" {
  description = "Enable point-in-time recovery (PITR) for data protection"
  type        = bool
  default     = true
}

variable "enable_encryption" {
  description = "Enable encryption at rest using AWS managed keys"
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "KMS CMK ARN for server-side encryption (null = AWS managed key)"
  type        = string
  default     = null
}

variable "enable_stream" {
  description = "Enable DynamoDB Streams for capturing changes"
  type        = bool
  default     = false  # Can enable later if you want change data capture
}
