// SYFTKOGTECH — serverless function
// Keeps your API key secret on the server. The browser never sees it.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request" }) };
  }

  const businessData = (body.data || "").slice(0, 20000);
  if (!businessData.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "No data provided" }) };
  }

  const SYSTEM_PROMPT = `You are SYFTKOG — an elite AI business intelligence analyst for SYFTKOGTECH.
Your job is to analyze business data and deliver sharp, actionable insights.

Always respond with ONLY valid JSON in this EXACT format, no markdown fences, no extra text:
{
  "summary": "One sentence overview of the business situation",
  "insights": [
    {"title": "...", "detail": "2-3 sentences", "type": "positive|warning|neutral"},
    {"title": "...", "detail": "2-3 sentences", "type": "positive|warning|neutral"},
    {"title": "...", "detail": "2-3 sentences", "type": "positive|warning|neutral"}
  ],
  "opportunities": [
    {"title": "...", "detail": "2-3 sentences", "impact": "high|medium|low"},
    {"title": "...", "detail": "2-3 sentences", "impact": "high|medium|low"}
  ],
  "recommendations": [
    {"action": "...", "reason": "...", "priority": "immediate|short-term|long-term"},
    {"action": "...", "reason": "...", "priority": "immediate|short-term|long-term"},
    {"action": "...", "reason": "...", "priority": "immediate|short-term|long-term"}
  ],
  "healthScore": 75
}
healthScore is 0-100. Be direct and specific — every insight must reference the actual data.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2024-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: "Analyze this business data:\n\n" + businessData }],
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || "AI request failed";
      return { statusCode: 502, body: JSON.stringify({ error: msg }) };
    }

    const text = (data.content || []).map((i) => i.text || "").join("");
    const clean = text.replace(/```json|\n```|```/g, "").trim();

    let jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { statusCode: 502, body: JSON.stringify({ error: "Invalid response format from AI" }) };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Analysis failed: " + err.message }) };
  }
};