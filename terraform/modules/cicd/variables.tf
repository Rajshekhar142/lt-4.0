variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-south-1"
}

variable "github_repo_owner" {
  description = "GitHub username or org that owns the repo"
  type        = string
}

variable "github_repo_name" {
  description = "GitHub repository name"
  type        = string
}

variable "github_branch" {
  description = "Branch this deploy role should be trusted for"
  type        = string
  default     = "tdevops"
}

variable "artifact_bucket_name" {
  description = "S3 bucket used as the hand-off point for build artifacts (must be globally unique)"
  type        = string
}

variable "ec2_instance_arn" {
  description = "ARN of the EC2 instance the deploy role is allowed to SSM into. Use * to scope by tag instead (see ssm policy)."
  type        = string
}
