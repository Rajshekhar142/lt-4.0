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
  # Fix 3: Disk-full killed the DB once already (WAL growth + npm/build
  # artifacts + system updates ate the original ~8GB root volume with no
  # headroom). Bumping to 20GB on gp3 buys real margin so this class of
  # incident can't repeat. ~$1.60/month extra — cheap insurance for an
  # app that has to stay up daily.
  root_block_device = {
      volume_size = 20
      volume_type = "gp3"
    }
  

  tags = {
    Terraform   = "true"
    Environment = var.environment
  }
}
