resource "aws_accessanalyzer_analyzer" "main" {
  count = var.enabled ? 1 : 0

  analyzer_name = "${var.project_name}-analyzer-${var.environment}"
  type          = "ACCOUNT"

  tags = {
    Name = "${var.project_name}-access-analyzer-${var.environment}"
  }
}
