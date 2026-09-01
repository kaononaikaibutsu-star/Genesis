const OLLAMA_HOST = 'http://127.0.0.1:11434';

// Function to generate text embeddings using nomic-embed-text
async function getEmbedding(text) {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text
      })
    });
    
    const data = await response.json();
    return data.embedding; // Returns array of float numbers
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

// Function to calculate Cosine Similarity between vector arrays
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Function to query local LLM with vault context
async function askVault(query, contextNotes, modelName = 'llama3.2') {
  try {
    const contextText = contextNotes
      .map(n => `Title: ${n.title}\nContent: ${n.content}\nTags: ${n.tags}`)
      .join('\n---\n');

    const prompt = `You are Genesis, a private personal assistant. Answer the user's question using ONLY the provided memories below. If the answer cannot be found, say so politely.

Memories:
${contextText}

Question: ${query}
Answer:`;

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false
      })
    });

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error querying local LLM:', error);
    return 'Could not reach local Ollama instance. Make sure Ollama is running.';
  }
}

module.exports = { getEmbedding, cosineSimilarity, askVault };