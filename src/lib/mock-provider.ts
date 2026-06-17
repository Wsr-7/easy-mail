import {
  selectConfiguredModel,
  type AvailableModel,
  type LlmProvider,
  type LlmRequestOptions,
  type LlmResponse
} from "./llm-provider";

export interface MockProviderOptions {
  models?: AvailableModel[];
  responses?: string[];
}

export class MockProvider implements LlmProvider {
  public readonly prompts: string[] = [];
  private responseIndex = 0;
  private readonly models: AvailableModel[];
  private readonly responses: string[];

  public constructor(options: MockProviderOptions = {}) {
    this.models = options.models || [
      { vendor: "mock", family: "mock-model", id: "mock-model", name: "Mock Model" }
    ];
    this.responses = options.responses || ["{}"];
  }

  public async listModels(): Promise<AvailableModel[]> {
    return this.models.map((model) => ({ ...model }));
  }

  public async sendPrompt(prompt: string, options: LlmRequestOptions): Promise<LlmResponse> {
    const model = selectConfiguredModel(this.models, options.modelFamily);
    if (!model) {
      throw new Error("Select an available GitHub Copilot model before analyzing.");
    }
    this.prompts.push(prompt);
    const rawText = this.responses[Math.min(this.responseIndex, this.responses.length - 1)] || "{}";
    this.responseIndex += 1;
    return {
      rawText,
      model: { ...model },
      usedFallback: false
    };
  }
}
