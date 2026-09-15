import pytest
from agent.providers import ProviderConfig, build_model


def test_anthropic_uses_given_key_and_default_model():
    model = build_model(ProviderConfig(name="anthropic", api_key="sk-test"))
    assert type(model).__name__ == "AnthropicModel"
    assert model.get_config()["model_id"] == "claude-sonnet-5"


def test_openai_model_id_override():
    model = build_model(ProviderConfig(name="openai", api_key="sk-test", model_id="gpt-4o-mini"))
    assert model.get_config()["model_id"] == "gpt-4o-mini"


def test_nebius_is_openai_compatible_at_token_factory(monkeypatch):
    monkeypatch.setenv("NEBIUS_API_KEY", "nb-test")
    model = build_model(ProviderConfig(name="nebius"))
    assert type(model).__name__ == "OpenAIModel"
    assert model.get_config()["model_id"] == "nvidia/nemotron-3-super-120b-a12b"
    assert model.client_args["base_url"] == "https://api.tokenfactory.nebius.com/v1/"


def test_bedrock_reads_env_when_key_empty(monkeypatch):
    monkeypatch.setenv("AWS_BEARER_TOKEN_BEDROCK", "bearer-test")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    model = build_model(ProviderConfig(name="bedrock"))
    assert type(model).__name__ == "BedrockModel"
    assert model.get_config()["model_id"] == "global.anthropic.claude-sonnet-4-6"


def test_unknown_provider_raises():
    with pytest.raises(ValueError):
        build_model(ProviderConfig(name="llama-on-a-toaster", api_key="x"))


def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ValueError):
        build_model(ProviderConfig(name="anthropic"))


def test_bedrock_without_key_uses_boto_chain(monkeypatch):
    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)
    model = build_model(ProviderConfig(name="bedrock"))
    assert type(model).__name__ == "BedrockModel"
