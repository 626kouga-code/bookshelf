terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# 認証情報は AWS CLI のプロファイル（既定: trello-app。タスク管理アプリと同じアカウント）を使う
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project = var.project_name
    }
  }
}
