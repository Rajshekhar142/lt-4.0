variable "environment" {
  type    = string
  default = "dev"
}

variable "subnet_id" {
  type    = string
  default = "subnet-07777b52a2c3d5de9"
}

variable "github_repo_owner" {
  type = string
}

variable "github_repo_name" {
  type = string
}

variable "artifact_bucket_name" {
  type = string
}