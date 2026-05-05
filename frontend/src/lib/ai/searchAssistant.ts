import { Product } from '@/types';

/**
 * Hook for semantic, vector-based AI search.
 * Searches product catalog based on loose conversational intents instead of strictly keyword matching.
 */
export async function aiSearch(query: string, products: Product[]): Promise<Product[]> {
    console.log(`Semantic AI Search fired for: ${query}`);
    
    // Placeholder logic: filtering locally. 
    // In production, use Vector DB (e.g., Pinecone/MongoDB Atlas Search) and Embeddings (e.g. OpenAI ada-002 model)
    const lowerQuery = query.toLowerCase();
    
    return products.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) || 
        (p.description && p.description.toLowerCase().includes(lowerQuery))
    );
}
