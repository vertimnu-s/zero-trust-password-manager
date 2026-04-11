output "web_acl_arn" {
  value = var.enabled ? aws_wafv2_web_acl.api_protection[0].arn : null
}

output "web_acl_name" {
  value = var.enabled ? aws_wafv2_web_acl.api_protection[0].name : null
}

output "cloudfront_distribution_id" {
  value = var.enabled ? aws_cloudfront_distribution.api_distribution[0].id : null
}

output "cloudfront_api_endpoint" {
  description = "WAF-protected API endpoint (use as VITE_API_URL in production)"
  value       = var.enabled ? "https://${aws_cloudfront_distribution.api_distribution[0].domain_name}" : null
}

output "waf_log_group_name" {
  value = var.enabled && var.enable_logging ? aws_cloudwatch_log_group.waf_logs[0].name : null
}

output "enabled" {
  value = var.enabled
}
