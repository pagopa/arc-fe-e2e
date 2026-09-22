locals {
  # Common Tags:
  common_tags = {
    CreatedBy   = "Terraform"
    Environment = var.env
    Owner       = upper(var.prefix)
    Source      = "https://github.com/pagopa/arpu-fe-e2e" # Repository URL
    CostCenter  = "TS310 - PAGAMENTI & SERVIZI"
  }

  # Repo
  github = {
    org        = "pagopa"
    repository = "arpu-fe-e2e"
  }

  env_secrets   = {}
  env_variables = {}

  repo_secrets = var.env_short == "p" ? {
    USER_USERNAME_DEV = data.azurerm_key_vault_secret.arpu_fe_e2e_test_user[0].value
    USER_PASSWORD_DEV = data.azurerm_key_vault_secret.arpu_fe_e2e_test_password[0].value
    USER_USERNAME_UAT = data.azurerm_key_vault_secret.arpu_fe_e2e_test_user[0].value
    USER_PASSWORD_UAT = data.azurerm_key_vault_secret.arpu_fe_e2e_test_password[0].value
  } : {}

  repo_env = var.env_short == "p" ? {} : {}

  map_repo = {
    "dev" : "*",
    "uat" : "uat"
    "prod" : "main"
  }
}
