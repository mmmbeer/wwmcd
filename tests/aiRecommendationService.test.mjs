import assert from "node:assert/strict";
import test from "node:test";
import {
  getAiRecommendations,
  isStructuredOutputUnsupportedError
} from "../js/player-combat/ai/aiRecommendationService.js";

test("AI recommendation service falls back when json_schema response format is unsupported", async () => {
  const calls = [];
  const recommendations = await getAiRecommendations({
    apiKey: "test-key",
    model: "fallback-model",
    context: {
      availableOptions: {
        attacks: [{
          id: "attack_rapier",
          name: "Rapier",
          cost: { action: true },
          available: true
        }]
      }
    },
    chatClient: async (request) => {
      calls.push(request);
      if (calls.length === 1) {
        throw new Error("This model does not support response format `json_schema`. See supported models at https://console.groq.com/docs/structured-outputs#supported-models");
      }
      return {
        text: JSON.stringify({
          recommendations: [{
            rank: 1,
            title: "Attack with Rapier",
            score: 90,
            explanation: "Best available damage option.",
            actions: [{
              slot: "Action",
              optionId: "attack_rapier",
              name: "Rapier",
              explanation: "Uses the main action for reliable damage."
            }],
            reasons: ["Reliable damage"],
            warnings: []
          }]
        })
      };
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].responseFormat.type, "json_schema");
  assert.equal(calls[1].responseFormat, undefined);
  assert.match(calls[1].messages[0].content, /Return ONLY valid JSON/);
  assert.equal(recommendations[0].pieces[0].optionId, "attack_rapier");
});

test("structured output unsupported detector matches Groq response format errors", () => {
  assert.equal(isStructuredOutputUnsupportedError(new Error("This model does not support response format `json_schema`.")), true);
  assert.equal(isStructuredOutputUnsupportedError(new Error("Network failed.")), false);
});
