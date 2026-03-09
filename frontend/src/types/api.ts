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

// --- Multi-tenancy ---
export interface TenantInfo {
    id: string;
    name: string;
    subdomain: string;
    plan: 'free' | 'pro' | 'enterprise';
    region: 'us' | 'eu' | 'ap';
    settings: Record<string, any>;
}

// --- Candidate Platform ---
export interface CandidateProfile {
    id: string;
    tenant_id: string;
    email: string;
    name: string;
    institution: string | null;
    orcid_id: string | null;
    orcid_verified: boolean;
    h_index: number | null;
    research_areas: string[];
    bio: string | null;
    job_preferences: Record<string, any>;
    is_public: boolean;
    created_at: string;
    updated_at: string | null;
}

export interface JobPosting {
    id: string;
    tenant_id: string;
    title: string;
    institution: string;
    department: string | null;
    position_type: 'tenure_track' | 'postdoc' | 'lecturer' | 'visiting' | 'research';
    description: string;
    requirements: Record<string, any>;
    salary_range: { min?: number; max?: number; currency?: string } | null;
    location: string | null;
    deadline: string | null;
    created_by_email: string;
    created_at: string;
    is_active: boolean;
}

export interface ApplicationStatusHistory {
    status: string;
    changed_at: string;
    note: string;
}

export interface JobApplication {
    id: string;
    candidate_profile_id: string;
    job_posting_id: string;
    analysis_id: string | null;
    status: 'submitted' | 'reviewing' | 'shortlisted' | 'interviewed' | 'offered' | 'rejected';
    status_history: ApplicationStatusHistory[];
    cover_note: string | null;
    created_at: string;
}

// --- Developer Ecosystem ---
export interface DeveloperApp {
    id: string;
    name: string;
    description: string | null;
    developer_email: string;
    api_key_prefix: string;
    category: 'analytics' | 'integration' | 'workflow' | 'reporting' | 'other';
    rate_limit_hour: number;
    total_requests: number;
    is_marketplace_listed: boolean;
    created_at: string;
}

export interface AppRegisterResponse {
    status: string;
    app_id: string;
    api_key_prefix: string;
    api_key: string;
    warning: string;
}
