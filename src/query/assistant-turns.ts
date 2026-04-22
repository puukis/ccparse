import type {
  AssistantTextEvent,
  AssistantThinkingEvent,
  AssistantTurn,
  NormalizedSession,
  ToolUseEvent,
  UsageSnapshotEvent,
} from "../types/normalized.js";

export function getAssistantTurns(session: NormalizedSession): AssistantTurn[] {
  const grouped = new Map<number, AssistantTurn>();

  for (const event of session.events) {
    if (event.kind !== "assistant_text" && event.kind !== "assistant_thinking" && event.kind !== "tool_use") {
      continue;
    }

    const recordIndex = event.provenance.recordIndex;
    let turn = grouped.get(recordIndex);
    if (!turn) {
      turn = {
        id: `${session.metadata.sessionId ?? "session"}:assistant-turn:${recordIndex}`,
        recordIndex,
        text: "",
        textBlocks: [],
        thinkingBlocks: [],
        toolUses: [],
        warnings: [...event.warnings],
      };

      if (event.timestamp) {
        turn.timestamp = event.timestamp;
      }

      if ("model" in event && event.model) {
        turn.model = event.model;
      }

      grouped.set(recordIndex, turn);
    } else {
      turn.warnings.push(...event.warnings);
    }

    switch (event.kind) {
      case "assistant_text":
        turn.textBlocks.push(event as AssistantTextEvent);
        turn.text = turn.textBlocks.map((item) => item.text).join("\n\n");
        break;
      case "assistant_thinking":
        turn.thinkingBlocks.push(event as AssistantThinkingEvent);
        break;
      case "tool_use":
        turn.toolUses.push(event as ToolUseEvent);
        break;
      default:
        break;
    }
  }

  for (const event of session.events) {
    if (event.kind !== "usage") {
      continue;
    }

    const turn = grouped.get(event.provenance.recordIndex);
    if (turn) {
      turn.usage = event as UsageSnapshotEvent;
    }
  }

  return [...grouped.values()].sort((left, right) => left.recordIndex - right.recordIndex);
}
