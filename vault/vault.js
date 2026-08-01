// vault.js

async function loadSecrets() {
  const loginRes = await fetch(`${process.env.VAULT_ADDR}/v1/auth/approle/login`, {
    method: 'POST',
    body: JSON.stringify({
      role_id: process.env.VAULT_ROLE_ID,
      secret_id: process.env.VAULT_SECRET_ID,
    }),
  });
  if (!loginRes.ok) throw new Error(`Vault login failed: ${loginRes.status}`);
  const { auth } = await loginRes.json();
  const clientToken = auth.client_token;

  const secretRes = await fetch(`${process.env.VAULT_ADDR}/v1/lifetracker/data/db`, {
    headers: { 'X-Vault-Token': clientToken },
  });
  const { data } = await secretRes.json();
  return data.data; // { DATABASE_URL: "postgres://..." }
}

module.exports = { loadSecrets };
