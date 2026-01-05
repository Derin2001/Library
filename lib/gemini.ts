import { GoogleGenAI, Type } from "@google/genai";
import { Book, Transaction, Reservation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface Recommendation {
    title: string;
    reason: string;
    language: string;
}

export const getBookRecommendations = async (
    memberHistory: (Transaction | Reservation)[],
    fullCatalog: Book[]
): Promise<Recommendation[]> => {
    // Collect titles of books user has already interacted with
    const historyTitles = new Set(memberHistory.map(h => {
        if ('bookTitle' in h) return h.bookTitle;
        const book = fullCatalog.find(b => b.id === h.bookId);
        return book?.title || '';
    }).filter(t => t !== ''));

    // Deduplicate available catalog by title to prevent AI from seeing multiple copies of the same book
    const catalogForAi = fullCatalog
        .filter(b => !historyTitles.has(b.title))
        .map(b => ({ 
            title: b.title, 
            author: b.author, 
            category: b.category, 
            language: b.language 
        }))
        .filter((v, i, a) => a.findIndex(t => t.title === v.title) === i);

    if (catalogForAi.length === 0) return [];

    const historySummary = Array.from(historyTitles).join(", ");
    
    const prompt = `User's Reading History: [${historySummary}]. 
    Task: Select exactly 3 UNIQUE book titles from the PROVIDED CATALOG below that this user would enjoy based on their history.
    
    PROVIDED CATALOG:
    ${JSON.stringify(catalogForAi.slice(0, 50))}
    
    STRICT RULES:
    1. Suggestions MUST be chosen strictly from the PROVIDED CATALOG above.
    2. DO NOT suggest books that are not in the list.
    3. Provide a short, personalized reason for each suggestion.
    4. Return 3 different books.
    
    Return the recommendations as a JSON object.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 2000 },
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        recommendations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING, description: "The EXACT title from the catalog" },
                                    reason: { type: Type.STRING, description: "A friendly reason for recommending this book" },
                                    language: { type: Type.STRING }
                                },
                                required: ["title", "reason", "language"]
                            },
                            minItems: 3,
                            maxItems: 3
                        }
                    },
                    required: ["recommendations"]
                }
            }
        });

        const text = response.text || '{"recommendations": []}';
        const result = JSON.parse(text);
        
        // Final safety check: Only keep suggestions that ACTUALLY exist in our catalog
        const seenTitles = new Set<string>();
        const uniqueRecs: Recommendation[] = [];
        
        for (const rec of (result.recommendations || [])) {
            const existsInCatalog = fullCatalog.some(b => b.title.toLowerCase() === rec.title.trim().toLowerCase());
            const key = rec.title.trim().toLowerCase();
            
            if (existsInCatalog && !seenTitles.has(key) && uniqueRecs.length < 3) {
                seenTitles.add(key);
                uniqueRecs.push(rec);
            }
        }
        
        return uniqueRecs;
    } catch (error) {
        console.error("AI Recommendation error:", error);
        return [];
    }
};