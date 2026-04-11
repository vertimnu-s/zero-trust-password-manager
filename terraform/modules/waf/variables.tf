variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "enabled" {
  description = "Toggle WAF + CloudFront on/off"
  type        = bool
  default     = true
}

variable "api_gateway_endpoint" {
  description = "API Gateway endpoint URL (without stage path)"
  type        = string
}

variable "api_gateway_stage_name" {
  type    = string
}

variable "rate_limit_per_ip" {
  description = "Max requests per 5-minute window per IP"
  type        = number
  default     = 2000
}

variable "frontend_origin" {
  type = string
}

variable "enable_logging" {
  type    = bool
  default = true
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "blocked_ip_set_arn" {
  description = "ARN of the WAF IP set for dynamically blocked IPs (from incident response)"
  type        = string
  default     = null
}
