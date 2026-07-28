# AWS EC2 Infrastructure as Code (Terraform)

This repository manages the single-node infrastructure for the **Lifetracker** application using Terraform. It captures an existing, manually provisioned AWS EC2 instance and brings it under Infrastructure as Code (IaC) control without downtime or replacement.

---

## 🛠 Tech Stack & Architecture

- **Cloud Provider:** AWS (`us-east-1`)
- **Infrastructure Tool:** Terraform (AWS Provider `~> 5.0`)
- **Compute:** EC2 (`t3.micro`, Ubuntu 24.04 LTS)
- **Application Stack:** Node.js 22, PM2, Nginx Reverse Proxy (Port 80 ➔ 3000)
- **Networking:** Custom VPC (`vpc-0fa253c1f06deb346`) and Subnet (`subnet-07777b52a2c3d5de9`)

---

## 📁 Repository Structure

```text
.
├── main.tf              # Root Terraform configuration calling modules
├── variables.tf         # Global input variables (region, environment)
├── outputs.tf           # Infrastructure outputs (instance_id, public_ip)
├── terraform.tfstate    # State file tracking managed resources
└── modules/
    └── ec2/
        ├── main.tf      # EC2 module implementation
        ├── variables.tf # Module input variables
        ├── outputs.tf   # Module outputs
	
	configs/
        	├── user_data.sh # Server bootstrap & application setup script
        	└── nginx.conf   # Nginx reverse proxy configuration
