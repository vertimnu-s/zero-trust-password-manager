output "dynamodb_key_arn" {
  value = var.enabled ? aws_kms_key.dynamodb[0].arn : null
}

output "s3_key_arn" {
  value = var.enabled ? aws_kms_key.s3[0].arn : null
}

output "dynamodb_key_id" {
  value = var.enabled ? aws_kms_key.dynamodb[0].key_id : null
}

output "s3_key_id" {
  value = var.enabled ? aws_kms_key.s3[0].key_id : null
}
