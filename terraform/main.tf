module "ec2" {
  source = "./modules/ec2"

  environment = var.environment
  subnet_id   = var.subnet_id
}

module "cicd" {
  source = "./modules/cicd"

  aws_region            = "us-east-1"
  github_repo_owner     = var.github_repo_owner
  github_repo_name      = var.github_repo_name
  artifact_bucket_name  = var.artifact_bucket_name
  ec2_instance_id       = module.ec2.instance_id
}