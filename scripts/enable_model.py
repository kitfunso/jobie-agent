"""Enable a Bedrock model for this account: accept its Marketplace offer, wait for it, then make one 5-token call.

Usage from the repo root: .venv\\Scripts\\python.exe scripts\\enable_model.py [model_id] [inference_profile_id]
Defaults to anthropic.claude-sonnet-5 and global.anthropic.claude-sonnet-5. Reads AWS_BEARER_TOKEN_BEDROCK from .env.
"""
import json
import os
import sys
import time
from pathlib import Path

import boto3
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
if not os.environ.get("AWS_BEARER_TOKEN_BEDROCK"):
    sys.exit("AWS_BEARER_TOKEN_BEDROCK is not set in .env")
region = os.environ.get("AWS_REGION", "us-east-1")
model = sys.argv[1] if len(sys.argv) > 1 else "anthropic.claude-sonnet-5"
profile = sys.argv[2] if len(sys.argv) > 2 else "global." + model
br = boto3.client("bedrock", region_name=region)


def availability() -> dict:
    r = br.get_foundation_model_availability(modelId=model)
    r.pop("ResponseMetadata", None)
    return r


print("before:", json.dumps(availability(), default=str))
offers = br.list_foundation_model_agreement_offers(modelId=model)
tokens = [o["offerToken"] for o in offers.get("offers", [])]
if not tokens:
    sys.exit("Bedrock lists no offer for this model, so there is nothing to accept")
if availability()["agreementAvailability"]["status"] != "AVAILABLE":
    r = br.create_foundation_model_agreement(modelId=model, offerToken=tokens[0])
    r.pop("ResponseMetadata", None)
    print("agreement requested:", r, flush=True)
for elapsed in range(0, 180, 5):
    status = availability()["agreementAvailability"]
    print(f"[{elapsed}s] agreement={status}", flush=True)
    if status["status"] == "AVAILABLE":
        break
    time.sleep(5)
else:
    sys.exit("agreement still not available after 3 minutes; run this again in a few minutes")
rt = boto3.client("bedrock-runtime", region_name=region)
r = rt.converse(modelId=profile, messages=[{"role": "user", "content": [{"text": "Reply with the single word OK."}]}],
                inferenceConfig={"maxTokens": 5})
print("invoke", profile, "->", r["output"]["message"]["content"][0]["text"].strip(), r["usage"])
