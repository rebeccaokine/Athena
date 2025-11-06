variable "project_name" {
  type    = string
  default = "athena"
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "openai_api_key" {
  type      = string
  default   = ""
  sensitive = true
}
