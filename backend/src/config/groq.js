export const groqConfig = {
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
  baseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
};
