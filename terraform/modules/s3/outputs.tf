# S3 Module Outputs

output "audit_logs_bucket_name" {
  description = "Name of the S3 bucket for audit logs"
  value       = aws_s3_bucket.audit_logs.id
}

output "audit_logs_bucket_arn" {
  description = "ARN of the S3 audit logs bucket"
  value       = aws_s3_bucket.audit_logs.arn
}

output "audit_logs_bucket_region" {
  description = "AWS region where the S3 bucket is located"
  value       = aws_s3_bucket.audit_logs.region
}
