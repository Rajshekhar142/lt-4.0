module "ec2" {
  source = "./modules/ec2"

  environment = var.environment
  subnet_id   = var.subnet_id
}
