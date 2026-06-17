import * as vscode from "vscode";
import {
  normalizeAvailableModel,
  selectConfiguredModelIndex,
  type AvailableModel,
  type LlmProvider,
  type LlmRequestOptions,
  type LlmResponse
} from "./llm-provider";

export class CopilotProvider implements LlmProvider {
  public async listModels(): Promise<AvailableModel[]> {
    const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
    return models.map(normalizeAvailableModel);
  }

  public async sendPrompt(prompt: string, options: LlmRequestOptions): Promise<LlmResponse> {
    const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
    const availableModels = models.map(normalizeAvailableModel);
    const selectedModelIndex = selectConfiguredModelIndex(availableModels, options.modelFamily);
    const selectedModel = selectedModelIndex >= 0 ? models[selectedModelIndex] : undefined;
    const selectedAvailableModel = selectedModelIndex >= 0 ? availableModels[selectedModelIndex] : undefined;
    if (!selectedModel || !selectedAvailableModel) {
      throw new Error("Select an available GitHub Copilot model before analyzing.");
    }

    const response = await selectedModel.sendRequest(
      [vscode.LanguageModelChatMessage.User(prompt)],
      {},
      new vscode.CancellationTokenSource().token
    );
    return {
      rawText: await readResponseText(response.text),
      model: selectedAvailableModel,
      usedFallback: false
    };
  }
}

async function readResponseText(stream: AsyncIterable<unknown>): Promise<string> {
  let full = "";
  for await (const part of stream) {
    if (part && typeof part === "object" && "value" in (part as Record<string, unknown>) && typeof (part as Record<string, unknown>).value === "string") {
      full += String((part as Record<string, unknown>).value);
    } else {
      full += String(part);
    }
  }
  return full;
}
