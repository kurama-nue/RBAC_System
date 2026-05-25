const { VoyageAIClient } = require('voyageai');

/**
 * Voyage AI Embedding Helper
 * Uses voyage-4-large model to generate high-dimensional embeddings for RAG.
 *
 * Model: voyage-4-large
 *  - Dimension: 1024 (default) or 256 / 512 / 2048 (configurable)
 *  - Context: up to 32,000 tokens
 *  - Best for: long documents, semantic search, RAG pipelines
 */

let client = null;

/**
 * Lazily initialises the Voyage AI client once.
 */
const getClient = () => {
  if (!client) {
    if (!process.env.VOYAGE_API_KEY) {
      throw new Error('VOYAGE_API_KEY is not set in environment variables');
    }
    client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
  }
  return client;
};

/**
 * Generate an embedding vector for a single text string.
 *
 * @param {string} text - The text to embed.
 * @param {'document'|'query'} inputType - Use 'document' when storing,
 *   'query' when searching. Voyage optimises the vector accordingly.
 * @returns {Promise<number[]>} A 1024-dimensional float array.
 */
const embedText = async (text, inputType = 'document') => {
  if (!text || typeof text !== 'string') {
    throw new Error('embedText: text must be a non-empty string');
  }

  const voyageClient = getClient();
  const response = await voyageClient.embed({
    input: [text.trim()],
    model: 'voyage-large-2',
    inputType,
  });

  return response.data[0].embedding;
};

/**
 * Generate embedding vectors for multiple texts in a single API call.
 * Voyage AI supports batches of up to 128 inputs.
 *
 * @param {string[]} texts - Array of texts to embed.
 * @param {'document'|'query'} inputType - Purpose of the embeddings.
 * @returns {Promise<number[][]>} Array of 1024-dimensional float arrays.
 */
const embedBatch = async (texts, inputType = 'document') => {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('embedBatch: texts must be a non-empty array');
  }
  if (texts.length > 128) {
    throw new Error('embedBatch: maximum batch size is 128 texts');
  }

  const voyageClient = getClient();
  const response = await voyageClient.embed({
    input: texts.map((t) => t.trim()),
    model: 'voyage-large-2',
    inputType,
  });

  return response.data.map((item) => item.embedding);
};

/**
 * Build a combined text representation of a Task document for embedding.
 * Concatenates the most semantically relevant fields.
 *
 * @param {{ title: string, description?: string, status?: string, priority?: string }} task
 * @returns {string}
 */
const buildTaskEmbeddingText = (task) => {
  const parts = [
    task.title || '',
    task.description || '',
    task.status ? `Status: ${task.status}` : '',
    task.priority ? `Priority: ${task.priority}` : '',
  ].filter(Boolean);

  return parts.join('. ');
};

module.exports = { embedText, embedBatch, buildTaskEmbeddingText };
