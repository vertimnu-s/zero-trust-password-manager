variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "enabled" {
  description = "Toggle CloudTrail on/off"
  type        = bool
  default     = true
}

variable "s3_log_retention_days" {
  type    = number
  default = 90
}
