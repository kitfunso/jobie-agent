"""Builds a Strands model from the user's own credentials. Keys are never stored server-side."""
from __future__ import annotations

import os
from dataclasses import dataclass

from strands.models import Model

DEFAULT_MODEL_IDS = {
    "anthropic": "claude-sonnet-5",
    "openai": "gpt-4o",
    "bedrock": "global.anthropic.claude-sonnet-5",
}
ENV_KEYS = {"anthropic": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY", "bedrock": "AWS_BEARER_TOKEN_BEDROCK"}


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_key: str = ""
    model_id: str = ""
    region: str = ""


def build_model(cfg: ProviderConfig) -> Model:
    if cfg.name not in DEFAULT_MODEL_IDS:
        raise ValueError(f"unknown provider '{cfg.name}'; choose one of {sorted(DEFAULT_MODEL_IDS)}")
    key = cfg.api_key or os.environ.get(ENV_KEYS[cfg.name], "")
    if not key and cfg.name != "bedrock":
        raise ValueError(f"no API key for {cfg.name}: paste one in the extension or set {ENV_KEYS[cfg.name]} in .env")
    model_id = cfg.model_id or DEFAULT_MODEL_IDS[cfg.name]
    if cfg.name == "anthropic":
        from strands.models.anthropic import AnthropicModel
        return AnthropicModel(client_args={"api_key": key}, model_id=model_id, max_tokens=4096)
    if cfg.name == "openai":
        from strands.models.openai import OpenAIModel
        return OpenAIModel(client_args={"api_key": key}, model_id=model_id)
    from strands.models import BedrockModel
    region = cfg.region or os.environ.get("AWS_REGION", "us-east-1")
    return BedrockModel(model_id=model_id, region_name=region, api_key=key or None)
