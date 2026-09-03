# Github
data "github_organization_teams" "all" {
  root_teams_only = true
  summary_only    = true
}

# KV Core
data "azurerm_key_vault" "key_vault_core" {
  name                = "${var.prefix}-${var.env_short}-${var.location_short}-core-kv"
  resource_group_name = "${var.prefix}-${var.env_short}-${var.location_short}-core-sec-rg"
}

# Kv Domain
data "azurerm_key_vault" "key_vault_domain" {
  name                = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}-kv"
  resource_group_name = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}-sec-rg"
}

# Key Vault - Slack webhook
data "azurerm_key_vault_secret" "slack_webhook" {
  count = var.env_short == "p" ? 1 : 0

  key_vault_id = data.azurerm_key_vault.key_vault_core.id
  name         = "slack-webhook-url"
}

# Key Vault - User for E2E test
data "azurerm_key_vault_secret" "arpu_fe_e2e_test_user" {
  count = var.env_short == "p" ? 1 : 0

  key_vault_id = data.azurerm_key_vault.key_vault_domain.id
  name         = "testing-username"
}

# Key Vault - Password for E2E test
data "azurerm_key_vault_secret" "arpu_fe_e2e_test_password" {
  count = var.env_short == "p" ? 1 : 0

  key_vault_id = data.azurerm_key_vault.key_vault_domain.id
  name         = "testing-password"
}
