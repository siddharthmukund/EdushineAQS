export interface Scores {
    overall_aqs: number;
    research: number;
    education: number;
    teaching: number;
    percentile?: number;
    [key: string]: any;
}

export interface AnalysisResult {
    id: string;
    candidate_name: string | null;
    scores: Scores;
    fitment: Record<string, any>;
    validation: Record<string, any>;
    recommendation: string | null;
    metadata: Record<string, any>;
    created_at: string;
}

export interface ApiResponse<T> {
    status: 'success' | 'error';
    data: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    meta?: {
        timestamp: number;
        request_id: string;
    }
}

// --- Committee ---
export interface CommitteeResponse {
    committee_id: string;
    name: string;
    batch_id: string;
    session_token: string;
    created_at: string;
}

export interface CommitteeJoinResponse {
    session_token: string;
    committee_id: string;
    name: string;
}

export interface VoteTallyResponse {
    tally: Record<string, number>;
    total: number;
    details: Array<{
        member_name: string;
        member_email: string;
        vote: string;
        comment: string | null;
        voted_at: string;
    }>;
}

export interface CommentItem {
    id: string;
    author_name: string;
    author_email: string;
    comment: string;
    parent_id: string | null;
    created_at: string;
}

// --- Interview Prep ---
export interface InterviewQuestion {
    question: string;
    purpose: string;
    follow_up?: string;
}

export interface InterviewQuestions {
    research: InterviewQuestion[];
    teaching: InterviewQuestion[];
    service: InterviewQuestion[];
    gaps: InterviewQuestion[];
}

export interface InterviewPrepResponse {
    analysis_id: string;
    questions: InterviewQuestions;
    generated_at: string;
}

// --- Auth ---
export interface TokenResponse {
    access_token: string;
    token_type: string;
    role: string;
    name: string;
    user_id: string;
}
