data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  owners = ["099720109477"] # Canonical
}

module "ec2_instance" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "6.4.0"

  # Match live server Name tag
  name = "lifetracker"

  # Fix 1: Hardcode exact AMI currently on live box to stop replacement
  ami = "ami-0b6d9d3d33ba97d99"

  instance_type = "t3.micro"
  key_name      = "lifetracker-api"

  # Fix 2: Disable creating a brand new SG, attach the existing one
  create_security_group = false
  vpc_security_group_ids = ["sg-04612c3c3b38f321f"]
  user_data = file("${path.module}/configs/user_data.sh")
  monitoring = false # Change to false if your live server doesn't have detailed monitoring
  subnet_id  = var.subnet_id

  tags = {
    Terraform   = "true"
    Environment = var.environment
  }
}
