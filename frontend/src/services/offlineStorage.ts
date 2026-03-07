import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { AnalysisResult } from '../types/api';

export class AppDatabase extends Dexie {
    analyses!: Table<AnalysisResult, string>;

    constructor() {
        super('CVAnalyzerDB');
        this.version(1).stores({
            analyses: 'id, created_at, candidate_name' // Primary key and indexed props
        });
    }
}

export const db = new AppDatabase();

export const offlineStorage = {
    async saveAnalysis(analysis: AnalysisResult) {
        await db.analyses.put(analysis);
    },

    async getAnalysis(id: string) {
        return await db.analyses.get(id);
    },

    async getAllAnalyses() {
        return await db.analyses.orderBy('created_at').reverse().toArray();
    },

    async deleteAnalysis(id: string) {
        await db.analyses.delete(id);
    }
};
