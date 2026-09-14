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
    r"i am confident (?:that|in)", r"i would welcome the (?:opportunity|chance)", r"i look forward to",
    r"aligns? (?:closely |perfectly |well )?with", r"resonates?", r"(?:drawn|attracted) to",
    r"well[- ]positioned", r"uniquely (?:positioned|qualified|placed)", r"extensive experience",
    r"strong background", r"eager to", r"keen to", r"meaningful (?:contribution|impact)",
    r"contribute to (?:your|the) (?:team|success|mission)", r"thank you for (?:considering|your (?:time|consideration))",
    r"throughout my career", r"in my current role", r"i bring", r"skill ?set", r"cross-functional",
    r"best practices", r"your (?:organi[sz]ation|esteemed)", r"dear hiring manager", r"exciting opportunity",
    r"the successful candidate", r"track record", r"state-of-the-art", r"world-class",
    r"deliver(?:ing|s|ed)? value", r"drive (?:growth|results|impact|innovation)", r"impactful",
    r"i am particularly", r"what excites me", r"welcome a (?:conversation|chat|call|discussion)",
    r"would (?:love|be glad|be happy) to (?:discuss|talk|chat|hear|speak)", r"happy to (?:discuss|talk further|chat)",
    r"open to a conversation", r"hope to hear", r"i'?d love to",
)

# The bridge: a fact, then a clause telling the reader why it matters to them. Every model does it unprompted.
BRIDGE = _any(
    r"which (?:gives|gave|means|meant|puts|put|makes|made|lets|let|taught) me",
    r"that (?:experience|background|work|combination|foundation) (?:is|sits|gives|gave|means|taught|puts)",
    r"sits? (?:at|in) the (?:same )?intersection", r"that'?s (?:exactly|precisely) (?:where|what|the)",
    r"is (?:exactly|precisely) (?:where|what|the kind)", r"the direction i want", r"where i want to (?:take|go)",
    r"translates? (?:directly )?(?:to|into)", r"the kind of (?:work|problem|role|environment|place) i",
    r"speaks? directly to", r"maps? (?:directly |neatly )?(?:on)?to", r"(?:most )?direct match for",
    r"(?:a |the )?(?:natural|close|good|strong|obvious) (?:match|fit) for",
)

FLATTERY = _any(
    r"(?:harder|bigger|tougher|larger|more \w+)(?: \w+){0,4} than most", r"few (?:teams|desks|companies|firms|places|shops)",
    r"the best (?:team|desk|place|firm|company)", r"industry[- ]leading", r"a leader in",
    r"leading (?:firm|company|player|desk)", r"the (?:most )?(?:interesting|exciting|hardest) (?:problems?|work|desk) in",
)

SALES_TALK = _any(
    r"in my (?:daily |everyday )?toolkit", r"rigorously", r"to (?:a )?production standard", r"battle[- ]tested",
    r"production[- ](?:grade|ready|quality)", r"end[- ]to[- ]end", r"deep (?:experience|expertise|understanding)",
    r"hands[- ]on", r"first[- ]hand", r"real[- ]world",
)

# Tone example embedded in the brief; a different person and field so its facts cannot be lifted, and the
# echo check refuses its phrases.
EXAMPLE_LETTER = """Dear Ms Okafor,

The rota at Hillside was the job nobody wanted, so I took it. Forty staff, and the old spreadsheet kept putting the same people on nights. I rebuilt it as a short Python script that reads holiday requests from the shared calendar. Sick days fell 19% in the first quarter. The managers still argue with it, and I take that as a sign it's being used.

Before Hillside I ran the front desk at a hostel in Leeds for two years. Most of that was saying no politely, in four languages.

I haven't used SAP, and the posting leans on it. Rostering across the Bristol depots is what I'd ask about first if we talk.

Dana Reyes"""

# Spoken contractions only; possessive 's is left out so "EDF's desk" does not count.
CONTRACTIONS = re.compile(
    r"\b(?:i'm|i've|i'd|i'll|it's|that's|there's|here's|what's|let's|isn't|wasn't|aren't|weren't|don't|doesn't|"
    r"didn't|can't|couldn't|won't|wouldn't|haven't|hasn't|hadn't|we're|we've|we'd|we'll|they're|they've|you're|"
    r"you'll|you've|who's)\b", re.IGNORECASE)
MIN_WORDS_FOR_CONTRACTIONS = 120
ECHO_NGRAM = 8
WORD = re.compile(r"[a-z0-9]+")

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
    Rule("bridge clause", BRIDGE, "state the fact and stop; let the reader connect it", LETTER),
    Rule("flattery", FLATTERY, "cut it; the reader works there", LETTER),
    Rule("sales talk", SALES_TALK, "say what you did instead", LETTER),
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
# A range ("78-84%", "+4.7 to +5.3") is one number; years are not numbers; "H1" is not a number.
NUMBER = re.compile(r"(?<![A-Za-z\d])[+-]?\d+(?:[.,]\d+)*(?:\s*(?:-|–|to|and)\s*[+-]?\d+(?:[.,]\d+)*)?")
YEAR = re.compile(r"\b(?:19|20)\d{2}\b")
MAX_NUMBERS_PER_SENTENCE = 2
MAX_NUMBERS_PER_LETTER = 6
DIGITS = re.compile(r"\d+")
# "one" is left out: in a letter it is a pronoun far more often than a count.
_NUMBER_WORDS = ("two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
                 "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty")
NUMBER_WORDS = {w: str(i) for i, w in enumerate(_NUMBER_WORDS, start=2)}
NUMBER_WORDS.update({"thirty": "30", "forty": "40", "fifty": "50", "sixty": "60", "seventy": "70", "eighty": "80",
                     "ninety": "90", "dozen": "12"})
CURRENCY = re.compile(r"[£$€]")
