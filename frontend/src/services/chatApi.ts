/**
 * Chat API Service
 * 
 * Service for interacting with the chat endpoint that uses chat_function DSPy module.
 * Handles general Q&A, plotly code editing, and data analysis queries.
 */

import { config, getAuthHeaders, checkAuthResponse } from '../config';

export interface ChatRequest {
  message: string;
  dataset_id?: string;
  fig_data?: Record<string, any>;
  plotly_code?: string;
}

export interface ChatResponse {
  reply: string;
  user?: string;
  matched_chart?: {
    index: number;
    type: string;
    title: string;
  };
  code_type?: 'plotly_edit' | 'analysis';
  executable_code?: string;
}

/**
 * Send a chat message to the AI assistant
 * 
 * @param request - Chat request with message and optional context
 * @returns Promise with the AI's response
 * @throws Error if the request fails
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  try {
    const response = await fetch(`${config.backendUrl}/api/chat`, {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      credentials: 'include',
      body: JSON.stringify(request),
    });

    await checkAuthResponse(response);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data: ChatResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
}

/**
 * Send a simple text message without additional context
 * 
 * @param message - The message to send
 * @returns Promise with the AI's response
 */
export async function sendSimpleMessage(message: string): Promise<ChatResponse> {
  return sendChatMessage({ message });
}

/**
 * Send a message with dataset context
 * 
 * @param message - The message to send
 * @param datasetId - The dataset ID for context
 * @returns Promise with the AI's response
 */
export async function sendMessageWithDataset(
  message: string,
  datasetId: string
): Promise<ChatResponse> {
  return sendChatMessage({
    message,
    dataset_id: datasetId,
  });
}

/**
 * Send a message to edit Plotly code
 * 
 * @param message - Instructions for editing
 * @param plotlyCode - The current Plotly code
 * @param datasetId - Optional dataset ID for context
 * @returns Promise with the AI's response
 */
export async function requestPlotlyEdit(
  message: string,
  plotlyCode: string,
  datasetId?: string
): Promise<ChatResponse> {
  return sendChatMessage({
    message,
    plotly_code: plotlyCode,
    dataset_id: datasetId,
  });
}

/**
 * Send a message to analyze figure data
 * 
 * @param message - The analysis question
 * @param figData - The Plotly figure data
 * @param datasetId - Optional dataset ID for context
 * @returns Promise with the AI's response
 */
export async function requestDataAnalysis(
  message: string,
  figData: Record<string, any>,
  datasetId?: string
): Promise<ChatResponse> {
  return sendChatMessage({
    message,
    fig_data: figData,
    dataset_id: datasetId,
  });
}

