output "trail_arn" {
  value = var.enabled ? aws_cloudtrail.main[0].arn : null
}

output "trail_s3_bucket" {
  value = var.enabled ? aws_s3_bucket.trail_logs[0].id : null
}

output "enabled" {
  value = var.enabled
}
