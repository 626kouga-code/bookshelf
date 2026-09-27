variable "aws_region" {
  description = "デプロイ先のAWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "aws_profile" {
  description = "AWS CLI のプロファイル名"
  type        = string
  default     = "trello-app"
}

variable "project_name" {
  description = "リソース名のプレフィックス"
  type        = string
  default     = "reading-app"
}

variable "instance_type" {
  description = "EC2のインスタンスタイプ。無料枠の対象で最も安い t4g.micro（ARM）。対象は `aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true` で確認できる"
  type        = string
  default     = "t4g.micro"
}

variable "root_volume_size" {
  description = "ルートボリュームのサイズ（GB）。Amazon Linux 2023 のAMIは8GBなので、それ以上にする"
  type        = number
  default     = 10
}

variable "my_ip_cidr" {
  description = "SSH（22）とアプリ（443）への接続を許可する自分のグローバルIP（例: 203.0.113.10/32）。IPが変わったら直して terraform apply し直す"
  type        = string

  validation {
    condition     = can(cidrhost(var.my_ip_cidr, 0)) && endswith(var.my_ip_cidr, "/32")
    error_message = "my_ip_cidr は「IPアドレス/32」の形式で指定してください（例: 203.0.113.10/32）。"
  }
}

variable "ssh_public_key_path" {
  description = "EC2に登録するSSH公開鍵のパス（秘密鍵は手元にだけ置く）"
  type        = string
  default     = "../reading-app-key.pub"
}

variable "budget_limit_usd" {
  description = "課金アラートの月額の上限（USD）。クレジットで支払われる分も含めて、使った金額がこの額に近づくとメールで知らせる"
  type        = number
  default     = 20
}

variable "budget_email" {
  description = "課金アラートの通知先メールアドレス"
  type        = string
}
