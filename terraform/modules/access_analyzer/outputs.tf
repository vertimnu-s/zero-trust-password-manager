output "analyzer_arn" {
  value = var.enabled ? aws_accessanalyzer_analyzer.main[0].arn : null
}
