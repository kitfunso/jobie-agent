"""One real call through the full loop. Prints rounds and the letter. Costs one model call per round."""
import sys
from pathlib import Path

from dotenv import load_dotenv

from agent.cv import extract_text
from agent.providers import ProviderConfig, build_model
from agent.writer import tailor

load_dotenv()
provider = sys.argv[1] if len(sys.argv) > 1 else "bedrock"
cv = extract_text(Path("samples/cv.pdf").read_bytes())
posting = Path("samples/posting.txt").read_text(encoding="utf-8")
outcome = tailor(build_model(ProviderConfig(name=provider)), "Senior Data Engineer", "Sample Co", "London", posting, cv)
for r in outcome.rounds:
    print(f"round {r.round}: {len(r.findings)} findings", [f.rule for f in r.findings])
print("\n" + outcome.result.cover_letter)
print("\nGAPS:", outcome.result.gaps)
