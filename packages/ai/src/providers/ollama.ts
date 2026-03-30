import OpenAI from "openai";
import { getEnvApiKey } from "../env-api-keys.js";
import type {
	AssistantMessage,
	Context,
	Message,
	Model,
	OpenAICompletionsCompat,
	SimpleStreamOptions,
	StreamFunction,
	StreamOptions,
	TextContent,
	ThinkingContent,
	Tool,
	ToolCall,
	Usage,
} from "../types.js";
import { AssistantMessageEventStream } from "../utils/event-stream.js";
import { parseStreamingJson } from "../utils/json-parse.js";
import { sanitizeSurrogates } from "../utils/sanitize-unicode.js";
import { convertMessages } from "./openai-completions.js";
import { buildBaseOptions } from "./simple-options.js";

export interface OllamaOptions extends StreamOptions {
	toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
}

const ollamaCompat = {
	supportsStore: false,
	supportsDeveloperRole: false,
	supportsReasoningEffort: false,
	reasoningEffortMap: {},
	supportsUsageInStreaming: false,
	maxTokensField: "max_tokens",
	requiresToolResultName: false,
	requiresAssistantAfterToolResult: false,
	requiresThinkingAsText: false,
	thinkingFormat: undefined as unknown as "openai" | "openrouter" | "zai" | "qwen" | "qwen-chat-template" | undefined,
	openRouterRouting: undefined,
	vercelGatewayRouting: undefined,
	supportsStrictMode: false,
} as unknown as Required<OpenAICompletionsCompat>;

function hasToolHistory(messages: Message[]): boolean {
	for (const msg of messages) {
		if (msg.role === "toolResult") {
			return true;
		}
		if (msg.role === "assistant") {
			if (msg.content.some((block) => block.type === "toolCall")) {
				return true;
			}
		}
	}
	return false;
}

function convertTools(tools: Tool[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
	return tools.map((tool) => ({
		type: "function" as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		},
	}));
}

export const streamOllama: StreamFunction<"openai-completions", OllamaOptions> = (
	model: Model<"openai-completions">,
	context: Context,
	options?: OllamaOptions,
): AssistantMessageEventStream => {
	const stream = new AssistantMessageEventStream();

	(async () => {
		const output: AssistantMessage = {
			role: "assistant",
			content: [],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: Date.now(),
		};

		try {
			const apiKey = options?.apiKey || getEnvApiKey(model.provider) || "";
			const client = createClient(model, context, apiKey, options?.headers);
			const params = buildParams(model, context, options);
			const openaiStream = await client.chat.completions.create(params, { signal: options?.signal });
			stream.push({ type: "start", partial: output });

			let currentBlock: TextContent | ThinkingContent | (ToolCall & { partialArgs?: string }) | null = null;
			const blocks: (TextContent | ThinkingContent | ToolCall)[] = [];
			const blockIndex = () => blocks.length - 1;
			const finishCurrentBlock = (block?: typeof currentBlock) => {
				if (block) {
					if (block.type === "text") {
						stream.push({
							type: "text_end",
							contentIndex: blockIndex(),
							content: block.text,
							partial: output,
						});
					} else if (block.type === "thinking") {
						stream.push({
							type: "thinking_end",
							contentIndex: blockIndex(),
							content: block.thinking,
							partial: output,
						});
					} else if (block.type === "toolCall") {
						const parsedArgs =
							typeof block.arguments === "string" ? parseStreamingJson(block.partialArgs) : block.arguments;
						const toolCall: ToolCall = {
							id: block.id,
							name: block.name,
							arguments: parsedArgs,
							type: "toolCall",
						};
						stream.push({
							type: "toolcall_end",
							contentIndex: blockIndex(),
							toolCall,
							partial: output,
						});
					}
				}
			};

			for await (const chunk of openaiStream) {
				if (!chunk || typeof chunk !== "object") continue;

				output.responseId ||= chunk.id;

				const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
				if (!choice) continue;

				if (choice.finish_reason) {
					output.stopReason =
						choice.finish_reason === "stop"
							? "stop"
							: choice.finish_reason === "length"
								? "length"
								: choice.finish_reason === "tool_calls"
									? "toolUse"
									: "error";
				}

				const delta = choice.delta;
				if (!delta) continue;

				if (delta.content) {
					const text = sanitizeSurrogates(delta.content);
					if (!currentBlock) {
						currentBlock = { type: "text", text };
						blocks.push(currentBlock);
						stream.push({ type: "text_start", contentIndex: blockIndex(), partial: output });
					} else if (currentBlock.type === "text") {
						currentBlock.text += text;
						stream.push({
							type: "text_delta",
							contentIndex: blockIndex(),
							delta: text,
							partial: output,
						});
					} else {
						finishCurrentBlock(currentBlock);
						currentBlock = { type: "text", text };
						blocks.push(currentBlock);
						stream.push({ type: "text_start", contentIndex: blockIndex(), partial: output });
					}
				}

				const reasoningContent = (delta as any).reasoning_content;
				if (reasoningContent) {
					const thinking = sanitizeSurrogates(reasoningContent);
					if (!currentBlock) {
						currentBlock = { type: "thinking", thinking };
						blocks.push(currentBlock);
						stream.push({ type: "thinking_start", contentIndex: blockIndex(), partial: output });
					} else if (currentBlock.type === "thinking") {
						currentBlock.thinking += thinking;
						stream.push({
							type: "thinking_delta",
							contentIndex: blockIndex(),
							delta: thinking,
							partial: output,
						});
					} else {
						finishCurrentBlock(currentBlock);
						currentBlock = { type: "thinking", thinking };
						blocks.push(currentBlock);
						stream.push({ type: "thinking_start", contentIndex: blockIndex(), partial: output });
					}
				}

				const toolCalls = (delta as any).tool_calls;
				if (toolCalls && toolCalls.length > 0) {
					for (const tc of toolCalls) {
						const existingCall = currentBlock && currentBlock.type === "toolCall" && currentBlock.id === tc.id;
						if (!existingCall) {
							if (currentBlock) {
								finishCurrentBlock(currentBlock);
							}
							const toolCallBlock: ToolCall & { partialArgs?: string } = {
								id: tc.id || `call_${Math.random().toString(36).substring(7)}`,
								name: tc.function?.name || "",
								arguments: tc.function?.arguments || "",
								type: "toolCall",
							};
							if (tc.function?.arguments) {
								toolCallBlock.partialArgs = tc.function.arguments;
							}
							blocks.push(toolCallBlock);
							currentBlock = toolCallBlock;
							stream.push({ type: "toolcall_start", contentIndex: blockIndex(), partial: output });
						} else if (tc.function?.arguments && currentBlock && currentBlock.type === "toolCall") {
							currentBlock.partialArgs = (currentBlock.partialArgs || "") + tc.function.arguments;
							stream.push({
								type: "toolcall_delta",
								contentIndex: blockIndex(),
								delta: tc.function.arguments,
								partial: output,
							});
						}
					}
				}
			}

			finishCurrentBlock(currentBlock);
			output.content = blocks;
			const usage: Usage = {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			};
			output.usage.cost.input = (model.cost.input / 1000000) * usage.input;
			output.usage.cost.output = (model.cost.output / 1000000) * usage.output;
			output.usage.cost.cacheRead = (model.cost.cacheRead / 1000000) * usage.cacheRead;
			output.usage.cost.cacheWrite = (model.cost.cacheWrite / 1000000) * usage.cacheWrite;
			output.usage.cost.total =
				output.usage.cost.input +
				output.usage.cost.output +
				output.usage.cost.cacheRead +
				output.usage.cost.cacheWrite;
			const reason =
				output.stopReason === "stop" || output.stopReason === "length" || output.stopReason === "toolUse"
					? output.stopReason
					: "stop";
			stream.push({ type: "done", reason, message: output });
		} catch (error) {
			stream.push({
				type: "error",
				reason: "error",
				error: {
					role: "assistant",
					content: [],
					model: model.id,
					api: model.api,
					provider: model.provider,
					usage: {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					stopReason: "error",
					errorMessage: error instanceof Error ? error.message : String(error),
					timestamp: Date.now(),
				},
			});
			stream.end();
		}
	})();

	return stream;
};

export const streamSimpleOllama: StreamFunction<"openai-completions", SimpleStreamOptions> = (
	model: Model<"openai-completions">,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream => {
	const apiKey = options?.apiKey || getEnvApiKey(model.provider);

	const base = buildBaseOptions(model, options, apiKey || "");

	return streamOllama(model, context, base as OllamaOptions);
};

function createClient(
	model: Model<"openai-completions">,
	_context: Context,
	apiKey?: string,
	optionsHeaders?: Record<string, string>,
) {
	const headers = { ...model.headers };

	if (optionsHeaders) {
		Object.assign(headers, optionsHeaders);
	}

	return new OpenAI({
		apiKey: apiKey || "ollama",
		baseURL: model.baseUrl,
		dangerouslyAllowBrowser: true,
		defaultHeaders: headers,
	});
}

function buildParams(model: Model<"openai-completions">, context: Context, options?: OllamaOptions) {
	const compat = ollamaCompat;
	const messages = convertMessages(model, context, compat);

	const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
		model: model.id,
		messages,
		stream: true,
	};

	if (options?.maxTokens) {
		if (compat.maxTokensField === "max_completion_tokens") {
			(params as any).max_completion_tokens = options.maxTokens;
		} else {
			(params as any).max_tokens = options.maxTokens;
		}
	}

	if (options?.temperature !== undefined) {
		params.temperature = options.temperature;
	}

	if (context.tools) {
		params.tools = convertTools(context.tools);
	} else if (hasToolHistory(context.messages)) {
		params.tools = [];
	}

	if (options?.toolChoice) {
		(params as any).tool_choice = options.toolChoice;
	}

	return params;
}
