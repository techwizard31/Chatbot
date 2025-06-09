// For App Router: app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_GOOGLE_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert OpenAI format messages to Gemini format
    let conversationHistory = messages
      .slice(0, -1) // All messages except the last one
      .map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // Ensure first message is from user, filter out initial assistant messages
    const firstUserIndex = conversationHistory.findIndex(msg => msg.role === 'user');
    if (firstUserIndex > 0) {
      conversationHistory = conversationHistory.slice(firstUserIndex);
    } else if (conversationHistory.length > 0 && conversationHistory[0].role === 'model') {
      // If first message is from model, remove it
      conversationHistory = conversationHistory.slice(1);
    }

    // Get the latest user message
    const latestMessage = messages[messages.length - 1];

    // Start chat with history (only if we have valid history)
    const chat = model.startChat({
      history: conversationHistory.length > 0 ? conversationHistory : [],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    });

    // Send the latest message
    const result = await chat.sendMessage(latestMessage.content);
    const response = await result.response;
    const message = response.text() || 'Sorry, I couldn\'t generate a response.';

    return NextResponse.json({ message });
  } catch (error: any) {
    console.error('Google Gemini API error:', error);
    
    // Provide better error handling for common Gemini errors
    let errorMessage = 'Failed to get response from AI';
    
    if (error.message?.includes('API_KEY_INVALID')) {
      errorMessage = 'Invalid Google API key. Please check your configuration.';
    } else if (error.message?.includes('QUOTA_EXCEEDED')) {
      errorMessage = 'API quota exceeded. Please try again later.';
    } else if (error.message?.includes('SAFETY')) {
      errorMessage = 'Content blocked by safety filters. Please rephrase your message.';
    }

    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}