import axios from 'axios';
import type {
    ApiResponse, AnalysisResult,
    CommitteeResponse, CommitteeJoinResponse, VoteTallyResponse, CommentItem,
    InterviewPrepResponse, TokenResponse,
    CandidateProfile, JobPosting, JobApplication,
    AppRegisterResponse,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000, // 60s for LLM processing
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('api_key') || 'development-key';
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const analyzeCV = async (
    cvFile: File,
    jobDescription?: string,
    model?: string
): Promise<AnalysisResult> => {
    const formData = new FormData();
    formData.append('cv_file', cvFile);
    if (jobDescription) {
        formData.append('job_description', jobDescription);
    }
    if (model) {
        formData.append('model', model);
    }

    const response = await apiClient.post<ApiResponse<AnalysisResult>>(
        '/api/analyze',
        formData,
        {
            headers: { 'Content-Type': 'multipart/form-data' },
        }
    );

    if (response.data.status !== 'success') {
        throw new Error(response.data.error?.message || 'Unknown error');
    }

    return response.data.data;
};

// Batch Analysis APIs

export interface BatchJobResponse {
    batch_id: string;
    cv_count: number;
    status: string;
    estimated_completion_minutes: number;
    websocket_url: string;
}

export interface BatchStatusResponse {
    batch_id: string;
    cv_count: number;
    completed_count: number;
    status: string;
    total_cost_usd: number;
    created_at: string;
    completed_at: string | null;
}

export const batchAnalyze = async (
    cvFiles: File[],
    jobDescription: string | File,
    llmProvider: string = 'claude-3-5-sonnet-20241022'
): Promise<BatchJobResponse> => {
    const formData = new FormData();

    cvFiles.forEach((file) => {
        formData.append('cv_files', file);
    });

    if (typeof jobDescription === 'string') {
        formData.append('job_description', jobDescription);
    } else {
        formData.append('job_description_file', jobDescription);
    }

    formData.append('llm_provider', llmProvider);

    const response = await apiClient.post<BatchJobResponse>(
        '/api/batch',
        formData,
        {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000, // 2 minutes for upload
        }
    );

    return response.data;
};

export const getBatchStatus = async (batchId: string): Promise<BatchStatusResponse> => {
    const response = await apiClient.get<BatchStatusResponse>(
        `/api/batch/${batchId}`
    );
    return response.data;
};

export interface BatchResultsResponse {
    batch_id: string;
    status: string;
    cv_count: number;
    completed_count: number;
    total_cost_usd: number;
    results: AnalysisResult[];
}

export const getBatchResults = async (batchId: string): Promise<BatchResultsResponse> => {
    const response = await apiClient.get<BatchResultsResponse>(
        `/api/batch/${batchId}/results`
    );
    return response.data;
};

// Analytics APIs

export interface SuccessPredictionResponse {
    status: string;
    candidate_id: string;
    candidate_name: string;
    prediction: {
        success_probability_percent: number;
        expected_tenure_years: number;
        risk_factors: string[];
        success_drivers: string[];
        model_confidence: string;
    }
}

export const getSuccessPrediction = async (analysisId: string): Promise<SuccessPredictionResponse> => {
    const response = await apiClient.get<SuccessPredictionResponse>(
        `/api/analytics/candidate/${analysisId}/success-prediction`
    );
    return response.data;
};

export interface DiversityAnalyticsResponse {
    status: string;
    batch_id: string;
    analytics: {
        total_candidates_analyzed: number;
        institutional_diversity: {
            unique_institutions: number;
            score: number;
        };
        simulated_demographics: {
            gender: { female: number; male: number; non_binary_or_undisclosed: number };
            ethnicity: { underrepresented: number; majority: number; undisclosed: number };
        };
        inclusivity_index: number;
        systemic_bias_warnings: string[];
        recommendation: string;
    }
}

export const getDiversityAnalytics = async (batchId: string): Promise<DiversityAnalyticsResponse> => {
    const response = await apiClient.get<DiversityAnalyticsResponse>(
        `/api/analytics/batch/${batchId}/diversity`
    );
    return response.data;
};

// ---------------------------------------------------------------------------
// Interview Prep
// ---------------------------------------------------------------------------

export const getInterviewPrep = async (analysisId: string): Promise<InterviewPrepResponse> => {
    const response = await apiClient.get<InterviewPrepResponse>(
        `/api/analyze/${analysisId}/interview-prep`
    );
    return response.data;
};

// ---------------------------------------------------------------------------
// Committee Collaboration
// ---------------------------------------------------------------------------

export const createCommittee = async (
    batchId: string,
    name: string,
    creatorName: string,
    creatorEmail: string,
): Promise<CommitteeResponse> => {
    const response = await apiClient.post<CommitteeResponse>('/api/committee', {
        batch_id: batchId,
        name,
        creator_name: creatorName,
        creator_email: creatorEmail,
    });
    return response.data;
};

export const joinCommittee = async (
    committeeId: string,
    name: string,
    email: string,
): Promise<CommitteeJoinResponse> => {
    const response = await apiClient.post<CommitteeJoinResponse>(
        `/api/committee/${committeeId}/join`,
        { name, email },
    );
    return response.data;
};

export const submitVote = async (
    committeeId: string,
    candidateId: string,
    vote: string,
    sessionToken: string,
    comment?: string,
): Promise<void> => {
    await apiClient.post(
        `/api/committee/${committeeId}/vote`,
        { candidate_id: candidateId, vote, comment },
        { headers: { Authorization: `Bearer ${sessionToken}` } },
    );
};

export const getVotes = async (committeeId: string, candidateId: string): Promise<VoteTallyResponse> => {
    const response = await apiClient.get<VoteTallyResponse>(
        `/api/committee/${committeeId}/votes/${candidateId}`
    );
    return response.data;
};

export const addComment = async (
    committeeId: string,
    candidateId: string,
    comment: string,
    sessionToken: string,
    parentId?: string,
): Promise<CommentItem> => {
    const response = await apiClient.post<CommentItem>(
        `/api/committee/${committeeId}/comment`,
        { candidate_id: candidateId, comment, parent_id: parentId },
        { headers: { Authorization: `Bearer ${sessionToken}` } },
    );
    return response.data;
};

export const getComments = async (committeeId: string, candidateId: string): Promise<{ comments: CommentItem[] }> => {
    const response = await apiClient.get<{ comments: CommentItem[] }>(
        `/api/committee/${committeeId}/comments/${candidateId}`
    );
    return response.data;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authRegister = async (email: string, name: string, password: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/register', { email, name, password });
    return response.data;
};

export const authLogin = async (email: string, password: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/login', { email, password });
    return response.data;
};

// ---------------------------------------------------------------------------
// Candidate Platform
// ---------------------------------------------------------------------------

export const createCandidateProfile = async (data: {
    email: string; name: string; institution?: string; orcid_id?: string;
    h_index?: number; research_areas?: string[]; bio?: string; job_preferences?: Record<string, any>;
}): Promise<{ status: string; profile: CandidateProfile }> => {
    const response = await apiClient.post('/api/candidate/profile', data);
    return response.data;
};

export const getCandidateProfileByEmail = async (email: string): Promise<{ status: string; profile: CandidateProfile } | null> => {
    try {
        const response = await apiClient.get(`/api/candidate/profile/me`, { params: { email } });
        return response.data;
    } catch {
        return null;
    }
};

export const updateCandidateProfile = async (
    profileId: string, data: Partial<CandidateProfile>
): Promise<{ status: string; profile: CandidateProfile }> => {
    const response = await apiClient.put(`/api/candidate/profile/${profileId}`, data);
    return response.data;
};

export const verifyORCID = async (
    profileId: string, orcidId: string
): Promise<{ status: string; profile: CandidateProfile; orcid_parsed: Record<string, any> }> => {
    const response = await apiClient.post(`/api/candidate/profile/${profileId}/verify-orcid`, { orcid_id: orcidId });
    return response.data;
};

export const listJobPostings = async (positionType?: string): Promise<{ status: string; jobs: JobPosting[] }> => {
    const response = await apiClient.get('/api/candidate/jobs', { params: positionType ? { position_type: positionType } : {} });
    return response.data;
};

export const createJobPosting = async (data: {
    title: string; institution: string; position_type: string; description: string;
    created_by_email: string; department?: string; requirements?: Record<string, any>;
    salary_range?: Record<string, any>; location?: string; deadline?: string;
}): Promise<{ status: string; job: JobPosting }> => {
    const response = await apiClient.post('/api/candidate/jobs', data);
    return response.data;
};

export const applyToJob = async (
    jobId: string,
    data: { candidate_profile_id: string; analysis_id?: string; cover_note?: string }
): Promise<{ status: string; application: JobApplication }> => {
    const response = await apiClient.post(`/api/candidate/jobs/${jobId}/apply`, data);
    return response.data;
};

export const getMyApplications = async (email: string): Promise<{ status: string; applications: JobApplication[] }> => {
    const response = await apiClient.get('/api/candidate/applications', { params: { email } });
    return response.data;
};

export const updateApplicationStatus = async (
    applicationId: string, status: string, note?: string
): Promise<{ status: string; application: JobApplication }> => {
    const response = await apiClient.put(`/api/candidate/applications/${applicationId}/status`, { status, note });
    return response.data;
};

// ---------------------------------------------------------------------------
// Developer Ecosystem / Marketplace
// ---------------------------------------------------------------------------

export const registerDeveloperApp = async (data: {
    name: string; developer_email: string; description?: string;
    webhook_url?: string; category?: string;
}): Promise<AppRegisterResponse> => {
    const response = await apiClient.post('/api/v1/public/apps/register', data);
    return response.data;
};

export const getMarketplaceApps = async (category?: string): Promise<{ status: string; apps: any[] }> => {
    const response = await apiClient.get('/api/v1/public/marketplace', { params: category ? { category } : {} });
    return response.data;
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const updateApiKeys = async (keys: {
    anthropic?: string;
    openai?: string;
    gemini?: string;
}): Promise<{ status: string; message: string }> => {
    const response = await apiClient.post('/api/settings/keys', keys);
    return response.data;
};
