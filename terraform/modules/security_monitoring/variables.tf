variable "enable_runtime_monitoring" {
  description = "Enable GuardDuty runtime monitoring"
  type        = bool
  default     = true
}
variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "enabled" {
  description = "Toggle GuardDuty + SNS alerts on/off"
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Email to receive security alerts"
  type        = string
}
