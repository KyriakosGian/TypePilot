/* Shared X post validation. twitter-text is bundled locally, never fetched at runtime. */
(function (scope) {
  "use strict";
  const parser = scope.twttr.txt;
  const LIMIT = 280;
  const normalise = (text) => String(text ?? "").normalize("NFC");
  const length = (text) => parser.parseTweet(normalise(text)).weightedLength;
  const urls = (text) => parser.extractUrlsWithIndices(normalise(text));
  const mentions = (text) => parser.extractMentionsWithIndices(normalise(text));
  const contextParts = (context = {}) => ({
    prefix: normalise(context.prefix), suffix: normalise(context.suffix),
  });
  function includesAll(before, after) {
    const remaining = [...after];
    return before.every((value) => {
      const index = remaining.indexOf(value);
      if (index < 0) return false;
      remaining.splice(index, 1);
      return true;
    });
  }
  function budget(context) {
    const { prefix, suffix } = contextParts(context);
    return Math.max(0, LIMIT - length(prefix) - length(suffix));
  }
  function protectedTokens(text) {
    return [...urls(text).map((entry) => entry.url), ...mentions(text).map((entry) => `@${entry.screenName}`)];
  }
  function validate(original, result, context = {}) {
    const { prefix, suffix } = contextParts(context);
    const candidate = normalise(result);
    const fullBefore = prefix + normalise(original) + suffix;
    const fullAfter = prefix + candidate + suffix;
    const parsed = parser.parseTweet(fullAfter);
    let reason = "";
    if (!candidate.trim()) reason = "The generated post was empty.";
    else if (!includesAll(urls(fullBefore).map((entry) => entry.url), urls(fullAfter).map((entry) => entry.url))) {
      reason = "A link was changed or omitted.";
    } else if (!includesAll(mentions(fullBefore).map((entry) => entry.screenName), mentions(fullAfter).map((entry) => entry.screenName))) {
      reason = "An @mention was changed or omitted.";
    } else if (parser.extractHashtags(candidate).length > 2) reason = "The result contains more than two hashtags.";
    else if (parsed.weightedLength > LIMIT) reason = `The complete post uses ${parsed.weightedLength}/${LIMIT} characters.`;
    else if (!parsed.valid) reason = "The complete post is not valid under X's text rules.";
    return { valid: !reason, reason, weightedLength: parsed.weightedLength, result: candidate };
  }
  function checkBudget(original, context = {}) {
    const available = budget(context);
    if (!available || length(protectedTokens(original).join(" ")) > available) {
      return { valid: false, reason: "The existing text, links, and mentions leave too little room. Select more of the post or remove a link." };
    }
    return { valid: true, available };
  }
  scope.TypePilotX = Object.freeze({ length, validate, budget, checkBudget, protectedTokens, normalise });
})(globalThis);
