"""Named AI-writing patterns. Source: the no-ai-slop skill rule list plus cover-letter cliches."""
from __future__ import annotations

import re
from dataclasses import dataclass

LETTER = ("letter",)
BOTH = ("letter", "cv")


@dataclass(frozen=True)
class Rule:
    name: str
    pattern: re.Pattern[str]
    fix: str
    kinds: tuple[str, ...] = BOTH


def _any(*alts: str) -> re.Pattern[str]:
    return re.compile(r"\b(?:" + "|".join(alts) + r")\b", re.IGNORECASE)


BANNED_WORDS = _any(
    r"delv(?:e|es|ed|ing)", r"foster(?:s|ed|ing)?", r"leverag(?:e|es|ed|ing)",
    r"utili[sz](?:e|es|ed|ing)", r"facilitat(?:e|es|ed|ing)", r"empower(?:s|ed|ing)?",
    r"streamlin(?:e|es|ed|ing)", r"robust", r"cutting-edge", r"paradigm shift",
    r"game[- ]chang(?:er|ing)", r"this is huge", r"this changes everything", r"tapestry",
    r"realm", r"beacon", r"multifaceted", r"meticulous(?:ly)?", r"intricate", r"paramount",
    r"transformative", r"elevat(?:e|es|ed|ing)", r"embark(?:s|ed|ing)?", r"supercharg(?:e|es|ed|ing)",
    r"harness(?:es|ed|ing)?", r"ever-evolving", r"seamless(?:ly)?", r"holistic", r"crucial",
    r"pivotal", r"unlock(?:s|ed|ing)?", r"nuanced", r"vibrant", r"showcas(?:e|es|ed|ing)",
    r"boast(?:s|ed|ing)?", r"notably", r"surpass(?:es|ed|ing)?", r"garner(?:s|ed|ing)?",
    r"strategically", r"testament", r"underscor(?:es|ed|ing)", r"synerg(?:y|ies|istic)",
    r"spearhead(?:s|ed|ing)?",
)

CLICHES = _any(
    r"i am writing to (?:express|apply)", r"excited to apply", r"thrilled", r"passionate about",
    r"proven track record", r"results[- ]driven", r"team player", r"hit the ground running",
    r"fast-paced environment", r"self-starter", r"go-getter", r"detail-oriented",
    r"think(?:ing)? outside the box", r"perfect fit", r"ideal candidate", r"wealth of experience",
    r"i believe (?:i|my)", r"dynamic (?:team|environment|role)",
)

EMPTY_PHRASES = _any(
    r"it'?s worth noting", r"it'?s important to note", r"at the end of the day", r"when it comes to",
    r"at its core", r"in today'?s world", r"in the age of", r"in the world of", r"the reality is",
    r"the truth is", r"in terms of", r"with regard to", r"in order to", r"going forward",
    r"let'?s dive in",
)

RULES: tuple[Rule, ...] = (
    Rule("banned word", BANNED_WORDS, "replace with the plain word or the concrete fact"),
    Rule("cover letter cliche", CLICHES, "state the specific result or role fact instead", LETTER),
    Rule("empty phrase", EMPTY_PHRASES, "cut the phrase, keep the point"),
    Rule("binary contrast", re.compile(
        r"\bnot (?:just|only|merely)\b[^.\n]{1,80}\bbut\b|\b(?:isn'?t|is not|wasn'?t) (?:just |only )?[^.\n]{1,60}[.;]\s*(?:it'?s|it is)\b",
        re.IGNORECASE), "state the second half directly", LETTER),
    Rule("throat clearing", re.compile(
        r"(?:^|(?<=[.!?]\s))(?:here'?s the thing|here'?s what i mean|let me be clear|i'?ll be honest|the uncomfortable truth is)",
        re.IGNORECASE | re.MULTILINE), "delete the opener", LETTER),
    Rule("faux insight", re.compile(
        r"what most people (?:get wrong|miss)|here'?s what nobody tells you|the part everyone misses|this is the part most people skip",
        re.IGNORECASE), "cut the setup, make the claim stand alone"),
    Rule("colon reveal", re.compile(r"(?m)^[^:\n]{3,40}: [a-z][^\n.]{3,80}\.$"),
         "rewrite as a plain sentence", LETTER),
    Rule("superficial analysis", re.compile(
        r",\s*(?:highlighting|underscoring|reflecting|showcasing|demonstrating|signal(?:l)?ing|emphasi[sz]ing)\b",
        re.IGNORECASE), "replace the -ing clause with the concrete consequence"),
    Rule("importance puffery", re.compile(
        r"stands as a testament|testament to|pivotal moment|plays a vital role|solidif(?:y|ies) (?:its|my) position|underscores (?:its|the) significance",
        re.IGNORECASE), "state the fact and let the reader judge"),
    Rule("metadiscourse", re.compile(
        r"that last part matters|the key point is|as you can see|this distinction matters|in other words",
        re.IGNORECASE), "delete the aside"),
    Rule("weasel attribution", re.compile(
        r"experts agree|industry reports suggest|many argue|widely regarded as|studies show",
        re.IGNORECASE), "name the source or cut the claim"),
    Rule("negative listing", re.compile(r"(?:^|\.\s)Not an? \w+\. Not an? \w+\.", re.MULTILINE),
         "say what it is", LETTER),
    Rule("dramatic fragmentation", re.compile(r"That'?s it\. That'?s the whole thing\.|\. And \w+\. And \w+\.",
         re.IGNORECASE), "use complete sentences", LETTER),
    Rule("rhetorical setup", re.compile(r"what if i told you|think about it:|plot twist:", re.IGNORECASE),
         "drop the setup and make the point", LETTER),
    Rule("hedging stack", re.compile(r"\b(?:arguably|generally speaking|it could be said)\b", re.IGNORECASE),
         "commit to the claim or cut it"),
    Rule("emoji", re.compile(r"[\U0001F300-\U0001FAFF☀-➿]"), "remove"),
)

SUMMARY_OPENERS = re.compile(r"^\s*(?:in conclusion|ultimately|overall|in summary|to sum up|to summari[sz]e)\b", re.IGNORECASE)
EM_DASH = re.compile(r"—|–| -- ")
SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
MAX_LETTER_WORDS = 350
