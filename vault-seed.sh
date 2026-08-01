docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=root vault-test vault secrets enable -path=lifetracker kv-v2

docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=root vault-test vault kv put lifetracker/db \
  ADMIN_EMAIL="rajsheakharmishra001@gmail.com" \
  ADMIN_PASSWORD="Gen4_leader"

docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=root vault-test vault auth enable approle

docker exec -i -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=root vault-test vault policy write lifetracker-read - << 'EOF'
path "lifetracker/data/db" {
  capabilities = ["read"]
}
EOF

docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=root vault-test vault write auth/approle/role/lifetracker-app \
  token_policies="lifetracker-read" \
  token_ttl=1h \
  token_max_ttl=4h

docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=root vault-test vault read auth/approle/role/lifetracker-app/role-id

docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=root vault-test vault write -f auth/approle/role/lifetracker-app/secret-id
