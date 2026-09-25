// vault.js
import {SSMClient, GetParameterCommand} from "@aws-sdk/client-ssm"

const client = new SSMClient({ region: "us-east-1" });

export async function loadSecrets() {
  const res = await client.send(new GetParameterCommand({
    Name: "/lifetracker/prod/creds",
    WithDecryption: true
  }));

  return JSON.parse(res.Parameter.Value);
}
