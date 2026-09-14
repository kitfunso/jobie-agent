"""One real call through the full loop. Prints rounds and the letter. Costs one model call per round.

Usage from the repo root: python -m scripts.smoke [provider] [model_id]
"""
import sys
from pathlib import Path

from dotenv import load_dotenv

from agent.cv import extract_text
from agent.providers import DEFAULT_MODEL_IDS, ProviderConfig, build_model
from agent.writer import tailor

load_dotenv()
provider = sys.argv[1] if len(sys.argv) > 1 else "bedrock"
model_id = sys.argv[2] if len(sys.argv) > 2 else ""
print("model:", model_id or DEFAULT_MODEL_IDS[provider])
cv = extract_text(Path("samples/cv.pdf").read_bytes())
posting = Path("samples/posting.txt").read_text(encoding="utf-8")
outcome = tailor(build_model(ProviderConfig(name=provider, model_id=model_id)),
                 "Senior Data Engineer", "Sample Co", "London", posting, cv)
for r in outcome.rounds:
    print(f"round {r.round} {r.source}: {len(r.findings)} findings", [f.rule for f in r.findings])
print("\n" + outcome.result.cover_letter)
print("\nGAPS:", outcome.result.gaps)
