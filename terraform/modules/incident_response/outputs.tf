output "lambda_function_arn" {
  value = var.enabled ? aws_lambda_function.remediation[0].arn : null
}

output "lambda_function_name" {
  value = var.enabled ? aws_lambda_function.remediation[0].function_name : null
}

output "waf_ip_set_arn" {
  value = var.enabled ? aws_wafv2_ip_set.blocked_ips[0].arn : null
}

output "enabled" {
  value = var.enabled
}
