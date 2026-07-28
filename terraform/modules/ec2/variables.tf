variable "environment" {
  type        = string
  description = "the env for deployment"
}

variable "subnet_id" {
  type        = string
  description = "Subnet ID where the EC2 instance will be deployed"
}
