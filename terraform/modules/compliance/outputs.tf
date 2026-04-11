output "security_hub_id" {
  value = var.enabled ? aws_securityhub_account.main[0].id : null
}

output "config_recorder_id" {
  value = var.enabled ? aws_config_configuration_recorder.main[0].id : null
}
